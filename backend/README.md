# Backend API

Simple Express server for managing a list of 1,000,000 selectable IDs with custom ID support.

## Project Structure

```
backend/
├── server.js       # Main Express server
├── state.json      # Persisted selection state (created at runtime)
├── state.json.tmp  # Atomic write temp file
└── package.json
```

## API Endpoints

### GET /state
Returns currently selected IDs in order.

```json
{ "selected": [1, 5, 100] }
```

### GET /left
Returns available (unselected) IDs with pagination and search.

Query params:
- `q`: search term (matches ID as string)
- `page`: page number (0-based, 20 items per page)

### GET /right
Returns selected IDs with pagination and search.

Query params:
- `q`: search term (matches ID as string)
- `page`: page number (0-based, 20 items per page)

### POST /select
Select an ID (move from left to right).

Body:
```json
{ "id": 123 }
```

### POST /deselect
Deselect an ID (move from right to left).

Body:
```json
{ "id": 123 }
```

### POST /add
Add a custom ID beyond the built-in 1,000,000 range.

Body:
```json
{ "id": 999999999 }
```

### POST /reorder
Update the order of selected IDs (for drag-and-drop).

Body:
```json
{ "items": [5, 1, 100] }
```

## How 1,000,000 IDs Are Handled

The server generates IDs 1-1,000,000 at startup. These are not stored in memory as individual objects—only an index of available IDs is maintained.

**Performance approach:**
- `availableIdIndex`: array of unselected IDs for fast pagination
- `unavailableIdSet`: Set of selected/custom IDs for O(1) lookups
- Incremental updates: selecting an ID removes it from the index (O(n) array splice)
- Full rebuild: only on deselect/add custom/reorder (rare operations)

**Tradeoff:** Slightly more memory for the unavailable Set, but avoids O(n) rebuild on every select operation.

## Selection State Storage

State is persisted to `state.json` with atomic writes (write to temp file, then rename).

**Persisted data:**
- `selected`: array of selected IDs in order
- `manuallyAdded`: array of custom IDs added by user

**Persistence strategy:**
- Debounced writes (1 second delay) to avoid filesystem thrashing
- Only writes when state actually changes
- Atomic rename prevents corruption on crash

## Configuration

Environment variable:
- `PORT`: server port (default: 3001)

## Known Limitations

- All state in memory; server restart reloads from disk
- No authentication or rate limiting
- Single-file persistence (no backup/history)
- Search is case-sensitive string matching on ID
- Custom IDs limited to 999,999,999
- Reorder payload limited to 10,000 items
