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
  <div class="switch-row"><button onclick="toggleMode()">${isMoney?"⏱ 時間グラフ":"💴 金額グラフ"}</button></div>
  ${chart(pr,isMoney)}
  <div class="legend"><span><i></i>目標</span><span><i class="actual"></i>実績</span></div>
  <button class="secondary chart-history-btn" onclick="goalHistory()">📋 このプロジェクトの目標設定履歴</button>
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
  if(v>=100000000)return `${(v/100000000).toFixed(v%100000000?1:0)}億`;
  if(v>=10000)return `${(v/10000).toFixed(v%10000?1:0)}万`;
  return `${Math.round(v)}円`;
 }
 return `${Math.round(v)}h`;
}
function chart(pr,moneyMode){
 const W=700,H=310,L=62,R=18,T=18,B=48;
 const startDate=dateOf(pr.start_date),endDate=dateOf(pr.end_date);
 const viewStart=addDays(startDate,-1),viewEnd=endDate;
 const days=Math.max(1,Math.round((viewEnd-viewStart)/DAY));
 const actuals=logsFor(pr).filter(x=>x.study_date>=pr.start_date&&x.study_date<=pr.end_date).sort((a,b)=>a.study_date.localeCompare(b.study_date));
 const history=state.goals.filter(g=>g.project_id===pr.id).sort((a,b)=>a.change_date.localeCompare(b.change_date));
 const actualAt=d=>actualTotalAt(pr,key(d));
 const x=d=>L+Math.max(0,Math.min(days,(d-viewStart)/DAY))/days*(W-L-R);
 const toValue=v=>moneyMode?v/60*1250:v/60;
 // Goal segments: the graph always starts at (day before start, 0).
 // Before a change, the previous slope is preserved. From a change date onward,
 // the new line starts at the actual cumulative study time on that date.
 const segments=[];
 let segStart=viewStart,segStartVal=0;
 if(history.length){
  const first=history[0];
  segments.push({start:segStart,startVal:0,end:dateOf(first.change_date),endVal:first.value_at_change});
  for(let i=0;i<history.length;i++){
   const g=history[i],next=history[i+1];
   const end=next?dateOf(next.change_date):endDate;
   segments.push({start:dateOf(g.change_date),startVal:actualAt(g.change_date),end,endVal:g.goal_minutes});
  }
 }else{
  segments.push({start:viewStart,startVal:0,end:endDate,endVal:pr.goal_minutes});
 }
 const goalVals=segments.flatMap(seg=>[toValue(seg.startVal),toValue(seg.endVal)]);
 const actualVals=actuals.map(l=>toValue(actualAt(l.study_date)));
 const maxVal=Math.max(1,...goalVals,...actualVals,0);
 const y=v=>H-B-Math.max(0,v)/maxVal*(H-T-B);
 let s=`<svg class="chart" viewBox="0 0 ${W} ${H}">`;
 for(let i=0;i<=4;i++){
  const v=maxVal*i/4,yy=y(toValue(v));
  s+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#e8ece9"/><text x="${L-8}" y="${yy+4}" text-anchor="end" font-size="10" fill="#89908a">${formatAxis(v,moneyMode)}</text>`;
 }
 [0,Math.round(days/2),days].forEach(n=>{const d=addDays(viewStart,n);s+=`<text x="${x(d)}" y="${H-14}" text-anchor="middle" font-size="10" fill="#89908a">${d.getMonth()+1}/${d.getDate()}</text>`});
 segments.forEach(seg=>{
  const a=seg.start,b=seg.end;
  if(b<viewStart||a>viewEnd)return;
  const aa=a<viewStart?viewStart:a,bb=b>viewEnd?viewEnd:b;
  const span=Math.max(1,(b-a)/DAY);
  const av=toValue(seg.startVal),bv=toValue(seg.endVal);
  const valueAt=d=>av+(bv-av)*((d-a)/DAY)/span;
  s+=`<line x1="${x(aa)}" y1="${y(valueAt(aa))}" x2="${x(bb)}" y2="${y(valueAt(bb))}" stroke="#555" stroke-width="2" stroke-dasharray="5 6"/>`;
 });
 // Actual line always starts at the origin on the day before the project starts.
 const pts=[`${x(viewStart)},${y(0)}`];
 let seen=false;
 actuals.forEach(l=>{
  const d=dateOf(l.study_date);
  if(d>=viewStart&&d<=viewEnd){
   pts.push(`${x(d)},${y(toValue(actualAt(l.study_date)))}`);seen=true;
  }
 });
 if(seen){
  s+=`<polyline points="${pts.join(" ")}" fill="none" stroke="#42ad5b" stroke-width="4"/>`;
  pts.forEach(q=>{const [cx,cy]=q.split(",");s+=`<circle cx="${cx}" cy="${cy}" r="4" fill="#42ad5b"/>`});
 }else{
  s+=`<circle cx="${x(viewStart)}" cy="${y(0)}" r="4" fill="#42ad5b"/>`;
 }
 s+="</svg>";
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
  const k=key(d),l=logAt(pr,k),inRange=k>=pr.start_date&&k<=pr.end_date,holiday=holidaySet(d.getFullYear()).has(k),dow=d.getDay();
  const colorClass=holiday||dow===0?"sunday":dow===6?"saturday":"";
  cells+=`<button class="day ${colorClass} ${d.getMonth()!==m?"other ":""}${inRange?"in-range ":""}${l?.minutes?"has ":""}${k===selectedDate?"selected":""}" onclick="selectDay('${k}')">${d.getDate()}${l?`<small>${Math.floor(l.minutes/60)}h${l.minutes%60?String(l.minutes%60).padStart(2,"0"):""}</small>`:""}</button>`;
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
 open(`<h2>プロジェクト</h2>${items}<button class="primary" onclick="newProject()">＋ 新規プロジェクト</button><button class="secondary" onclick="closeStudyModal()">閉じる</button>`);
}
window.switchProject=id=>{currentId=id;const pr=p();calendarMonth=new Date(dateOf(pr.start_date).getFullYear(),dateOf(pr.start_date).getMonth(),1);close();render()};

