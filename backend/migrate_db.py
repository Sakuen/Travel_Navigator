import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "db.json")

def migrate():
    """
    Migrates the db.json structure to support multiple countries and continents.
    - Renames 'country' (str) to 'countries' (List[str])
    - Renames 'continent' (str) to 'continents' (List[str])
    """
    if not os.path.exists(DB_PATH):
        print(f"DB not found at {DB_PATH}")
        return

    with open(DB_PATH, "r") as f:
        db = json.load(f)

    changed = False
    for user, data in db.items():
        if "past_trips" in data:
            for trip in data["past_trips"]:
                # Migrate country to countries
                if "country" in trip:
                    val = trip.pop("country")
                    trip["countries"] = [val] if isinstance(val, str) else val
                    changed = True
                elif "countries" not in trip:
                    trip["countries"] = []
                    changed = True
                
                # Migrate continent to continents
                if "continent" in trip:
                    val = trip.pop("continent")
                    if isinstance(val, str):
                        trip["continents"] = [val] if val and val != "Unknown" else []
                    else:
                        trip["continents"] = val
                    changed = True
                elif "continents" not in trip:
                    trip["continents"] = []
                    changed = True

    if changed:
        with open(DB_PATH, "w") as f:
            json.dump(db, f, indent=2)
        print("Migration complete. Updated db.json.")
    else:
        print("No migration needed - schema is already up to date.")

if __name__ == "__main__":
    migrate()
