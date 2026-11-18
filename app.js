const $=(s,r=document)=>r.querySelector(s);
const MAX_RECORD_MS=120000;
const state={transcript:"",result:null,tab:"tasks",recorder:null,recording:false,chunks:[],stream:null,stopTimer:null,discard:false,apiKey:"",requestController:null};
document.addEventListener("DOMContentLoaded",()=>{
 $("#typeBtn").addEventListener("click",organise);
 $("#demoBtn").addEventListener("click",()=>{$("#typedInput").value=DEMO_CONVERSATION;$("#typedInput").focus();toast("Demo conversation loaded");});
 $("#micBtn").addEventListener("click",toggleMic);
 $("#clearBtn").addEventListener("click",clearAll);
 $("#settingsBtn").addEventListener("click",()=>{const p=$("#settings");p.hidden=!p.hidden;$("#settingsBtn").setAttribute("aria-expanded",String(!p.hidden));});
 $("#apiKey").addEventListener("input",e=>state.apiKey=e.target.value.trim());
 $("#copySummary").addEventListener("click",copySummary);
 document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
});

/* ---------- Typed conversation ---------- */
async function organise(){
 const text=$("#typedInput").value.trim();
 if(!text){toast("Add a conversation first.");return;}
 await analyse({text});
}

/* ---------- Send to Dayline AI (text or voice audio) ---------- */
async function analyse(input){
 const btn=$("#typeBtn");btn.disabled=true;btn.textContent="Organising…";
 const controller=new AbortController();state.requestController=controller;
 try{
  const response=await fetch("/api/understand",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...input,apiKey:state.apiKey}),signal:controller.signal});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||"AI request failed. Please try again.");
  if(!payload||typeof payload!=="object")throw new Error("The AI returned an invalid response. Please try again.");
  state.transcript=typeof payload.transcript==="string"?payload.transcript:(input.text||"");
  state.result=normalise(payload);
  renderResults();
  const heard=$("#heard");
  if(input.audio){heard.textContent="Dayline heard: “"+state.transcript+"”";heard.hidden=false;}else heard.hidden=true;
  $("#resultsPanel").hidden=false;
  $("#resultsPanel").scrollIntoView({behavior:"smooth",block:"start"});
  toast("Your conversation has been organised.");
 }catch(err){
  if(err.name!=="AbortError")toast(err.message||"Could not reach Gemini. Check the AI setup.");
 }finally{
  state.requestController=null;btn.disabled=false;btn.innerHTML='Organise conversation <span>→</span>';
 }
}
function normalise(data){
 const map=(arr,kind)=>Array.isArray(arr)?arr.filter(item=>item&&typeof item==="object").map(item=>({...item,kind,evidenceFound:quoteExists(item.quote,state.transcript),done:false})):[];
 return{language:data.detectedLanguage||"Language not identified",tasks:map(data.tasks,"task"),emails:map(data.emails,"email"),events:map(data.events,"event"),businessItems:map(data.businessItems,"business")};
}
function quoteExists(quote,transcript){return !!quote&&!!transcript&&String(transcript).toLocaleLowerCase().includes(String(quote).trim().toLocaleLowerCase());}

/* ---------- Clear ---------- */
function clearAll(){
 if(state.requestController)state.requestController.abort();
 if(state.recording){state.discard=true;stopRecording();}
 $("#typedInput").value="";
 state.result=null;state.transcript="";
 $("#resultsPanel").hidden=true;$("#summary").innerHTML="";$("#tabContent").innerHTML="";$("#heard").hidden=true;
 $("#typedInput").focus();
 toast("Cleared. Start a new conversation.");
}

