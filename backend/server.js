const express=require("express");
const cors=require("cors");
const app=express();
app.use(cors()); app.use(express.json());

let selected = [];
let maxId = 1000000;
let manuallyAdded = new Set();
let queue = {add:new Set(),remove:new Set(),update:false};

function available(){
    const s = new Set(selected);
    const baseIds = Array.from({length:maxId},(_,i)=>i+1).filter(x=>!s.has(x));
    const extraIds = Array.from(manuallyAdded).filter(x=>!s.has(x));
    return [...baseIds, ...extraIds];
}

app.get("/state",(req,res)=>res.json({selected}));
app.get("/left",(req,res)=>{
    const q = req.query.q || "", page = Number(req.query.page||0), size = 20;
    let arr = available().filter(x=>String(x).includes(q));
    res.json(arr.slice(page*size, page*size+size));
});

app.get("/right",(req,res)=>{
    const q = req.query.q || "", page = Number(req.query.page||0), size=20;
    let arr = selected.filter(x => String(x).includes(q));
    res.json(arr.slice(page*size, page*size+size));
});

app.post("/select",(req,res)=>{
 const id = Number(req.body.id);
 if(id && !selected.includes(id)) {
     selected.push(id);
 }
 res.json({ok:true});
});

app.post("/reorder",(req,res)=>{
    selected = req.body.items||[];
    res.json({ok:true});
});

app.post("/deselect",(req,res)=>{
    const id = Number(req.body.id);
    if(id && selected.includes(id)) {
        const idx = selected.indexOf(id);
        if(idx !== -1) selected.splice(idx, 1);
    }
    res.json({ok:true});
});

app.post("/add",(req,res)=>{
    const id=Number(req.body.id);
    if(id && !manuallyAdded.has(id) && !selected.includes(id)){
        manuallyAdded.add(id);
        res.json({ok:true});
    } else {
        res.json({ok:false,error:"Duplicate ID or invalid"});
    }
});


app.listen(3001,()=>console.log("api on 3001"));