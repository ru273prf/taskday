(()=>{"use strict";
const SUPABASE_URL='https://uiyksvrxcfowdkmnsdeu.supabase.co';
const SUPABASE_KEY='sb_publishable_18Sdy8EEn-wVDIicAYKFtg_2UWaJ6Zs';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const key=d=>{const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
const dateOf=k=>{
 if(k instanceof Date)return new Date(k.getFullYear(),k.getMonth(),k.getDate());
 if(typeof k==="number"){const d=new Date(k);return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
 if(k&&typeof k==="object"){
  if(typeof k.study_date==="string")return dateOf(k.study_date);
  if(typeof k.start_date==="string")return dateOf(k.start_date);
  if(typeof k.end_date==="string")return dateOf(k.end_date);
 }
 const s=String(k??"").slice(0,10);
 const [y,m,d]=s.split("-").map(Number);
 return new Date(y,m-1,d);
};
const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const diffDays=(a,b)=>Math.round((dateOf(b)-dateOf(a))/86400000);
const fmt=k=>{const d=dateOf(k);return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`};
const minutesText=m=>`${Math.floor(m/60)}時間${String(m%60)}分`;
const money=m=>Math.round(m/60*1250).toLocaleString("ja-JP");
const DAY=86400000;
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

async function ensureZeroStudyLogs(){
 if(!user||!state.projects.length)return;
 const today=dateOf(new Date());
 const yesterday=addDays(today,-1);
 const rows=[];
 const groups=new Map();
 for(const pr of state.projects){
  const t=projectType(pr);
  if(!groups.has(t))groups.set(t,[]);
  groups.get(t).push(pr);
 }
 for(const [,projects] of groups){
  const representative=projects[0];
  const start=projects.reduce((d,pr)=>{const x=dateOf(pr.start_date);return x<d?x:d},dateOf(representative.start_date));
  const end=projects.reduce((d,pr)=>{const x=dateOf(pr.end_date);return x>d?x:d},dateOf(representative.end_date));
  const through=end<yesterday?end:yesterday;
  if(through<start)continue;
  const existing=new Set(logsFor(representative).map(x=>String(x.study_date).slice(0,10)));
  for(let d=start;d<=through;d=addDays(d,1)){
   const date=key(d);
   if(!existing.has(date)) rows.push({project_id:representative.id,user_id:user.id,study_date:date,minutes:0});
  }
 }
 if(!rows.length)return;
 const {data,error}=await sb.from("study_logs").insert(rows).select();
 if(error){console.error("Automatic zero study-log creation failed:",error);return;}
 state.logs.push(...(data||rows));
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
 await ensureZeroStudyLogs();
}
function auth(){$("#app").innerHTML=`<div class="card"><h2>勉強時間</h2><p class="note">TaskDayと同じアカウントで利用します。</p><button class="primary" onclick="login()">ログイン</button></div>`}
window.login=async()=>{const email=prompt("メールアドレス");if(!email)return;const pass=prompt("パスワード");if(!pass)return;const {error}=await sb.auth.signInWithPassword({email:email.trim(),password:pass});if(error)alert(error.message)};
function p(){return state.projects.find(x=>x.id===currentId)||state.projects[0]}
function projectType(pr){const n=Number(pr?.project_type);return Number.isInteger(n)&&n>=1&&n<=10?n:1}
function sharedProjects(pr){const t=projectType(pr);return state.projects.filter(x=>projectType(x)===t)}
function logsFor(pr){
 const ids=new Set(sharedProjects(pr).map(x=>x.id));
 const byDate=new Map();
 for(const row of state.logs){
  if(!ids.has(row.project_id))continue;
  const d=String(row.study_date).slice(0,10);
  const prev=byDate.get(d);
  // Same-type projects share one calendar/log stream. If old duplicate rows exist,
  // prefer a non-zero record over an automatically-created zero record.
  if(!prev || (Number(prev.minutes)||0)===0 && (Number(row.minutes)||0)>0) byDate.set(d,row);
 }
 return [...byDate.values()].sort((a,b)=>String(a.study_date).localeCompare(String(b.study_date)));
}
function total(pr){return logsFor(pr).reduce((a,x)=>a+(Number(x.minutes)||0),0)}
function logAt(pr,date){return logsFor(pr).find(x=>x.study_date===date)}

function durationDays(start,end){
 const a=dateOf(start),b=dateOf(end);
 return Math.max(1,Math.round((b-a)/DAY));
}
function hmFromMinutes(mins){
 mins=Math.max(0,Math.round(Number(mins)||0));
 return `${Math.floor(mins/60)}時間${mins%60}分`;
}
function metricMoneyFromMinutes(mins){
 const yen=(Number(mins)||0)/60*1250;
 if(yen>=100000000){
  const n=yen/100000000; return `${Number.isInteger(n)?n:n.toFixed(1)}億`;
 }
 if(yen>=10000){
  const n=yen/10000; return `${Number.isInteger(n)?n:n.toFixed(1)}万`;
 }
 return `${Math.round(yen)}円`;
}
function currentMetrics(pr){
 const target=Number(pr.goal_minutes)||0;
 const totalDays=Math.max(1,diffDays(pr.start_date,pr.end_date)+1);

 // Goal average = final target / inclusive project days.
 const targetAvg=target/totalDays;

 // Metrics are based on TODAY, and therefore use the records through
 // yesterday. Example: today 8/15 -> evaluate 8/12, 8/13, 8/14.
 const today=dateOf(new Date());
 const yesterday=addDays(today,-1);
 const start=dateOf(pr.start_date);
 const end=dateOf(pr.end_date);
 const through=yesterday<start?addDays(start,-1):(yesterday>end?end:yesterday);

 // Number of calendar days from project start through yesterday, inclusive.
 const elapsed=through<start?0:Math.min(totalDays,diffDays(pr.start_date,key(through))+1);

 // Missing past dates are automatically stored as 0 minutes, so this is
 // exactly the sum of all study records from start through yesterday.
 const actual=through<start?0:actualTotalAt(pr,key(through));

 // Actual average = total actual minutes / number of elapsed calendar days.
 const actualAvg=elapsed>0?actual/elapsed:0;

 // Progress compares actual cumulative time with the target cumulative time
 // that should have been achieved by yesterday.
 const targetThrough=targetAvg*elapsed;
 const progress=targetThrough>0?(actual/targetThrough)*100:0;

 // Forecast: if the current actual average continues, how many calendar days
 // are needed to complete the full target from the project start?
 // We count the start date as day 1, so N required days means start + (N - 1).
 const forecastDays=actualAvg>0?Math.max(1,Math.ceil(target/actualAvg)):null;
 const forecastDate=forecastDays?addDays(start,forecastDays-1):null;
 const forecastErrorDays=forecastDate?diffDays(end,forecastDate):null;

 return {targetAvg,actualAvg,progressDiff:progress-100,forecastDays,forecastDate,forecastErrorDays};
}

function render(){
 try{
 const pr=p();
 if(!pr){$("#app").innerHTML=`<div class="card empty">プロジェクトがありません。<button class="primary" onclick="projects()">＋ プロジェクトを作成</button></div>`;return}
 const t=total(pr),isMoney=mode==="money",metrics=currentMetrics(pr);
 const targetValue=isMoney?money(pr.goal_minutes)+"円":minutesText(pr.goal_minutes);
 const totalValue=isMoney?money(t)+"円":minutesText(t);
 $("#app").innerHTML=`<header><button class="project-btn" onclick="projects()">${esc(pr.name)} ▾</button><button class="settings" onclick="settings()">⚙ 設定</button></header>
 <div class="card">
  <div class="meta">${fmt(pr.start_date)} ～ ${fmt(pr.end_date)}</div>
  <div class="summary">
   <div><b>${targetValue}</b><span>目標${isMoney?"金額":"時間"}</span></div>
   <div><b>${totalValue}</b><span>これまでの合計${isMoney?"金額":"時間"}</span></div>
   <div><b>${isMoney?metricMoneyFromMinutes(metrics.targetAvg):hmFromMinutes(metrics.targetAvg)}</b><span>目標平均</span></div>
   <div><b>${isMoney?metricMoneyFromMinutes(metrics.actualAvg):hmFromMinutes(metrics.actualAvg)}</b><span>実績平均</span></div>
   <div><b>${metrics.progressDiff>=0?"+":""}${metrics.progressDiff.toFixed(1)}%</b><span>進度差</span></div>
  </div>
  <div class="forecast-box">
   <div><b>実績通りなら</b><strong>${metrics.forecastDate?fmt(metrics.forecastDate):"算出不可"}</strong></div>
   <div><b>目標終了日との差</b><strong>${metrics.forecastErrorDays===null?"—":metrics.forecastErrorDays===0?"±0日":metrics.forecastErrorDays<0?`-${Math.abs(metrics.forecastErrorDays)}日早い`:`+${metrics.forecastErrorDays}日遅い`}</strong></div>
   <small>目標時間 ÷ 実績平均 ${metrics.actualAvg>0?`= 約${metrics.forecastDays}日`:"（実績平均が0のため未算出）"}</small>
  </div>
  <div class="switch-row"><button onclick="toggleMode()">${isMoney?"⏱ 時間グラフ":"💴 金額グラフ"}</button></div>
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
function actualTotalAt(pr,date){
 const start=pr.start_date;
 return logsFor(pr).filter(x=>x.study_date>=start&&x.study_date<=date).reduce((a,x)=>a+x.minutes,0);
}
function formatAxis(v,moneyMode){
 if(moneyMode){
  if(v>=100000000){const n=v/100000000;return `${Number.isInteger(n)?n:n.toFixed(1)}億`;}
  if(v>=10000){const n=v/10000;return `${Number.isInteger(n)?n:n.toFixed(1)}万`;}
  return `${Math.round(v)}円`;
 }
 return `${Math.round(v)}h`;
}
function chart(pr,moneyMode){
 const W=700,H=310,L=68,R=18,T=18,B=48;
 const startDate=dateOf(pr.start_date),endDate=dateOf(pr.end_date);
 const viewStart=addDays(startDate,-1),viewEnd=endDate;
 const totalDays=Math.max(1,diffDays(key(viewStart),key(viewEnd)));
 const projectDays=Math.max(1,diffDays(pr.start_date,pr.end_date)+1);
 const actuals=logsFor(pr).filter(x=>String(x.study_date)>=String(pr.start_date)&&String(x.study_date)<=String(pr.end_date)).sort((a,b)=>String(a.study_date).localeCompare(String(b.study_date)));
 const x=d=>L+Math.max(0,Math.min(totalDays,(d-viewStart)/DAY))/totalDays*(W-L-R);
 const toValue=v=>moneyMode?v/60*1250:v/60;
 const actualValueAt=d=>toValue(actualTotalAt(pr,key(d)));

 // 目標は常に「開始日の前日・0h」を原点とする一本の直線。
 // 傾きはユーザー指定どおり、目標時間 ÷ (目標終了日 - プロジェクト開始日の日数)。
 const targetValue=toValue(pr.goal_minutes);
 const slopePerDay=targetValue/projectDays;
 const goalAt=d=>slopePerDay*Math.max(0,(d-viewStart)/DAY);
 const actualVals=actuals.map(l=>actualValueAt(dateOf(l.study_date)));
 const goalEndValue=goalAt(viewEnd);
 const maxVal=Math.max(1,goalEndValue,...actualVals,0);
 const y=v=>H-B-(Math.max(0,v)/maxVal)*(H-T-B);

 let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="勉強時間グラフ">`;
 for(let i=0;i<=4;i++){
  const v=maxVal*i/4,yy=y(v);
  s+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#e8ece9"/>`;
  s+=`<text x="${L-8}" y="${yy+4}" text-anchor="end" font-size="10" fill="#89908a">${formatAxis(v,moneyMode)}</text>`;
 }
 [0,Math.round(totalDays/2),totalDays].forEach(n=>{
  const d=addDays(viewStart,n);
  s+=`<text x="${x(d)}" y="${H-14}" text-anchor="middle" font-size="10" fill="#89908a">${d.getMonth()+1}/${d.getDate()}</text>`;
 });
 s+=`<line x1="${x(viewStart)}" y1="${y(0)}" x2="${x(viewEnd)}" y2="${y(goalEndValue)}" stroke="#555" stroke-width="2" stroke-dasharray="5 6"/>`;

 const pts=[`${x(viewStart)},${y(0)}`];
 actuals.forEach(l=>{
  const d=dateOf(l.study_date);
  pts.push(`${x(d)},${y(actualValueAt(d))}`);
 });
 s+=`<polyline points="${pts.join(" ")}" fill="none" stroke="#42ad5b" stroke-width="4"/>`;
 pts.forEach(q=>{const [cx,cy]=q.split(",");s+=`<circle cx="${cx}" cy="${cy}" r="4" fill="#42ad5b"/>`;});
 s+=`</svg>`;
 return s;
}

function holidaySet(year){
 const s=new Set();
 const addDate=(d)=>s.add(key(d));
 const add=(m,d)=>addDate(new Date(year,m-1,d));
 const nthMon=(month,n)=>{let d=new Date(year,month-1,1);let shift=(1-d.getDay()+7)%7;return new Date(year,month-1,1+shift+(n-1)*7)};
 const vernal=Math.floor(20.8431+0.242194*(year-1980)-Math.floor((year-1980)/4));
 const autumn=Math.floor(23.2488+0.242194*(year-1980)-Math.floor((year-1980)/4));
 // Japan's regular national holidays.
 add(1,1);                         // New Year's Day
 addDate(nthMon(1,2));             // Coming of Age Day
 add(2,11);                        // National Foundation Day
 add(2,23);                        // Emperor's Birthday
 add(3,vernal);                    // Vernal Equinox
 add(4,29);                        // Showa Day
 add(5,3); add(5,4); add(5,5);     // Constitution / Greenery / Children's Day
 addDate(nthMon(7,3));             // Marine Day
 add(8,11);                        // Mountain Day
 addDate(nthMon(9,3));             // Respect for the Aged Day
 add(9,autumn);                    // Autumnal Equinox
 addDate(nthMon(10,2));            // Sports Day
 add(11,3);                        // Culture Day
 add(11,23);                       // Labor Thanksgiving Day
 // 2020/2021 Olympic one-offs are historical and are intentionally omitted.
 // Substitute holidays: if a holiday falls on Sunday, the next non-holiday weekday becomes a holiday.
 const originals=[...s].map(x=>dateOf(x)).sort((a,b)=>a-b);
 for(const d of originals){
  if(d.getDay()===0){
   let sub=addDays(d,1);
   while(s.has(key(sub))) sub=addDays(sub,1);
   addDate(sub);
  }
 }
 // Citizen's holiday: a weekday between two national holidays.
 for(let m=1;m<=12;m++){
  const last=new Date(year,m,0).getDate();
  for(let day=2;day<last;day++){
   const d=new Date(year,m-1,day);
   if(d.getDay()===0||d.getDay()===6||s.has(key(d))) continue;
   if(s.has(key(addDays(d,-1)))&&s.has(key(addDays(d,1)))) addDate(d);
  }
 }
 return s;
}

function calendar(pr){
 const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0),startGrid=new Date(y,m,1-first.getDay()),endGrid=new Date(y,m+1,0+6-last.getDay());
 let cells="";
 for(let d=new Date(startGrid);d<=endGrid;d=addDays(d,1)){
  const k=key(d),l=logAt(pr,k),inRange=k>=pr.start_date&&k<=pr.end_date,todayKey=key(new Date()),recordable=inRange&&k<=todayKey,holiday=holidaySet(d.getFullYear()).has(k),dow=d.getDay();
  const colorClass=holiday||dow===0?"sunday":dow===6?"saturday":"";
  cells+=`<button class="day ${colorClass} ${d.getMonth()!==m?"other ":""}${inRange?"in-range ":""}${recordable?"recordable ":""}${l?.minutes?"has ":""}${k===selectedDate?"selected":""}" ${recordable?`onclick="selectDay('${k}')"`:""}>${d.getDate()}${l?`<small>${Math.floor(l.minutes/60)}h${l.minutes%60?String(l.minutes%60).padStart(2,"0"):""}</small>`:""}</button>`;
 }
 return `<div class="calhead"><button onclick="changeMonth(-1)">‹</button><div class="month-title">${y}年${m+1}月</div><button onclick="changeMonth(1)">›</button></div><div class="week">${["日","月","火","水","木","金","土"].map(x=>`<div>${x}</div>`).join("")}</div><div class="grid">${cells}</div>`;
}
window.changeMonth=n=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+n,1);render()}
window.selectDay=k=>{
 const pr=p();
 selectedDate=k;
 render();
 const todayKey=key(new Date());
 if(k>=pr.start_date&&k<=pr.end_date&&k<=todayKey)logDay(k);
 else if(k>todayKey) alert("未来の日付には勉強時間を登録できません。");
 else alert("この日はプロジェクト期間外です。");
}
window.projects=function projects(){
 const items=state.projects.map(x=>`<div class="project-item"><button class="project-main" onclick="switchProject('${x.id}')"><b>${esc(x.name)} ${x.id===currentId?"✓":""}</b><small>種類 ${projectType(x)}　${fmt(x.start_date)} ～ ${fmt(x.end_date)}　目標 ${minutesText(x.goal_minutes)}</small></button></div>`).join("");
 open(`<h2>プロジェクト</h2>${items}<button class="primary" onclick="newProject()">＋ 新規プロジェクト</button><button class="secondary" onclick="closeStudyModal()">閉じる</button>`);
}
window.switchProject=id=>{currentId=id;const pr=p();calendarMonth=new Date(dateOf(pr.start_date).getFullYear(),dateOf(pr.start_date).getMonth(),1);close();render()};

window.settings=function settings(){
 open(`<h2>設定</h2>
 <div class="row"><button onclick="projects()">📁 プロジェクト選択</button></div>
 <div class="row"><button onclick="goalEdit()">🎯 目標設定・変更</button></div>
 <div class="row"><button class="danger" style="background:none!important;color:#d84a4a!important" onclick="deleteProjectList()">🗑 プロジェクト削除</button></div>
 <button class="secondary" onclick="closeStudyModal()">閉じる</button>`);
}
window.goalEdit=function goalEdit(){
 const pr=p();
 open(`<h2>目標設定・変更</h2>
  <label class="label">新しい目標終了日</label>
  <input id="ge" class="input" type="date" min="${pr.start_date}" value="${pr.end_date}">
  <label class="label">新しい目標勉強時間（時間）</label>
  <input id="gg" class="input" type="number" min="0" step="0.25" value="${pr.goal_minutes/60}">
  <p class="note">目標開始日はプロジェクト作成時に設定した日で固定です。<br>目標を変更すると、前の目標線は消え、新しい目標から一本の直線として表示されます。</p>
  <button class="primary" onclick="saveGoal()">保存</button>
  <button class="secondary" onclick="closeStudyModal()">戻る</button>`);
}
window.saveGoal=async()=>{
 const pr=p(),end=$("#ge").value,h=Number($("#gg").value);
 if(!end||end<=pr.start_date||!Number.isFinite(h)||h<0){alert("新しい目標終了日・勉強時間を確認してください。");return}
 const minutes=Math.round(h*60);
 const r=await sb.from("study_projects").update({end_date:end,goal_minutes:minutes}).eq("id",pr.id).eq("user_id",user.id);
 if(r.error){alert("目標設定を変更できませんでした。\n\n"+r.error.message);return}
 // 履歴機能は廃止。過去の履歴データもこのプロジェクトについて削除する。
 const del=await sb.from("study_goal_history").delete().eq("project_id",pr.id).eq("user_id",user.id);
 if(del.error){alert("目標設定は更新されましたが、旧履歴の削除に失敗しました。\n\n"+del.error.message);}
 pr.end_date=end;pr.goal_minutes=minutes;
 state.goals=state.goals.filter(g=>g.project_id!==pr.id);
 closeStudyModal();render();
}

window.newProject=function newProject(){
 const types=Array.from({length:10},(_,i)=>i+1);
 open(`<h2>新規プロジェクト</h2>
 <label class="label">プロジェクト名</label><input id="pn" class="input" placeholder="例：TOEFL対策">
 <label class="label">開始日</label><input id="ps" class="input" type="date" value="${key(new Date())}">
 <label class="label">目標終了日</label><input id="pe" class="input" type="date">
 <label class="label">目標勉強時間（時間）</label><input id="pg" class="input" type="number" min="0" step="5" placeholder="60">
 <label class="label">種類（同じ数字のプロジェクトはカレンダー・勉強時間を共有）</label>
 <div class="wheels type-wheel-wrap">${wheel("projectType",types,1)}</div>
 <div class="note">種類は1～10。例：種類1のプロジェクト同士では、同じ勉強時間の記録を共有します。</div>
 <button class="primary" onclick="createProject()">保存</button><button class="secondary" onclick="closeStudyModal()">戻る</button>`);
}
window.createProject=async()=>{
 const name=$("#pn").value.trim()||"新規プロジェクト",start=$("#ps").value,end=$("#pe").value||start,h=Number($("#pg").value||0),type=Number($("#projectTypeWheel")?.dataset.selected||1);
 if(!start||end<start||!Number.isFinite(h)||h<0||!Number.isInteger(type)||type<1||type>10){alert("入力内容を確認してください。");return}
 const {data,error}=await sb.from("study_projects").insert({user_id:user.id,name,start_date:start,end_date:end,goal_minutes:Math.round(h*60),project_type:type}).select().single();
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
 const pr=state.projects.find(x=>x.id===id);if(!pr)return;
 const sameType=state.projects.filter(x=>x.id!==id&&projectType(x)===projectType(pr));
 // Keep shared study records alive if another project of the same type remains.
 if(sameType.length){
  const moved=await sb.from("study_logs").update({project_id:sameType[0].id}).eq("project_id",id).eq("user_id",user.id);
  if(moved.error){alert("共有勉強記録の移動に失敗しました。\n\n"+moved.error.message);return}
 }
 const r=await sb.from("study_projects").delete().eq("id",id).eq("user_id",user.id);
 if(r.error){alert(r.error.message);return}
 state.projects=state.projects.filter(x=>x.id!==id);state.logs=state.logs.filter(x=>x.project_id!==id);state.goals=state.goals.filter(x=>x.project_id!==id);
 currentId=state.projects[0]?.id||null;close();render();
}
function bindWheels(){
 document.querySelectorAll(".wheel-list").forEach(el=>{
  if(el.dataset.bound==="1")return;
  el.dataset.bound="1";
  const vals=JSON.parse(el.dataset.values||"[]");
  let index=Math.max(0,vals.indexOf(Number(el.dataset.selected)));
  let lastY=0,drag=false,carry=0;
  const STEP=42;
  const apply=i=>{
   index=Math.max(0,Math.min(vals.length-1,i));
   el.dataset.selected=String(vals[index]);
   el.style.transform=`translateY(${63-index*STEP}px)`;
   [...el.children].forEach((x,j)=>x.classList.toggle("selected",j===index));
  };
  const moveBy=dy=>{
   carry+=dy;
   while(Math.abs(carry)>=STEP){
    const dir=carry<0?1:-1;
    apply(index+dir);
    carry+=dir*STEP;
   }
  };
  el.addEventListener("pointerdown",e=>{drag=true;lastY=e.clientY;carry=0;el.setPointerCapture?.(e.pointerId);});
  el.addEventListener("pointermove",e=>{if(!drag)return;const dy=e.clientY-lastY;lastY=e.clientY;moveBy(dy);});
  el.addEventListener("pointerup",e=>{drag=false;carry=0;el.releasePointerCapture?.(e.pointerId);});
  el.addEventListener("pointercancel",()=>{drag=false;carry=0;});
  el.addEventListener("wheel",e=>{e.preventDefault();apply(index+(e.deltaY>0?1:-1));},{passive:false});
  apply(index);
 });
}
function logDay(date){
 const pr=p(),old=logAt(pr,date);
 if(date<pr.start_date||date>pr.end_date){alert("この日はプロジェクト期間外です。");return}
 const hm=old?.minutes||0,h=Math.floor(hm/60),m=hm%60;
 const hours=Array.from({length:16},(_,i)=>i),mins=Array.from({length:12},(_,i)=>i*5);
 open(`<h2>${fmt(date)} の勉強時間</h2><div class="wheels">${wheel("hours",hours,h)}${wheel("mins",mins,m)}</div><div class="note">上下にスワイプして時間・分を選択<br>時間：0～15時間　分：00～55分（5分刻み）</div><button class="primary" onclick="saveLog('${date}')">登録する</button><button class="secondary" onclick="closeStudyModal()">戻る</button>`);
}
function wheel(name,vals,sel){
 const idx=Math.max(0,vals.indexOf(sel));
 const label=v=>name==="mins"?String(v).padStart(2,"0"):String(v);
 return `<div class="wheel"><div id="${name}Wheel" class="wheel-list" data-selected="${vals[idx]}" data-values='${JSON.stringify(vals)}'>${vals.map((v,i)=>`<div class="wheel-item ${i===idx?"selected":""}">${label(v)}</div>`).join("")}</div></div>`;
}
window.saveLog=async date=>{
 const a=$("#hoursWheel"),b=$("#minsWheel");
 if(!a||!b){alert("時間・分の選択値を取得できませんでした。");return}
 const hv=Number(a.dataset.selected),mv=Number(b.dataset.selected),minutes=hv*60+mv,pr=p(),old=logAt(pr,date);
 // Same-type projects share one study-log stream.
 let r=old
  ?await sb.from("study_logs").update({minutes}).eq("id",old.id).eq("user_id",user.id)
  :await sb.from("study_logs").insert({project_id:pr.id,user_id:user.id,study_date:date,minutes});
 if(r.error){alert("勉強時間を保存できませんでした。\n\n"+r.error.message);return}
 await load();close();render();
}

window.toggleMode=function toggleMode(){mode=mode==="hours"?"money":"hours";render()}
function open(html){
 $("#sheet").innerHTML=html;
 $("#modal").classList.add("show");
 setTimeout(bindWheels,0);
}
function close(){ $("#modal").classList.remove("show"); }
window.closeStudyModal=close;
window.closeModal=close;

$("#modal").addEventListener("click",e=>{e.stopPropagation();});
init();
})();