/* ---------- Results ---------- */
function renderResults(){
 const r=state.result;$("#languageLabel").textContent="Detected language: "+r.language+" · Review every suggestion before acting.";
 const counts=[["Tasks",r.tasks.length],["Email drafts",r.emails.length],["Calendar events",r.events.length],["Business records",r.businessItems.length]];
 $("#summary").innerHTML=counts.map(([label,n])=>'<div class="summary-card"><strong>'+n+'</strong><span>'+label+'</span></div>').join("");
 $("#tasksCount").textContent=r.tasks.length;$("#emailsCount").textContent=r.emails.length;$("#eventsCount").textContent=r.events.length;$("#businessCount").textContent=r.businessItems.length;switchTab(state.tab);
}
function switchTab(tab){
 state.tab=tab;document.querySelectorAll(".tab").forEach(b=>{const a=b.dataset.tab===tab;b.classList.toggle("active",a);b.setAttribute("aria-selected",String(a));});
 const r=state.result;if(!r)return;const data=tab==="tasks"?r.tasks:tab==="emails"?r.emails:tab==="events"?r.events:r.businessItems;const root=$("#tabContent");root.innerHTML="";
 if(!data.length){root.innerHTML='<div class="empty">Nothing in this section yet. Add more context and organise the conversation again.</div>';return;}
 const list=document.createElement("div");list.className="result-list";data.forEach(item=>list.appendChild(makeCard(item,tab)));root.appendChild(list);
 if(tab==="events"){const b=document.createElement("button");b.className="secondary-btn";b.textContent="Export calendar (.ics)";b.addEventListener("click",exportCalendar);root.appendChild(b);}
}
function linkButton(label,href){
 const a=document.createElement("a");a.className="secondary-btn link-btn";a.textContent=label;a.href=href;a.target="_blank";a.rel="noopener noreferrer";return a;
}
function makeCard(item,tab){
 const card=document.createElement("article");card.className="result-card";
 const title=item.title||item.task||item.subject||"Untitled item";
 const top=document.createElement("div");top.className="result-top";
 const h=document.createElement("h3");h.textContent=title;top.appendChild(h);
 if(tab==="tasks"){const label=document.createElement("label");label.className="done-toggle";const cb=document.createElement("input");cb.type="checkbox";cb.addEventListener("change",()=>{item.done=cb.checked;h.style.textDecoration=cb.checked?"line-through":"none";});label.append(cb,document.createTextNode("Done"));top.appendChild(label);}
 card.appendChild(top);
 const details=[];if(item.owner)details.push("Owner: "+item.owner);if(item.dueDate)details.push("Due: "+item.dueDate);if(item.amount)details.push("Amount: "+item.amount);if(item.recipient)details.push("To: "+item.recipient);if(item.start)details.push("When: "+item.start);if(item.location)details.push("Where: "+item.location);if(item.kind)details.push("Type: "+item.kind);if(item.counterparty)details.push("Contact: "+item.counterparty);if(item.status)details.push("Status: "+item.status);
 if(details.length){const p=document.createElement("p");p.textContent=details.join(" · ");card.appendChild(p);}
 if(item.subject){const p=document.createElement("p");p.textContent="Subject: "+item.subject;card.appendChild(p);}
 let gmailLink=null;
 if(item.body){
  const body=document.createElement("textarea");body.className="draft-editor";body.value=item.body;body.rows=Math.min(12,Math.max(4,item.body.split("\n").length+1));body.setAttribute("aria-label","Edit email draft");
  body.addEventListener("input",()=>{item.body=body.value;if(gmailLink)gmailLink.href=gmailUrl(item);});
  card.appendChild(body);
 }
 const meta=document.createElement("div");meta.className="meta";
 const ev=document.createElement("span");ev.className="pill "+(item.evidenceFound?"evidence":"review");ev.textContent=item.evidenceFound?"Source quote found":"Needs review — quote not matched";meta.appendChild(ev);
 const note=document.createElement("span");note.className="pill";note.textContent="AI suggestion · not sent or scheduled";meta.appendChild(note);
 card.appendChild(meta);
 if(item.quote){const q=document.createElement("div");q.className="quote";q.textContent="Original words: “"+item.quote+"”";card.appendChild(q);}

 const actions=document.createElement("div");actions.className="card-actions";
 if(tab==="emails"&&item.body){
  const copy=document.createElement("button");copy.className="secondary-btn";copy.textContent="Copy email";copy.addEventListener("click",()=>copyText((item.subject?"Subject: "+item.subject+"\n\n":"")+item.body));actions.appendChild(copy);
  gmailLink=linkButton("Open in Gmail →",gmailUrl(item));actions.appendChild(gmailLink);
 }
 if(tab==="events"){const url=calendarUrl(item);if(url)actions.appendChild(linkButton("Add to Google Calendar →",url));}
 if(tab==="tasks"){const url=reminderUrl(item);if(url)actions.appendChild(linkButton("Set reminder in Google Calendar →",url));}
 if(actions.children.length)card.appendChild(actions);
 return card;
}

