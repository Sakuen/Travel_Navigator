"""Safe provider errors and local, metadata-only usage accounting.

These counters are not Google's project quota: other apps/keys are invisible here.
"""
import hashlib
import json
import logging
import math
import os
import re
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from langchain_core.callbacks import BaseCallbackHandler

STATUS_PATH = os.path.join(os.path.dirname(__file__), "data", "ai_usage.sqlite3")
AI_STUDIO_URL = "https://aistudio.google.com/usage?tab=rate-limit"
logger = logging.getLogger(__name__)


class AIServiceError(RuntimeError):
    def __init__(self, code, message, status_code=503, retry_after=None):
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.retry_after = retry_after

    def public_detail(self):
        return {"code": self.code, "message": str(self), "retry_after_seconds": self.retry_after,
                "quota_url": AI_STUDIO_URL if self.code == "quota_exceeded" else None}


def redact(text):
    for name in ("GOOGLE_API_KEY", "GEMINI_API_KEY"):
        key = os.getenv(name)
        if key:
            text = text.replace(key, "[redacted]")
    text = re.sub(r"AIza[\w-]+", "[redacted]", text)
    return re.sub(r"([?&](?:key|api_key)=)[^&\s'\"]+", r"\1[redacted]", text, flags=re.I)


def classify_error(error):
    if isinstance(error, AIServiceError):
        return error
    chain, current = [], error
    while current is not None and len(chain) < 8 and all(current is not e for e in chain):
        chain.append(current)
        current = current.__cause__ or current.__context__
    text = " ".join(str(e) for e in chain).lower()
    codes = {str(getattr(e, "code", "")) for e in chain}
    if "429" in codes or "resource_exhausted" in text or re.search(r"\b429\b", text):
        # Prefer Google's structured RetryInfo; older adapters include it in the message.
        retry = None
        for exc in chain:
            details = getattr(exc, "details", {})
            if isinstance(details, dict):
                details = details.get("error", details).get("details", [])
            if isinstance(details, list):
                for item in details:
                    if isinstance(item, dict) and item.get("@type", "").endswith("RetryInfo"):
                        match = re.fullmatch(r"([0-9.]+)s", str(item.get("retryDelay", "")))
                        if match:
                            retry = math.ceil(float(match[1]))
        if retry is None:
            match = re.search(r"retry (?:in|after)\s+([0-9.]+)s", text)
            if match:
                retry = math.ceil(float(match[1]))
        message = "Gemini's request or token quota was reached for this model/project."
        if "perday" in text or "per_day" in text or "daily" in text:
            message += " A daily limit was reported; a short wait may not resolve it. Check the reset and allowance in Google AI Studio."
        elif retry:
            message += f" Google suggests waiting {retry} seconds before retrying. If it persists, check your allowance in Google AI Studio."
        else:
            message += " Check the model's limits and reset time in Google AI Studio before retrying."
        return AIServiceError("quota_exceeded", message, 429, retry)
    if "401" in codes or "403" in codes or any(word in text for word in ("api_key_invalid", "api key not valid", "permission_denied")):
        return AIServiceError("api_key_rejected", "Gemini rejected the API credentials or project permissions. Check the backend API key and its access in Google AI Studio.")
    if "404" in codes or "not_found" in text:
        return AIServiceError("model_unavailable", "This Gemini model is unavailable for the configured project. Choose another model or check its availability in Google AI Studio.")
    if any(word in text for word in ("api key must", "api_key must", "api key is required", "default credentials", "missing key")):
        return AIServiceError("configuration_error", "The backend has no usable Gemini API key. Set GOOGLE_API_KEY in the root .env and restart the backend.")
    if isinstance(error, TimeoutError) or "timeout" in text or "timed out" in text or "504" in codes:
        return AIServiceError("ai_timeout", "Gemini took too long to respond. Your preferences are still here; please retry.", 504)
    if any(code in codes for code in ("500", "502", "503")) or "unavailable" in text:
        return AIServiceError("provider_unavailable", "Gemini is temporarily unavailable. Your preferences are still here; try again shortly.")
    if "400" in codes or "invalid_argument" in text:
        return AIServiceError("ai_request_rejected", "Gemini rejected the model request. This may be an unsupported model feature or request format; try another model.", 502)
    return AIServiceError("ai_generation_failed", "Gemini could not produce a usable response. Your preferences are still here; please retry or choose another model.", 502)


