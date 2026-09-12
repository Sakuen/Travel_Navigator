import type { TripBrief } from "../components/TravelBrief";

export type Destination = { name: string; id?: string; country_code?: string };
export type DestinationCard = Destination & {
  id: string; image_url: string; the_why: string; the_but: string; tags: string[];
  history_reason?: string; weather_note?: string; timing_note?: string;
  suitability?: "recommended" | "caution" | "avoid";
  research_status?: string; checked_at?: string;
  sources?: { id: number; url: string; title: string }[];
};
export type DailySummary = { day_number: number; title: string; summary: string; image_url?: string; lat: number; lng: number };
export type Activity = { time: string; title: string; description: string; location_name: string; lat: number; lng: number; action_type: string };
export type DailyItinerary = { day_number: number; day_title: string; items: Activity[] };
export type SavedTrip = {
  id?: string; revision?: number; trip_title: string; total_days: number; general_summary: string;
  daily_summaries: DailySummary[]; destination?: Destination; trip_context?: TripBrief;
  daily_details?: Record<string, DailyItinerary>; status?: string;
};
export type PastTripStop = { city: string; hotel?: string; lat?: number; lng?: number };
export type PastTrip = {
  id: string; year: number; title?: string; countries: string[]; continents?: string[];
  participants?: string[]; rating: number; notes?: string; stops: PastTripStop[];
  liked?: string[]; disliked?: string[]; would_revisit?: boolean | null;
  generated_story?: { title: string; introduction: string; highlights: string[]; story: string };
};
export type UserDNA = { hard_nos: string[]; soft_likes: string[]; past_footprints: string[] };
export type AppState = { username: string | null; user_dna: UserDNA; trip_context: TripBrief; past_trips: PastTrip[]; is_brief_complete: boolean };
export type UserData = { user_dna: UserDNA; saved_trips: SavedTrip[]; past_trips: PastTrip[] };

export type Dream = {
  id?: string; revision: number; title: string; countries: string[]; continents: string[];
  participants: string[]; timing: string; priority: "someday" | "keen" | "next";
  notes: string; links: string[]; stops: PastTripStop[];
  status?: "dreaming" | "completed"; completed_trip_id?: string;
  generated_summary?: { title: string; overview: string; highlights: string[]; practical_notes: string[]; open_questions: string[] };
};
