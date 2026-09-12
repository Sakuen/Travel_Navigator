"""Offline regressions. Run: python -m unittest discover -s backend -p test_planning.py"""
import json
import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
import db
import main
import agent
import ai_status
from google.genai.errors import ClientError, ServerError
from langchain_core.messages import AIMessage
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from models import TripContext, DestinationResponse
from recommendations import golden_week_conflict, finalize_recommendations, extract_research, research_prompt


def card(name="Kyoto, Japan", code="JP", identifier="kyoto"):
    return {"id": identifier, "name": name, "country_code": code, "image_url": "city",
            "the_why": "Quiet walks", "the_but": "Check dates", "suitability": "recommended",
            "tags": [], "source_ids": []}


class PlanningTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db_patch = patch.object(db, "DB_PATH", os.path.join(self.temp.name, "travel.sqlite3"))
        self.legacy_patch = patch.object(db, "LEGACY_PATH", os.path.join(self.temp.name, "db.json"))
        self.db_patch.start()
        self.legacy_patch.start()
        self.addCleanup(self.db_patch.stop)
        self.addCleanup(self.legacy_patch.stop)
        self.client = TestClient(main.app)

    def test_golden_week_boundaries_and_opt_in(self):
        for start, end, expected in [("2027-04-20", "2027-04-28", False),
                                     ("2027-04-29", "2027-04-29", True),
                                     ("2027-05-06", "2027-05-06", True),
                                     ("2027-05-07", "2027-05-15", False),
                                     ("2026-12-20", "2027-05-02", True)]:
            context = {"start_date": start, "end_date": end}
            self.assertEqual(golden_week_conflict(card(), context), expected)
            self.assertFalse(golden_week_conflict(card("Rome", "IT"), context))
            self.assertFalse(golden_week_conflict(card(), {**context, "avoid_peak_periods": False}))

    def test_vague_dates_are_not_confirmed(self):
        result = finalize_recommendations([card()], {"dates": "spring"}, {"sources": []})
        self.assertFalse(result["dates_confirmed"])
        self.assertEqual(result["destinations"][0]["research_status"], "unverified")
        self.assertEqual(result["destinations"][0]["suitability"], "caution")

    def test_filtered_holidays_and_untrusted_source_ids(self):
        other = {**card("Rome", "IT", "rome"), "source_ids": [0, 99, 0]}
        result = finalize_recommendations([card(), other],
            {"start_date": "2027-04-28", "end_date": "2027-05-08"},
            {"sources": [{"id": 0, "url": "https://example.com", "title": "Source"}], "checked_at": "today"})
        self.assertEqual([c["id"] for c in result["destinations"]], ["rome"])
        self.assertEqual(len(result["destinations"][0]["sources"]), 1)
        self.assertIn("Golden Week", result["excluded"][0]["reason"])

    def test_date_validation(self):
        for values in [{"start_date": "2027-05-01"},
                       {"start_date": "2027-05-02", "end_date": "2027-05-01"},
                       {"start_date": "2027-01-01", "end_date": "2030-01-01"}]:
            response = self.client.post("/api/destinations", json={"current_state": {"trip_context": values}})
            self.assertEqual(response.status_code, 422)

    def test_legacy_import_once_leaves_original_unchanged(self):
        legacy = {"Sascha": {**db.empty_profile(), "past_trips": [{"id": "old", "notes": "Café"}]}}
        original = json.dumps(legacy, ensure_ascii=False)
        with open(db.LEGACY_PATH, "w", encoding="utf-8") as stream:
            stream.write(original)
        self.assertEqual(db.get_user_data("Sascha")["past_trips"][0]["notes"], "Café")
        db.delete_past_trip("Sascha", "old")
        self.assertEqual(db.get_user_data("Sascha")["past_trips"], [])
        with open(db.LEGACY_PATH, encoding="utf-8") as stream:
            self.assertEqual(stream.read(), original)

    def test_concurrent_saves_do_not_drop_trips(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda i: db.save_past_trip("Sascha", {"id": str(i)}), range(12)))
        self.assertEqual(len(db.get_user_data("Sascha")["past_trips"]), 12)

    def test_save_reopen_update_and_stale_revision(self):
        trip = {"trip_title": "Italy", "total_days": 1, "general_summary": "Walks",
                "daily_summaries": [{"day_number": 1, "title": "Rome", "summary": "Walk", "lat": 41.9, "lng": 12.5}],
                "destination": card("Rome", "IT"), "trip_context": {"budget": "CHF 2000"},
                "daily_details": {"1": {"day_number": 1, "day_title": "Rome", "items": [
                    {"time": "10:00", "title": "Our walk", "description": "Edited by us", "location_name": "Rome",
                     "lat": 41.9, "lng": 12.5, "action_type": "Walk"}]}}}
        result = self.client.post("/api/users/Sascha/trips", json={"username": "Sascha", "trip": trip})
        self.assertEqual(result.status_code, 200, result.text)
        saved = result.json()["trip"]
        reopened = self.client.get("/api/users/Sascha").json()["saved_trips"][0]
        self.assertEqual(reopened, saved)
        self.assertEqual(saved["daily_details"]["1"]["items"][0]["description"], "Edited by us")
        updated = self.client.post("/api/users/Sascha/trips", json={"username": "Sascha", "trip": saved})
        self.assertEqual(updated.json()["trip"]["revision"], 2)
        stale = self.client.post("/api/users/Sascha/trips", json={"username": "Sascha", "trip": saved})
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(len(db.get_user_data("Sascha")["saved_trips"]), 1)

    def test_recommendation_reloads_latest_history_and_feedback(self):
        trip = {"id": "past", "year": 2025, "countries": ["Italy"], "rating": 5,
                "liked": ["Quiet walks"], "disliked": ["Queues"], "would_revisit": True, "stops": []}
        response = self.client.post("/api/users/Sascha/past-trips", json={"username": "Sascha", "trip": trip})
        self.assertEqual(response.status_code, 200)
        with patch.object(main, "generate_destinations", return_value={"destinations": []}) as generate:
            self.client.post("/api/destinations", json={"current_state": {"username": "Sascha", "past_trips": []}})
            history = generate.call_args.args[0]["past_trips"]
        self.assertEqual(history[0]["liked"], ["Quiet walks"])
        self.assertEqual(history[0]["would_revisit"], True)

    def test_day_generation_receives_saved_plan(self):
        overview = {"trip_title": "Italy", "total_days": 1, "general_summary": "Walks",
                    "daily_summaries": [{"day_number": 1, "title": "Rome", "summary": "Walk", "lat": 41.9, "lng": 12.5}]}
        with patch.object(main, "generate_daily_itinerary", return_value={"items": []}) as generate:
            response = self.client.post("/api/itinerary/daily", json={"destination": card(), "current_state": {}, "day_number": 1, "overview": overview})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(generate.call_args.kwargs["overview"], overview | {"daily_summaries": [overview["daily_summaries"][0] | {"image_url": None}]})

    def test_itinerary_cannot_bypass_golden_week_guard(self):
        response = self.client.post("/api/itinerary", json={"destination": card(), "current_state": {
            "trip_context": {"start_date": "2027-05-01", "end_date": "2027-05-05"}}})
        self.assertEqual(response.status_code, 422)

    def test_research_does_not_send_private_history(self):
        prompt = research_prompt([card()], {"dates": "May 2027", "notes": "PRIVATE", "username": "PRIVATE"})
        self.assertNotIn("PRIVATE", prompt)

    def test_only_provider_citations_are_accepted(self):
        message = SimpleNamespace(content="Invented link https://fake.example", content_blocks=[], response_metadata={})
        self.assertEqual(extract_research(message)["sources"], [])
        message.response_metadata = {"grounding_metadata": {"grounding_chunks": [{"web": {"uri": "https://japan.travel", "title": "Official"}}, {"web": {"uri": "javascript:alert(1)"}}]}}
        self.assertEqual(len(extract_research(message)["sources"]), 1)

    def test_search_failure_remains_provisional(self):
        response = DestinationResponse(destinations=[card("Rome", "IT")])
        model = unittest.mock.MagicMock()
        model.bind_tools.return_value.invoke.side_effect = RuntimeError("Search down")
        with patch.object(agent, "get_llm", return_value=model), patch.object(agent, "safe_invoke", return_value=response):
            result = agent.generate_destinations({"trip_context": {}})
        self.assertEqual(result["destinations"][0]["research_status"], "unverified")

    def test_completion_connects_feedback_without_inventing_actual_stops(self):
        saved = db.save_user_trip("Sascha", {"trip_title": "A plan", "daily_summaries": [{"title": "Planned museum"}]})
        actual = {"id": saved["id"], "year": 2026, "title": "Our trip", "countries": ["Italy"],
                  "rating": 4, "notes": "We spent the afternoon walking.", "liked": ["Walking"], "stops": []}
        response = self.client.post(f"/api/users/Sascha/trips/{saved['id']}/complete", json={
            "username": "Sascha", "revision": saved["revision"], "trip": actual})
        self.assertEqual(response.status_code, 200, response.text)
        profile = db.get_user_data("Sascha")
        self.assertEqual(profile["saved_trips"][0]["status"], "completed")
        self.assertEqual(profile["past_trips"][0]["stops"], [])
        self.assertEqual(main.planning_state({"username": "Sascha"})["past_trips"][0]["liked"], ["Walking"])
        stale = self.client.post(f"/api/users/Sascha/trips/{saved['id']}/complete", json={
            "username": "Sascha", "revision": saved["revision"], "trip": actual})
        self.assertEqual(stale.status_code, 409)

    def test_summary_cannot_overwrite_newer_memories(self):
        original = {"id": "trip", "notes": "Old note"}
        db.save_past_trip("Sascha", original)
        db.save_past_trip("Sascha", {**original, "notes": "New note"})
        with self.assertRaises(db.RevisionConflict):
            db.save_trip_story("Sascha", "trip", original, {"title": "Old summary"})
        self.assertNotIn("generated_story", db.get_user_data("Sascha")["past_trips"][0])

    def test_guest_keeps_session_preferences(self):
        state = main.planning_state({"username": "Guest", "user_dna": {"soft_likes": ["Hiking"]}})
        self.assertEqual(state["user_dna"]["soft_likes"], ["Hiking"])


class AiStatusTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        patcher = patch.object(ai_status, "STATUS_PATH", os.path.join(self.temp.name, "usage.sqlite3"))
        patcher.start()
        self.addCleanup(patcher.stop)
        self.client = TestClient(main.app, raise_server_exceptions=False)

    def quota_error(self):
        return ClientError(429, {"error": {"status": "RESOURCE_EXHAUSTED", "message": "Quota exceeded",
            "details": [{"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "12.5s"}]}})

    def test_quota_failure_is_not_retried(self):
        model = unittest.mock.MagicMock()
        model.invoke.side_effect = self.quota_error()
        with patch.object(agent.time, "sleep") as sleep:
            with self.assertRaises(ai_status.AIServiceError) as error:
                agent.safe_invoke(model, [])
        self.assertEqual(error.exception.status_code, 429)
        self.assertEqual(error.exception.retry_after, 13)
        self.assertEqual(model.invoke.call_count, 1)
        sleep.assert_not_called()

    def test_transient_failure_has_only_one_retry(self):
        model = unittest.mock.MagicMock()
        model.invoke.side_effect = [ServerError(503, {"error": {"message": "Unavailable"}}), "ok"]
        with patch.object(agent.time, "sleep"):
            self.assertEqual(agent.safe_invoke(model, []), "ok")
        self.assertEqual(model.invoke.call_count, 2)

    def test_quota_response_preserves_http_status_and_retry_hint(self):
        with patch.object(main, "generate_destinations", side_effect=self.quota_error()):
            response = self.client.post("/api/destinations", json={"current_state": {}})
        self.assertEqual(response.status_code, 429, response.text)
        self.assertEqual(response.headers["retry-after"], "13")
        self.assertEqual(response.json()["detail"]["code"], "quota_exceeded")

    def test_model_setup_failure_no_longer_becomes_generic_500(self):
        with patch.object(agent, "get_llm", side_effect=ValueError("Missing key")):
            response = self.client.post("/api/destinations", json={"current_state": {}})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"]["code"], "configuration_error")

    def test_review_quota_failure_preserves_provisional_candidates(self):
        model = unittest.mock.MagicMock()
        model.bind_tools.return_value.invoke.return_value = SimpleNamespace(content="Weather evidence", content_blocks=[],
            response_metadata={"grounding_metadata": {"grounding_chunks": [{"web": {"uri": "https://example.com", "title": "Weather"}}]}})
        candidates = DestinationResponse(destinations=[card("Rome", "IT", "rome")])
        with patch.object(agent, "get_llm", return_value=model), patch.object(agent, "safe_invoke", side_effect=[candidates, self.quota_error()]):
            result = agent.generate_destinations({"trip_context": {}})
        self.assertEqual(result["destinations"][0]["id"], "rome")
        self.assertEqual(result["destinations"][0]["research_status"], "unverified")
        self.assertEqual(result["research_error"]["code"], "quota_exceeded")

    def test_callback_records_tokens_without_private_content(self):
        message = AIMessage(content="PRIVATE response", usage_metadata={"input_tokens": 10, "output_tokens": 4, "total_tokens": 14})
        model = GenericFakeChatModel(messages=iter([message]), callbacks=[ai_status.UsageTracker("test-model")])
        model.invoke("PRIVATE prompt")
        snapshot = ai_status.usage_snapshot("test-model")
        self.assertEqual(snapshot["requests"], 1)
        self.assertEqual(snapshot["total_tokens"], 14)
        self.assertIsNone(snapshot["remaining_tokens"])
        with ai_status.usage_db() as conn:
            stored = str(dict(conn.execute("SELECT * FROM calls").fetchone()))
        self.assertNotIn("PRIVATE", stored)

    def test_failed_calls_do_not_claim_zero_consumed_tokens(self):
        tracker = ai_status.UsageTracker("test-model")
        tracker.on_chat_model_start({}, [], run_id="error-call")
        tracker.on_llm_error(self.quota_error(), run_id="error-call")
        snapshot = ai_status.usage_snapshot("test-model")
        self.assertEqual(snapshot["failed_requests"], 1)
        self.assertIsNone(snapshot["total_tokens"])
        self.assertEqual(snapshot["latest_error"]["retry_after_seconds"], 13)

    def test_usage_storage_failure_does_not_break_generation(self):
        message = AIMessage(content="ok")
        model = GenericFakeChatModel(messages=iter([message]), callbacks=[ai_status.UsageTracker("test-model")])
        with patch.object(ai_status, "usage_db", side_effect=OSError("Disk unavailable")), self.assertLogs("ai_status", level="WARNING"):
            self.assertEqual(model.invoke("hello").content, "ok")

    def test_usage_is_scoped_to_key_and_model(self):
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "first-test-key"}):
            tracker = ai_status.UsageTracker("first-model")
            tracker.on_chat_model_start({}, [], run_id="one")
            self.assertEqual(ai_status.usage_snapshot("different-model")["requests"], 0)
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "second-test-key"}):
            self.assertEqual(ai_status.usage_snapshot("first-model")["requests"], 0)

    def test_unknown_server_error_returns_reference_not_secrets(self):
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "sensitive-test-key"}), patch.object(main, "planning_state", side_effect=RuntimeError("sensitive-test-key")), self.assertLogs("main", level="ERROR") as logs:
            response = self.client.post("/api/destinations", json={"current_state": {}})
        self.assertEqual(response.status_code, 500)
        self.assertIn("reference", response.json()["detail"]["message"])
        self.assertNotIn("sensitive-test-key", response.text)
        self.assertNotIn("sensitive-test-key", "".join(logs.output))

    def test_usage_endpoint_does_not_call_gemini(self):
        with patch.object(agent, "get_llm") as model:
            response = self.client.get("/api/ai/usage?model_name=test-model")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["remaining_tokens"])
        model.assert_not_called()


class DreamTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        for name, filename in [("DB_PATH", "travel.sqlite3"), ("LEGACY_PATH", "missing.json")]:
            patcher = patch.object(db, name, os.path.join(self.temp.name, filename))
            patcher.start()
            self.addCleanup(patcher.stop)
        self.client = TestClient(main.app)
        self.base = "/api/users/Sascha/dreams"

    def create(self, **changes):
        response = self.client.post(self.base, json={"title": "Japan someday", "countries": ["Japan"],
            "notes": "Try a pottery class. Budget undecided.", "links": ["https://example.com/ideas"],
            "stops": [{"city": "Kyoto", "hotel": "Possible stay", "lat": 35, "lng": 135}], **changes})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["dream"]

    def completion(self, dream):
        return {"username": "Sascha", "revision": dream["revision"], "trip": {
            "id": "must-not-overwrite", "year": 2025, "title": "Our Japan trip", "countries": ["Japan"],
            "rating": 4, "notes": "We enjoyed the gardens.", "stops": [{"city": "Tokyo"}], "liked": ["gardens"]}}

    def test_dreams_are_persistent_isolated_and_not_visited(self):
        dream = self.create()
        self.assertEqual(self.client.get(self.base).json()["dreams"], [dream])
        self.assertEqual(self.client.get("/api/users/Jacky/dreams").json()["dreams"], [])
        self.assertEqual(db.get_user_data("Sascha")["past_trips"], [])
        self.assertEqual(main.planning_state({"username": "Sascha"})["past_trips"], [])

    def test_edit_delete_conflicts_and_no_resurrection(self):
        dream = self.create()
        newer = self.client.post(self.base, json={**dream, "notes": "Updated notes"}).json()["dream"]
        self.assertEqual(self.client.post(self.base, json=dream).status_code, 409)
        self.assertEqual(self.client.delete(f'{self.base}/{dream["id"]}?revision=1').status_code, 409)
        self.assertEqual(self.client.delete(f'{self.base}/{dream["id"]}?revision={newer["revision"]}').status_code, 200)
        self.assertEqual(self.client.post(self.base, json=newer).status_code, 404)

    def test_validation_rejects_unsafe_links_and_coordinates(self):
        for values in [{"title": " "}, {"links": ["javascript:alert(1)"]}, {"links": ["https://user:password@example.com"]},
                       {"stops": [{"city": "Kyoto", "lat": 100, "lng": 0}]}, {"stops": [{"city": "Kyoto", "lat": 35}]}]:
            self.assertEqual(self.client.post(self.base, json={"title": "Dream", **values}).status_code, 422)

    def test_summary_uses_saved_notes_selected_model_and_invalidates_after_edit(self):
        import dreams
        from models import DreamSummary
        dream = self.create()
        summary = DreamSummary(title="A creative escape", overview="Pottery is on the wishlist.", open_questions=["Budget?"])
        with patch.object(dreams, "get_llm") as llm, patch.object(dreams, "safe_invoke", return_value=summary) as invoke:
            response = self.client.post(f'{self.base}/{dream["id"]}/summary', json={"model_name": "selected-model"})
        self.assertEqual(response.status_code, 200)
        llm.assert_called_once_with("selected-model")
        prompt = invoke.call_args.args[1][0].content
        self.assertIn(dream["notes"], prompt)
        self.assertIn(dream["links"][0], prompt)
        self.assertIn("have NOT read", prompt)
        saved = response.json()["dream"]
        self.assertEqual(saved["revision"], 2)
        self.assertEqual(saved["generated_summary"], summary.model_dump())
        response = self.client.post(self.base, json={**saved, "notes": "New research"})
        self.assertNotIn("generated_summary", response.json()["dream"])

    def test_summary_cannot_overwrite_concurrent_edit(self):
        import dreams
        from models import DreamSummary
        dream = self.create()
        def during_generation(*args):
            db.save_dream("Sascha", {**dream, "notes": "Latest research"})
            return DreamSummary(title="Old", overview="Outdated")
        with patch.object(dreams, "get_llm"), patch.object(dreams, "safe_invoke", side_effect=during_generation):
            response = self.client.post(f'{self.base}/{dream["id"]}/summary', json={})
        self.assertEqual(response.status_code, 409)
        saved = self.client.get(self.base).json()["dreams"][0]
        self.assertEqual(saved["notes"], "Latest research")
        self.assertNotIn("generated_summary", saved)

    def test_completion_atomic_preserves_research_and_uses_actual_visits(self):
        dream = self.create()
        existing = {"id": "must-not-overwrite", "title": "Existing memory"}
        db.save_past_trip("Sascha", existing)
        payload = self.completion(dream)
        response = self.client.post(f'{self.base}/{dream["id"]}/complete', json=payload)
        self.assertEqual(response.status_code, 200)
        trip = response.json()["trip"]
        self.assertNotEqual(trip["id"], existing["id"])
        self.assertEqual(trip["stops"][0]["city"], "Tokyo")
        self.assertNotIn("pottery", trip["notes"])
        profile = db.get_user_data("Sascha")
        self.assertEqual(len(profile["past_trips"]), 2)
        self.assertIn(existing, profile["past_trips"])
        archived = profile["dreams"][0]
        self.assertEqual(archived["notes"], dream["notes"])
        self.assertEqual(archived["links"], dream["links"])
        self.assertEqual(archived["completed_trip_id"], trip["id"])
        self.assertEqual(self.client.post(f'{self.base}/{dream["id"]}/complete', json=payload).status_code, 409)
        self.assertEqual(self.client.post(self.base, json=archived).status_code, 409)
        self.client.delete(f'{self.base}/{dream["id"]}?revision={archived["revision"]}')
        self.assertEqual(len(db.get_user_data("Sascha")["past_trips"]), 2)

    def test_invalid_completion_leaves_dream_untouched(self):
        dream = self.create()
        for changes in [{"countries": []}, {"year": 2999}, {"rating": 0}]:
            payload = self.completion(dream)
            payload["trip"].update(changes)
            self.assertEqual(self.client.post(f'{self.base}/{dream["id"]}/complete', json=payload).status_code, 422)
        self.assertEqual(self.client.get(self.base).json()["dreams"], [dream])
        self.assertEqual(db.get_user_data("Sascha")["past_trips"], [])


if __name__ == "__main__":
    unittest.main()
