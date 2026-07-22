const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || '*'
}));
app.use(express.json({ limit: '100kb' }));

const STATE_FILE = path.join(__dirname, 'state.json');
const STATE_FILE_TMP = path.join(__dirname, 'state.json.tmp');
const MAX_BUILTIN_ID = 1000000;
const PAGE_SIZE = 20;
const MAX_CUSTOM_ID = 999999999;
const PORT = process.env.PORT || 3001;

// State: selectedIdOrder preserves drag-and-drop ordering; Set enables O(1) lookups
let selectedIdOrder = [];
let selectedIdSet = new Set();
let customIds = new Set();
let availableIdIndex = [];

// Use a Set for unavailable IDs to avoid rebuilding the entire index on every change
// Tradeoff: Slightly more memory, but O(1) add/remove vs O(n) rebuild
let unavailableIdSet = new Set();
let saveTimeout = null;

async function loadPersistedState() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(data);
    selectedIdOrder = parsed.selected || [];
    selectedIdSet = new Set(selectedIdOrder);
    customIds = new Set(parsed.manuallyAdded || []);
    buildUnavailableSet();
    buildAvailableIndex();
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Failed to load state:', err.message);
    buildUnavailableSet();
    buildAvailableIndex();
  }
}

function buildUnavailableSet() {
  // Only selected IDs are unavailable
  // Custom IDs are available for selection until selected
  unavailableIdSet = new Set(selectedIdSet);
}

function buildAvailableIndex() {
  availableIdIndex = [];
  for (let id = 1; id <= MAX_BUILTIN_ID; id++) {
    if (!unavailableIdSet.has(id)) {
      availableIdIndex.push(id);
    }
  }
  for (const id of customIds) {
    if (!unavailableIdSet.has(id)) {
      availableIdIndex.push(id);
    }
  }
}

// Incremental update: remove single ID from index instead of full rebuild
// Only called when selecting an ID (the common operation)
function removeFromAvailableIndex(id) {
  const idx = availableIdIndex.indexOf(id);
  if (idx !== -1) {
    availableIdIndex.splice(idx, 1);
  }
}

// Full rebuild needed when adding custom IDs or reordering
// Tradeoff: Rare operations accept O(n) cost to keep common operations fast
function rebuildAvailableIndex() {
  buildUnavailableSet();
  buildAvailableIndex();
}

// Debounce writes to avoid filesystem thrashing during rapid user interactions
// 1 second delay balances responsiveness with write batching
async function schedulePersist() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      const state = JSON.stringify({
        selected: selectedIdOrder,
        manuallyAdded: Array.from(customIds)
      });
      await fs.writeFile(STATE_FILE_TMP, state, 'utf8');
      await fs.rename(STATE_FILE_TMP, STATE_FILE);
    } catch (err) {
      console.error('Failed to save state:', err.message);
    }
  }, 1000);
}

function getAvailableIdsPaginated(searchTerm, page) {
  const startIdx = page * PAGE_SIZE;
  const endIdx = (page + 1) * PAGE_SIZE;
  
  if (!searchTerm) {
    return availableIdIndex.slice(startIdx, endIdx);
  }
  
  const availableIdsPage = [];
  let count = 0;
  
  for (const id of availableIdIndex) {
    if (String(id).includes(searchTerm)) {
      if (count >= startIdx && count < endIdx) {
        availableIdsPage.push(id);
      }
      count++;
    }
  }
  
  return availableIdsPage;
}

app.get('/state', (req, res) => {
  res.json({ selected: selectedIdOrder });
});

app.get('/left', (req, res) => {
  const searchTerm = String(req.query.q || '');
  const page = Math.max(0, Number(req.query.page || 0));
  const availableIdsPage = getAvailableIdsPaginated(searchTerm, page);
  res.json(availableIdsPage);
});

app.get('/right', (req, res) => {
  const searchTerm = String(req.query.q || '').slice(0, 100);
  const page = Math.max(0, Number(req.query.page || 0));
  const filteredSelectedIds = selectedIdOrder.filter(id => String(id).includes(searchTerm));
  res.json(filteredSelectedIds.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE));
});

function validateId(id) {
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0 || num > MAX_CUSTOM_ID) {
    return null;
  }
  return num;
}

// Domain helpers: represent actual business actions
function addSelectedId(id) {
  if (!selectedIdSet.has(id)) {
    selectedIdOrder.push(id);
    selectedIdSet.add(id);
    unavailableIdSet.add(id);
    removeFromAvailableIndex(id);
    schedulePersist();
  }
}

function removeSelectedId(id) {
  const idx = selectedIdOrder.indexOf(id);
  if (idx !== -1) {
    selectedIdOrder.splice(idx, 1);
    selectedIdSet.delete(id);
    unavailableIdSet.delete(id);
    // Rebuild to restore ID to available list
    rebuildAvailableIndex();
    schedulePersist();
  }
}

function addCustomId(id) {
  customIds.add(id);
  // Custom IDs are available for selection, so don't add to unavailableIdSet
  rebuildAvailableIndex();
  schedulePersist();
}

function updateSelectedOrder(newOrder) {
  selectedIdOrder = newOrder;
  selectedIdSet = new Set(newOrder);
  rebuildAvailableIndex();
  schedulePersist();
}

function isBuiltinId(id) {
  return id >= 1 && id <= MAX_BUILTIN_ID;
}

app.post('/select', (req, res) => {
  const id = validateId(req.body?.id);
  if (!id) {
    return res.status(400).json({ error: 'ID must be a positive integer up to 999,999,999' });
  }
  
  addSelectedId(id);
  res.json({ ok: true });
});

app.post('/deselect', (req, res) => {
  const id = validateId(req.body?.id);
  if (!id) {
    return res.status(400).json({ error: 'ID must be a positive integer up to 999,999,999' });
  }
  
  removeSelectedId(id);
  res.json({ ok: true });
});

app.post('/add', (req, res) => {
  const id = validateId(req.body?.id);
  if (!id) {
    return res.status(400).json({ error: 'ID must be a positive integer up to 999,999,999' });
  }
  
  if (isBuiltinId(id)) {
    return res.status(400).json({ error: 'Cannot add built-in ID (1-1,000,000)' });
  }
  
  if (selectedIdSet.has(id) || customIds.has(id)) {
    return res.status(409).json({ error: 'ID already exists in selected or custom list' });
  }
  
  addCustomId(id);
  res.json({ ok: true });
});

app.post('/reorder', (req, res) => {
  const reorderPayload = req.body?.items;
  if (!Array.isArray(reorderPayload)) {
    return res.status(400).json({ error: 'items must be an array' });
  }
  
  if (reorderPayload.length > 10000) {
    return res.status(400).json({ error: 'Reorder list cannot exceed 10,000 items' });
  }
  
  for (const id of reorderPayload) {
    if (!validateId(id)) {
      return res.status(400).json({ error: 'ID must be a positive integer up to 999,999,999' });
    }
  }
  
  if (new Set(reorderPayload).size !== reorderPayload.length) {
    return res.status(400).json({ error: 'Reorder list contains duplicate IDs' });
  }
  
  updateSelectedOrder(reorderPayload);
  res.json({ ok: true });
});

// Only start server if this file is run directly (not imported for tests)
if (require.main === module) {
  loadPersistedState().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
}

module.exports = { app, ready: loadPersistedState() };