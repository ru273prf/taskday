(function(){
"use strict";
if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));}
if(window.caches){caches.keys().then(ks=>ks.forEach(k=>caches.delete(k)));}
const $=s=>document.querySelector(s);
const injectedStyle=document.createElement("style");
injectedStyle.textContent=`.day-number-row{display:flex;align-items:center;gap:3px;min-width:0;width:100%;overflow:hidden}.countdown-inline{display:inline-block;flex:1;min-width:0;margin:0;padding:0;background:transparent;border:0;border-radius:0;color:#555;font-size:11px;font-weight:400;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;text-align:left}
.day-detail{padding:2px 0}.day-detail-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.day-detail-head h2{margin:0;font-size:24px}.day-detail-close{width:42px;height:42px;border:0;border-radius:50%;background:#f1f3f5;color:#666;font-size:32px;line-height:1;cursor:pointer}.day-detail-list{display:flex;flex-direction:column;gap:8px}.day-detail-task{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #edf0f4}.day-detail-task-main{flex:1;min-width:0;border:0;background:transparent;text-align:left;padding:2px 0;cursor:pointer}.day-detail-task-title{display:block;font-size:17px;font-weight:700;overflow-wrap:anywhere}.day-detail-task-date{display:block;margin-top:3px;font-size:12px;color:#8a94a6}.day-detail-plus{display:block;margin:18px auto 2px;width:58px;height:58px;border:0;border-radius:50%;background:#111;color:#fff;font-size:32px;line-height:1;cursor:pointer}
.date-field{position:relative;height:56px;border:1px solid #e2e5ea;border-radius:14px;background:#fff;overflow:hidden}.date-display{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:18px;color:#111;pointer-events:none;z-index:1}.date-field input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;z-index:2}
@media(max-width:600px){.card.calendar{width:100% !important;box-sizing:border-box}.grid{grid-template-columns:repeat(7,minmax(0,1fr)) !important;gap:2px !important;width:100%}.day{min-width:0 !important;width:100% !important;min-height:104px !important;padding:6px 2px !important;overflow:hidden;box-sizing:border-box}.day-number{font-size:15px !important}.day-number-row{gap:3px !important}.countdown-inline{font-size:9px !important;color:#555 !important;font-weight:400 !important}.cal-labels{display:block !important;margin-top:3px !important}.cal-label{display:-webkit-box !important;font-size:10px !important;line-height:1.15 !important;white-space:normal !important;overflow:hidden !important;text-overflow:ellipsis !important;-webkit-line-clamp:2 !important;-webkit-box-orient:vertical !important;margin:2px 0 !important;padding:2px 2px !important;border-radius:3px !important;word-break:break-all !important}}`;
document.head.appendChild(injectedStyle);
const homeStyle=document.createElement("style");
homeStyle.textContent=`.countdown-only{margin-top:8px}.home-add{width:42px;height:42px;border:1px solid #dfe4e0;background:#fff;border-radius:11px;font-size:26px;line-height:1;font-weight:500;color:#222}.home-nav{position:fixed;bottom:0;left:0;right:0;height:68px;background:rgba(255,255,255,.97);border-top:1px solid #e1e5e2;display:flex;justify-content:center;gap:6px;z-index:100;box-shadow:0 -2px 12px rgba(0,0,0,.04)}.home-nav a{padding:10px 16px;border-radius:12px;color:#777;text-decoration:none;font-size:12px;display:flex;align-items:center;min-width:76px;min-height:46px;justify-content:center}.home-nav a.active{background:#edf7ef;color:#2d9147;font-weight:800}.modal{position:fixed;inset:0;background:rgba(0,0,0,.38);display:none;align-items:flex-end;justify-content:center;padding:12px;z-index:200}.modal.show{display:flex}.sheet{width:min(650px,100%);max-height:88dvh;overflow:auto;background:#fff;border-radius:24px 24px 18px 18px;padding:22px 18px}.sheet h2{margin:0 0 16px}.field{margin:13px 0}.field label{display:block;color:#777;font-size:12px;margin-bottom:6px}.field input{width:100%;padding:12px;border:1px solid #dfe4e0;border-radius:10px;background:#fff;box-sizing:border-box}.actions{display:flex;gap:8px;margin-top:12px}.actions button{flex:1;padding:13px;border-radius:11px;font-weight:800}.primary{border:0;background:#42ad5b;color:#fff}.secondary{border:1px solid #dfe4e0;background:#fff}@media(max-width:520px){.home-nav{justify-content:space-around;gap:0}.home-nav a{min-width:0;flex:1;padding-left:8px;padding-right:8px}.actions{flex-direction:column}}@media(min-width:521px){.modal{align-items:center}.sheet{border-radius:24px}}`
document.head.appendChild(homeStyle);

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const key=d=>{const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
const fromKey=k=>{if(k instanceof Date)return new Date(k);const [y,m,d]=String(k).split("-").map(Number);return new Date(y,m-1,d)};
const mondayKey=d=>{const x=new Date(d);const n=x.getDay();x.setDate(x.getDate()-(n===0?6:n-1));return key(x)};
const daysLeft=d=>{const a=new Date();a.setHours(0,0,0,0);return Math.round((fromKey(d)-a)/86400000)};
const fmt=d=>{const x=fromKey(d);return x.getFullYear()+"/"+(x.getMonth()+1)+"/"+x.getDate()};
const dateField=(id,value)=>'<div class="date-field"><span class="date-display" id="'+id+'Display">'+(value?fmt(value):'日付を選択')+'</span><input id="'+id+'" type="date" value="'+esc(value||'')+'" aria-label="締め切り日"></div>';
const rem=d=>{const n=daysLeft(d);return n>0?"あと"+n+"日":n===0?"今日":Math.abs(n)+"日経過"};
// ===== Supabase cloud sync =====
const SUPABASE_URL="https://uiyksvrxcfowdkmnsdeu.supabase.co";
const SUPABASE_KEY="sb_publishable_18Sdy8EEn-wVDIicAYKFtg_2UWaJ6Zs";
let sb=null,currentUser=null,cloudReady=false,syncing=false;

let state={tasks:[],countdowns:[],completed:[],events:[]};
try{
  const cached=JSON.parse(localStorage.getItem("taskday-v3")||localStorage.getItem("taskday-v2")||"null");
  if(cached){
    state.tasks=(cached.tasks||[]).filter(t=>t.type!=="daily");
    state.countdowns=cached.countdowns||[];
    state.completed=(cached.completed||[]).slice(0,5);
    state.events=cached.events||[];
  }
}catch(e){}

let view=window.START_VIEW||"home",calDate=new Date(),selectedDate=new Date();
const cacheSave=()=>localStorage.setItem("taskday-v3",JSON.stringify(state));

function rowFromItem(item,type){
  return {
    id:item.id,
    user_id:currentUser.id,
    name:item.title,
    type,
    due_date:item.date||null,
    completed:!!item.done,
    completed_at:item.completedAt?new Date(item.completedAt).toISOString():null
  };
}

function itemFromRow(r){
  return {
    id:r.id,
    title:r.name||"",
    date:r.due_date||null,
    type:r.type,
    done:!!r.completed,
    completedAt:r.completed_at?Date.parse(r.completed_at):undefined,
    reset:""
  };
}

async function cloudSave(){
  cacheSave();
  if(!sb||!currentUser||syncing)return;
  syncing=true;
  try{
    const rows=[
      ...state.tasks.map(t=>rowFromItem(t,t.type)),
      ...state.countdowns.map(c=>rowFromItem(c,"countdown")),
      ...state.events.map(e=>rowFromItem(e,"event")),
      ...state.completed.map(t=>rowFromItem(t,t.type))
    ];
    let r=await sb.from("tasks").delete().eq("user_id",currentUser.id);
    if(r.error)throw r.error;
    if(rows.length){
      r=await sb.from("tasks").insert(rows);
      if(r.error)throw r.error;
    }
  }catch(e){
    console.error("Supabase save failed:",e);
    alert("クラウドへの保存に失敗しました。");
  }finally{syncing=false;}
}

async function save(){await cloudSave();}

async function cloudLoad(){
  if(!sb||!currentUser)return;
  const {data,error}=await sb.from("tasks").select("*").eq("user_id",currentUser.id);
  if(error){console.error(error);alert("クラウドデータの読み込みに失敗しました。");return;}

  // 初回ログインでクラウドが空なら、既存のPCデータを1回だけ移行
  if((data||[]).length===0){
    const hasLocal=state.tasks.length||state.countdowns.length||state.events.length||state.completed.length;
    if(hasLocal){await cloudSave();return;}
  }

  state={tasks:[],countdowns:[],completed:[],events:[]};
  (data||[]).forEach(r=>{
    const x=itemFromRow(r);
    if(r.type==="countdown")state.countdowns.push(x);
    else if(r.type==="event")state.events.push(x);
    else if(r.completed)state.completed.push(x);
    else state.tasks.push(x);
  });
  state.completed.sort((a,b)=>(b.completedAt||0)-(a.completedAt||0));
  state.completed=state.completed.slice(0,5);
  cacheSave();
}

async function loadSupabase(){
  if(!window.supabase?.createClient){
    await new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
    });
  }
  sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}

