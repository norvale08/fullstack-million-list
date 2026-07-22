import React,{useEffect,useState,useRef} from "react";
import {createRoot} from "react-dom/client";
import "./style.css";

const API="http://localhost:3001";

function Box({right, localSelected, onLocalSelect, onLocalDeselect, localAdded, onReorder}){
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(0);
    const [q, setQ] = useState("");
    const [fullList, setFullList] = useState([]);
    const [draggedItem, setDraggedItem] = useState(null);
    const [baseIds, setBaseIds] = useState([]);

    // Load base IDs once on mount for left panel
    useEffect(() => {
        if (!right) {
            const generateBaseIds = () => Array.from({ length: 1000000 }, (_, i) => i + 1);
            setBaseIds(generateBaseIds());
        }
    }, [right]);

    async function load(p = 0){
        if(right){
            const localArray = Array.from(localSelected);
            const filtered = localArray.filter(x => String(x).includes(q));
            if(p === 0){
                setItems(filtered.slice(0, 20));
            } else {
                setItems(prev=>[...prev,...filtered.slice(p*20, (p+1)*20)]);
            }
        } else {
            // Combine base IDs with manually added IDs
            const allIds = [...baseIds, ...Array.from(localAdded)];
            const uniqueIds = [...new Set(allIds)];
            
            // Filter out selected items and apply search filter
            const available = uniqueIds.filter(x => !localSelected.has(x) && String(x).includes(q));
            
            if(p === 0){
                setItems(available.slice(0, 20));
            } else {
                setItems(prev=>[...prev,...available.slice(p*20, (p+1)*20)]);
            }
        }
    }
    
    async function loadFullList(){
        if(!right) return;
        setFullList(Array.from(localSelected));
    }

    useEffect(()=>{
        setPage(0);
        load(0);
        if(right)loadFullList();
    },[q, right, localSelected, localAdded, baseIds]);
    
    const handleDragStart = (e, item) => {
        setDraggedItem(item);
        e.dataTransfer.effectAllowed = "move";
    };
    
    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };
    
    const handleDrop = async (e, targetItem) => {
        e.preventDefault();
        if(!right || !draggedItem || draggedItem === targetItem) return;
        
        await loadFullList();
        
        // Get the current filtered list
        const filtered = fullList.filter(x => String(x).includes(q));
        const draggedIndex = filtered.indexOf(draggedItem);
        const targetIndex = filtered.indexOf(targetItem);
        
        if(draggedIndex === -1 || targetIndex === -1) return;
        
        // Reorder the filtered list
        const newFiltered = [...filtered];
        newFiltered.splice(draggedIndex, 1);
        newFiltered.splice(targetIndex, 0, draggedItem);
        
        // Map back to full list: keep items not in filter in their original order,
        // insert filtered items in their new order
        const notInFilter = fullList.filter(x => !String(x).includes(q));
        const newItems = [...notInFilter, ...newFiltered];
        
        setFullList(newItems);
        fetch(API+"/reorder",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({items:newItems})
        });
        if(onReorder) onReorder();
        setDraggedItem(null);
    };

    return <div className="box">
                <input placeholder="filter ID" value = {q} onChange = {e => setQ(e.target.value)}/>
                <div className="list" 
                    onScroll = { e=> {
                        if(e.target.scrollTop + e.target.clientHeight >= e.target.scrollHeight - 10) {
                            let p = page + 1; setPage(p); load(p);
                        }
                    }}>
            {
                items.map( x => <div 
                    draggable={right}
                    onDragStart={(e) => handleDragStart(e, x)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, x)}
                    onClick={()=>!right ? onLocalSelect(x) : onLocalDeselect(x)}
                    key={x}>{x}</div>)
            }
            </div></div>
    }
    
