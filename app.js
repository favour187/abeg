const $=(s,r=document)=>r.querySelector(s);
const state={transcript:"",result:null,tab:"tasks",listening:false,recognition:null,apiKey:""};
document.addEventListener("DOMContentLoaded",()=>{
 $("#typeBtn").addEventListener("click",organise);
 $("#demoBtn").addEventListener("click",()=>{$("#typedInput").value=DEMO_CONVERSATION;$("#typedInput").focus();toast("Demo conversation loaded");});
 $("#micBtn").addEventListener("click",toggleMic);
 $("#settingsBtn").addEventListener("click",()=>{const p=$("#settings");p.hidden=!p.hidden;$("#settingsBtn").setAttribute("aria-expanded",String(!p.hidden));});
 $("#apiKey").addEventListener("input",e=>state.apiKey=e.target.value.trim());
 $("#copySummary").addEventListener("click",copySummary);
 document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
});
async function organise(){
 const text=$("#typedInput").value.trim();if(!text){toast("Add a conversation first.");return;}
 const btn=$("#typeBtn");btn.disabled=true;btn.textContent="Organising…";state.transcript=text;
 try{
  const response=await fetch("/api/understand",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,apiKey:state.apiKey})});
  const payload=await response.json();if(!response.ok)throw new Error(payload.error||"AI request failed");
  state.result=normalise(payload);renderResults();$("#resultsPanel").hidden=false;$("#resultsPanel").scrollIntoView({behavior:"smooth",block:"start"});toast("Your conversation has been organised.");
 }catch(err){toast(err.message||"Could not reach Gemini. Check the AI setup.");}
 finally{btn.disabled=false;btn.innerHTML='Organise conversation <span>→</span>';}
}
function normalise(data){
 const map=(arr,kind)=>Array.isArray(arr)?arr.map(item=>({...item,kind,evidenceFound:quoteExists(item.quote,state.transcript),done:false})): [];
 return{language:data.detectedLanguage||"Language not identified",tasks:map(data.tasks,"task"),emails:map(data.emails,"email"),events:map(data.events,"event"),businessItems:map(data.businessItems,"business")};
}
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
 const list=document.createElement("div");list.className="result-list";data.forEach((item,i)=>list.appendChild(makeCard(item,tab,i)));root.appendChild(list);
 if(tab==="events"){const b=document.createElement("button");b.className="secondary-btn";b.textContent="Export calendar (.ics)";b.addEventListener("click",exportCalendar);root.appendChild(b);}
}
function makeCard(item,tab){
 const card=document.createElement("article");card.className="result-card";const title=item.title||item.task||item.subject||"Untitled item";const top=document.createElement("div");top.className="result-top";const h=document.createElement("h3");h.textContent=title;top.appendChild(h);
 if(tab==="tasks"){const label=document.createElement("label");label.className="done-toggle";const cb=document.createElement("input");cb.type="checkbox";cb.addEventListener("change",()=>{item.done=cb.checked;h.style.textDecoration=cb.checked?"line-through":"none";});label.append(cb,document.createTextNode("Done"));top.appendChild(label);}
 card.appendChild(top);const details=[];if(item.owner)details.push("Owner: "+item.owner);if(item.dueDate)details.push("Due: "+item.dueDate);if(item.amount)details.push("Amount: "+item.amount);if(item.recipient)details.push("To: "+item.recipient);if(item.start)details.push("When: "+item.start);if(item.location)details.push("Where: "+item.location);if(item.kind)details.push("Type: "+item.kind);if(item.counterparty)details.push("Contact: "+item.counterparty);if(item.status)details.push("Status: "+item.status);
 if(details.length){const p=document.createElement("p");p.textContent=details.join(" · ");card.appendChild(p);}if(item.subject){const p=document.createElement("p");p.textContent="Subject: "+item.subject;card.appendChild(p);}if(item.body){const body=document.createElement("div");body.className="draft-body";body.textContent=item.body;card.appendChild(body);}
 const meta=document.createElement("div");meta.className="meta";const ev=document.createElement("span");ev.className="pill "+(item.evidenceFound?"evidence":"review");ev.textContent=item.evidenceFound?"Source quote found":"Needs review — quote not matched";meta.appendChild(ev);const note=document.createElement("span");note.className="pill";note.textContent="AI suggestion · not sent or scheduled";meta.appendChild(note);card.appendChild(meta);
 if(item.quote){const q=document.createElement("div");q.className="quote";q.textContent="Original words: “"+item.quote+"”";card.appendChild(q);}
 if(tab==="emails"&&item.body){const actions=document.createElement("div");actions.className="card-actions";const copy=document.createElement("button");copy.className="secondary-btn";copy.textContent="Copy email";copy.addEventListener("click",()=>copyText((item.subject?"Subject: "+item.subject+"\n\n":"")+item.body));actions.appendChild(copy);card.appendChild(actions);}return card;
}
function exportCalendar(){
 const events=state.result.events.filter(e=>e.start);if(!events.length){toast("No dated events to export.");return;}
 const esc=s=>String(s||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\n/g,"\\n");const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Dayline//Productivity workspace//EN"];
 events.forEach((e,i)=>{const d=new Date(e.start);if(Number.isNaN(d.getTime()))return;lines.push("BEGIN:VEVENT","UID:dayline-"+Date.now()+"-"+i,"DTSTAMP:"+icsDate(new Date()),"DTSTART:"+icsDate(d),"SUMMARY:"+esc(e.title),"DESCRIPTION:"+esc(e.description||e.quote),"LOCATION:"+esc(e.location),"END:VEVENT");});lines.push("END:VCALENDAR");download("dayline-calendar.ics",lines.join("\r\n"),"text/calendar");
}
function icsDate(d){return d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");}
function copySummary(){const r=state.result;if(!r)return;const lines=["DAYLINE OVERVIEW","Detected language: "+r.language,"","TASKS",...r.tasks.map(t=>"- "+(t.title||t.task)+" — "+(t.owner||"Unassigned")+" — "+(t.dueDate||"No due date")),"","EMAIL DRAFTS",...r.emails.map(e=>"- "+(e.subject||e.title||"Draft")),"","CALENDAR",...r.events.map(e=>"- "+(e.title||"Event")+" — "+(e.start||"Date not set")),"","BUSINESS",...r.businessItems.map(b=>"- "+(b.kind||"Record")+": "+(b.title||"Item")+" — "+(b.amount||"No amount"))];copyText(lines.join("\n"));}
function copyText(text){if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>toast("Copied to clipboard."),()=>toast("Copy was blocked."));else toast("Clipboard is unavailable.");}
function download(name,content,type){const a=document.createElement("a");const url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast("Calendar exported.");}
function toggleMic(){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast("Voice input is not supported here. You can still type in any language.");return;}if(state.listening){state.recognition.stop();return;}
 const rec=new SR();state.recognition=rec;rec.lang=navigator.language||"en-US";rec.interimResults=true;rec.continuous=false;
 rec.onstart=()=>{state.listening=true;$("#micStatus").textContent="Listening with your browser speech language ("+rec.lang+").";$("#micBtn").textContent="Stop listening";};
 rec.onresult=e=>{let words="";for(let i=e.resultIndex;i<e.results.length;i++)words+=e.results[i][0].transcript;$("#typedInput").value=($("#typedInput").value+" "+words).trim();};
 rec.onerror=e=>toast("Microphone issue: "+e.error+". You can type instead.");
 rec.onend=()=>{state.listening=false;$("#micBtn").textContent="Use microphone";$("#micStatus").textContent="Voice recognition follows your browser language. Typing supports any language.";};rec.start();
}
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3200);}
