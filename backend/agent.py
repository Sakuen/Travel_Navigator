import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from pydantic import BaseModel
from models import AppStateUpdate, UserDNA, TripContext
import json

def get_llm():
    # Make sure GOOGLE_API_KEY is in the environment
    # Using gemini-2.5-flash-lite: fast, capable, and has separate free-tier quota
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash-lite",
        temperature=0.7,
        timeout=30,
        max_retries=2,
    )

CONCIERGE_PROMPT = """
You are the Lighthouse Navigator, an intuitive, highly perceptive travel concierge.
Your goal is to have a natural conversation with the user to extract their "User DNA" (hard no's, soft likes) 
and their "Trip Context" (dates, budget, group size).

Do not ask a barrage of survey questions. Ask 1 or 2 dynamic questions at most in a single message.
Extract insights seamlessly from what the user says.

If they say "I'm traveling with my toddler", you must update the group_size and add a status_flag like "👶 Toddler".
If they say "I hate tourist traps", you must add "tourist traps" to hard_nos.

IMPORTANT: Do NOT set 'is_brief_complete' to true until you have successfully gathered ALL essential information (duration/timing, budget, and people situation/group size).
If the user hasn't provided this information, continue asking natural questions to gather it.
Once all essential info is gathered, set 'is_brief_complete' to true and summarize their Travel Brief.

Current State:
{current_state}

Respond using the provided structured output format to update the state and provide your response message.
"""

def process_chat(user_message: str, current_state: dict, chat_history: list = None) -> dict:
    if chat_history is None:
        chat_history = []
        
    try:
        llm = get_llm()
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
        
        result: AppStateUpdate = structured_llm.invoke(messages)
        if not result:
            raise ValueError("LLM returned empty structured output")
            
        return {
            "response_message": result.response_message,
            "state_updates": {
                "user_dna": result.user_dna.model_dump() if result.user_dna else None,
                "trip_context": result.trip_context.model_dump() if result.trip_context else None,
                "is_brief_complete": result.is_brief_complete
            }
        }
    except Exception as e:
        print(f"Error during LLM invocation: {e}")
        return {
            "response_message": "I'm sorry, my systems experienced a brief hiccup while processing that. Could you please repeat or rephrase what you just said?",
            "state_updates": {
                "user_dna": None,
                "trip_context": None,
                "is_brief_complete": False
            }
        }

def generate_destinations(current_state: dict) -> dict:
    llm = get_llm()
    
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
        result: DestinationResponse = structured_llm.invoke([HumanMessage(content=prompt)])
        if not result:
            raise ValueError("LLM returned empty structured output")
        return result.model_dump()
    except Exception as e:
        print(f"Error generating destinations: {e}")
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

def generate_itinerary(destination: dict, current_state: dict) -> dict:
    llm = get_llm()
    
    from models import ItineraryResponse
    structured_llm = llm.with_structured_output(ItineraryResponse)
    
    prompt = f"""
    You are the Lighthouse Navigator. The user has selected a destination.
    Create a highly realistic, 1-day itinerary (Day 1) for this destination based on their profile.
    
    Destination Selected: {json.dumps(destination, indent=2)}
    User Profile: {json.dumps(current_state, indent=2)}
    
    Requirements:
    - Ensure travel times make sense (Constraint Solver).
    - Add a "Live Buffer" between stops.
    - Give approximate real-world coordinates (lat, lng) for Mapbox to draw the route.
    - Provide 4-6 chronological items.
    """
    
    try:
        result: ItineraryResponse = structured_llm.invoke([HumanMessage(content=prompt)])
        if not result:
            raise ValueError("LLM returned empty structured output")
        return result.model_dump()
    except Exception as e:
        print(f"Error generating itinerary: {e}")
        return {
            "day": "Error: Could not generate itinerary",
            "items": []
        }
