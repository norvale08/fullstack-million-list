const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const app = express();
app.use(cors());
app.use(express.json());

const STATE_FILE = path.join(__dirname, "state.json");
const MAX_ID = 1000000;

// In-memory state
let selected = [];
let manuallyAdded = new Set();

// Queue with deduplication
const queue = {
    add: new Set(), // IDs to add
    remove: new Set(), // IDs to remove
    select: new Set(), // IDs to select
    reorder: null, // Reorder operation
    pending: false
};

// Load state from file on startup
function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
            selected = data.selected || [];
            manuallyAdded = new Set(data.manuallyAdded || []);
            console.log("State loaded from file");
        }
    } catch (err) {
        console.error("Error loading state:", err);
    }
}

// Save state to file
function saveState() {
    try {
        const data = {
            selected,
            manuallyAdded: Array.from(manuallyAdded)
        };
        fs.writeFileSync(STATE_FILE, JSON.stringify(data));
    } catch (err) {
        console.error("Error saving state:", err);
    }
}

// Process queue operations
function processQueue() {
    if (queue.pending) return;
    queue.pending = true;

    // Process removes
    queue.remove.forEach(id => {
        const idx = selected.indexOf(id);
        if (idx !== -1) selected.splice(idx, 1);
    });
    queue.remove.clear();

    // Process selects
    queue.select.forEach(id => {
        if (!selected.includes(id)) {
            selected.push(id);
        }
    });
    queue.select.clear();

    // Process adds
    queue.add.forEach(id => {
        if (!selected.includes(id) && !manuallyAdded.has(id)) {
            manuallyAdded.add(id);
        }
    });
    queue.add.clear();

    // Process reorder
    if (queue.reorder) {
        selected = queue.reorder;
        queue.reorder = null;
    }

    saveState();
    queue.pending = false;
}

// Batching intervals
// Add operations batch every 10 seconds
setInterval(() => {
    if (queue.add.size > 0) {
        processQueue();
        console.log(`Processed ${queue.add.size} add operations`);
    }
}, 10000);

// Get/change operations batch every 1 second
setInterval(() => {
    if (queue.remove.size > 0 || queue.select.size > 0 || queue.reorder !== null) {
        processQueue();
        console.log("Processed get/change operations");
    }
}, 1000);

function available() {
    const s = new Set(selected);
    const baseIds = Array.from({ length: MAX_ID }, (_, i) => i + 1).filter(x => !s.has(x));
    const extraIds = Array.from(manuallyAdded).filter(x => !s.has(x));
    return [...baseIds, ...extraIds];
}

app.get("/state", (req, res) => res.json({ selected }));

app.get("/left", (req, res) => {
    const q = req.query.q || "";
    const page = Number(req.query.page || 0);
    const size = 20;
    let arr = available().filter(x => String(x).includes(q));
    res.json(arr.slice(page * size, page * size + size));
});

app.get("/right", (req, res) => {
    const q = req.query.q || "";
    const page = Number(req.query.page || 0);
    const size = 20;
    let arr = selected.filter(x => String(x).includes(q));
    res.json(arr.slice(page * size, page * size + size));
});

app.post("/select", (req, res) => {
    const id = Number(req.body.id);
    if (id && !selected.includes(id) && !queue.select.has(id)) {
        queue.select.add(id); // Add to select queue with deduplication
        queue.remove.delete(id); // Remove from remove queue if present
    }
    res.json({ ok: true });
});

app.post("/reorder", (req, res) => {
    queue.reorder = req.body.items || [];
    res.json({ ok: true });
});

app.post("/deselect", (req, res) => {
    const id = Number(req.body.id);
    if (id && selected.includes(id)) {
        queue.remove.add(id); // Add to remove queue with deduplication
    }
    res.json({ ok: true });
});

app.post("/add", (req, res) => {
    const id = Number(req.body.id);
    if (id && !manuallyAdded.has(id) && !selected.includes(id) && !queue.add.has(id)) {
        queue.add.add(id); // Add to queue with deduplication
        res.json({ ok: true });
    } else {
        res.json({ ok: false, error: "Duplicate ID or invalid" });
    }
});

// Initialize
loadState();
app.listen(3001, () => console.log("API on 3001"));