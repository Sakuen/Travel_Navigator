import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Load environment variables from the parent directory
load_dotenv(dotenv_path="../.env")

from models import ChatRequest, DestinationRequest, ItineraryRequest, DailyItineraryRequest, AddPastTripRequest
from agent import process_chat, generate_destinations, generate_itinerary_overview, generate_daily_itinerary

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import db

app = FastAPI(title="Lighthouse Navigator API")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    print(f"Global Exception: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)}
    )

# Add CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Welcome to the Lighthouse Navigator API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.post("/api/chat")
def chat_endpoint(request: ChatRequest):
    print(f"Chat request: {request.message} (Model: {request.model_name})")
    result = process_chat(request.message, request.current_state, request.chat_history, model_name=request.model_name)
    
    # Auto-persist DNA
    username = request.current_state.get("username")
    if username and username != "Guest" and result.get("state_updates"):
        dna = result["state_updates"].get("user_dna")
        if dna:
            db.update_user_dna(username, dna)
    return result

@app.get("/api/users/{username}")
def get_user_endpoint(username: str):
    return db.get_user_data(username)

@app.delete("/api/users/{username}/dna")
def reset_dna_endpoint(username: str):
    db.reset_user_dna(username)
    return {"status": "ok"}

class SaveTripRequest(BaseModel):
    username: str
    trip: dict

@app.post("/api/users/{username}/trips")
def save_trip_endpoint(username: str, request: SaveTripRequest):
    db.save_user_trip(username, request.trip)
    return {"status": "ok"}

@app.delete("/api/users/{username}/trips/{trip_id}")
def delete_trip_endpoint(username: str, trip_id: str):
    db.delete_user_trip(username, trip_id)
    return {"status": "ok"}

@app.post("/api/users/{username}/past-trips")
def add_past_trip_endpoint(username: str, request: AddPastTripRequest):
    trip_dict = request.trip.model_dump()
    from agent import geocode_location
    
    continents = set(trip_dict.get("continents", []))
    countries_str = ", ".join(trip_dict.get("countries", []))
    
    for stop in trip_dict.get("stops", []):
        if not stop.get("lat") or stop.get("lat") == 0:
            coords = geocode_location(stop["city"], countries_str)
            stop["lat"] = coords["lat"]
            stop["lng"] = coords["lng"]
            if coords.get("continent"):
                continents.add(coords["continent"])
            
    trip_dict["continents"] = list(continents)
            
    db.save_past_trip(username, trip_dict)
    return {"status": "ok"}




@app.delete("/api/users/{username}/past-trips/{trip_id}")
def delete_past_trip_endpoint(username: str, trip_id: str):
    db.delete_past_trip(username, trip_id)
    return {"status": "ok"}


@app.post("/api/destinations")
def destinations_endpoint(request: DestinationRequest):
    print(f"Destinations request (Model: {request.model_name})")
    result = generate_destinations(request.current_state, model_name=request.model_name)
    return result

@app.post("/api/itinerary")
def itinerary_endpoint(request: ItineraryRequest):
    print(f"Itinerary request for: {request.destination.get('name')} (Model: {request.model_name})")
    result = generate_itinerary_overview(request.destination, request.current_state, model_name=request.model_name)
    return result

@app.post("/api/itinerary/daily")
def daily_itinerary_endpoint(request: DailyItineraryRequest):
    print(f"Daily Itinerary request Day {request.day_number} (Model: {request.model_name})")
    result = generate_daily_itinerary(request.destination, request.current_state, request.day_number, model_name=request.model_name)
    return result