function goalTargetAt(pr,date){
 const target=dateOf(date),hist=state.goals.filter(g=>g.project_id===pr.id).sort((a,b)=>a.change_date.localeCompare(b.change_date));
 if(hist.length===0){
  const a=dateOf(pr.start_date),b=dateOf(pr.end_date),span=Math.max(1,(b-a)/DAY);
  return pr.goal_minutes*Math.max(0,Math.min(1,(target-a)/DAY/span));
 }
 const first=hist[0],firstDate=dateOf(first.change_date);
 if(target<=firstDate){
  const a=dateOf(pr.start_date),span=Math.max(1,(firstDate-a)/DAY);
  return first.value_at_change*Math.max(0,Math.min(1,(target-a)/DAY/span));
 }
 for(let i=0;i<hist.length;i++){
  const g=hist[i],a=dateOf(g.change_date),next=hist[i+1],b=next?dateOf(next.change_date):dateOf(g.end_date);
  const av=actualTotalAt(pr,g.change_date),bv=g.goal_minutes,span=Math.max(1,(b-a)/DAY);
  if(target<=b){return av+(bv-av)*Math.max(0,Math.min(1,(target-a)/DAY/span));}
 }
 return hist[hist.length-1].goal_minutes;
}
function goalHistoryItems(pr){
 const rows=state.goals.filter(g=>g.project_id===pr.id).sort((a,b)=>String(b.change_date).localeCompare(String(a.change_date))).slice(0,5);
 if(!rows.length)return `<div class="note">このプロジェクトの目標設定変更履歴はありません。</div>`;
 return rows.map(g=>{
  const span=Math.max(1,diffDays(g.change_date,g.end_date));
  const actual=actualTotalAt(pr,g.change_date);
  const daily=Math.max(0,(g.goal_minutes-actual)/span);
  return `<div class="history-row"><div class="history-main"><b>${fmt(g.change_date)}から</b><span>終了：${fmt(g.end_date)}</span><span>目標：${minutesText(g.goal_minutes)}</span><span>1日：約${(daily/60).toFixed(2)}時間</span></div><button class="secondary small" onclick="editGoalHistory('${g.id}')">変更</button></div>`;
 }).join("");
}
window.goalHistory=function goalHistory(){
 const pr=p();if(!pr)return;
 open(`<h2>「${esc(pr.name)}」の目標設定履歴</h2><p class="note">最新5件を表示しています。</p><div class="history-list">${goalHistoryItems(pr)}</div><button class="secondary" onclick="closeStudyModal()">閉じる</button>`);
}
window.editGoalHistory=function editGoalHistory(id){
 const g=state.goals.find(x=>x.id===id);if(!g)return;
 open(`<h2>目標設定を変更</h2>
  <label class="label">設定方法</label>
  <select id="ghmode" class="input" onchange="toggleGoalMode('gh')"><option value="total">新しい目標時間</option><option value="daily">1日の勉強時間</option></select>
  <label class="label">新しい目標開始日</label><input id="ghs" class="input" type="date" value="${g.change_date}">
  <label class="label">新しい目標終了日</label><input id="ghe" class="input" type="date" value="${g.end_date}">
  <label class="label" id="ghvalueLabel">新しい勉強時間（時間）</label><input id="ghvalue" class="input" type="number" min="0" step="0.25" value="${g.goal_minutes/60}">
  <p class="note">新しい開始日までは以前の目標の傾きを維持します。新しい開始日からは、その日の実績を起点に新しい目標を設定します。</p>
  <button class="primary" onclick="saveGoalHistoryEdit('${g.id}')">保存</button><button class="secondary" onclick="goalHistory()">戻る</button>`);
}
window.toggleGoalMode=function(prefix){
 const modeEl=$(`#${prefix}mode`),label=$(`#${prefix}valueLabel`),input=$(`#${prefix}value`);if(!modeEl||!label||!input)return;
 if(modeEl.value==='daily'){label.textContent='1日の勉強時間（時間）';input.step='0.25';}
 else{label.textContent='新しい目標時間（時間）';input.step='0.25';}
}
window.saveGoalHistoryEdit=async function(id){
 const g=state.goals.find(x=>x.id===id);if(!g)return;
 const start=$('#ghs').value,end=$('#ghe').value,h=Number($('#ghvalue').value),type=$('#ghmode').value,pr=p();
 if(!start||!end||end<=start||start<pr.start_date||!Number.isFinite(h)||h<0){alert('入力内容を確認してください。');return}
 const actual=actualTotalAt(pr,start),days=Math.max(1,diffDays(start,end));
 const endpoint=type==='daily'?Math.round(actual+h*60*days):Math.round(h*60);
 const oldTarget=goalTargetAt(pr,start);
 const {data,error}=await sb.from('study_goal_history').update({change_date:start,end_date:end,goal_minutes:endpoint,value_at_change:Math.round(oldTarget)}).eq('id',id).select().single();
 if(error){alert('履歴を変更できませんでした。\n\n'+error.message);return}
 const i=state.goals.findIndex(x=>x.id===id);if(i>=0)state.goals[i]=data;
 const latest=state.goals.filter(x=>x.project_id===pr.id).sort((a,b)=>String(b.change_date).localeCompare(String(a.change_date)))[0];
 if(latest&&latest.id===id){
  const r=await sb.from('study_projects').update({end_date:end,goal_minutes:endpoint}).eq('id',pr.id).eq('user_id',user.id);
  if(r.error){alert(r.error.message);return}
  pr.end_date=end;pr.goal_minutes=endpoint;
 }
 closeStudyModal();render();
}
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
  <label class="label">設定方法</label>
  <select id="gmode" class="input" onchange="toggleGoalMode('g')"><option value="total">新しい目標時間</option><option value="daily">1日の勉強時間</option></select>
  <label class="label">新しい目標開始日</label><input id="gs" class="input" type="date" min="${pr.start_date}" value="${selectedDate>=pr.start_date&&selectedDate<=pr.end_date?selectedDate:pr.start_date}">
  <label class="label">新しい目標終了日</label><input id="ge" class="input" type="date" min="${pr.start_date}" value="${pr.end_date}">
  <label class="label" id="gvalueLabel">新しい目標時間（時間）</label><input id="gvalue" class="input" type="number" min="0" step="0.25" value="${pr.goal_minutes/60}">
  <p class="note">新しい開始日までは、それまでの目標の傾きをそのまま維持します。新しい開始日以降は、その日の実績を起点に新しい目標を引きます。</p>
  <button class="primary" onclick="saveGoal()">保存</button><button class="secondary" onclick="closeStudyModal()">戻る</button>`);
}
window.saveGoal=async()=>{
 const pr=p(),start=$('#gs').value,end=$('#ge').value,h=Number($('#gvalue').value),type=$('#gmode').value;
 if(!start||!end||end<=start||start<pr.start_date||!Number.isFinite(h)||h<0){alert('新しい目標の期間・時間を確認してください。');return}
 const actual=actualTotalAt(pr,start),days=Math.max(1,diffDays(start,end));
 const endpoint=type==='daily'?Math.round(actual+h*60*days):Math.round(h*60);
 const oldTarget=goalTargetAt(pr,start);
 const {data,error}=await sb.from('study_goal_history').insert({project_id:pr.id,user_id:user.id,change_date:start,value_at_change:Math.round(oldTarget),goal_minutes:endpoint,end_date:end}).select().single();
 if(error){alert('目標を変更できませんでした。\n\n'+error.message);return}
 state.goals.push(data);
 pr.end_date=end;pr.goal_minutes=endpoint;
 const r=await sb.from('study_projects').update({end_date:end,goal_minutes:endpoint}).eq('id',pr.id).eq('user_id',user.id);
 if(r.error){alert(r.message||r.error.message);return}
 closeStudyModal();render();
}

window.newProject=function newProject(){
 open(`<h2>新規プロジェクト</h2>
 <label class="label">プロジェクト名</label><input id="pn" class="input" placeholder="例：TOEFL対策">
 <label class="label">開始日</label><input id="ps" class="input" type="date" value="${key(new Date())}">
 <label class="label">目標終了日</label><input id="pe" class="input" type="date">
 <label class="label">目標勉強時間（時間）</label><input id="pg" class="input" type="number" min="0" step="5" placeholder="60">
 <button class="primary" onclick="createProject()">保存</button><button class="secondary" onclick="closeStudyModal()">戻る</button>`);
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
 <button class="primary" onclick="saveGoal()">保存</button><button class="secondary" onclick="closeStudyModal()">戻る</button>`);
}
window.saveGoal=async()=>{
 const pr=p(),start=$("#gs").value,end=$("#ge").value,h=Number($("#gg").value);
 if(!start||!end||end<=start||start<pr.start_date||start>pr.end_date||!Number.isFinite(h)||h<0){alert("新しい目標の期間・時間を確認してください。");return}
 const valueAt=goalLineAt(pr,start);
 const {data,error}=await sb.from("study_goal_history").insert({project_id:pr.id,user_id:user.id,change_date:start,value_at_change:Math.round(valueAt),goal_minutes:Math.round(h*60),end_date:end}).select().single();
 if(error){alert("目標を変更できませんでした。\n\n"+error.message);return}
 state.goals.push(data);
 pr.end_date=end;pr.goal_minutes=Math.round(h*60);
 const r=await sb.from("study_projects").update({end_date:end,goal_minutes:Math.round(h*60)}).eq("id",pr.id).eq("user_id",user.id);
 if(r.error){alert(r.error.message);return}
 close();render();
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
 let r=old?await sb.from("study_logs").update({minutes}).eq("id",old.id).eq("user_id",user.id):await sb.from("study_logs").insert({project_id:pr.id,user_id:user.id,study_date:date,minutes});
 if(r.error){alert("勉強時間を保存できませんでした。\\n\\n"+r.error.message);return}
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