def key_scope():
    key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or "unconfigured"
    return hashlib.sha256(key.encode()).hexdigest()


@contextmanager
def usage_db():
    os.makedirs(os.path.dirname(STATUS_PATH), exist_ok=True)
    conn = sqlite3.connect(STATUS_PATH, timeout=5)
    conn.row_factory = sqlite3.Row
    try:
        with conn:
            conn.execute("""CREATE TABLE IF NOT EXISTS calls (
                id TEXT PRIMARY KEY, scope TEXT NOT NULL, model TEXT NOT NULL,
                started REAL NOT NULL, finished REAL, status TEXT NOT NULL,
                input_tokens INTEGER, output_tokens INTEGER, total_tokens INTEGER, error TEXT)""")
            conn.execute("CREATE INDEX IF NOT EXISTS calls_scope_model ON calls(scope, model, started)")
            yield conn
    finally:
        conn.close()


class UsageTracker(BaseCallbackHandler):
    """Never stores prompts, responses, travel records or API keys."""
    def __init__(self, model):
        self.model = model
        self.scope = key_scope()

    def on_chat_model_start(self, serialized, messages, *, run_id, **kwargs):
        try:
            with usage_db() as conn:
                conn.execute("INSERT OR IGNORE INTO calls(id, scope, model, started, status) VALUES (?, ?, ?, ?, 'pending')",
                             (str(run_id), self.scope, self.model, time.time()))
        except Exception:
            logger.warning("Could not record local AI usage; generation will continue.")

    def on_llm_end(self, response, *, run_id, **kwargs):
        metadata = None
        for batch in response.generations:
            for generation in batch:
                candidate = getattr(getattr(generation, "message", None), "usage_metadata", None)
                if candidate:
                    metadata = candidate
                    break
            if metadata:
                break
        self._finish(run_id, "success", metadata)

    def on_llm_error(self, error, *, run_id, **kwargs):
        self._finish(run_id, "error", error=classify_error(error).public_detail())

    def _finish(self, run_id, status, metadata=None, error=None):
        metadata = metadata or {}
        try:
            with usage_db() as conn:
                conn.execute("UPDATE calls SET finished=?, status=?, input_tokens=?, output_tokens=?, total_tokens=?, error=? WHERE id=?",
                             (time.time(), status, metadata.get("input_tokens"), metadata.get("output_tokens"),
                              metadata.get("total_tokens"), json.dumps(error) if error else None, str(run_id)))
        except Exception:
            logger.warning("Could not record local AI usage; generation will continue.")


def usage_snapshot(model):
    now = time.time()
    with usage_db() as conn:
        rows = conn.execute("SELECT * FROM calls WHERE scope=? AND model=? AND started>=? ORDER BY started DESC",
                            (key_scope(), model, now - 86400)).fetchall()
    latest_error = next((row for row in rows if row["error"]), None)
    latest_success = next((row for row in rows if row["status"] == "success"), None)
    error = json.loads(latest_error["error"]) if latest_error else None
    if error:
        error["occurred_at"] = datetime.fromtimestamp(latest_error["finished"], timezone.utc).isoformat()
        error["retry_at"] = (latest_error["finished"] + error["retry_after_seconds"]
                             if error.get("retry_after_seconds") else None)
        error["success_since"] = bool(latest_success and latest_success["finished"] > latest_error["finished"])
    measured = [row for row in rows if row["total_tokens"] is not None]
    return {"model": model, "remaining_tokens": None, "quota_url": AI_STUDIO_URL,
            "scope": "This app and API key only; other apps/keys in your Google project are not included.",
            "period": "Last 24 hours", "requests": len(rows),
            "requests_last_minute": sum(row["started"] >= now - 60 for row in rows),
            "successful_requests": sum(row["status"] == "success" for row in rows),
            "failed_requests": sum(row["status"] == "error" for row in rows),
            "measured_requests": len(measured),
            "input_tokens": sum(row["input_tokens"] or 0 for row in rows),
            "output_tokens": sum(row["output_tokens"] or 0 for row in rows),
            "total_tokens": sum(row["total_tokens"] for row in measured) if measured else None,
            "latest_error": error}
