# Planning, history and travel conditions

## Implemented workflow

1. Select a profile and chat about a trip. Review and edit the brief before asking for matches.
2. Set exact start/end dates (including year), weather preferences, revisit preference, and whether to avoid peak periods. Flexible timing is allowed but cannot be treated as a completed holiday check.
3. Matching reloads the profile's stored history on the server. Recorded places, ratings, likes, dislikes, revisit feedback and notes inform suggestions and their explanations. Current trip requirements take precedence over general preferences. The model is instructed to transfer enjoyable experiences to new places rather than automatically repeat an entire trip or blacklist a whole country because of one bad experience.
4. The model proposes up to six candidates. A separate Gemini Google Search call researches local weather/climate and date-specific holidays/events. Only destination names, country codes and timing are sent to this search step. A final structured review ranks candidates and filters unsuitable ones.
5. Cards display the connection to past experiences, weather and timing notes, research date, and links supplied by the search provider's citation metadata. Generated URLs are not accepted as evidence. A card without supporting sources is labelled provisional. Search failure is visible and does not pretend to establish suitable conditions.
6. Choose a destination, open days, and edit activity titles, descriptions and times. Activities can be added, removed or moved up. Movement does not automatically recalculate times or routing. Days are generated once per open plan and retained in the saved record along with the original brief, destination and overview.
7. Save explicitly after edits. Reopen through Saved Trips. Revision checking rejects stale writes from another window. Generate unopened days using the saved trip brief and overview, not another trip's current context.
8. Record a completed trip with actual countries, year, rating, stories and feedback. The original plan remains saved and is linked by the same ID to the past-trip record. Planned stops are deliberately not labelled as visited; add actual stops in My Travels.
9. In My Travels, edit what you loved/disliked and whether you would revisit. Generate a travel-story draft from recorded facts. Editing the past trip invalidates its generated story; regenerate it after corrections. A concurrent edit prevents a stale summary from overwriting newer memories.

## My Dreams

Use **My Dreams** beside My Travels to collect future destinations. Each profile can save titles, countries, continents, travellers, priority, flexible timing, places and possible hotels, free-form notes and links. Search the collected material, filter by priority/traveller/continent, and view counts separately from visited places. Optional latitude/longitude pairs put places on the dream map; geocoding is not automatic in this section.

**Summarize with AI** uses the selected Gemini model to organize one dream's saved material into an overview, highlights, practical notes and open questions. It does not retrieve linked pages: paste relevant excerpts into the notes. Summaries are stored and cleared after edits, and concurrent edits prevent an outdated summary from being saved. Ordinary saves and conversion do not use Gemini.

**We did it!** asks for actual countries, places, year, rating and memories. It atomically creates a past trip with a new ID and moves the dream into the fulfilled archive, preserving its original notes, links, places and summary. Planned hotels and research are not copied into factual memories. Existing coordinates carry over only for explicitly entered matching places. Subsequent details can be edited in My Travels. Duplicate conversions and stale edits are rejected; deleting an archived dream leaves the completed trip intact.

Dreams use stable IDs and revisions inside the existing SQLite profile document. Existing profiles need no destructive migration. They are kept separate from recommendation history and visited-place KPIs. Shared accounts and membership remain future work.

## Weather and local dates

- Future travel uses seasonal climate information. The research prompt allows an actual forecast only within its stated short-range horizon; it does not promise weather months in advance.
- Research is instructed to use the visit's year, regional conditions, official event/holiday sources, closures, school breaks, major crowds and the user's weather preferences. These checks are AI assessments, not an exhaustive events database or deterministic weather solver.
- The application additionally blocks Japan when an exact travel range overlaps **29 April–6 May**, provided peak-period avoidance is enabled. This is a conservative recurring crowd window, including a possible substitute holiday, not a claim that every day is a statutory holiday each year. It is enforced after candidate review and at itinerary creation. Adjacent weekends and annual changes still need live research. Source: [Japan National Tourism Organization — May](https://www.japan.travel/en/guide/may/).
- Other event/weather exclusions depend on retrieved evidence and model assessment. Missing sources or vague dates remain visibly unverified. Disabling peak avoidance is an explicit brief setting; it does not disable weather assessment.
- Google Search grounding uses the configured Gemini API key and may have provider charges. Integration reference: [LangChain Google Generative AI](https://docs.langchain.com/oss/python/integrations/chat/google_generative_ai).

## Storage and migration

The local prototype now uses `backend/data/travel.sqlite3`. On first access it imports the existing `backend/data/db.json` once in a transaction, retaining profile names, preferences, saved plans and history. The JSON file is left unchanged. Subsequent writes use SQLite transactions; restarting does not reimport deleted/edited records. UUIDs identify new plans. Legacy plan IDs continue to work.

Keep backups of both the legacy JSON and SQLite file. Stop the backend before copying SQLite for a simple file backup. The old `migrate_db.py` script only changes legacy JSON; it is not a migration mechanism for the new database. Structured profile documents remain inside SQLite for compatibility; a normalized shared-trip schema is a later migration.

## Running and checking

From the repository root, with uv installed:

```powershell
uv sync --locked
uv run --locked python -B -m unittest discover -s backend -p test_planning.py
uv run --locked uvicorn main:app --app-dir backend --reload
```

In another terminal, run `npm run dev` from `frontend`. The backend reads the root `.env` regardless of launch directory. The frontend uses its existing `.env.local` Mapbox configuration.

Dependencies are managed in the root `pyproject.toml` and `uv.lock`. Use `uv add` (or `uv add --dev`) to change them. The backend requirements files are generated compatibility exports; the README lists the export commands.

Frontend checks: `npx tsc --noEmit`, `npm run build`, and ESLint on the changed components/types. The existing external image elements still produce image-optimization warnings.

## Gemini usage and errors

Open **AI usage** beside the model selector to see calls, failures and reported tokens observed by this installation during the last 24 hours. Tracking starts with this feature and is scoped to the configured key and selected model. It does not include other applications or keys in the same Google project. Token counts are unavailable when the provider does not return usage metadata.

There is no single free-token balance shown here. Gemini enforces model/project request and token limits; check the linked Google AI Studio page for your project's actual limits and usage. See [Google's rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits).

Quota failures return a useful 429 response, with a retry countdown when Google supplies a delay. They are not automatically retried. A short delay does not necessarily resolve a daily quota limit. Matching can make three calls (candidates, search and review); if search or review fails, existing candidates remain visibly provisional. Other unexpected server errors include a reference that can be matched to the backend terminal log.

Usage metadata is stored separately in `backend/data/ai_usage.sqlite3`. This ledger stores timings, model, token counts, safe error messages and a key fingerprint; it does not store API keys, prompts or generated content. Opening or refreshing the panel makes no Gemini calls.

The Next.js API proxy allows six minutes for the sequential matching pipeline. Its default 30-second timeout can otherwise interrupt a healthy backend request and surface a generic 500. Restart the frontend after changing this configuration. Future hosting must allow the same duration or move generation to background jobs with progress polling.

## Remaining phases

Accounts and trip-level authorization are the next foundation for shared use. Preserve the [accounts, shared-travel and iPhone design direction](development-direction.md) while adding other features.

Photo/video uploads, individual multimedia memories, video recaps, exportable travel books, bookings/tasks, shared planning and authenticated access are not implemented in this increment. The existing profile chooser is not authentication; this remains a local prototype. The map still connects approximate coordinates rather than validating real travel times, and the itinerary editor does not yet support moving an activity between days or conversational remixing.
