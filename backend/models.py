from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Dict, Any, Literal
from datetime import date

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
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    weather_preferences: str = "Comfortable temperatures; avoid extreme heat and heavy rain"
    avoid_peak_periods: bool = True
    revisit_preference: Literal["new_places", "open_to_revisits", "favorites"] = "new_places"

    @model_validator(mode="after")
    def validate_dates(self):
        if bool(self.start_date) != bool(self.end_date):
            raise ValueError("Provide both start and end dates, or neither")
        if self.start_date and self.end_date < self.start_date:
            raise ValueError("End date must be on or after start date")
        if self.start_date and (self.end_date - self.start_date).days > 366:
            raise ValueError("Plan at most one year at a time")
        return self

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
    countries: List[str] = Field(default_factory=list)
    continents: List[str] = Field(default_factory=list)
    participants: List[str] = Field(default_factory=list)
    rating: int = Field(..., ge=1, le=5)
    notes: Optional[str] = None
    stops: List[PastTripStop] = Field(default_factory=list)
    liked: List[str] = Field(default_factory=list)
    disliked: List[str] = Field(default_factory=list)
    would_revisit: Optional[bool] = None


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
    country_code: str = Field(..., description="ISO two-letter country code, e.g. JP")
    history_reason: str = Field(default="", description="Explain specific connections to recorded likes, dislikes and visits. Never invent history.")
    weather_note: str = Field(default="", description="Local weather suitability for the travel period; distinguish seasonal expectations from forecasts")
    timing_note: str = Field(default="", description="Date-specific holidays, crowds, closures and festivals; state uncertainty")
    suitability: Literal["recommended", "caution", "avoid"] = "caution"
    source_ids: List[int] = Field(default_factory=list, description="IDs from supplied research sources supporting this destination, never invent IDs")

class DestinationRequest(BaseModel):
    current_state: dict
    model_name: Optional[str] = "gemini-2.5-flash"

class DestinationResponse(BaseModel):
    destinations: List[DestinationCard] = Field(..., max_length=6, description="Up to 6 candidates, ranked by suitability")

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
    overview: Optional[TripOverview] = None
    existing_days: Dict[str, DailyItinerary] = Field(default_factory=dict)


class SavedTrip(TripOverview):
    id: Optional[str] = None
    destination: dict
    trip_context: TripContext = Field(default_factory=TripContext)
    daily_details: Dict[str, DailyItinerary] = Field(default_factory=dict)
    status: Literal["draft", "planned", "in_progress", "completed"] = "draft"
    revision: int = Field(default=0, ge=0)


class SaveTripRequest(BaseModel):
    username: str
    trip: SavedTrip


class CompleteTripRequest(AddPastTripRequest):
    revision: int = Field(ge=0)


class TripStory(BaseModel):
    title: str
    introduction: str
    highlights: List[str] = Field(default_factory=list)
    story: str


class Dream(BaseModel):
    id: Optional[str] = None
    revision: int = Field(default=0, ge=0)
    title: str = Field(min_length=1, max_length=200)
    countries: List[str] = Field(default_factory=list)
    continents: List[str] = Field(default_factory=list)
    participants: List[str] = Field(default_factory=list)
    timing: str = ""
    priority: Literal["someday", "keen", "next"] = "someday"
    notes: str = Field(default="", max_length=60000)
    links: List[str] = Field(default_factory=list, max_length=100)
    stops: List[PastTripStop] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_content(self):
        from urllib.parse import urlsplit
        self.title = self.title.strip()
        if not self.title:
            raise ValueError("Give your dream a title")
        for link in self.links:
            parsed = urlsplit(link)
            if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
                raise ValueError("Links must be http or https URLs without credentials")
        for stop in self.stops:
            if (stop.lat is None) != (stop.lng is None):
                raise ValueError("Provide both coordinates or leave both blank")
            if stop.lat is not None and not (-90 <= stop.lat <= 90 and -180 <= stop.lng <= 180):
                raise ValueError("Coordinates are outside the valid range")
        return self


class DreamSummaryRequest(BaseModel):
    model_name: str = "gemini-2.5-flash"


class DreamSummary(BaseModel):
    title: str
    overview: str
    highlights: List[str] = Field(default_factory=list)
    practical_notes: List[str] = Field(default_factory=list)
    open_questions: List[str] = Field(default_factory=list)
