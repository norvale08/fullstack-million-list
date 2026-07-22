const express=require("express");
const cors=require("cors");
const app=express();
app.use(cors()); app.use(express.json());

let selected = [];
let maxId = 1000000;
let manuallyAdded = new Set();
let queue = {add:new Set(),update:false};

function available(){
    const s = new Set(selected);
    const baseIds = Array.from({length:maxId},(_,i)=>i+1).filter(x=>!s.has(x));
    const extraIds = Array.from(manuallyAdded).filter(x=>!s.has(x));
    return [...baseIds, ...extraIds];
}

app.get("/state",(req,res)=>res.json({selected}));
app.get("/left",(req,res)=>{
    const q = Number(req.query.q||0), page = Number(req.query.page||0), size=20;
    let arr=available().filter(x=>String(x).includes(String(q)));
    res.json(arr.slice(page*size,page*size+size));
});

app.get("/right",(req,res)=>{
    const q = Number(req.query.q||0), page = Number(req.query.page||0), size=20;
    let arr = selected.filter(x => String(x).includes(String(q)));
    res.json(arr.slice(page*size, page*size+size));
});

app.post("/select",(req,res)=>{
 const id = Number(req.body.id);
 if(id && !selected.includes(id)) queue.add.add(id);
 res.json({ok:true});
});

app.post("/reorder",(req,res)=>{
    queue.update=req.body.items||[];
    res.json({ok:true});
});

app.post("/add",(req,res)=>{
    const id=Number(req.body.id);
    if(id && !manuallyAdded.has(id) && !selected.includes(id)){
        manuallyAdded.add(id);
        queue.add.add(id);
        res.json({ok:true});
    } else {
        res.json({ok:false,error:"Duplicate ID or invalid"});
    }
});

setInterval(()=>{
    for(const id of queue.add) if(!selected.includes(id)) selected.push(id);
    queue.add.clear();
},10000);

setInterval(()=>{
    if(queue.update){ selected = queue.update; queue.update=false; }
},1000);

app.listen(3001,()=>console.log("api on 3001"));