# Fullstack Million List

A dual-pane ID selector with 1,000,000 base IDs. Left pane shows available IDs, right pane shows selected IDs. Features filtering, infinite scroll, drag-and-drop reordering, and custom ID addition.

## Stack

- **Frontend**: React 18 + Vite (built to `frontend/dist/`)
- **Backend**: Express (serves API + built frontend static files)

## Running on Replit

The "Start application" workflow builds the frontend and starts the backend on port 5000:

```
cd frontend && npm run build && cd ../backend && PORT=5000 node server.js
```

The backend serves the built frontend at `/` and the API at:
- `GET /left` — paginated available IDs (with optional `?q=` filter, `?page=`)
- `GET /right` — paginated selected IDs
- `GET /state` — full selected ID list
- `POST /select` — move an ID to selected
- `POST /deselect` — move an ID back to available
- `POST /add` — add a custom ID (1,000,001–999,999,999)
- `POST /reorder` — update drag-and-drop order of selected IDs

## State persistence

State is saved to `backend/state.json` with debounced writes (1s delay). The file is created automatically on first selection.

## User preferences