/* ---------- Links into Gmail and Google Calendar ---------- */
function qs(params){return Object.entries(params).filter(([,v])=>v!==undefined&&v!==null&&v!=="").map(([k,v])=>encodeURIComponent(k)+"="+encodeURIComponent(v)).join("&");}
function gmailUrl(item){
 const params={view:"cm",fs:"1",su:item.subject||"",body:item.body||""};
 if(item.recipient&&item.recipient.includes("@"))params.to=item.recipient.trim();
 return "https://mail.google.com/mail/?"+qs(params);
}
function calendarUrl(item){
 const start=new Date(item.start);if(Number.isNaN(start.getTime()))return "";
 const end=new Date(start.getTime()+60*60000);
 const fmt=d=>d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
 return "https://calendar.google.com/calendar/render?"+qs({action:"TEMPLATE",text:item.title||"Dayline event",dates:fmt(start)+"/"+fmt(end),details:item.description||item.quote||"",location:item.location||""});
}
function reminderUrl(item){
 const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(item.dueDate||"");if(!m)return "";
 const day=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));const next=new Date(day.getTime()+86400000);
 const f=d=>d.toISOString().slice(0,10).replace(/-/g,"");
 const details=[item.owner?"Owner: "+item.owner:"",item.status?"Status: "+item.status:"",item.quote?"Source: "+item.quote:""].filter(Boolean).join("\n");
 return "https://calendar.google.com/calendar/render?"+qs({action:"TEMPLATE",text:"Reminder: "+(item.title||"Task"),dates:f(day)+"/"+f(next),details});
}

