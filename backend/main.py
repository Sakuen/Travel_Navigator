import os
from fastapi import FastAPI
from dotenv import load_dotenv

# Load environment variables from the parent directory
load_dotenv(dotenv_path="../.env")

from models import ChatRequest
from agent import process_chat, generate_destinations, generate_itinerary
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Lighthouse Navigator API")

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
    result = process_chat(request.message, request.current_state, request.chat_history)
    return result

class DestinationRequest(BaseModel):
    current_state: dict

@app.post("/api/destinations")
def destinations_endpoint(request: DestinationRequest):
    result = generate_destinations(request.current_state)
    return result

class ItineraryRequest(BaseModel):
    destination: dict
    current_state: dict

@app.post("/api/itinerary")
def itinerary_endpoint(request: ItineraryRequest):
    result = generate_itinerary(request.destination, request.current_state)
    return result
