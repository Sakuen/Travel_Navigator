from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class UserDNA(BaseModel):
    hard_nos: List[str] = Field(default_factory=list, description="Absolute constraints (e.g., 'No cruises', 'No early mornings')")
    soft_likes: List[str] = Field(default_factory=list, description="Preferences and interests (e.g., 'mid-century modern', 'jazz clubs')")
    past_footprints: List[str] = Field(default_factory=list, description="Places previously visited")

class TripContext(BaseModel):
    destination: Optional[str] = Field(None, description="The planned destination if known")
    dates: Optional[str] = Field(None, description="Travel dates")
    budget: Optional[str] = Field(None, description="Budget constraints")
    group_size: Optional[str] = Field(None, description="Who is traveling (e.g., 'solo', 'couple', 'family with toddler')")
    status_flags: List[str] = Field(default_factory=list, description="Extracted key statuses for the UI (e.g., '👶 Toddler', '💸 Budget', '☀️ Warm Weather')")

class AppStateUpdate(BaseModel):
    user_dna: Optional[UserDNA] = None
    trip_context: Optional[TripContext] = None
    is_brief_complete: bool = Field(default=False, description="Set to true when the user has provided enough info to move to destination selection.")
    response_message: str = Field(..., description="The message to send back to the user.")

class ChatMessage(BaseModel):
    role: str
    content: str

class PastTripStop(BaseModel):
    city: str
    hotel: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

class PastTrip(BaseModel):
    id: str
    year: int
    title: Optional[str] = None
    country: str
    continent: Optional[str] = None
    participants: List[str] = Field(default_factory=list)
    rating: int = Field(..., ge=1, le=5)
    notes: Optional[str] = None
    stops: List[PastTripStop] = Field(default_factory=list)


class AddPastTripRequest(BaseModel):

    username: str
    trip: PastTrip

class ChatRequest(BaseModel):

    message: str
    current_state: dict
    chat_history: List[ChatMessage] = Field(default_factory=list)
    model_name: Optional[str] = "gemini-2.5-flash"

class ItineraryRequest(BaseModel):
    destination: dict
    current_state: dict
    chat_history: List[ChatMessage] = Field(default_factory=list)
    model_name: Optional[str] = "gemini-2.5-flash"

class DestinationCard(BaseModel):
    id: str = Field(..., description="A short, unique identifier for the destination (e.g., 'kyoto_japan')")
    name: str = Field(..., description="The name of the destination (e.g., 'Kyoto, Japan')")
    image_url: str = Field(..., description="A keyword to use for unsplash image search (e.g., 'kyoto')")
    the_why: str = Field(..., description="A 1-2 sentence explanation of why this matches the user's preferences")
    the_but: str = Field(..., description="A 1 sentence heads-up about a potential downside (e.g., slightly over budget, long flight)")
    tags: List[str] = Field(default_factory=list, description="3-4 tags summarizing the vibe (e.g., 'Temples', 'Foodie', 'Quiet')")

class DestinationRequest(BaseModel):
    current_state: dict
    model_name: Optional[str] = "gemini-2.5-flash"

class DestinationResponse(BaseModel):
    destinations: List[DestinationCard] = Field(..., description="Exactly 3 destination recommendations")

class DailySummary(BaseModel):
    day_number: int = Field(..., description="The day number (1, 2, 3...)")
    title: str = Field(..., description="High-level title for the day (e.g., 'Arrival & Roman Ruins')")
    summary: str = Field(..., description="1-sentence summary of the day's vibe")
    image_url: Optional[str] = Field(None, description="A keyword for image search representing this day's activity")
    lat: float = Field(..., description="Central latitude for this day's area")

    lng: float = Field(..., description="Central longitude for this day's area")

class TripOverview(BaseModel):
    trip_title: str = Field(..., description="A catchy title for the whole trip")
    total_days: int = Field(..., description="Total duration of the trip")
    general_summary: str = Field(..., description="A 2-3 sentence overview of the whole journey")
    daily_summaries: List[DailySummary] = Field(..., description="List of summary cards for each day")

class ItineraryItem(BaseModel):
    time: str = Field(..., description="Time of the activity (e.g., '09:00 AM')")
    title: str = Field(..., description="Title of the activity")
    description: str = Field(..., description="Short description of what to do")
    location_name: str = Field(..., description="Name of the place for the map")
    lat: float = Field(..., description="Approximate latitude")
    lng: float = Field(..., description="Approximate longitude")
    action_type: str = Field(..., description="Type of action (e.g., 'Book Now', 'Get Directions', 'View Menu')")

class DailyItinerary(BaseModel):
    day_number: int = Field(..., description="The day number")
    day_title: str = Field(..., description="Full title for the day")
    items: List[ItineraryItem] = Field(..., description="Detailed hourly items")

class DailyItineraryRequest(BaseModel):
    destination: dict
    current_state: dict
    day_number: int
    model_name: Optional[str] = "gemini-2.5-flash"


