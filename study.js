(()=>{"use strict";
const SUPABASE_URL="https://uiyksvrxcfowdkmnsdeu.supabase.co";
const SUPABASE_KEY="sb_publishable_18Sdy8EEn-wVDIicAYKFtg_2UWaJ6Zs";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const key=d=>{const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
const dateOf=k=>{const [y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d)};
const fmt=k=>{const d=dateOf(k);return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`};
const minutesText=m=>`${Math.floor(m/60)}時間${String(m%60).padStart(2,"0")}分`;
const money=m=>Math.round(m/60*1250).toLocaleString("ja-JP");
let user=null,state={projects:[],logs:[],goals:[]},currentId=null,mode="hours",selectedDate=key(new Date());

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
  if(user){
   await load();
   if(!currentId&&state.projects[0])currentId=state.projects[0].id;
   render();
  }
 });
}
async function load(){
 const [p,l,g]=await Promise.all([
  sb.from("study_projects").select("*").order("created_at",{ascending:true}),
  sb.from("study_logs").select("*").order("study_date",{ascending:true}),
  sb.from("study_goal_history").select("*").order("change_date",{ascending:true})
 ]);
 const errors=[
  ["study_projects",p.error],
  ["study_logs",l.error],
  ["study_goal_history",g.error]
 ].filter(([,e])=>e);
 if(errors.length){
  console.error("Study data load errors:", errors);
  const detail=errors.map(([name,e])=>`${name}: ${e.message||e.code||"unknown error"}`).join("\n");
  alert("勉強時間データの読み込みに失敗しました。\n\n"+detail);
 }
 state.projects=p.data||[];
 state.logs=l.data||[];
 state.goals=g.data||[];
}
function auth(){
 $("#app").innerHTML=`<div class="card"><h2>勉強時間</h2><p class="auth-note">TaskDayと同じアカウントで利用します。ログインすると、勉強時間データはTaskDayのタスクデータとは別テーブルに保存されます。</p><button class="primary" onclick="login()">ログイン</button></div>`;
}
window.login=async()=>{const email=prompt("メールアドレス");if(!email)return;const pass=prompt("パスワード");if(!pass)return;const {error}=await sb.auth.signInWithPassword({email:email.trim(),password:pass});if(error)alert(error.message)};
function p(){return state.projects.find(x=>x.id===currentId)||state.projects[0]}
function logsFor(pr){return state.logs.filter(x=>x.project_id===pr.id)}
function total(pr){return logsFor(pr).reduce((a,x)=>a+x.minutes,0)}
function logAt(pr,date){return logsFor(pr).find(x=>x.study_date===date)}
function render(){
 const pr=p(); if(!pr){$("#app").innerHTML=`<div class="card empty">プロジェクトがありません。<button class="primary" onclick="newProject()">＋ 新規プロジェクトを作成</button></div>`;return}
 const t=total(pr), isMoney=mode==="money";
 const target=isMoney?money(pr.goal_minutes)+"円":minutesText(pr.goal_minutes);
 $("#app").innerHTML=`<header><button class="project-btn" onclick="projects()">${esc(pr.name)} ▾</button><button class="settings" onclick="settings()">⚙ 設定</button></header>
 <div class="card">
  <div class="meta">${fmt(pr.start_date)} ～ ${fmt(pr.end_date)}</div>
  <div class="goal">目標：${target}</div>
  <div class="summary"><div><b>${minutesText(t)}</b><span>これまでの合計時間</span></div><div><b>${money(t)}円</b><span>これまでの合計金額</span></div></div>
  <div class="switch-row"><button onclick="toggleMode()">${isMoney?"⏱ 時間グラフ":"💴 金額グラフ"}</button></div>
  ${chart(pr,isMoney)}
  <div class="legend"><span><i></i>目標</span><span><i class="actual"></i>実績</span></div>
 </div>
 <div class="card"><div class="section-title">カレンダー</div>${calendar(pr)}</div>
 <button class="plus" onclick="logDay('${selectedDate}')">＋</button>`;
}
function chart(pr,moneyMode){
 const W=700,H=300,L=55,R=18,T=18,B=45,start=dateOf(pr.start_date),end=dateOf(pr.end_date);
 const days=Math.max(1,Math.round((end-start)/86400000));
 const totalVal=pr.goal_minutes, max=moneyMode?Math.max(1,totalVal/60*1250):Math.max(1,totalVal);
 const x=d=>L+Math.max(0,Math.min(days,(d-start)/86400000))/days*(W-L-R);
 const y=v=>H-B-v/max*(H-T-B);
 let s=`<svg class="chart" viewBox="0 0 ${W} ${H}">`;
 for(let i=0;i<=4;i++){const v=max*i/4,yy=y(v);s+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#e8ece9"/><text x="${L-8}" y="${yy+4}" text-anchor="end" font-size="10" fill="#89908a">${moneyMode?Math.round(v).toLocaleString():Math.round(v)}</text>`}
 [0,Math.round(days/2),days].forEach(n=>{const d=new Date(start.getTime()+n*86400000);s+=`<text x="${x(d)}" y="${H-14}" text-anchor="middle" font-size="10" fill="#89908a">${d.getMonth()+1}/${d.getDate()}</text>`});
 const history=state.goals.filter(g=>g.project_id===pr.id).sort((a,b)=>a.change_date.localeCompare(b.change_date));
 const segments=[];let from=start,fromVal=0,currentTarget=pr.goal_minutes,currentEnd=end;
 history.forEach(g=>{const cd=dateOf(g.change_date);segments.push([from,cd,fromVal,g.value_at_change]);from=cd;fromVal=g.value_at_change;currentTarget=g.goal_minutes;currentEnd=dateOf(g.end_date)});
 segments.push([from,currentEnd,fromVal,currentTarget]);
 segments.forEach(seg=>{const [a,b,av,bv]=seg;const A=moneyMode?av/60*1250:av,B=moneyMode?bv/60*1250:bv;s+=`<line x1="${x(a)}" y1="${y(A)}" x2="${x(b)}" y2="${y(B)}" stroke="#555" stroke-width="2" stroke-dasharray="5 6"/>`});
 let cum=0,pts=[];
 logsFor(pr).sort((a,b)=>a.study_date.localeCompare(b.study_date)).forEach(l=>{cum+=l.minutes;const v=moneyMode?cum/60*1250:cum;pts.push(`${x(dateOf(l.study_date))},${y(v)}`)});
 if(pts.length){s+=`<polyline points="${pts.join(" ")}" fill="none" stroke="#42ad5b" stroke-width="4"/>`;pts.forEach(q=>{const [cx,cy]=q.split(",");s+=`<circle cx="${cx}" cy="${cy}" r="4" fill="#42ad5b"/>`})}
 return s+"</svg>";
}
function calendar(pr){
 const start=dateOf(pr.start_date),end=dateOf(pr.end_date),n=Math.max(1,Math.round((end-start)/86400000)+1),days=[];
 for(let i=0;i<n;i++){const d=new Date(start.getTime()+i*86400000),k=key(d),l=logAt(pr,k);days.push(`<button class="day ${l?.minutes?"has ":""}${k===selectedDate?"selected":""}" onclick="selectDay('${k}')">${d.getDate()}${l?`<small>${Math.floor(l.minutes/60)}h${l.minutes%60?String(l.minutes%60).padStart(2,"0"):""}</small>`:""}</button>`)}
 return `<div class="calendar">${["日","月","火","水","木","金","土"].map(x=>`<div class="week">${x}</div>`).join("")}${days.join("")}</div>`;
}
window.selectDay=k=>{selectedDate=k;render();logDay(k)}
window.projects=function projects(){
 const items=state.projects.map(x=>`<div class="project-item"><button class="project-main" onclick="switchProject('${x.id}')"><b>${esc(x.name)} ${x.id===currentId?"✓":""}</b><small>${fmt(x.start_date)} ～ ${fmt(x.end_date)}　目標 ${minutesText(x.goal_minutes)}</small></button></div>`).join("");
 open(`<h2>プロジェクト</h2>${items}<button class="primary" onclick="newProject()">＋ 新規プロジェクト</button><button class="secondary" onclick="close()">閉じる</button>`);
}
window.switchProject=id=>{currentId=id;close();render()};
window.settings=function settings(){open(`<h2>設定</h2><div class="row"><button onclick="projects()">📁 プロジェクト選択</button></div><div class="row"><button onclick="goalEdit()">🎯 目標設定・変更</button></div><div class="row"><button onclick="newProject()">＋ 新規プロジェクト</button></div><div class="row"><button class="danger" onclick="deleteProject()">🗑 プロジェクト削除</button></div><button class="secondary" onclick="close()">閉じる</button>`)}
window.newProject=function newProject(){open(`<h2>新規プロジェクト</h2><label class="label">プロジェクト名</label><input id="pn" class="input" placeholder="例：TOEFL対策"><label class="label">開始日</label><input id="ps" class="input" type="date" value="${key(new Date())}"><label class="label">目標終了日</label><input id="pe" class="input" type="date"><label class="label">目標勉強時間（時間）</label><input id="pg" class="input" type="number" min="0" step="5" placeholder="60"><button class="primary" onclick="createProject()">保存</button><button class="secondary" onclick="close()">戻る</button>`)}
window.createProject=async()=>{
 const name=$("#pn").value.trim()||"新規プロジェクト";
 const start=$("#ps").value;
 const end=$("#pe").value||start;
 const h=Number($("#pg").value||0);
 if(!start){alert("開始日を選択してください");return}
 if(end<start){alert("終了日は開始日以降にしてください");return}
 if(!Number.isFinite(h)||h<0){alert("目標時間を正しく入力してください");return}
 if(!user){alert("ログイン状態を確認できません。ページを再読み込みしてください。");return}
 const {data,error}=await sb.from("study_projects").insert({
  user_id:user.id,name,start_date:start,end_date:end,goal_minutes:Math.round(h*60)
 }).select().single();
 if(error){console.error(error);alert("プロジェクトを作成できませんでした。\n\n"+error.message);return}
 state.projects.push(data);
 currentId=data.id;
 close();
 render();
}
window.goalEdit=function goalEdit(){const pr=p();open(`<h2>目標設定・変更</h2><label class="label">新しい目標終了日</label><input id="ge" class="input" type="date" value="${pr.end_date}"><label class="label">新しい目標勉強時間（時間）</label><input id="gg" class="input" type="number" step="5" value="${pr.goal_minutes/60}"><p class="note">変更前の目標線と過去の実績は保存され、変更時点の実績座標から新しい目標線が始まります。</p><button class="primary" onclick="saveGoal()">保存</button><button class="secondary" onclick="close()">戻る</button>`)}
window.saveGoal=async()=>{const pr=p(),end=$("#ge").value,h=Number($("#gg").value),change=selectedDate<=key(new Date())?selectedDate:key(new Date()),value=logsFor(pr).filter(x=>x.study_date<=change).reduce((a,x)=>a+x.minutes,0);const {data,error}=await sb.from("study_goal_history").insert({project_id:pr.id,user_id:user.id,change_date:change,value_at_change:value,goal_minutes:h*60,end_date:end}).select().single();if(error){alert(error.message);return}state.goals.push(data);pr.end_date=end;pr.goal_minutes=h*60;const r=await sb.from("study_projects").update({end_date:end,goal_minutes:h*60}).eq("id",pr.id).eq("user_id",user.id);if(r.error){alert(r.error.message);return}close();render()}
window.deleteProject=function deleteProject(){const pr=p();open(`<h2>プロジェクト削除</h2><p>「${esc(pr.name)}」と、このプロジェクトの勉強記録・目標履歴を削除します。</p><button class="primary" style="background:#e24a4a" onclick="confirmDelete()">削除する</button><button class="secondary" onclick="close()">キャンセル</button>`)}
window.confirmDelete=async()=>{const pr=p();const r=await sb.from("study_projects").delete().eq("id",pr.id).eq("user_id",user.id);if(r.error){alert(r.error.message);return}state.projects=state.projects.filter(x=>x.id!==pr.id);state.logs=state.logs.filter(x=>x.project_id!==pr.id);state.goals=state.goals.filter(x=>x.project_id!==pr.id);currentId=state.projects[0]?.id||null;close();render()}
window.logDay=function logDay(date){const pr=p(),old=logAt(pr,date),h=Math.floor((old?.minutes||0)/60),m=(old?.minutes||0)%60;open(`<h2>${fmt(date)} の勉強時間</h2><div class="wheels">${wheel("hours",Array.from({length:25},(_,i)=>i*5),h)}${wheel("mins",Array.from({length:12},(_,i)=>i*5),m)}</div><div class="note">上下にスワイプして5分刻みで選択</div><button class="primary" onclick="saveLog('${date}')">登録する</button><button class="secondary" onclick="close()">戻る</button>`)}
function wheel(name,vals,sel){const idx=vals.indexOf(sel),safe=idx<0?0:idx;return `<div class="wheel"><div id="${name}Wheel" class="wheel-list" data-index="${safe}" data-values='${JSON.stringify(vals)}'>${vals.map((v,i)=>`<div class="wheel-item ${i===safe?"selected":""}">${String(v).padStart(2,"0")}</div>`).join("")}</div></div>`}
function wheelBind(el){
 let y=0;
 const move=(clientY)=>{
   const dy=clientY-y;
   if(Math.abs(dy)<=18)return;
   let i=Number(el.dataset.index)+(dy<0?1:-1);
   const vals=JSON.parse(el.dataset.values);
   i=Math.max(0,Math.min(vals.length-1,i));
   el.dataset.index=i;
   el.style.transform=`translateY(${65-i*40}px)`;
   [...el.children].forEach((x,j)=>x.classList.toggle("selected",j===i));
   y=clientY;
 };
 el.ontouchstart=e=>{y=e.touches[0].clientY};
 el.ontouchmove=e=>{e.preventDefault();move(e.touches[0].clientY)};
 el.onmousedown=e=>{y=e.clientY;el.onmousemove=q=>move(q.clientY)};
 el.onmouseup=()=>el.onmousemove=null;
 el.onmouseleave=()=>el.onmousemove=null;
}
window.saveLog=async date=>{const a=$("#hoursWheel"),b=$("#minsWheel"),hv=JSON.parse(a.dataset.values)[Number(a.dataset.index)],mv=JSON.parse(b.dataset.values)[Number(b.dataset.index)],minutes=hv*60+mv,pr=p(),old=logAt(pr,date);let r;if(old)r=await sb.from("study_logs").update({minutes}).eq("id",old.id).eq("user_id",user.id);else r=await sb.from("study_logs").insert({project_id:pr.id,user_id:user.id,study_date:date,minutes});if(r.error){alert(r.error.message);return}await load();close();render()}
window.toggleMode=function toggleMode(){mode=mode==="hours"?"money":"hours";render()}
function open(html){$("#sheet").innerHTML=html;$("#modal").classList.add("show");setTimeout(()=>{document.querySelectorAll(".wheel-list").forEach(w=>{w.style.transform=`translateY(${65-Number(w.dataset.index)*40}px)`;wheelBind(w)})},0)}
function close(){$("#modal").classList.remove("show")}
$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")close()});
init();
})();
