import os
import json
import traceback
from typing import List, Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from pydantic import BaseModel
from models import AppStateUpdate, UserDNA, TripContext

import time

def get_llm(model_name: str = "gemini-1.5-flash"):
    # Fallback to flash if none provided
    actual_model = model_name or "gemini-1.5-flash"
    return ChatGoogleGenerativeAI(
        model=actual_model,
        temperature=0.7,
        timeout=60,
        max_retries=1, # Manual retries handled by safe_invoke
    )

def safe_invoke(structured_llm, messages, max_attempts=3):
    last_error = None
    for attempt in range(max_attempts):
        try:
            print(f"LLM Attempt {attempt + 1}...")
            result = structured_llm.invoke(messages)
            if result:
                return result
            print(f"LLM returned empty result on attempt {attempt + 1}")
        except Exception as e:
            last_error = e
            print(f"LLM attempt {attempt + 1} failed: {e}")
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                print("Quota hit, waiting 5s before retry...")
                time.sleep(5)
            else:
                time.sleep(1)
    
    raise last_error or ValueError("LLM invocation failed after retries")


CONCIERGE_PROMPT = """
You are the Lighthouse Concierge, a world-class travel curator. Your goal is to gather a "Travel Brief" from the user before suggesting destinations.

CRITICAL INSTRUCTIONS:
1. DO NOT mark 'is_brief_complete' as true until you have confirmed:
   - Duration/Timing (How many days/weeks? Which season?)
   - Travel Style & Pace (Relaxed/Luxury? Adventure/Fast-paced? Culturally immersive?)
   - Daily Activity Level (1-2 main spots per day? Or "see everything"?)
   - Group Dynamics (Solo? Family with kids? Couple? Friends?)
   - Budget level (Backpacker? Mid-range? Luxury?)

2. Information Extraction:
   - Extract "Hard Nos" (things to avoid) and "Soft Likes" (preferences) into 'user_dna'.
   - Extract destination, dates, budget, and group size into 'trip_context'.
   - Add visual icons to 'status_flags' for the UI (e.g., '👶 Toddler', '💸 Budget', '🎨 Artsy').

3. Conversation Flow:
   - Be conversational and warm. Don't ask more than 2 questions at a time.
   - Once all essential info is gathered, tell the user you're ready to find their perfect matches and set 'is_brief_complete' to true.
   - If the user explicitly says "skip" or "show me anything", respect their choice and set 'is_brief_complete' to true.

Current State:
{current_state}

Respond using the provided structured output format to update the state and provide your response message.
"""

def process_chat(user_message: str, current_state: dict, chat_history: list = None, model_name: str = None) -> dict:
    if chat_history is None:
        chat_history = []
        
    try:
        llm = get_llm(model_name)
        structured_llm = llm.with_structured_output(AppStateUpdate)

        
        system_prompt = CONCIERGE_PROMPT.format(current_state=json.dumps(current_state, indent=2))
        
        messages = [SystemMessage(content=system_prompt)]
        
        # Append history
        from langchain_core.messages import AIMessage
        for msg in chat_history[-6:]: # Keep last 6 messages to avoid context overflow
            role = msg.role if hasattr(msg, 'role') else msg.get('role', '')
            content = msg.content if hasattr(msg, 'content') else msg.get('content', '')
            if role == 'user':
                messages.append(HumanMessage(content=content))
            else:
                messages.append(AIMessage(content=content))
                
        messages.append(HumanMessage(content=user_message))
        
        result = safe_invoke(structured_llm, messages)
        return {
            "response_message": result.response_message,
            "state_updates": {
                "user_dna": result.user_dna.model_dump() if result.user_dna else None,
                "trip_context": result.trip_context.model_dump() if result.trip_context else None,
                "is_brief_complete": result.is_brief_complete
            }
        }
    except Exception as e:
        print(f"Error during LLM invocation in process_chat:")
        traceback.print_exc()
        return {
            "response_message": "I'm sorry, my systems experienced a brief hiccup while processing that. Could you please repeat or rephrase what you just said?",
            "state_updates": {
                "user_dna": None,
                "trip_context": None,
                "is_brief_complete": False
            }
        }

