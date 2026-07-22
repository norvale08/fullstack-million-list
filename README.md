# Fullstack Million List

## Running the app

```bash
# Backend
cd backend
npm install
npm start

# Frontend
cd frontend
npm install
npm run dev
```

## What this does

A dual-pane ID selector with 1M base IDs (1-1,000,000). Left pane shows available IDs, right pane shows selected IDs. Features filtering, infinite scroll, drag-and-drop reordering, and custom ID addition.

## Engineering Architecture

### ID Representation
- **Built-in IDs**: 1 to 1,000,000 (pre-defined range)
- **Custom IDs**: User-added IDs up to 999,999,999
- **Unified storage**: All available IDs cached in `availableIdsCache` array for O(1) pagination
- **Selected IDs**: Stored in array for drag-and-drop ordering, with Set for O(1) lookups

### Data Structures
- `selectedIds` (Array): Preserves user-defined order for drag-and-drop reordering
- `selectedIdsSet` (Set): O(1) membership checks for duplicate prevention
- `customAddedIds` (Set): Tracks manually added IDs to distinguish from built-in range
- `availableIdsCache` (Array): Cached list of all non-selected IDs for fast pagination

### Pagination Strategy
- **Without filter**: Direct array slice from cached available IDs - O(1) per page
- **With filter**: Single pass through cached array - O(n) where n = cache size
- Cache rebuilt on state changes (select/deselect/add/reorder) - O(m) where m = total IDs
- Tradeoff: ~8MB memory for cache vs eliminating 1M iteration on every request

### Duplicate Prevention
- Built-in IDs cannot be manually added (enforced by `isBuiltinId` check)
- Custom IDs checked against both `selectedIdsSet` and `customAddedIds`
- Reorder operation validates for duplicates before applying

### Performance Tradeoffs
- **Memory**: ~8MB for `availableIdsCache` (1M integers ~ 4MB + overhead)
- **Lookup speed**: O(1) for unfiltered pagination, O(n) for filtered
- **Cache rebuild**: O(m) on state changes, but amortized across many requests
- **Implementation complexity**: Moderate - cache invalidation on mutations

### Limitations
- Single-user only (no concurrency control)
- No authentication or authorization
- Cache rebuild on every state change (acceptable for single-user demo)
- Would need database with indexed queries for production multi-user use
