import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = import.meta.env.VITE_API_URL || '';
const PAGE_SIZE = 20;

function IdList({ isRight, selectedIds, onSelect, onDeselect, addedIds, onReorder, refreshTrigger }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('');
  const [draggedId, setDraggedId] = useState(null);

  const loadItems = async (pageNum = 0) => {
    if (isRight) {
      const filtered = selectedIds.filter(id => String(id).includes(filter));
      if (pageNum === 0) {
        setItems(filtered.slice(0, PAGE_SIZE));
      } else {
        setItems(prev => [...prev, ...filtered.slice(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE)]);
      }
    } else {
      const url = `${API}/left?q=${encodeURIComponent(filter)}&page=${pageNum}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (pageNum === 0) {
        setItems(data);
      } else {
        setItems(prev => [...prev, ...data]);
      }
    }
  };

  useEffect(() => {
    setPage(0);
    loadItems(0);
  }, [filter, selectedIds, addedIds, isRight, refreshTrigger]);

  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadItems(nextPage);
    }
  };

  const handleDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetId) => {
    e.preventDefault();
    if (!isRight || !draggedId || draggedId === targetId) return;

    const draggedIndex = selectedIds.indexOf(draggedId);
    const targetIndex = selectedIds.indexOf(targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    const newOrder = [...selectedIds];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedId);

    await fetch(`${API}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: newOrder })
    });

    if (onReorder) onReorder();
    setDraggedId(null);
  };

  return (
    <div className="panel">
      <input
        type="text"
        placeholder="Filter IDs..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
        className="filter-input"
      />
      <div className="list" onScroll={handleScroll}>
        {items.map(id => (
          <div
            key={id}
            draggable={isRight}
            onDragStart={e => handleDragStart(e, id)}
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, id)}
            onClick={() => isRight ? onDeselect(id) : onSelect(id)}
            className={`list-item ${isRight ? 'draggable' : ''}`}
          >
            {id}
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [selectedIds, setSelectedIds] = useState([]);
  const [addedIds, setAddedIds] = useState(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [newIdInput, setNewIdInput] = useState('');
  const [error, setError] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetch(`${API}/state`)
      .then(r => r.json())
      .then(data => setSelectedIds(data.selected || []))
      .catch(err => console.error('Failed to load state:', err));
  }, []);

  const handleSelect = async (id) => {
    if (selectedIds.includes(id)) return;

    const res = await fetch(`${API}/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });

    if (res.ok) {
      setSelectedIds(prev => [...prev, id]);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleDeselect = async (id) => {
    const res = await fetch(`${API}/deselect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });

    if (res.ok) {
      setSelectedIds(prev => prev.filter(x => x !== id));
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleAddId = async () => {
    const id = Number(newIdInput);
    if (!id || isNaN(id)) {
      setError('Please enter a valid number');
      return;
    }
    if (selectedIds.includes(id) || addedIds.has(id)) {
      setError('ID already exists');
      return;
    }

    const res = await fetch(`${API}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });

    const data = await res.json();
    if (data.ok) {
      setAddedIds(prev => new Set([...prev, id]));
      setNewIdInput('');
      setShowAddModal(false);
      setError('');
    } else {
      setError(data.error || 'Failed to add ID');
    }
  };

  const refreshState = () => {
    fetch(`${API}/state`)
      .then(r => r.json())
      .then(data => setSelectedIds(data.selected || []));
  };

  return (
    <main>
      <h1>ID Selector</h1>
      <div className="toolbar">
        <button onClick={() => setShowAddModal(true)}>Add Custom ID</button>
      </div>
      
      {error && <div className="error">{error}</div>}

      <div className="panels">
        <IdList
          isRight={false}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onDeselect={handleDeselect}
          addedIds={addedIds}
          refreshTrigger={refreshTrigger}
        />
        <IdList
          isRight={true}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onDeselect={handleDeselect}
          addedIds={addedIds}
          onReorder={refreshState}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {showAddModal && (
        <div className="modal" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Add Custom ID</h2>
            <input
              type="text"
              value={newIdInput}
              onChange={e => setNewIdInput(e.target.value)}
              placeholder="Enter ID number"
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddId();
                if (e.key === 'Escape') setShowAddModal(false);
              }}
              autoFocus
            />
            <div className="modal-actions">
              <button onClick={() => setShowAddModal(false)}>Cancel</button>
              <button onClick={handleAddId}>Add</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);