/* ---------- Calendar file export ---------- */
function escIcs(s){return String(s||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n");}
function exportCalendar(){
 const events=state.result.events.filter(e=>e.start);if(!events.length){toast("No dated events to export.");return;}
 const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Dayline//Productivity workspace//EN"];
 events.forEach((e,i)=>{const d=new Date(e.start);if(Number.isNaN(d.getTime()))return;lines.push("BEGIN:VEVENT","UID:dayline-"+Date.now()+"-"+i,"DTSTAMP:"+icsDate(new Date()),"DTSTART:"+icsDate(d),"SUMMARY:"+escIcs(e.title),"DESCRIPTION:"+escIcs(e.description||e.quote),"LOCATION:"+escIcs(e.location),"END:VEVENT");});
 lines.push("END:VCALENDAR");download("dayline-calendar.ics",lines.join("\r\n"),"text/calendar");
}
function icsDate(d){return d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");}
function copySummary(){const r=state.result;if(!r)return;const lines=["DAYLINE OVERVIEW","Detected language: "+r.language,"","TASKS",...r.tasks.map(t=>"- "+(t.title||t.task)+" — "+(t.owner||"Unassigned")+" — "+(t.dueDate||"No due date")),"","EMAIL DRAFTS",...r.emails.map(e=>"- "+(e.subject||e.title||"Draft")),"","CALENDAR",...r.events.map(e=>"- "+(e.title||"Event")+" — "+(e.start||"Date not set")),"","BUSINESS",...r.businessItems.map(b=>"- "+(b.kind||"Record")+": "+(b.title||"Item")+" — "+(b.amount||"No amount"))];copyText(lines.join("\n"));}
function copyText(text){if(navigator.clipboard?.writeText){navigator.clipboard.writeText(text).then(()=>toast("Copied to clipboard."),()=>fallbackCopy(text));return;}fallbackCopy(text);}
function fallbackCopy(text){const field=document.createElement("textarea");field.value=text;field.setAttribute("readonly","");field.style.position="fixed";field.style.opacity="0";document.body.appendChild(field);field.select();let copied=false;try{copied=document.execCommand("copy");}catch{}field.remove();toast(copied?"Copied to clipboard.":"Clipboard access is unavailable.");}
function download(name,content,type){const a=document.createElement("a");const url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast("Calendar exported.");}

/* ---------- Voice: record audio and send it straight to the AI ---------- */
function setMicUi(mode){
 const labels={idle:"Record voice",recording:"Stop recording",encoding:"Preparing audio…",sending:"Sending to Dayline…"};
 const hints={idle:"Speak in any language, or type. Your voice goes straight to Dayline's AI.",recording:"Recording… speak in your own language, then tap Stop.",encoding:"Preparing your recording…",sending:"Sending your voice to Dayline's AI…"};
 $("#micBtn").textContent=labels[mode];$("#micBtn").disabled=mode==="encoding"||mode==="sending";$("#micStatus").textContent=hints[mode];
}
async function toggleMic(){
 if(state.recording){stopRecording();return;}
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast("Voice recording is not supported in this browser. You can type instead.");return;}
 if(state.requestController){toast("Dayline is still working on the last request.");return;}
 let stream;
 try{stream=await navigator.mediaDevices.getUserMedia({audio:true});}catch{toast("Microphone permission was denied. You can type instead.");return;}
 const type=["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg;codecs=opus"].find(t=>MediaRecorder.isTypeSupported(t))||"";
 const recorder=type?new MediaRecorder(stream,{mimeType:type}):new MediaRecorder(stream);
 state.chunks=[];state.stream=stream;state.recorder=recorder;state.discard=false;
 recorder.ondataavailable=e=>{if(e.data&&e.data.size)state.chunks.push(e.data);};
 recorder.onstop=async()=>{
  stream.getTracks().forEach(t=>t.stop());clearTimeout(state.stopTimer);state.recording=false;
  if(state.discard){state.discard=false;setMicUi("idle");return;}
  const blob=new Blob(state.chunks,{type:recorder.mimeType||type||"audio/webm"});
  if(blob.size<2000){setMicUi("idle");toast("Nothing was recorded. Try again.");return;}
  try{
   setMicUi("encoding");
   const wav=await blobToWav(blob);
   const data=await blobToBase64(wav);
   setMicUi("sending");
   await analyse({audio:{mimeType:"audio/wav",data}});
  }catch(err){
   toast("Could not process the recording. Try again or type instead.");
  }finally{setMicUi("idle");}
 };
 recorder.start();state.recording=true;setMicUi("recording");
 state.stopTimer=setTimeout(stopRecording,MAX_RECORD_MS);
}
function stopRecording(){if(state.recorder&&state.recorder.state!=="inactive")state.recorder.stop();}
async function blobToWav(blob){
 const AC=window.AudioContext||window.webkitAudioContext;
 const ctx=new AC();
 let decoded;
 try{decoded=await ctx.decodeAudioData(await blob.arrayBuffer());}finally{ctx.close?.();}
 const rate=16000;
 const OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
 const off=new OAC(1,Math.max(1,Math.ceil(decoded.duration*rate)),rate);
 const src=off.createBufferSource();src.buffer=decoded;src.connect(off.destination);src.start();
 const rendered=await off.startRendering();
 return encodeWav(rendered.getChannelData(0),rate);
}
function encodeWav(samples,rate){
 const buffer=new ArrayBuffer(44+samples.length*2);const view=new DataView(buffer);
 const str=(o,s)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));};
 str(0,"RIFF");view.setUint32(4,36+samples.length*2,true);str(8,"WAVE");str(12,"fmt ");view.setUint32(16,16,true);
 view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);
 view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,"data");view.setUint32(40,samples.length*2,true);
 let o=44;for(let i=0;i<samples.length;i++,o+=2){const s=Math.max(-1,Math.min(1,samples[i]));view.setInt16(o,s<0?s*0x8000:s*0x7fff,true);}
 return new Blob([buffer],{type:"audio/wav"});
}
function blobToBase64(blob){
 return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(",")[1]||"");r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});
}
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3200);}
