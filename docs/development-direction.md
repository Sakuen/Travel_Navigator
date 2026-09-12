# Development direction

Agreed direction: build a shared travel app for Sascha and Jacky, usable on both iPhones as a private Home Screen web app. Keep this direction in mind while developing the current web application. Accounts are a foundational requirement, not a cosmetic replacement for the profile selector.

## Accounts and ownership first

- Introduce real sign-in with stable user IDs and server-verified sessions. Use a maintained authentication solution; choose the provider when implementing accounts.
- Enforce access in every backend read/write operation, including AI endpoints and future media downloads. Never treat a username supplied by the browser as proof of identity.
- Separate personal preferences and feedback from shared trip content. Both travellers can contribute without overwriting each other's ratings or likes/dislikes.
- Represent trip ownership and membership explicitly. Store a shared trip once and grant its members access rather than duplicating the entire trip under each profile.
- Migrate existing profile records, trip IDs and memories carefully when accounts are introduced; preserve the link between plans and completed trips.
- Keep the prototype local until access controls are implemented. Authentication and authorization are not implemented yet.

## Design for both iPhones

- Continue with Next.js and FastAPI. Target an installable PWA before investing in a native iOS app.
- Design new screens for small touch displays as well as desktop: reachable navigation, labelled controls, large touch targets, and separate map/timeline views where needed.
- Keep server credentials on the backend. Prepare configurable API/storage locations rather than coupling features to a personal computer's paths.
- Add offline access to saved trip essentials later. Distinguish locally cached content from synced content; AI generation and live research need connectivity.
- For shared edits, preserve revision checks and expose conflicts clearly. Automatic offline editing and conflict merging are not yet supported.

## Media and deployment later

- Put future media metadata and access rules in the application database; keep original photos/videos in separate private storage, with backup/export support.
- Deploy behind HTTPS with durable database storage and backups. Render is a candidate, not a committed hosting decision.
- Add the web app manifest, icons, Home Screen installation and carefully scoped offline caching when preparing the PWA. Avoid caching authenticated data across account changes.
- Consider native iOS only when requirements such as reliable background media uploads justify it.

## Development tooling

Use uv for Python dependency management: root `pyproject.toml`, committed `uv.lock`, `uv sync --locked`, and `uv run --locked`. Keep npm for the existing frontend. Requirements files are compatibility exports, not independently maintained dependency lists.