function App(){
    const [error,setError]=useState("");
    const [stateKey,setStateKey]=useState(0);
    const [lastSelected,setLastSelected]=useState([]);
    const [localSelected,setLocalSelected]=useState(new Set());
    const [localAdded,setLocalAdded]=useState(new Set());
    const [queueInfo,setQueueInfo]=useState({add:0,remove:0,reorder:0,select:0});
    const [showModal,setShowModal]=useState(false);
    const [modalInput,setModalInput]=useState("");
    
    const handleLocalSelect = (id) => {
        setLocalSelected(prev => new Set([...prev, id]));
        fetch(API+"/select",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({id})
        });
        setQueueInfo(prev => ({...prev, select: prev.select + 1}));
        setTimeout(() => setQueueInfo(prev => ({...prev, select: Math.max(0, prev.select - 1)})), 1000);
    };
    
    const handleLocalDeselect = (id) => {
        setLocalSelected(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });
        fetch(API+"/deselect",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({id})
        });
        setQueueInfo(prev => ({...prev, remove: prev.remove + 1}));
        setTimeout(() => setQueueInfo(prev => ({...prev, remove: Math.max(0, prev.remove - 1)})), 1000);
    };

    const handleReorder = () => {
        setQueueInfo(prev => ({...prev, reorder: prev.reorder + 1}));
        setTimeout(() => setQueueInfo(prev => ({...prev, reorder: Math.max(0, prev.reorder - 1)})), 1000);
    };
    
    useEffect(()=>{
        const loadState = () => {
            fetch(API+"/state").then(r=>r.json()).then(d=>{
                if(d.selected){
                    setLastSelected(d.selected);
                    setLocalSelected(new Set(d.selected));
                }
            });
        };
        loadState();
    },[]);

    const openModal = () => {
        setShowModal(true);
        setModalInput("");
        setError("");
    };

    const closeModal = () => {
        setShowModal(false);
        setModalInput("");
    };

    async function handleAdd(){
        const numId = Number(modalInput);
        if(!modalInput || isNaN(numId)){
            setError("Please enter a valid number");
            return;
        }
        if(localAdded.has(numId) || localSelected.has(numId)){
            setError("ID already exists");
            return;
        }
        setLocalAdded(prev => new Set([...prev, numId]));
        let r = await fetch(API+"/add",{
            method:"POST", 
            headers:{"Content-Type":"application/json"}, 
            body:JSON.stringify({id:numId})});
        let d = await r.json();
        if(!d.ok) {
            setError(d.error || "Failed to add ID");
            setLocalAdded(prev => {
                const newSet = new Set(prev);
                newSet.delete(numId);
                return newSet;
            });
        }
        else {
            setError("");
            setModalInput("");
            setShowModal(false);
            setQueueInfo(prev => ({...prev, add: prev.add + 1}));
            setTimeout(() => setQueueInfo(prev => ({...prev, add: Math.max(0, prev.add - 1)})), 10000);
        }
    }
    
    return <main>
            <h2>Million IDs Selector</h2>
            <div className="controls">
                <button className="add-button" onClick={openModal}>Add New ID</button>
                {queueInfo.add > 0 && <span className="queue-info">{queueInfo.add} add(s) queued (processing in ~10s)</span>}
                {queueInfo.select > 0 && <span className="queue-info">{queueInfo.select} select(s) queued (processing in ~1s)</span>}
                {queueInfo.remove > 0 && <span className="queue-info">{queueInfo.remove} remove(s) queued (processing in ~1s)</span>}
                {queueInfo.reorder > 0 && <span className="queue-info">{queueInfo.reorder} reorder(s) queued (processing in ~1s)</span>}
            </div>
            {error && <div className="error">{error}</div>}
            <section key={stateKey}>
                <Box localSelected = {localSelected} onLocalSelect = {handleLocalSelect} onLocalDeselect = {handleLocalDeselect} localAdded = {localAdded} onReorder = {handleReorder}/>
                <Box right localSelected = {localSelected} onLocalSelect = {handleLocalSelect} onLocalDeselect = {handleLocalDeselect} localAdded = {localAdded} onReorder = {handleReorder}/>
            </section>
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Add New ID</h3>
                        <input 
                            type="text" 
                            value={modalInput} 
                            onChange={e => setModalInput(e.target.value)}
                            placeholder="Enter ID number"
                            autoFocus
                            onKeyDown={e => {
                                if(e.key === 'Enter') handleAdd();
                                if(e.key === 'Escape') closeModal();
                            }}
                        />
                        <div className="modal-buttons">
                            <button className="cancel" onClick={closeModal}>Cancel</button>
                            <button className="confirm" onClick={handleAdd}>Add ID</button>
                        </div>
                    </div>
                </div>
            )}
        </main>
}
createRoot(document.getElementById("root")).render(<App/>);