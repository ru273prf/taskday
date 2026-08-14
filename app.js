(function(){
"use strict";
if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));}
if(window.caches){caches.keys().then(ks=>ks.forEach(k=>caches.delete(k)));}
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const key=d=>{const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
const fromKey=k=>{if(k instanceof Date)return new Date(k);const [y,m,d]=String(k).split("-").map(Number);return new Date(y,m-1,d)};
const mondayKey=d=>{const x=new Date(d);const n=x.getDay();x.setDate(x.getDate()-(n===0?6:n-1));return key(x)};
const daysLeft=d=>{const a=new Date();a.setHours(0,0,0,0);return Math.round((fromKey(d)-a)/86400000)};
const fmt=d=>fromKey(d).toLocaleDateString("ja-JP",{year:"numeric",month:"long",day:"numeric"});
const rem=d=>{const n=daysLeft(d);return n>0?"あと"+n+"日":n===0?"今日":Math.abs(n)+"日経過"};
let state;try{state=JSON.parse(localStorage.getItem("taskday-v3")||localStorage.getItem("taskday-v2")||'{"tasks":[],"countdowns":[],"completed":[]}')}catch(e){state={tasks:[],countdowns:[],completed:[]}}
state.tasks=(state.tasks||[]).filter(t=>t.type!=="daily");state.countdowns=state.countdowns||[];state.completed=state.completed||[];state.events=state.events||[];
let view=window.START_VIEW||"home",calDate=new Date(),selectedDate=new Date();
const save=()=>localStorage.setItem("taskday-v3",JSON.stringify(state));
function refresh(){
 const wk=mondayKey(new Date());
 state.tasks.forEach(t=>{if(t.type==="weekly"&&t.reset!==wk){t.done=false;t.reset=wk}});
 state.countdowns=state.countdowns.filter(c=>daysLeft(c.date)>=0);
 state.completed=state.completed.slice(0,5);
 save();
}
function complete(id){
 const el=document.querySelector('[data-complete="'+id+'"]');
 if(!el)return;
 window.__completeTimers=window.__completeTimers||{};
 if(el.dataset.pending==="1"){
   clearTimeout(window.__completeTimers[id]);
   delete window.__completeTimers[id];
   delete el.dataset.pending;
   el.classList.remove("done");
   el.textContent="";
   const card=el.closest(".card");
   if(card)card.classList.remove("completing");
   return;
 }
 el.dataset.pending="1";
 el.classList.add("done");
 el.textContent="✓";
 const card=el.closest(".card");
 if(card)card.classList.add("completing");
 window.__completeTimers[id]=setTimeout(()=>{
   if(el.dataset.pending!=="1")return;
   const t=state.tasks.find(x=>x.id===id);
   if(t){
     state.tasks=state.tasks.filter(x=>x.id!==id);
     state.completed.unshift({...t,done:true,completedAt:Date.now()});
     state.completed=state.completed.slice(0,5);
     save();render();
   }
   delete window.__completeTimers[id];
 },3000);
}
function taskCard(t){return '<div class="card"><div class="row"><button class="check" data-complete="'+t.id+'"></button><button class="task" data-edit="'+t.id+'"><div class="title">'+esc(t.title)+'</div>'+(t.date?'<div class="meta">'+(t.type==="long"?"長期":"短期")+" ・ "+fmt(t.date)+'</div>':"")+'</button>'+(t.date?'<div class="days '+(daysLeft(t.date)<0?"danger":daysLeft(t.date)===0?"today":"")+'">'+rem(t.date)+'</div>':"")+'</div></div>'}
function countdownCard(c){return '<div class="card"><button class="count" data-count="'+c.id+'"><div><b>'+esc(c.title)+'</b><div class="meta">'+fmt(c.date)+'</div></div><div class="days '+(daysLeft(c.date)<0?"danger":daysLeft(c.date)===0?"today":"")+'">'+rem(c.date)+'</div></button></div>'}
function renderHome(){
 refresh();
 const w=state.tasks.filter(t=>t.type==="weekly"),s=state.tasks.filter(t=>t.type==="short").sort((a,b)=>{
   if(a.date&&!b.date)return -1;
   if(!a.date&&b.date)return 1;
   if(!a.date&&!b.date)return 0;
   return a.date.localeCompare(b.date);
 });
state.countdowns.sort((a,b)=>daysLeft(a.date)-daysLeft(b.date));
 $("#app").innerHTML=
 '<header><div><h1>TaskDay</h1><div class="date">'+new Date().toLocaleDateString("ja-JP",{month:"long",day:"numeric",weekday:"long"})+'</div></div><button class="add" id="plus">＋</button></header>'+
 section("＋ 毎週のタスク","addW",w,true)+
 section("＋ 短期タスク","addS",s,false)+
 '<div class="section"><button class="section-title link" id="completedToggle">完了済みタスク</button>'+
 '<div id="completedPanel" style="display:none;margin-top:9px">'+
 (state.completed.length?state.completed.map(t=>
 '<div class="card"><div class="row"><button class="check done" data-restore="'+t.id+'" aria-label="復活">✓</button><div style="flex:1"><div class="title" style="text-decoration:line-through;color:#9aa0a6">'+esc(t.title)+'</div><div class="meta">'+(t.type==="weekly"?"毎週":t.type==="long"?"長期":"短期")+' ・ 完了済み</div></div></div></div>'
 ).join(""):'<div class="card empty">完了したタスクはありません</div>')+
 '</div></div>'+
 '<div class="section"><div class="section-head"><b class="section-title">あと何日</b><button class="link" id="addC">追加</button></div>'+
 (state.countdowns.length?state.countdowns.map(countdownCard).join(""):'<div class="card empty">追加から目標日を登録できます</div>')+'</div>';

 $("#plus").onclick=()=>openTask("short");
 $("#addC").onclick=()=>openCountdown();
 $("#addW").onclick=()=>openTask("weekly");
 $("#addS").onclick=()=>openTask("short");

 document.querySelectorAll("[data-restore]").forEach(b=>b.onclick=()=>{
   const t=state.completed.find(x=>x.id===b.dataset.restore);
   if(t){
     state.completed=state.completed.filter(x=>x.id!==t.id);
     t.done=false;delete t.completedAt;state.tasks.push(t);save();render();
   }
 });
 const completedToggle=$("#completedToggle"),completedPanel=$("#completedPanel");
 completedToggle.onclick=()=>{completedPanel.style.display=completedPanel.style.display==="none"?"block":"none"};
 bind();
}
function section(title,id,list,weekly){return '<div class="section"><div class="section-head"><button class="section-title link" id="'+id+'">'+title+'</button>'+(weekly?'<span class="small">毎週月曜に復活</span>':"")+'</div>'+(list.length?list.map(taskCard).join(""):'<div class="card empty">'+title+' をタップして追加</div>')+'</div>'}
function bind(){document.querySelectorAll("[data-complete]").forEach(b=>b.onclick=()=>complete(b.dataset.complete));document.querySelectorAll("[data-edit]").forEach(b=>longPress(b,()=>taskActions(b.dataset.edit)));document.querySelectorAll("[data-count]").forEach(b=>longPress(b,()=>countActions(b.dataset.count)));document.querySelectorAll("[data-event]").forEach(b=>longPress(b,()=>eventActions(b.dataset.event)))}
function longPress(el,fn){let timer;el.addEventListener("pointerdown",()=>timer=setTimeout(fn,600));["pointerup","pointercancel","pointerleave"].forEach(x=>el.addEventListener(x,()=>clearTimeout(timer)))}
function openTask(type,date,id){const old=id&&state.tasks.find(x=>x.id===id),t=old?.type||type,d=old?.date||(date?key(date):""),label=t==="weekly"?"毎週のタスク":t==="long"?"長期タスク":"短期タスク";$("#sheet").innerHTML='<h2>'+(old?"タスクを編集":label+"を追加")+'</h2><div class="field"><label>タスク名</label><input id="tt" placeholder="タスク名" value="'+esc(old?.title||"")+'"></div>'+(t==="weekly"?"":'<div class="field"><label>締め切り日</label><input id="td" type="date" value="'+esc(d)+'"></div>')+'<div class="actions"><button class="secondary" id="cancel">キャンセル</button><button class="primary" id="ok">保存</button></div>';showModal();$("#cancel").onclick=closeModal;$("#ok").onclick=()=>{const title=$("#tt").value.trim();if(!title)return;const dateVal=t==="weekly"?null:($("#td").value||null);if(old){old.title=title;old.type=t;old.date=dateVal}else state.tasks.push({id:crypto.randomUUID(),title,type:t,date:dateVal,done:false,reset:t==="weekly"?mondayKey(new Date()):""});save();closeModal();render()}}
function taskActions(id){const t=state.tasks.find(x=>x.id===id);if(!t)return;$("#sheet").innerHTML='<h2>'+esc(t.title)+'</h2><div class="actions"><button class="secondary" id="edit">編集</button><button class="primary" id="delete">削除</button></div>';showModal();$("#edit").onclick=()=>{closeModal();openTask(t.type,t.date,t.id)};$("#delete").onclick=()=>{state.tasks=state.tasks.filter(x=>x.id!==id);save();closeModal();render()}}
function openCountdown(date,id){const old=id&&state.countdowns.find(x=>x.id===id),d=old?.date||date||key(new Date());$("#sheet").innerHTML='<h2>'+(old?"あと何日を編集":"あと何日を追加")+'</h2><div class="field"><label>名前</label><input id="ct" value="'+esc(old?.title||"")+'"></div><div class="field"><label>目標日</label><input id="cd" type="date" value="'+d+'"></div><div class="actions"><button class="secondary" id="cancel">キャンセル</button><button class="primary" id="ok">保存</button></div>';showModal();$("#cancel").onclick=closeModal;$("#ok").onclick=()=>{const title=$("#ct").value.trim();if(!title)return;if(old){old.title=title;old.date=$("#cd").value}else state.countdowns.push({id:crypto.randomUUID(),title,date:$("#cd").value});save();closeModal();render()}}
function countActions(id){const c=state.countdowns.find(x=>x.id===id);if(!c)return;$("#sheet").innerHTML='<h2>'+esc(c.title)+'</h2><div class="actions"><button class="secondary" id="edit">編集</button><button class="primary" id="delete">削除</button></div>';showModal();$("#edit").onclick=()=>{closeModal();openCountdown(null,c.id)};$("#delete").onclick=()=>{state.countdowns=state.countdowns.filter(x=>x.id!==id);save();closeModal();render()}}

function openEvent(date,id){
 const old=id&&state.events.find(x=>x.id===id),d=old?.date||date||key(new Date());
 $("#sheet").innerHTML='<h2>'+(old?"予定を編集":"予定を追加")+'</h2><div class="field"><label>予定名</label><input id="et" placeholder="予定名" value="'+esc(old?.title||"")+'"></div><div class="actions"><button class="secondary" id="cancel">キャンセル</button><button class="primary" id="ok">保存</button></div>';
 showModal();
 $("#cancel").onclick=closeModal;
 $("#ok").onclick=()=>{
   const title=$("#et").value.trim(); if(!title)return;
   if(old){old.title=title;old.date=d}else state.events.push({id:crypto.randomUUID(),title,date:d});
   save();closeModal();render();
 };
}
function eventActions(id){
 const e=state.events.find(x=>x.id===id);if(!e)return;
 $("#sheet").innerHTML='<h2>'+esc(e.title)+'</h2><div class="meta">'+fmt(e.date)+' ・ 予定</div><div class="actions"><button class="secondary" id="edit">編集</button><button class="primary" id="delete">削除</button></div>';
 showModal();
 $("#edit").onclick=()=>{closeModal();openEvent(null,e.id)};
 $("#delete").onclick=()=>{state.events=state.events.filter(x=>x.id!==id);save();closeModal();render()};
}
function dateAddChoice(date){
 $("#sheet").innerHTML='<h2>'+fmt(date)+'に追加</h2><div class="actions" style="flex-direction:column"><button class="primary" id="addTask">短期タスクとして追加</button><button class="secondary" id="addEvent">予定として追加</button><button class="secondary" id="cancel">キャンセル</button></div>';
 showModal();
 $("#addTask").onclick=()=>{closeModal();openTask("short",date)};
 $("#addEvent").onclick=()=>{closeModal();openEvent(key(date))};
 $("#cancel").onclick=closeModal;
}
function dayActions(date){
 const k=key(date);
 const items=[
   ...state.tasks.filter(t=>t.type==="short"&&t.date===k).map(t=>({id:t.id,title:t.title,kind:"task"})),
   ...state.events.filter(e=>e.date===k).map(e=>({id:e.id,title:e.title,kind:"event"})),
   ...state.countdowns.filter(c=>c.date===k).map(c=>({id:c.id,title:c.title,kind:"countdown"}))
 ];
 const list=items.length?items.map(x=>{
   const fn=x.kind==="task"?"taskActions":x.kind==="event"?"eventActions":"countActions";
   const label=x.kind==="task"?"短期タスク":x.kind==="event"?"予定":"あと何日";
   return '<button class="day-action" data-kind="'+x.kind+'" data-id="'+x.id+'"><span>'+esc(x.title)+'</span><small>'+label+' ・ 編集/削除</small></button>';
 }).join(""):'<div class="empty">この日のラベルはありません</div>';
 $("#sheet").innerHTML='<h2>'+fmt(date)+'</h2><div class="day-action-list">'+list+'</div><div class="actions"><button class="secondary" id="cancel">閉じる</button></div>';
 showModal();
 $("#cancel").onclick=closeModal;
 document.querySelectorAll(".day-action").forEach(b=>longPress(b,()=>{
   const fn=b.dataset.kind==="task"?taskActions:b.dataset.kind==="event"?eventActions:countActions;
   closeModal();fn(b.dataset.id);
 }));
}

function showModal(){
  $("#modal").classList.add("show");
  document.body.classList.add("modal-open");
  requestAnimationFrame(()=>{
    const input=$("#tt")||$("#ct");
    if(input){input.focus();if(typeof input.select==="function")input.select();}
  });
}
function closeModal(){$("#modal").classList.remove("show");document.body.classList.remove("modal-open")}

function jpHolidays(y){
 const set=new Set();
 const add=(m,d)=>set.add(`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
 add(1,1); // 元日
 add(2,11); // 建国記念の日
 add(2,23); // 天皇誕生日
 add(4,29); // 昭和の日
 add(5,3); add(5,4); add(5,5); // 憲法記念日・みどりの日・こどもの日
 add(7,20); // 海の日（2026）
 add(8,11); // 山の日
 add(11,3); add(11,23); // 文化の日・勤労感謝の日
 // 成人の日：1月第2月曜
 let d=new Date(y,0,1); d.setDate(1+(8-d.getDay()+7)%7); add(1,d.getDate()+7);
 // 海の日以外の移動祝日
 d=new Date(y,8,1); d.setDate(1+(1-d.getDay()+7)%7); add(9,d.getDate()+14); // 敬老の日: 第3月曜
 d=new Date(y,9,1); d.setDate(1+(1-d.getDay()+7)%7); add(10,d.getDate()+7); // スポーツの日: 第2月曜
 // 春分・秋分（簡易計算、実用上のカレンダー範囲）
 const vernal=Math.floor(20.8431+0.242194*(y-1980)-Math.floor((y-1980)/4));
 const autumn=Math.floor(23.2488+0.242194*(y-1980)-Math.floor((y-1980)/4));
 add(3,vernal); add(9,autumn);
 // 振替休日（日曜の祝日を翌平日に）
 const original=[...set];
 original.forEach(k=>{
   const dt=fromKey(k);
   if(dt.getDay()===0){
     let nd=new Date(dt); nd.setDate(nd.getDate()+1);
     while(set.has(key(nd))) nd.setDate(nd.getDate()+1);
     set.add(key(nd));
   }
 });
 // 国民の休日（祝日に挟まれた平日）
 for(let m=1;m<=12;m++) for(let day=2;day<=30;day++){
   const dt=new Date(y,m-1,day);
   if(dt.getDay()===0||dt.getDay()===6) continue;
   const prev=new Date(dt); prev.setDate(day-1);
   const next=new Date(dt); next.setDate(day+1);
   if(set.has(key(prev))&&set.has(key(next))) set.add(key(dt));
 }
 return set;
}

function renderCalendar(){
 const y=calDate.getFullYear(),m=calDate.getMonth(),first=new Date(y,m,1),start=new Date(first);
 start.setDate(1-first.getDay());
 let cells="";
 for(let i=0;i<42;i++){
   const d=new Date(start);d.setDate(start.getDate()+i);
   const k=key(d),sel=k===key(selectedDate),today=k===key(new Date()),holiday=jpHolidays(d.getFullYear()).has(k),dow=d.getDay();
   const labels=[
     ...state.tasks.filter(t=>t.date===k && (t.type==="short"||t.type==="long")).map(t=>({text:t.title,type:"task",id:t.id})),
     ...state.events.filter(e=>e.date===k).map(e=>({text:e.title,type:"event",id:e.id})),
     ...state.countdowns.filter(c=>c.date===k).map(c=>({text:c.title,type:"countdown",id:c.id}))
   ];
   const labelHtml=labels.slice(0,5).map(x=>'<span class="cal-label '+x.type+'" data-label-kind="'+x.type+'" data-label-id="'+x.id+'">'+esc(x.text)+'</span>').join("");
   const dayClass=(d.getMonth()!==m?"other ":"")+(sel?"sel ":"")+(today?"today ":"")+(holiday?"holiday ":"")+(dow===0?"sunday ":"")+(dow===6?"saturday ":"");
   cells+='<button class="day '+dayClass+'" data-day="'+k+'"><span class="day-number">'+d.getDate()+'</span><span class="cal-labels">'+labelHtml+'</span></button>';
 }
 const k=key(selectedDate);
 const short=state.tasks.filter(t=>t.type==="short"&&t.date===k);
 const long=state.tasks.filter(t=>t.type==="long");
 const counts=state.countdowns.filter(c=>c.date===k);

 $("#app").innerHTML=`
 <header><div><h1>カレンダー</h1><div class="date">日付を選択</div></div></header>
 <div class="card calendar">
   <div class="calhead"><button id="prev">‹</button><b>${y}年 ${m+1}月</b><button id="next">›</button></div>
   <div class="week">${["日","月","火","水","木","金","土"].map(x=>"<div>"+x+"</div>").join("")}</div>
   <div class="grid">${cells}</div>
 </div>
 <div class="section">
   <div class="section-head"><b class="section-title">${fmt(selectedDate)}のタスク</b></div>
   ${short.map(taskCard).join("")||'<div class="card empty">この日の短期タスクはありません</div>'}
 </div>
 <div class="section">
   <div class="section-head"><b class="section-title">あと何日</b></div>
   ${counts.map(countdownCard).join("")||'<div class="card empty">この日が目標日のものはありません</div>'}
 </div>
 <div class="section">
   <div class="section-head"><button class="section-title link" id="addLT">＋ 長期タスク</button></div>
   ${long.length?long.map(taskCard).join(""):'<div class="card empty">長期タスクはありません</div>'}
 </div>`;

 $("#prev").onclick=()=>{calDate=new Date(y,m-1,1);renderCalendar()};
 $("#next").onclick=()=>{calDate=new Date(y,m+1,1);renderCalendar()};
 document.querySelectorAll("[data-day]").forEach(b=>{
   const k=b.dataset.day;
   let timer=null,longed=false;
   b.addEventListener("pointerdown",()=>{
     longed=false;
     timer=setTimeout(()=>{
       longed=true;
       selectedDate=fromKey(k);
       calDate=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1);
       dayActions(selectedDate);
     },600);
   });
   ["pointerup","pointercancel","pointerleave"].forEach(ev=>b.addEventListener(ev,()=>{if(timer)clearTimeout(timer)}));
   b.addEventListener("click",e=>{
     if(longed){e.preventDefault();e.stopPropagation();longed=false;return;}
     selectedDate=fromKey(k);
     calDate=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1);
     dateAddChoice(selectedDate);
   });
 });

 $("#addLT").onclick=()=>openTask("long",k);

 document.querySelectorAll("[data-label-id]").forEach(b=>longPress(b,()=>{
   const kind=b.dataset.labelKind,id=b.dataset.labelId;
   const fn=kind==="task"?taskActions:kind==="event"?eventActions:countActions;
   fn(id);
 }));
 bind();
}
function render(){if(view==="home")renderHome();else renderCalendar()}
if($("#modal"))$("#modal").addEventListener("click",function(e){if(e.target.id==="modal")closeModal()});
refresh();
render();
window.TaskDay={render,openTask,openCountdown};
})();