(()=>{
"use strict";
const SUPABASE_URL="https://uiyksvrxcfowdkmnsdeu.supabase.co";
const SUPABASE_KEY="sb_publishable_18Sdy8EEn-wVDIicAYKFtg_2UWaJ6Zs";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const DAYS=["月","火","水","木","金"];
const PERIODS=[1,2,3,4,5,6];
const KEY="taskday-timetable-v1";
const MEMO_KEY="taskday-timetable-memo-v1";
let timetableMemo="";
let user=null;
let cells=Array.from({length:30},(_,i)=>({id:i,title:"",memo:"",done:false}));
let longed=false;

function indexOfCell(r,c){return r*5+c}
function loadLocal(){try{const x=JSON.parse(localStorage.getItem(KEY)||"null");if(Array.isArray(x)){x.forEach((v,i)=>{if(cells[i])cells[i]={...cells[i],...v}})}timetableMemo=String(localStorage.getItem(MEMO_KEY)||"")}catch(e){}}
function saveLocal(){localStorage.setItem(KEY,JSON.stringify(cells));localStorage.setItem(MEMO_KEY,timetableMemo)}
function encodeCell(c){return JSON.stringify({slot:c.id,title:c.title,memo:c.memo,done:!!c.done})}
function decodeRow(r){try{const x=JSON.parse(r.name||"");if(Number.isInteger(x.slot)&&x.slot>=0&&x.slot<30)return {id:x.slot,title:String(x.title||""),memo:String(x.memo||""),done:!!x.done}}catch(e){}return null}

async function loadCloud(){
 const {data,error}=await sb.from("tasks").select("id,name,type,completed").eq("user_id",user.id).eq("type","timetable");
 if(error){console.error(error);return false}
 const {data:noteRows,error:noteError}=await sb.from("tasks").select("id,name,type,completed").eq("user_id",user.id).eq("type","timetable_note");
 if(!noteError && noteRows?.length) timetableMemo=String(noteRows[0].name||"");
 else if(noteError) console.error(noteError);
 const cloud=Array.from({length:30},(_,i)=>({id:i,title:"",memo:"",done:false}));
 (data||[]).forEach(r=>{const x=decodeRow(r);if(x)cloud[x.id]=x});
 const hasCloud=(data||[]).length>0;
 const hasLocal=cells.some(x=>x.title||x.memo||x.done);
 if(hasCloud){cells=cloud;saveLocal();return true}
 if(hasLocal){await saveCloud();return true}
 return true;
}
async function saveCloud(){
 if(!user)return;
 saveLocal();
 const rows=cells.filter(c=>c.title||c.memo||c.done).map(c=>({id:crypto.randomUUID(),user_id:user.id,name:encodeCell(c),type:"timetable",due_date:null,completed:false,completed_at:null}));
 const del=await sb.from("tasks").delete().eq("user_id",user.id).eq("type","timetable");
 if(del.error){console.error(del.error);return}
 if(rows.length){const ins=await sb.from("tasks").insert(rows);if(ins.error)console.error(ins.error)}
 const oldNotes=await sb.from("tasks").delete().eq("user_id",user.id).eq("type","timetable_note");
 if(oldNotes.error){console.error(oldNotes.error);return}
 if(timetableMemo.trim()){
  const insNote=await sb.from("tasks").insert({id:crypto.randomUUID(),user_id:user.id,name:timetableMemo,type:"timetable_note",due_date:null,completed:false,completed_at:null});
  if(insNote.error)console.error(insNote.error);
 }
}

function authUI(){
 if($("#auth"))return;
 $("#app").innerHTML='<div class="panel"><h2>時間割</h2><p class="note">TaskDayと同じアカウントで利用します。</p><button class="primary" id="login">ログイン</button></div>';
 $("#login").onclick=async()=>{
  const email=prompt("メールアドレス");if(!email)return;
  const pass=prompt("パスワード");if(!pass)return;
  const {error}=await sb.auth.signInWithPassword({email:email.trim(),password:pass});
  if(error)alert(error.message);
 };
}

function render(){
 const grid=$("#grid");
 grid.innerHTML="<div class=\"cell head\">時限</div>"+DAYS.map((d,i)=>`<button type="button" class="cell head day-head" data-day="${i}">${d}</button>`).join("");
 grid.querySelectorAll(".day-head").forEach(el=>{
  el.addEventListener("click",()=>confirmDayReset(Number(el.dataset.day)));
 });
 for(let r=0;r<6;r++){
  grid.insertAdjacentHTML("beforeend",`<div class="cell period">${r+1}</div>`);
  for(let c=0;c<5;c++){
   const id=indexOfCell(r,c),item=cells[id];
   const el=document.createElement("button");
   el.type="button";el.className="slot"+(item.done?" done":"")+(!item.title?" empty":"");el.dataset.id=id;
   el.innerHTML=item.title?`<span>${esc(item.title)}</span>`:"";
   bindSlot(el,id);grid.appendChild(el);
  }
 }
 const memo=$("#timetableMemo");
 if(memo){
  memo.value=timetableMemo;
  autoSizeMemo();
  setupMemoKeyboard();
  memo.oninput=()=>{timetableMemo=memo.value;autoSizeMemo();saveCloud();requestAnimationFrame(()=>requestAnimationFrame(keepMemoCaretCentered));};
 }
}
function autoSizeMemo(){
 const memo=$("#timetableMemo");
 if(!memo)return;
 memo.style.height="auto";
 memo.style.height=Math.max(120,memo.scrollHeight)+"px";
}

// iPhoneのキーボード表示中も、入力している行が見える位置に保つ
function keepMemoCaretCentered(){
 const memo=$("#timetableMemo");
 if(!memo || document.activeElement!==memo)return;
 const vv=window.visualViewport;
 const viewportH=vv?vv.height:window.innerHeight;
 const navH=68;
 const targetY=(viewportH-navH)/2;
 const pos=memo.selectionStart||0;
 const before=memo.value.slice(0,pos);
 const mirror=document.createElement("div");
 const cs=getComputedStyle(memo);
 mirror.style.cssText=`position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:break-word;box-sizing:border-box;width:${memo.clientWidth}px;padding:${cs.padding};border:${cs.border};font:${cs.font};font-size:${cs.fontSize};font-family:${cs.fontFamily};font-weight:${cs.fontWeight};line-height:${cs.lineHeight};letter-spacing:${cs.letterSpacing};`;
 mirror.textContent=before||" ";
 document.body.appendChild(mirror);
 const lineY=mirror.offsetHeight;
 mirror.remove();
 const rect=memo.getBoundingClientRect();
 const caretY=rect.top+parseFloat(cs.paddingTop||"0")+lineY-memo.scrollTop;
 const delta=caretY-targetY;
 if(Math.abs(delta)>8){
   window.scrollTo({top:Math.max(0,window.scrollY+delta),behavior:"auto"});
 }
}

function setupMemoKeyboard(){
 const memo=$("#timetableMemo");
 if(!memo || memo.dataset.keyboardReady)return;
 memo.dataset.keyboardReady="1";
 const keep=()=>{
   autoSizeMemo();
   requestAnimationFrame(()=>requestAnimationFrame(keepMemoCaretCentered));
 };
 memo.addEventListener("focus",keep);
 memo.addEventListener("input",keep);
 memo.addEventListener("click",keep);
 memo.addEventListener("keyup",keep);
 if(window.visualViewport){
   window.visualViewport.addEventListener("resize",()=>{
     if(document.activeElement===memo)requestAnimationFrame(keepMemoCaretCentered);
   });
 }
}

function confirmDayReset(dayIndex){
 const day=DAYS[dayIndex];
 showModal(`<h2>${day}曜日をリセットしますか？</h2><p class="note">この曜日の課題チェックだけを白に戻します。授業名とメモは変更されません。</p><div class="actions"><button type="button" class="secondary" id="noReset">いいえ</button><button type="button" class="primary" id="yesReset">はい</button></div>`);
 $("#noReset").onclick=closeModal;
 $("#yesReset").onclick=async()=>{
  for(let r=0;r<6;r++){
   const c=cells[indexOfCell(r,dayIndex)];
   if(c.title)c.done=false;
  }
  closeModal();
  render();
  await saveCloud();
 };
}
function bindSlot(el,id){
 let timer=null;
 el.addEventListener("pointerdown",e=>{
  if(e.pointerType==="mouse"&&e.button!==0)return;
  longed=false;
  timer=setTimeout(()=>{longed=true;openSlotActions(id)},650);
 });
 ["pointerup","pointercancel","pointerleave"].forEach(ev=>el.addEventListener(ev,()=>{if(timer)clearTimeout(timer)}));
 el.addEventListener("click",e=>{if(longed){e.preventDefault();e.stopPropagation();longed=false;return}if(!cells[id].title)return;openDetails(id)});
}
function showModal(html){$("#sheet").innerHTML=html;$("#modal").classList.add("show")}
function closeModal(){$("#modal").classList.remove("show");$("#sheet").innerHTML=""}

function openDetails(id){
 const c=cells[id];
 showModal(`<h2>${c.title?esc(c.title):"授業なし"}</h2>
  ${c.title?`<label class="label">メモ</label><textarea id="memo" class="input memo" placeholder="この授業の課題などをメモ">${esc(c.memo)}</textarea>
  <div class="status-title">今週の課題</div>
  <div class="status-buttons"><button type="button" class="status-check ${c.done?"selected":""}" id="doneBtn">✓</button><button type="button" class="status-x ${!c.done?"selected":""}" id="xBtn">×</button></div>
  <div class="actions"><button type="button" class="secondary" id="cancel">閉じる</button><button type="button" class="primary" id="save">保存</button></div>`:`<p class="note">この時間にはまだ授業名が登録されていません。<br>長押しすると授業名を追加できます。</p><button type="button" class="secondary" id="cancel">閉じる</button>`}`);
 if($("#cancel"))$("#cancel").onclick=closeModal;
 if(c.title){
  let done=c.done;
  $("#doneBtn").onclick=()=>{done=true;$("#doneBtn").classList.add("selected");$("#xBtn").classList.remove("selected")};
  $("#xBtn").onclick=()=>{done=false;$("#xBtn").classList.add("selected");$("#doneBtn").classList.remove("selected")};
  $("#save").onclick=async()=>{c.memo=$("#memo").value; c.done=done; closeModal(); render(); await saveCloud()};
 }
}
function openSlotActions(id){
 const c=cells[id];
 showModal(`<h2>${c.title?"授業名を編集":"授業名を追加"}</h2><label class="label">授業名</label><input id="title" class="input" value="${esc(c.title)}" placeholder="授業名"><div class="actions"><button type="button" class="secondary" id="cancel">キャンセル</button>${c.title?'<button type="button" class="danger" id="delete">削除</button>':''}<button type="button" class="primary" id="save">保存</button></div>`);
 $("#cancel").onclick=closeModal;
 $("#save").onclick=async()=>{const title=$("#title").value.trim();if(!title){alert("授業名を入力してください。");return}c.title=title;closeModal();render();await saveCloud()};
 if($("#delete"))$("#delete").onclick=async()=>{c.title="";c.memo="";c.done=false;closeModal();render();await saveCloud()};
 $("#title").focus();
}

async function init(){
 loadLocal();
 const {data}=await sb.auth.getSession();
 user=data.session?.user||null;
 if(!user){authUI();return}
 await loadCloud();render();
 sb.auth.onAuthStateChange(async(_,session)=>{user=session?.user||null;if(user){await loadCloud();render()}else authUI()});
}
$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});
init();
})();