function authUI(){
  if(document.getElementById("taskday-auth"))return;
  const w=document.createElement("div");
  w.id="taskday-auth";
  w.innerHTML=`<div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px">
  <div style="background:#fff;border-radius:18px;padding:24px;width:min(390px,100%);box-sizing:border-box">
  <h2 style="margin:0 0 8px">TaskDay</h2>
  <p style="color:#666;font-size:14px">PCとiPhoneで同じデータを使うためにログインしてください。</p>
  <input id="auth-email" type="email" placeholder="メールアドレス" autocomplete="email" style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border:1px solid #ddd;border-radius:10px">
  <input id="auth-pass" type="password" placeholder="パスワード" autocomplete="current-password" style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0 12px;border:1px solid #ddd;border-radius:10px">
  <div style="display:flex;gap:8px">
  <button id="auth-login" style="flex:1;padding:12px;border:0;border-radius:10px;background:#111;color:#fff">ログイン</button>
  <button id="auth-signup" style="flex:1;padding:12px;border:1px solid #ddd;border-radius:10px;background:#fff">新規登録</button>
  </div>
  <div id="auth-msg" style="margin-top:12px;color:#666;font-size:13px"></div>
  </div></div>`;
  document.body.appendChild(w);

  const email=w.querySelector("#auth-email"),pass=w.querySelector("#auth-pass"),msg=w.querySelector("#auth-msg");
  email.focus();

  w.querySelector("#auth-login").onclick=async()=>{
    msg.textContent="ログイン中…";
    const {error}=await sb.auth.signInWithPassword({email:email.value.trim(),password:pass.value});
    msg.textContent=error?error.message:"";
  };
  w.querySelector("#auth-signup").onclick=async()=>{
    msg.textContent="登録中…";
    const {data,error}=await sb.auth.signUp({email:email.value.trim(),password:pass.value,options:{emailRedirectTo:"https://ru273prf.github.io/taskday/"}});
    if(error)msg.textContent=error.message;
    else msg.textContent=data.session?"登録しました":"確認メールを確認してください。";
  };
  pass.addEventListener("keydown",e=>{if(e.key==="Enter")w.querySelector("#auth-login").click()});
}

