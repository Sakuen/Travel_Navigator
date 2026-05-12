# The "Lighthouse" Navigator 🧭

A next-generation travel application that replaces static forms with a **State-Aware Conversation**. Lighthouse creates a living, breathing itinerary that adapts to real-world changes, your deep personal history, and real-time conditions.

## 1. Project Vision
Traditional travel planning is tedious, relying on overwhelming search results and rigid booking tools. The Lighthouse Navigator acts as a deeply intuitive concierge. It learns your "User DNA", curates bespoke experiences, and dynamically adjusts your journey—even while you are on it.

## 2. Technical Architecture & Data Flow

The app operates on a seamless "Feedback Loop" between the user, the LLM, and live data APIs.

*   **The Persona Engine (Backend):** A vector database (PostgreSQL + pgvector / Pinecone) storing the User DNA. This tracks:
    *   **"Hard No's":** e.g., No cruises, no early mornings.
    *   **"Soft Likes":** e.g., Mid-century modern design, hidden jazz clubs.
    *   **"Past Footprints":** Imported history to avoid repeats or build upon past favorites.
*   **The ReAct Controller (LLM):** Powered by **Gemini 1.5 Pro**, this is the brain of the app. It processes conversational chat and triggers function calls:
    *   `update_state_object()`: Locks in parameters like dates, budget, and group size.
    *   `deep_search_agent()`: Crawls live web data for events, weather, and specific destination deep-dives.
*   **The Synchronized Frontend:** A dynamic interface where the LLM’s text output translates into immediate UI updates (Map markers, Timeline cards, Status badges) without requiring a page refresh.

## 3. The Four-Stage Journey

### Phase 1: The Interview (The "Concierge" UI)
*   **Goal:** Extract high-intent data without survey fatigue.
*   **Interface:** A clean, centered chat window.
*   **Mechanism:** The LLM asks 4–6 dynamic questions. As you answer (e.g., "I'm traveling with my toddler"), a Global Status Bar at the top updates with relevant context (👶 icon).
*   **Result:** A **Travel Brief**—a concise summary of your inferred desires. Click "Confirm" to proceed.

### Phase 2: The Matchmaker (The "Card" UI)
*   **Goal:** Select the perfect destination.
*   **Interface:** Highly visual, horizontal swipe-cards.
*   **Mechanism:** The LLM presents 3 tailored destinations. Each card details:
    *   *The "Why":* "Matches your preference for 20°C weather and quiet mornings."
    *   *The "But":* "Slightly over your $200/day target, but we found savings on local transport."
*   **Selection:** Clicking a destination triggers the **Deep Search Agent**, spending ~10 seconds gathering live local data (festivals, transit strikes, new restaurant openings).

### Phase 3: The Navigator (The "Split" UI)
*   **Goal:** A functional, executable, and flexible itinerary.
*   **The Timeline (Left 40%):** A vertical scroll of the trip. Each item is a "Live Card" (e.g., a dinner reservation card with a "Book Now" button).
*   **The Smart Map (Right 60%):** A Mapbox-powered interactive map that visualizes the path for the day.
*   **The "Remix" Button:** A floating action button. Tap it and say, "I'm too tired for the museum, find me a park nearby." Both the Timeline and Map update instantly to reflect the new plan.

### Phase 4: The Companion (In-Destination Mode) *[New]*
*   **Goal:** Support the traveler while on the ground.
*   **Interface:** Mobile-first view prioritizing immediate needs.
*   **Mechanism:** 
    *   Offline caching of the core itinerary and maps.
    *   Proactive alerts (e.g., "Your train is delayed by 15 mins, grab a coffee at the nearby cafe.").
    *   Contextual AR View: Hold up your phone to see curated highlights layered over the real world.

## 4. Key Feature Modules

| Module | Feature | Functionality |
| :--- | :--- | :--- |
| **Onboarding** | *History Import* | Connects to Gmail/Calendar to see where you've been, tailoring suggestions for "Re-visitors" versus "First-timers". |
| **Logic** | *Constraint Solver* | The LLM physically models time and space. It ensures you aren't booking a 9 AM museum if your hotel is 2 hours away. |
| **Discovery** | *The "Blacklist"* | A persistent filter. If you hate "tourist traps," the LLM silently filters out high-traffic areas like Times Square entirely. |
| **Execution** | *Live Buffer* | Automatically injects 30 mins between stops for "getting lost" or transit delays, creating a stress-free pace. |
| **Memory** | *The Journal* *[New]* | Automatically builds a trip scrapbook by cross-referencing your GPS footprint with the planned itinerary. |

## 5. Development Tech Stack

*   **Frontend:** Next.js (React) for the web dashboard; responsive design doubling as a PWA for mobile access.
*   **Backend:** Python (FastAPI) to handle complex LLM orchestration and API routes.
*   **Mapping:** Mapbox SDK (for custom "vibe" layers and dynamic route drawing).
*   **Intelligence:** Google Gemini 1.5 Pro for massive context windows, perfect for entire trip history.
*   **Agentic Framework:** LangGraph to manage the cyclic "Search -> Plan -> Review" thought processes of the LLM.
*   **Database:** PostgreSQL with `pgvector` for storing and retrieving user preference embeddings.

## 6. UX Philosophy: "Invisible Personalization"
The app never dictates why it made a choice in an overbearing way (e.g., "Because you are old..."). Instead, it seamlessly presents options that simply *fit*. If the user is a returning visitor to a city, the UI skips the "Top 10 Attractions" list and opens directly to "Neighborhood Deep-Dives." 

**It feels less like an app and more like a partner who just knows you.**

---

## 🚀 Current Status

The Lighthouse Navigator is currently in **Active Prototype** stage.

- **✅ State-Aware Chat:** Functional concierge that extracts User DNA and Trip Context.
- **✅ Destination Matchmaker:** AI-driven recommendations based on personal preferences.
- **✅ Itinerary Builder:** Generates daily plans with real-world coordinates and visual summaries.
- **✅ Past Trips Dashboard:** A full-featured history manager with an interactive global map.
- **✅ Multi-Country Support:** Trips can now span multiple countries and continents with automatic geocoding.
- **🔄 Persistence:** Currently using a JSON-based lightweight database (`db.json`) for easy prototyping.
- **🔄 Search Agent:** Live web search for real-time events is in development.

---

## 🛠️ Getting Started

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **Google Gemini API Key** (for intelligence)
- **Mapbox Public Token** (for the interactive maps)

### 2. Environment Setup
Create a `.env` file in the root directory:
```env
GOOGLE_API_KEY=your_gemini_key_here
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
```

### 3. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload
```
The API will be available at `http://localhost:8000`.

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

### 5. Running Migrations (Optional)
If you are updating from an older version, run the migration script to update your data structure:
```bash
python backend/migrate_db.py
```
