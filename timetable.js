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
let user=null;
let cells=Array.from({length:30},(_,i)=>({id:i,title:"",memo:"",done:false}));
let longed=false;

function indexOfCell(r,c){return r*5+c}
function loadLocal(){try{const x=JSON.parse(localStorage.getItem(KEY)||"null");if(Array.isArray(x)){x.forEach((v,i)=>{if(cells[i])cells[i]={...cells[i],...v}})}}catch(e){}}
function saveLocal(){localStorage.setItem(KEY,JSON.stringify(cells))}
function encodeCell(c){return JSON.stringify({slot:c.id,title:c.title,memo:c.memo,done:!!c.done})}
function decodeRow(r){try{const x=JSON.parse(r.name||"");if(Number.isInteger(x.slot)&&x.slot>=0&&x.slot<30)return {id:x.slot,title:String(x.title||""),memo:String(x.memo||""),done:!!x.done}}catch(e){}return null}

async function loadCloud(){
 const {data,error}=await sb.from("tasks").select("id,name,type,completed").eq("user_id",user.id).eq("type","timetable");
 if(error){console.error(error);return false}
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
 grid.innerHTML="<div class=\"cell head\">時限</div>"+DAYS.map(d=>`<div class=\"cell head\">${d}</div>`).join("");
 for(let r=0;r<6;r++){
  grid.insertAdjacentHTML("beforeend",`<div class=\"cell period\">${r+1}</div>`);
  for(let c=0;c<5;c++){
   const id=indexOfCell(r,c),item=cells[id];
   const el=document.createElement("button");
   el.type="button";el.className="slot"+(item.done?" done":"")+(!item.title?" empty":"");el.dataset.id=id;
   el.innerHTML=item.title?`<span>${esc(item.title)}</span>`:"";
   bindSlot(el,id);grid.appendChild(el);
  }
 }
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