async function initCloud(){
  try{
    await loadSupabase();
    const {data}=await sb.auth.getSession();
    currentUser=data.session?.user||null;
    if(currentUser){
      cloudReady=true;
      document.getElementById("taskday-auth")?.remove();
      await cloudLoad();
      refresh();
      render();
    }else{
      authUI();
    }

    sb.auth.onAuthStateChange(async(_event,session)=>{
      currentUser=session?.user||null;
      if(currentUser){
        cloudReady=true;
        document.getElementById("taskday-auth")?.remove();
        await cloudLoad();
        refresh();
        render();
      }else{
        cloudReady=false;
        authUI();
      }
    });
  }catch(e){
    console.error(e);
    alert("Supabaseへの接続に失敗しました。");
  }
}

function refresh(){
  const wk=mondayKey(new Date());
  state.tasks.forEach(t=>{if(t.type==="weekly"&&t.reset!==wk){t.done=false;t.reset=wk}});
  state.countdowns=state.countdowns.filter(c=>daysLeft(c.date)>=0);
  state.completed=state.completed.slice(0,5);
  cacheSave();
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
function countdownCard(c){return '<div class="card"><div class="count"><div><b>'+esc(c.title)+'</b><div class="meta">'+fmt(c.date)+'</div></div><div class="days '+(daysLeft(c.date)<0?"danger":daysLeft(c.date)===0?"today":"")+'">'+rem(c.date)+'</div></div></div>'}
function renderHome(){
 refresh();
 state.countdowns.sort((a,b)=>daysLeft(a.date)-daysLeft(b.date));
 const cards=state.countdowns.length
   ?state.countdowns.map(countdownCard).join("")
   :'<div class="card empty">登録されている目標日はありません</div>';
 $("#app").innerHTML=
   '<header><div><h1>あと何日</h1></div><button class="home-add" id="addCountdown" aria-label="あと何日を追加">＋</button></header>'+
   '<div class="section countdown-only">'+cards+'</div>';
 $("#addCountdown").onclick=()=>openCountdown();
 bind();
}
function section(title,id,list,weekly){return '<div class="section"><div class="section-head"><button class="section-title link" id="'+id+'">'+title+'</button>'+(weekly?'<span class="small">毎週月曜に復活</span>':"")+'</div>'+(list.length?list.map(taskCard).join(""):'<div class="card empty">'+title+' をタップして追加</div>')+'</div>'}
function bind(){document.querySelectorAll("[data-complete]").forEach(b=>b.onclick=()=>complete(b.dataset.complete));document.querySelectorAll("[data-edit]").forEach(b=>longPress(b,()=>taskActions(b.dataset.edit)));document.querySelectorAll("[data-count]").forEach(b=>longPress(b,()=>countActions(b.dataset.count)));document.querySelectorAll("[data-event]").forEach(b=>longPress(b,()=>eventActions(b.dataset.event)))}
function longPress(el,fn){let timer;el.addEventListener("pointerdown",()=>timer=setTimeout(fn,600));["pointerup","pointercancel","pointerleave"].forEach(x=>el.addEventListener(x,()=>clearTimeout(timer)))}
function openTask(type,date,id){const old=id&&state.tasks.find(x=>x.id===id),t=old?.type||type,d=old?.date||(date?key(date):""),label=t==="weekly"?"毎週のタスク":t==="long"?"長期タスク":"短期タスク";$("#sheet").innerHTML='<h2>'+(old?"タスクを編集":label+"を追加")+'</h2><div class="field"><label>タスク名</label><input id="tt" placeholder="タスク名" value="'+esc(old?.title||"")+'"></div>'+(t==="weekly"?"":'<div class="field"><label>締め切り日</label>'+dateField("td",d)+'</div>')+'<div class="actions"><button class="secondary" id="cancel">キャンセル</button><button class="primary" id="ok">保存</button></div>';showModal();if($("#td")){const syncDate=()=>{$("#tdDisplay").textContent=$("#td").value?fmt($("#td").value):"日付を選択"};$("#td").addEventListener("change",syncDate)}$("#cancel").onclick=closeModal;$("#ok").onclick=()=>{const title=$("#tt").value.trim();if(!title)return;const dateVal=t==="weekly"?null:($("#td").value||null);if(old){old.title=title;old.type=t;old.date=dateVal}else state.tasks.push({id:crypto.randomUUID(),title,type:t,date:dateVal,done:false,reset:t==="weekly"?mondayKey(new Date()):""});save();closeModal();render()}}
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
  dayActions(date);
}

