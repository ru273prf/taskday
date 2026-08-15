(()=>{"use strict";
const SUPABASE_URL='https://uiyksvrxcfowdkmnsdeu.supabase.co';
const SUPABASE_KEY='sb_publishable_18Sdy8EEn-wVDIicAYKFtg_2UWaJ6Zs';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const key=d=>{const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
const dateOf=k=>{const [y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d)};
const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const diffDays=(a,b)=>Math.round((dateOf(b)-dateOf(a))/86400000);
const fmt=k=>{const d=dateOf(k);return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`};
const minutesText=m=>`${Math.floor(m/60)}時間${String(m%60).padStart(2,"0")}分`;
const money=m=>Math.round(m/60*1250).toLocaleString("ja-JP");
const DAY=86400000, MONTH_DAYS=30;
let user=null,state={projects:[],logs:[],goals:[]},currentId=null,mode="hours",selectedDate=key(new Date()),calendarMonth=new Date();

async function init(){
 const {data,error}=await sb.auth.getSession();
 if(error){console.error(error);alert("ログイン状態の取得に失敗しました。\n"+error.message);auth();return}
 user=data.session?.user||null;
 if(!user){auth();return}
 await load();
 if(!currentId&&state.projects[0])currentId=state.projects[0].id;
 render();
 sb.auth.onAuthStateChange(async(_,session)=>{
  user=session?.user||null;
  if(user){await load();if(!currentId&&state.projects[0])currentId=state.projects[0].id;render();}
 });
}
async function load(){
 const [p,l,g]=await Promise.all([
  sb.from("study_projects").select("*").order("created_at",{ascending:true}),
  sb.from("study_logs").select("*").order("study_date",{ascending:true}),
  sb.from("study_goal_history").select("*").order("change_date",{ascending:true})
 ]);
 const errors=[["study_projects",p.error],["study_logs",l.error],["study_goal_history",g.error]].filter(([,e])=>e);
 if(errors.length){
  console.error("Study data load errors:",errors);
  const detail=errors.map(([n,e])=>`${n}: ${e.message||e.code||"unknown error"}`).join("\n");
  alert("勉強時間データの読み込みに失敗しました。\n\n"+detail);
 }
 state.projects=p.data||[];state.logs=l.data||[];state.goals=g.data||[];
}
function auth(){$("#app").innerHTML=`<div class="card"><h2>勉強時間</h2><p class="note">TaskDayと同じアカウントで利用します。</p><button class="primary" onclick="login()">ログイン</button></div>`}
window.login=async()=>{const email=prompt("メールアドレス");if(!email)return;const pass=prompt("パスワード");if(!pass)return;const {error}=await sb.auth.signInWithPassword({email:email.trim(),password:pass});if(error)alert(error.message)};
function p(){return state.projects.find(x=>x.id===currentId)||state.projects[0]}
function logsFor(pr){return state.logs.filter(x=>x.project_id===pr.id)}
function total(pr){return logsFor(pr).reduce((a,x)=>a+x.minutes,0)}
function logAt(pr,date){return logsFor(pr).find(x=>x.study_date===date)}
function isLong(pr){return diffDays(pr.start_date,pr.end_date)>MONTH_DAYS}
function latestActualDate(pr){const ls=logsFor(pr).sort((a,b)=>a.study_date.localeCompare(b.study_date));return ls.length?ls[ls.length-1].study_date:null}
function fullRange(){
 viewMode="full";
 const pr=p();
 if(pr){
  viewStart=pr.start_date;
 }
 render();
}
function render(){
 try{
 const pr=p();
 if(!pr){$("#app").innerHTML=`<div class="card empty">プロジェクトがありません。<button class="primary" onclick="projects()">＋ プロジェクトを作成</button></div>`;return}
 const t=total(pr),isMoney=mode==="money";
 const targetValue=isMoney?money(pr.goal_minutes)+"円":minutesText(pr.goal_minutes);
 const totalValue=isMoney?money(t)+"円":minutesText(t);
 $("#app").innerHTML=`<header><button class="project-btn" onclick="projects()">${esc(pr.name)} ▾</button><button class="settings" onclick="settings()">⚙ 設定</button></header>
 <div class="card">
  <div class="meta">${fmt(pr.start_date)} ～ ${fmt(pr.end_date)}</div>
  <div class="summary"><div><b>${targetValue}</b><span>目標${isMoney?"金額":"時間"}</span></div><div><b>${totalValue}</b><span>これまでの合計${isMoney?"金額":"時間"}</span></div></div>
  <div class="switch-row"><button onclick="toggleMode()">${isMoney?"⏱ 時間グラフ":"💴 金額グラフ"}</button>${isLong(pr)?`<button onclick="toggleScale()">${viewMode(pr)==="full"?"1か月表示":"全期間"}</button>`:""}</div>
  ${chart(pr,isMoney)}
  <div class="legend"><span><i></i>目標</span><span><i class="actual"></i>実績</span></div>
 </div>
 <div class="card calendar-card"><div class="section-title">カレンダー</div>${calendar(pr)}</div>
 <button class="plus" onclick="logDay('${selectedDate}')">＋</button>`;
 }catch(err){
  console.error("Study render error:",err);
  $("#app").innerHTML=`<div class="card"><h2>勉強時間</h2><div class="warning">画面の表示中にエラーが発生しました。ページを再読み込みしてください。<br><small>${esc(err?.message||err)}</small></div></div>`;
 }
}
let scaleMode="auto";
function viewMode(pr){return isLong(pr)?scaleMode:"full"}
function toggleScale(){scaleMode=scaleMode==="full"?"auto":"full";render()}
function chart(pr,moneyMode){
 const W=700,H=310,L=60,R=18,T=18,B=48;
 let viewStart=dateOf(pr.start_date),viewEnd=dateOf(pr.end_date);
 if(isLong(pr)&&scaleMode!=="full"){
  const latest=latestActualDate(pr);
  let latestD=latest?dateOf(latest):dateOf(pr.start_date);
  const startD=dateOf(pr.start_date), endD=dateOf(pr.end_date);
  if(latestD<startD) latestD=startD;
  if(latestD>endD) latestD=endD;
  viewStart=addDays(latestD,-MONTH_DAYS);
  if(viewStart<dateOf(pr.start_date))viewStart=dateOf(pr.start_date);
  viewEnd=addDays(viewStart,MONTH_DAYS);
  if(viewEnd>dateOf(pr.end_date)){viewEnd=dateOf(pr.end_date);viewStart=addDays(viewEnd,-MONTH_DAYS);if(viewStart<dateOf(pr.start_date))viewStart=dateOf(pr.start_date)}
 }
 const days=Math.max(1,Math.round((viewEnd-viewStart)/DAY));
 const actuals=logsFor(pr).sort((a,b)=>a.study_date.localeCompare(b.study_date));
 const cumulativeAt=date=>actuals.filter(x=>x.study_date<=key(date)).reduce((a,x)=>a+x.minutes,0);
 const maxActual=Math.max(0,...actuals.filter(x=>x.study_date>=key(viewStart)&&x.study_date<=key(viewEnd)).map(x=>cumulativeAt(dateOf(x.study_date))));
 const maxGoal=Math.max(pr.goal_minutes,...state.goals.filter(g=>g.project_id===pr.id).map(g=>g.goal_minutes),1);
 const maxVal=moneyMode?Math.max(1,maxGoal/60*1250,maxActual/60*1250):Math.max(1,maxGoal,maxActual);
 const x=d=>L+Math.max(0,Math.min(days,(d-viewStart)/DAY))/days*(W-L-R);
 const y=v=>H-B-v/maxVal*(H-T-B);
 let s=`<svg class="chart" viewBox="0 0 ${W} ${H}">`;
 for(let i=0;i<=4;i++){const v=maxVal*i/4,yy=y(v);s+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#e8ece9"/><text x="${L-8}" y="${yy+4}" text-anchor="end" font-size="10" fill="#89908a">${moneyMode?Math.round(v).toLocaleString():Math.round(v)}</text>`}
 [0,Math.round(days/2),days].forEach(n=>{const d=addDays(viewStart,n);s+=`<text x="${x(d)}" y="${H-14}" text-anchor="middle" font-size="10" fill="#89908a">${d.getMonth()+1}/${d.getDate()}</text>`});
 const history=state.goals.filter(g=>g.project_id===pr.id).sort((a,b)=>a.change_date.localeCompare(b.change_date));
 const points=[{start:pr.start_date,end:pr.end_date,startVal:0,endVal:pr.goal_minutes}];
 let lastStart=pr.start_date,lastVal=0;
 history.forEach(g=>{points[points.length-1].end=g.change_date;points[points.length-1].endVal=g.value_at_change;points.push({start:g.change_date,end:g.end_date,startVal:g.value_at_change,endVal:g.goal_minutes});lastStart=g.change_date;lastVal=g.value_at_change});
 points.forEach(seg=>{
  const a=dateOf(seg.start),b=dateOf(seg.end);
  if(b<viewStart||a>viewEnd)return;
  const av=moneyMode?seg.startVal/60*1250:seg.startVal,bv=moneyMode?seg.endVal/60*1250:seg.endVal;
  s+=`<line x1="${x(a)}" y1="${y(av)}" x2="${x(b)}" y2="${y(bv)}" stroke="#555" stroke-width="2" stroke-dasharray="5 6"/>`;
 });
 let cum=0,pts=[];
 actuals.forEach(l=>{cum+=l.minutes;const d=dateOf(l.study_date);if(d>=viewStart&&d<=viewEnd){const v=moneyMode?cum/60*1250:cum;pts.push(`${x(d)},${y(v)}`)}});
 if(pts.length){s+=`<polyline points="${pts.join(" ")}" fill="none" stroke="#42ad5b" stroke-width="4"/>`;pts.forEach(q=>{const [cx,cy]=q.split(",");s+=`<circle cx="${cx}" cy="${cy}" r="4" fill="#42ad5b"/>`})}
 s+="</svg>";
 if(isLong(pr)&&scaleMode!=="full")s+=`<div class="chart-note">直近1か月を表示中（全期間を見るには「全期間」を押してください）</div>`;
 return s;
}
function calendar(pr){
 const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0),startGrid=new Date(y,m,1-first.getDay()),endGrid=new Date(y,m+1,0+6-last.getDay());
 let cells="";
 for(let d=new Date(startGrid);d<=endGrid;d=addDays(d,1)){
  const k=key(d),l=logAt(pr,k),inRange=k>=pr.start_date&&k<=pr.end_date;
  cells+=`<button class="day ${d.getMonth()!==m?"other ":""}${inRange?"in-range ":""}${l?.minutes?"has ":""}${k===selectedDate?"selected":""}" onclick="selectDay('${k}')">${d.getDate()}${l?`<small>${Math.floor(l.minutes/60)}h${l.minutes%60?String(l.minutes%60).padStart(2,"0"):""}</small>`:""}</button>`;
 }
 return `<div class="calhead"><button onclick="changeMonth(-1)">‹</button><div class="month-title">${y}年${m+1}月</div><button onclick="changeMonth(1)">›</button></div><div class="week">${["日","月","火","水","木","金","土"].map(x=>`<div>${x}</div>`).join("")}</div><div class="grid">${cells}</div>`;
}
window.changeMonth=n=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+n,1);render()}
window.selectDay=k=>{
 const pr=p();
 selectedDate=k;
 render();
 if(k>=pr.start_date&&k<=pr.end_date)logDay(k);
 else alert("この日はプロジェクト期間外です。");
}
window.projects=function projects(){
 const items=state.projects.map(x=>`<div class="project-item"><button class="project-main" onclick="switchProject('${x.id}')"><b>${esc(x.name)} ${x.id===currentId?"✓":""}</b><small>${fmt(x.start_date)} ～ ${fmt(x.end_date)}　目標 ${minutesText(x.goal_minutes)}</small></button></div>`).join("");
 open(`<h2>プロジェクト</h2>${items}<button class="primary" onclick="newProject()">＋ 新規プロジェクト</button><button class="secondary" onclick="close()">閉じる</button>`);
}
window.switchProject=id=>{currentId=id;const pr=p();calendarMonth=new Date(dateOf(pr.start_date).getFullYear(),dateOf(pr.start_date).getMonth(),1);close();render()};
window.settings=function settings(){
 open(`<h2>設定</h2>
 <div class="row"><button onclick="projects()">📁 プロジェクト選択</button></div>
 <div class="row"><button onclick="goalEdit()">🎯 目標設定・変更</button></div>
 <div class="row"><button class="danger" style="background:none!important;color:#d84a4a!important" onclick="deleteProjectList()">🗑 プロジェクト削除</button></div>
 <button class="secondary" onclick="close()">閉じる</button>`);
}
window.newProject=function newProject(){
 open(`<h2>新規プロジェクト</h2>
 <label class="label">プロジェクト名</label><input id="pn" class="input" placeholder="例：TOEFL対策">
 <label class="label">開始日</label><input id="ps" class="input" type="date" value="${key(new Date())}">
 <label class="label">目標終了日</label><input id="pe" class="input" type="date">
 <label class="label">目標勉強時間（時間）</label><input id="pg" class="input" type="number" min="0" step="5" placeholder="60">
 <button class="primary" onclick="createProject()">保存</button><button class="secondary" onclick="close()">戻る</button>`);
}
window.createProject=async()=>{
 const name=$("#pn").value.trim()||"新規プロジェクト",start=$("#ps").value,end=$("#pe").value||start,h=Number($("#pg").value||0);
 if(!start||end<start||!Number.isFinite(h)||h<0){alert("入力内容を確認してください。");return}
 const {data,error}=await sb.from("study_projects").insert({user_id:user.id,name,start_date:start,end_date:end,goal_minutes:Math.round(h*60)}).select().single();
 if(error){alert("プロジェクトを作成できませんでした。\n\n"+error.message);return}
 state.projects.push(data);currentId=data.id;calendarMonth=new Date(dateOf(start).getFullYear(),dateOf(start).getMonth(),1);close();render();
}
window.deleteProjectList=function deleteProjectList(){
 const items=state.projects.map(x=>`<div class="project-item"><button class="project-main" onclick="deleteConfirm('${x.id}')"><b>${esc(x.name)}</b><small>${fmt(x.start_date)} ～ ${fmt(x.end_date)}</small></button></div>`).join("");
 open(`<h2>削除するプロジェクトを選択</h2>${items||'<div class="empty">プロジェクトがありません。</div>'}<button class="secondary" onclick="settings()">戻る</button>`);
}
window.deleteConfirm=function deleteConfirm(id){
 const pr=state.projects.find(x=>x.id===id);if(!pr)return;
 open(`<h2>本当に削除しますか？</h2><p>「${esc(pr.name)}」と、このプロジェクトの勉強記録・目標履歴を削除します。<br>この操作は元に戻せません。</p>
 <button class="primary danger" onclick="confirmDelete('${id}')">削除する</button>
 <button class="secondary" onclick="deleteProjectList()">しない</button>`);
}
window.confirmDelete=async id=>{
 const r=await sb.from("study_projects").delete().eq("id",id).eq("user_id",user.id);
 if(r.error){alert(r.error.message);return}
 state.projects=state.projects.filter(x=>x.id!==id);state.logs=state.logs.filter(x=>x.project_id!==id);state.goals=state.goals.filter(x=>x.project_id!==id);
 currentId=state.projects[0]?.id||null;close();render();
}
function goalLineAt(pr,date){
 const targetDate=dateOf(date),hist=state.goals.filter(g=>g.project_id===pr.id).sort((a,b)=>a.change_date.localeCompare(b.change_date));
 let start=dateOf(pr.start_date),startVal=0,end=dateOf(pr.end_date),endVal=pr.goal_minutes;
 for(const g of hist){
  const ge=dateOf(g.change_date);
  if(targetDate<=ge)break;
  start=ge;startVal=g.value_at_change;end=dateOf(g.end_date);endVal=g.goal_minutes;
 }
 const span=Math.max(1,(end-start)/DAY);
 const pos=Math.max(0,Math.min(1,(targetDate-start)/DAY/span));
 return startVal+(endVal-startVal)*pos;
}
window.goalEdit=function goalEdit(){
 const pr=p();
 open(`<h2>目標設定・変更</h2>
 <label class="label">新しい目標開始日</label><input id="gs" class="input" type="date" min="${pr.start_date}" value="${selectedDate>=pr.start_date&&selectedDate<=pr.end_date?selectedDate:key(new Date())}">
 <label class="label">新しい目標終了日</label><input id="ge" class="input" type="date" min="${pr.start_date}" value="${pr.end_date}">
 <label class="label">新しい目標勉強時間（時間）</label><input id="gg" class="input" type="number" min="0" step="5" value="${pr.goal_minutes/60}">
 <p class="note">新しい目標開始日までは、それまでの目標の傾きを維持します。開始日以降は、新しい目標開始時点の目標座標から新しい終了日・目標時間へ向かう傾きになります。</p>
 <button class="primary" onclick="saveGoal()">保存</button><button class="secondary" onclick="close()">戻る</button>`);
}
window.saveGoal=async()=>{
 const pr=p(),start=$("#gs").value,end=$("#ge").value,h=Number($("#gg").value);
 if(!start||!end||end<=start||start<pr.start_date||!Number.isFinite(h)||h<0){alert("新しい目標の期間・時間を確認してください。");return}
 const valueAt=goalLineAt(pr,start);
 const {data,error}=await sb.from("study_goal_history").insert({project_id:pr.id,user_id:user.id,change_date:start,value_at_change:Math.round(valueAt),goal_minutes:Math.round(h*60),end_date:end}).select().single();
 if(error){alert("目標を変更できませんでした。\n\n"+error.message);return}
 state.goals.push(data);
 pr.end_date=end;pr.goal_minutes=Math.round(h*60);
 const r=await sb.from("study_projects").update({end_date:end,goal_minutes:Math.round(h*60)}).eq("id",pr.id).eq("user_id",user.id);
 if(r.error){alert(r.error.message);return}
 close();render();
}
window.logDay=
function bindWheels(){
 document.querySelectorAll(".wheel-list").forEach(el=>{
  if(el.dataset.bound==="1") return;
  el.dataset.bound="1";
  let startY=0,lastY=0,dragging=false,acc=0;
  const vals=JSON.parse(el.dataset.values||"[]");
  const clamp=i=>Math.max(0,Math.min(vals.length-1,i));
  const apply=i=>{
   i=clamp(i);
   el.dataset.selected=String(vals[i]);
   el.style.transform=`translateY(${52-i*42}px)`;
   el.querySelectorAll(".wheel-item").forEach((x,n)=>x.classList.toggle("sel",n===i));
  };
  const current=()=>Math.max(0,vals.indexOf(Number(el.dataset.selected)));
  const moveBy=delta=>{
   acc+=delta;
   while(Math.abs(acc)>=42){
    const dir=acc<0?1:-1;
    apply(current()+dir);
    acc+=dir*42;
   }
  };
  el.addEventListener("pointerdown",e=>{
   dragging=true;startY=lastY=e.clientY;acc=0;
   el.setPointerCapture?.(e.pointerId);
  });
  el.addEventListener("pointermove",e=>{
   if(!dragging)return;
   const dy=e.clientY-lastY; lastY=e.clientY; moveBy(dy);
  });
  el.addEventListener("pointerup",e=>{
   dragging=false; el.releasePointerCapture?.(e.pointerId);
  });
  el.addEventListener("pointercancel",()=>dragging=false);
  el.addEventListener("wheel",e=>{
   e.preventDefault();
   moveBy(-Math.sign(e.deltaY)*42);
  },{passive:false});
 });
}

