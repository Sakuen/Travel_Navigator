import json
import os
from typing import Dict, Any, List

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "db.json")

def ensure_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    if not os.path.exists(DB_PATH):
        default_data = {
            "Jacky": {"user_dna": {"hard_nos": [], "soft_likes": [], "past_footprints": []}, "saved_trips": [], "past_trips": []},
            "Sascha": {"user_dna": {"hard_nos": [], "soft_likes": [], "past_footprints": []}, "saved_trips": [], "past_trips": []},
            "Guest": {"user_dna": {"hard_nos": [], "soft_likes": [], "past_footprints": []}, "saved_trips": [], "past_trips": []}
        }

        with open(DB_PATH, "w") as f:
            json.dump(default_data, f, indent=2)

def load_db() -> Dict[str, Any]:
    ensure_db()
    with open(DB_PATH, "r") as f:
        return json.load(f)

def save_db(data: Dict[str, Any]):
    with open(DB_PATH, "w") as f:
        json.dump(data, f, indent=2)

def get_user_data(username: str) -> Dict[str, Any]:
    db = load_db()
    return db.get(username, {"user_dna": {"hard_nos": [], "soft_likes": [], "past_footprints": []}, "saved_trips": [], "past_trips": []})


def update_user_dna(username: str, dna: Dict[str, Any]):
    if username == "Guest": return # Guest doesn't save DNA
    db = load_db()
    if username in db:
        db[username]["user_dna"] = dna
        save_db(db)

def reset_user_dna(username: str):
    db = load_db()
    if username in db:
        db[username]["user_dna"] = {"hard_nos": [], "soft_likes": [], "past_footprints": []}
        save_db(db)

def save_user_trip(username: str, trip: Dict[str, Any]):
    db = load_db()
    if username in db:
        # Avoid duplicates by checking ID or Title
        trip_id = trip.get("id") or str(hash(trip.get("trip_title", "")))
        trip["id"] = trip_id
        # Remove old version if exists
        db[username]["saved_trips"] = [t for t in db[username]["saved_trips"] if t.get("id") != trip_id]
        db[username]["saved_trips"].append(trip)
        save_db(db)

def delete_user_trip(username: str, trip_id: str):
    db = load_db()
    if username in db:
        db[username]["saved_trips"] = [t for t in db[username]["saved_trips"] if t.get("id") != trip_id]
        save_db(db)

def save_past_trip(username: str, trip: Dict[str, Any]):
    db = load_db()
    if username in db:
        if "past_trips" not in db[username]: db[username]["past_trips"] = []
        # Update or add
        db[username]["past_trips"] = [t for t in db[username]["past_trips"] if t.get("id") != trip.get("id")]
        db[username]["past_trips"].append(trip)
        save_db(db)

def delete_past_trip(username: str, trip_id: str):
    db = load_db()
    if username in db:
        if "past_trips" in db[username]:
            db[username]["past_trips"] = [t for t in db[username]["past_trips"] if t.get("id") != trip_id]
            save_db(db)