function dayActions(date){
  const k=key(date);
  const short=state.tasks.filter(t=>t.type==="short"&&t.date===k);
  const list=short.length
    ? short.map(t=>`<div class="day-detail-task"><button class="check day-detail-check" data-complete="${t.id}"></button><button class="day-detail-task-main" data-edit="${t.id}"><span class="day-detail-task-title">${esc(t.title)}</span><span class="day-detail-task-date">${fmt(t.date)}</span></button></div>`).join("")
    : '<div class="empty">この日の短期タスクはありません</div>';
  $("#sheet").innerHTML=`<div class="day-detail"><div class="day-detail-head"><h2>${fmt(date)}</h2><button class="day-detail-close" id="dayDetailClose" aria-label="閉じる">×</button></div><div class="day-detail-list">${list}</div><button class="day-detail-plus" id="dayDetailPlus" aria-label="短期タスクを追加">＋</button></div>`;
  showModal();
  $("#dayDetailClose").onclick=closeModal;
  $("#dayDetailPlus").onclick=()=>{closeModal();openTask("short",date)};
  bind();
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
     ...state.events.filter(e=>e.date===k).map(e=>({text:e.title,type:"event",id:e.id}))
   ];
   const labelHtml=labels.slice(0,5).map(x=>'<span class="cal-label '+x.type+'" data-label-kind="'+x.type+'" data-label-id="'+x.id+'">'+esc(x.text)+'</span>').join("");
   const dayClass=(d.getMonth()!==m?"other ":"")+(sel?"sel ":"")+(today?"today ":"")+(holiday?"holiday ":"")+(dow===0?"sunday ":"")+(dow===6?"saturday ":"");
   const countdownInline=state.countdowns.filter(c=>c.date===k).map(c=>'<span class="countdown-inline" data-label-kind="countdown" data-label-id="'+c.id+'">'+esc(c.title)+'</span>').join("");
   cells+='<button class="day '+dayClass+'" data-day="'+k+'"><span class="day-number-row"><span class="day-number">'+d.getDate()+'</span>'+countdownInline+'</span><span class="cal-labels">'+labelHtml+'</span></button>';
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
     dayActions(selectedDate);
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
initCloud();
window.TaskDay={render,openTask,openCountdown};

// Study time is the main entry page (index.html); no legacy navigation injection.
})();