function logDay(date){
 const pr=p(),old=logAt(pr,date);
 if(date<pr.start_date||date>pr.end_date){alert("この日はプロジェクト期間外です。");return}
 const hm=old?.minutes||0,h=Math.floor(hm/60),m=hm%60;
 const hours=Array.from({length:16},(_,i)=>i),mins=Array.from({length:12},(_,i)=>i*5);
 open(`<h2>${fmt(date)} の勉強時間</h2><div class="wheels">${wheel("hours",hours,h)}${wheel("mins",mins,m)}</div><div class="note">上下にスワイプして時間・分を選択<br>時間：0～15時間　分：0～55分（5分刻み）</div>
 <button class="primary" onclick="saveLog('${date}')">登録する</button><button class="secondary" onclick="close()">戻る</button>`);
}
function wheel(name,vals,sel){
 const idx=Math.max(0,vals.indexOf(sel));
 return `<div class="wheel"><div id="${name}Wheel" class="wheel-list" data-index="${idx}" data-values='${JSON.stringify(vals)}'>${vals.map((v,i)=>`<div class="wheel-item ${i===idx?"selected":""}">${String(v).padStart(2,"0")}</div>`).join("")}</div></div>`;
}
function wheelBind(el){
 let y=0,drag=false;
 const move=clientY=>{const dy=clientY-y;if(Math.abs(dy)<18)return;const vals=JSON.parse(el.dataset.values);let i=Number(el.dataset.index)+(dy<0?1:-1);i=Math.max(0,Math.min(vals.length-1,i));el.dataset.index=i;el.style.transform=`translateY(${65-i*40}px)`;[...el.children].forEach((x,j)=>x.classList.toggle("selected",j===i));y=clientY};
 el.ontouchstart=e=>{y=e.touches[0].clientY};
 el.ontouchmove=e=>{e.preventDefault();move(e.touches[0].clientY)};
 el.ontouchend=()=>{};
 el.onmousedown=e=>{drag=true;y=e.clientY};
 el.onmousemove=e=>{if(drag)move(e.clientY)};
 el.onmouseup=()=>{drag=false};
 el.onmouseleave=()=>{drag=false};
}
window.saveLog=async date=>{
 const a=$("#hoursWheel"),b=$("#minsWheel"),hv=JSON.parse(a.dataset.values)[Number(a.dataset.index)],mv=JSON.parse(b.dataset.values)[Number(b.dataset.index)],minutes=hv*60+mv,pr=p(),old=logAt(pr,date);
 let r=old?await sb.from("study_logs").update({minutes}).eq("id",old.id).eq("user_id",user.id):await sb.from("study_logs").insert({project_id:pr.id,user_id:user.id,study_date:date,minutes});
 if(r.error){alert("勉強時間を保存できませんでした。\n\n"+r.error.message);return}
 await load();close();render();
}
window.toggleMode=function toggleMode(){mode=mode==="hours"?"money":"hours";render()}
function open(html){$("#sheet").innerHTML=html;$("#modal").classList.add("show");setTimeout(()=>document.querySelectorAll(".wheel-list").forEach(w=>{w.style.transform=`translateY(${65-Number(w.dataset.index)*40}px)`;wheelBind(w)}),0)}
function close(){$("#modal").classList.remove("show")}
$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")return});
init();
})();

document.addEventListener("click",e=>{
 const b=e.target.closest("button");
 if(!b)return;
 const t=(b.textContent||"").trim();
 if(t==="戻る"||t==="閉じる"){
  e.preventDefault();
  e.stopPropagation();
  close();
 }
});
