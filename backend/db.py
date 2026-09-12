"""Transactional local storage. The original JSON is imported once and left intact."""
import json
import os
import sqlite3
from contextlib import contextmanager
from uuid import uuid4

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "travel.sqlite3")
LEGACY_PATH = os.path.join(os.path.dirname(__file__), "data", "db.json")


def empty_profile():
    return {"user_dna": {"hard_nos": [], "soft_likes": [], "past_footprints": []},
            "saved_trips": [], "past_trips": [], "dreams": []}


class RevisionConflict(Exception):
    pass


@contextmanager
def connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=15)
    try:
        with conn:
            conn.execute("BEGIN IMMEDIATE")
            conn.execute("CREATE TABLE IF NOT EXISTS profiles (username TEXT PRIMARY KEY, data TEXT NOT NULL)")
            conn.execute("CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)")
            if not conn.execute("SELECT 1 FROM migrations WHERE name = 'json-import'").fetchone():
                data = {name: empty_profile() for name in ("Jacky", "Sascha", "Guest")}
                if os.path.exists(LEGACY_PATH):
                    with open(LEGACY_PATH, encoding="utf-8-sig") as source:
                        data.update(json.load(source))
                for username, profile in data.items():
                    conn.execute("INSERT OR IGNORE INTO profiles VALUES (?, ?)",
                                 (username, json.dumps(profile, ensure_ascii=False)))
                conn.execute("INSERT INTO migrations VALUES ('json-import')")
            yield conn
    finally:
        conn.close()


def get_user_data(username):
    with connection() as conn:
        row = conn.execute("SELECT data FROM profiles WHERE username = ?", (username,)).fetchone()
        return json.loads(row[0]) if row else empty_profile()


def mutate_profile(username, change):
    with connection() as conn:
        row = conn.execute("SELECT data FROM profiles WHERE username = ?", (username,)).fetchone()
        if not row:
            raise KeyError("Unknown profile")
        data = json.loads(row[0])
        result = change(data)
        conn.execute("UPDATE profiles SET data = ? WHERE username = ?",
                     (json.dumps(data, ensure_ascii=False), username))
        return result


def update_user_dna(username, dna):
    if username != "Guest":
        mutate_profile(username, lambda data: data.update(user_dna=dna))


def reset_user_dna(username):
    update_user_dna(username, empty_profile()["user_dna"])


def save_user_trip(username, trip):
    def change(data):
        trip_id = trip.get("id") or str(uuid4())
        trips = data.setdefault("saved_trips", [])
        old = next((t for t in trips if t.get("id") == trip_id), None)
        if old and old.get("revision", 0) != trip.get("revision", 0):
            raise RevisionConflict("This trip changed in another window. Reopen it before saving.")
        saved = {**trip, "id": trip_id, "revision": (old or {}).get("revision", 0) + 1}
        data["saved_trips"] = [t for t in trips if t.get("id") != trip_id] + [saved]
        return saved
    return mutate_profile(username, change)


def delete_user_trip(username, trip_id):
    mutate_profile(username, lambda data: data.update(
        saved_trips=[t for t in data.get("saved_trips", []) if t.get("id") != trip_id]))


def save_past_trip(username, trip):
    def change(data):
        data["past_trips"] = [t for t in data.get("past_trips", []) if t.get("id") != trip.get("id")] + [trip]
    mutate_profile(username, change)


def delete_past_trip(username, trip_id):
    mutate_profile(username, lambda data: data.update(
        past_trips=[t for t in data.get("past_trips", []) if t.get("id") != trip_id]))


def complete_user_trip(username, trip_id, revision, actual_trip):
    def change(data):
        saved = next((t for t in data.get("saved_trips", []) if t.get("id") == trip_id), None)
        if not saved:
            raise KeyError("Trip not found")
        if saved.get("revision", 0) != revision:
            raise RevisionConflict("This trip changed. Reopen it before completing it.")
        saved.update(status="completed", revision=revision + 1)
        data["past_trips"] = [t for t in data.get("past_trips", []) if t.get("id") != trip_id] + [actual_trip]
        return saved
    return mutate_profile(username, change)


def save_trip_story(username, trip_id, original, story):
    def change(data):
        trip = next((t for t in data.get("past_trips", []) if t.get("id") == trip_id), None)
        if trip is None:
            raise KeyError("Trip not found")
        if trip != original:
            raise RevisionConflict("Your memories changed while the summary was being written. Please retry.")
        trip["generated_story"] = story
    mutate_profile(username, change)


def save_dream(username, dream):
    def change(data):
        dreams = data.setdefault("dreams", [])
        old = next((d for d in dreams if d["id"] == dream.get("id")), None)
        if dream.get("id") and old is None:
            raise KeyError("Dream not found")
        if old and (old["revision"] != dream["revision"] or old.get("status") == "completed"):
            raise RevisionConflict("This dream changed or was completed. Reload before editing.")
        saved = {**dream, "id": old["id"] if old else str(uuid4()),
                 "revision": (old["revision"] if old else 0) + 1, "status": "dreaming"}
        data["dreams"] = [d for d in dreams if d["id"] != saved["id"]] + [saved]
        return saved
    return mutate_profile(username, change)


def delete_dream(username, dream_id, revision):
    def change(data):
        dream = next((d for d in data.get("dreams", []) if d["id"] == dream_id), None)
        if not dream:
            raise KeyError("Dream not found")
        if dream["revision"] != revision:
            raise RevisionConflict("This dream changed. Reload before deleting.")
        data["dreams"] = [d for d in data["dreams"] if d["id"] != dream_id]
    mutate_profile(username, change)


def save_dream_summary(username, dream_id, original, summary):
    def change(data):
        dream = next((d for d in data.get("dreams", []) if d["id"] == dream_id), None)
        if not dream:
            raise KeyError("Dream not found")
        if dream != original:
            raise RevisionConflict("Your dream changed while the summary was written. Reload and retry.")
        dream["generated_summary"] = summary
        dream["revision"] += 1
        return dream
    return mutate_profile(username, change)


def complete_dream(username, dream_id, revision, actual_trip):
    def change(data):
        dream = next((d for d in data.get("dreams", []) if d["id"] == dream_id), None)
        if not dream:
            raise KeyError("Dream not found")
        if dream.get("status") == "completed" or dream["revision"] != revision:
            raise RevisionConflict("This dream changed or was already completed. Reload before continuing.")
        # Generate the trip ID on the server; a conversion must never replace an existing trip.
        trip = {**actual_trip, "id": str(uuid4())}
        data.setdefault("past_trips", []).append(trip)
        dream.update(status="completed", completed_trip_id=trip["id"], revision=revision + 1)
        return trip
    return mutate_profile(username, change)
