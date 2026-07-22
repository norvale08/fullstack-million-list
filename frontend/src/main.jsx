import React,{useEffect,useState,useRef} from "react";
import {createRoot} from "react-dom/client";
import "./style.css";

const API="http://localhost:3001";

function Box({right, localSelected, onLocalSelect, onLocalDeselect, localAdded, localDeselected}){
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(0);
    const [q, setQ] = useState("");
    const [fullList, setFullList] = useState([]);
    const [draggedItem, setDraggedItem] = useState(null);

    async function load(p = 0){
        if(right){
            const localArray = Array.from(localSelected);
            const filtered = localArray.filter(x => String(x).includes(q));
            setItems(p ? x=>[...x,...filtered.slice(p*20, (p+1)*20)]:filtered.slice(0, 20));
        } else {
            const localExtra = [...Array.from(localDeselected), ...Array.from(localAdded)].filter(x => !localSelected.has(x) && String(x).includes(q));
            const localExtraUnique = [...new Set(localExtra)];
            
            if(p === 0){
                let r = await fetch(`${API}/left?page=0&q=${encodeURIComponent(q)}`);
                let d = await r.json();
                const combined = [...localExtraUnique, ...d];
                const unique = [...new Set(combined)];
                setItems(unique.slice(0, 20));
            } else {
                const offset = Math.max(0, p - Math.ceil(localExtraUnique.length / 20));
                let r = await fetch(`${API}/left?page=${offset}&q=${encodeURIComponent(q)}`);
                let d = await r.json();
                setItems(prev=>[...prev,...d]);
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
    },[q, right, localSelected, localAdded, localDeselected]);
    
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
        
        const draggedIndex = fullList.indexOf(draggedItem);
        const targetIndex = fullList.indexOf(targetItem);
        
        if(draggedIndex === -1 || targetIndex === -1) return;
        
        const newItems = [...fullList];
        newItems.splice(draggedIndex, 1);
        newItems.splice(targetIndex, 0, draggedItem);
        
        setFullList(newItems);
        fetch(API+"/reorder",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({items:newItems})
        });
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
    const [localDeselected,setLocalDeselected]=useState(new Set());
    
    const handleLocalSelect = (id) => {
        setLocalSelected(prev => new Set([...prev, id]));
        setLocalDeselected(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });
        fetch(API+"/select",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({id})
        });
    };
    
    const handleLocalDeselect = (id) => {
        setLocalSelected(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });
        setLocalDeselected(prev => new Set([...prev, id]));
        fetch(API+"/deselect",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({id})
        });
    };
    
    useEffect(()=>{
        const loadState = () => {
            fetch(API+"/state").then(r=>r.json()).then(d=>{
                if(d.selected){
                    const currentStr = JSON.stringify(d.selected);
                    const lastStr = JSON.stringify(lastSelected);
                    if(currentStr !== lastStr){
                        setLastSelected(d.selected);
                        setLocalSelected(new Set(d.selected));
                        setLocalDeselected(new Set());
                        setStateKey(prev=>prev+1);
                    }
                }
            });
        };
        loadState();
        const interval = setInterval(loadState, 1500);
        return () => clearInterval(interval);
    },[lastSelected]);

    async function handleAdd(){
        let id = prompt("ID");
        if(!id) return;
        const numId = Number(id);
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
        else setError("");
    }
    
    return <main>
            <h2>Million IDs selector</h2>
            <button onClick={handleAdd}>Add</button>
            {error && <div className="error">{error}</div>}
            <section key={stateKey}>
                <Box localSelected = {localSelected} onLocalSelect = {handleLocalSelect} onLocalDeselect = {handleLocalDeselect} localAdded = {localAdded} localDeselected = {localDeselected}/>
                <Box right localSelected = {localSelected} onLocalSelect = {handleLocalSelect} onLocalDeselect = {handleLocalDeselect} localAdded = {localAdded} localDeselected = {localDeselected}/>
            </section>
        </main>
}
createRoot(document.getElementById("root")).render(<App/>);