def generate_destinations(current_state: dict, model_name: str = None) -> dict:
    llm = get_llm(model_name)

    
    # We use a late import to avoid circular dependencies if any
    from models import DestinationResponse
    structured_llm = llm.with_structured_output(DestinationResponse)
    
    prompt = f"""
    You are the Lighthouse Navigator Matchmaker.
    Based on the user's travel profile, generate exactly 3 highly curated destination recommendations.
    
    User Profile:
    {json.dumps(current_state, indent=2)}
    
    Be creative but realistic. Consider their hard no's, soft likes, budget, and group size.
    Ensure "the_why" and "the_but" are engaging, specific, and concise.
    For "image_url", provide a single, highly relevant keyword for Unsplash (e.g., 'tokyo-neon', 'bali-beach', 'swiss-alps').
    """
    
    try:
        result = safe_invoke(structured_llm, [HumanMessage(content=prompt)])
        return result.model_dump()
    except Exception as e:
        print(f"Error generating destinations:")
        traceback.print_exc()
        return {
            "destinations": [
                {
                    "id": "error_fallback",
                    "name": "AI Hiccup - Please Retry",
                    "image_url": "error",
                    "the_why": "Our systems experienced a brief hiccup. We couldn't generate your destinations.",
                    "the_but": "You can try remixing or restarting the process.",
                    "tags": ["System Error"]
                }
            ]
        }

def generate_itinerary_overview(destination: dict, current_state: dict, model_name: str = None) -> dict:
    llm = get_llm(model_name)

    
    from models import TripOverview
    structured_llm = llm.with_structured_output(TripOverview)
    
    prompt = f"""
    You are the Lighthouse Navigator. The user has selected a destination.
    Create a "Big Picture" overview for the entire journey.
    
    Destination Selected: {json.dumps(destination, indent=2)}
    User Profile: {json.dumps(current_state, indent=2)}
    
    Requirements:
    - Summarize the whole journey in 2-3 sentences.
    - Provide a DailySummary card for each day (up to the duration requested, or 5 days if unknown).
    - Provide a 'image_url' keyword for each day (1-2 words for Unsplash search, e.g. 'temple', 'pasta', 'sunset').
    - Give approximate real-world coordinates (lat, lng) for the central location of each day.

    """
    
    try:
        result = safe_invoke(structured_llm, [HumanMessage(content=prompt)])
        if result and hasattr(result, 'model_dump'):
            return result.model_dump()
        return {
            "trip_title": f"Journey to {destination.get('name', 'Destination')}",
            "total_days": 0,
            "general_summary": "We couldn't generate the full plan right now. Please try again.",
            "daily_summaries": []
        }
    except Exception as e:
        print(f"Error generating overview: {e}")
        traceback.print_exc()
        return {
            "trip_title": "Plan Generation Error",
            "total_days": 0,
            "general_summary": "Our navigators got lost. Please retry the generation.",
            "daily_summaries": []
        }

def generate_daily_itinerary(destination: dict, current_state: dict, day_number: int, model_name: str = None) -> dict:
    llm = get_llm(model_name)

    
    from models import DailyItinerary
    structured_llm = llm.with_structured_output(DailyItinerary)
    
    prompt = f"""
    Create a highly realistic, hour-by-hour itinerary for Day {day_number} of this trip.
    
    Destination Selected: {json.dumps(destination, indent=2)}
    User Profile: {json.dumps(current_state, indent=2)}
    Day Number: {day_number}
    
    Requirements:
    - Provide 4-6 chronological items.
    - Ensure travel times make sense.
    - Give approximate real-world coordinates (lat, lng) for Mapbox.
    """
    
    try:
        result = safe_invoke(structured_llm, [HumanMessage(content=prompt)])
        return result.model_dump()
    except Exception as e:
        print(f"Error generating daily itinerary:")
        traceback.print_exc()
        return {
            "day_number": day_number,
            "day_title": "Day Details",
            "items": []
        }

