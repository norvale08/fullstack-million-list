import React,{useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import "./style.css";

const API="http://localhost:3001";

function Box({right}){
 const [items,setItems]=useState([]);
 const [page,setPage]=useState(0);
 const [q,setQ]=useState("");
 async function load(p=0){
  let r=await fetch(`${API}/${right?"right":"left"}?page=${p}&q=${q}`);
  let d=await r.json();
  setItems(p?x=>[...x,...d]:d);
 }
 useEffect(()=>load(0),[q]);
 return <div className="box">
 <input placeholder="filter ID" value={q} onChange={e=>setQ(e.target.value)}/>
 <div className="list" onScroll={e=>{
  if(e.target.scrollTop+e.target.clientHeight>=e.target.scrollHeight-10) {
   let p=page+1; setPage(p); load(p);
  }
 }}>
 {items.map(x=><div draggable={right} onDragEnd={()=>right&&fetch(API+"/reorder",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:[...items.filter(y=>y!==x),x]})})} onClick={()=>!right&&fetch(API+"/select",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:x})})} key={x}>{x}</div>)}
 </div></div>
}
function App(){
 return <main><h2>Million IDs selector</h2><button onClick={()=>{let id=prompt("ID");fetch(API+"/add",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})})}}>Add</button><section><Box/><Box right/></section></main>
}
createRoot(document.getElementById("root")).render(<App/>);