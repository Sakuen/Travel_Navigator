# Project guidance

- Read `docs/development-direction.md` when making product or architecture changes. The agreed direction is real accounts, shared trips with individual preferences/feedback, and an iPhone PWA.
- The profile chooser is not authentication. Future account work must enforce access in the backend and preserve existing travel records when migrating to stable user IDs and trip membership.
- Use uv from the repository root for Python: `uv sync --locked` and `uv run --locked`. Maintain `pyproject.toml` and `uv.lock` together. Requirements files are generated compatibility exports; export commands are in the README.
- Backend regression check: `uv run --locked python -B -m unittest discover -s backend -p test_planning.py`. These tests use isolated storage and mocked AI; do not use real travel data for test fixtures.
- Keep npm for the frontend and follow `frontend/AGENTS.md` for frontend changes.
