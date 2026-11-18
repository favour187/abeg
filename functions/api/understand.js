const MODEL="gemini-3.5-flash-lite";
const API="https://generativelanguage.googleapis.com/v1beta/models/"+MODEL+":generateContent";
const MAX_TEXT=18000;
const MAX_AUDIO_BASE64=9000000;
const schema={type:"OBJECT",properties:{
 detectedLanguage:{type:"STRING"},
 detectedLanguageCode:{type:"STRING"},
 reply:{type:"STRING"},
 transcript:{type:"STRING"},
 tasks:{type:"ARRAY",items:{type:"OBJECT",properties:{title:{type:"STRING"},owner:{type:"STRING"},dueDate:{type:"STRING"},amount:{type:"STRING"},status:{type:"STRING"},quote:{type:"STRING"}},required:["title","quote"]}},
 emails:{type:"ARRAY",items:{type:"OBJECT",properties:{title:{type:"STRING"},recipient:{type:"STRING"},subject:{type:"STRING"},body:{type:"STRING"},quote:{type:"STRING"}},required:["subject","body","quote"]}},
 events:{type:"ARRAY",items:{type:"OBJECT",properties:{title:{type:"STRING"},start:{type:"STRING"},location:{type:"STRING"},description:{type:"STRING"},quote:{type:"STRING"}},required:["title","quote"]}},
 businessItems:{type:"ARRAY",items:{type:"OBJECT",properties:{kind:{type:"STRING"},title:{type:"STRING"},amount:{type:"STRING"},dueDate:{type:"STRING"},counterparty:{type:"STRING"},status:{type:"STRING"},quote:{type:"STRING"}},required:["kind","title","quote"]}}
},required:["detectedLanguage","detectedLanguageCode","reply","transcript","tasks","emails","events","businessItems"]};
const fields={tasks:["title","owner","dueDate","amount","status","quote"],emails:["title","recipient","subject","body","quote"],events:["title","start","location","description","quote"],businessItems:["kind","title","amount","dueDate","counterparty","status","quote"]};
async function fetchWithRetry(url,init){
 let last;
 for(let attempt=0;attempt<3;attempt++){
  last=await fetch(url,init);
  if(last.status!==503&&last.status!==429)return last;
  await new Promise(r=>setTimeout(r,1500*(attempt+1)));
 }
 return last;
}
function clean(value,max=5000){return typeof value==="string"?value.trim().slice(0,max):"";}
function cleanItems(value,allowed,source){
 if(!Array.isArray(value))return [];
 return value.slice(0,12).filter(item=>item&&typeof item==="object"&&!Array.isArray(item)).map(item=>{
  const next={};allowed.forEach(key=>next[key]=clean(item[key],key==="body"?5000:500));
  return next;
 }).filter(item=>item.quote&&source.includes(item.quote));
}
function response(body,status,origin){
 const headers={"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"};
 if(origin)headers["Access-Control-Allow-Origin"]=origin;
 return new Response(JSON.stringify(body),{status,headers});
}
export async function onRequestPost(context){
 const origin=context.request.headers.get("Origin");
 const requestUrl=new URL(context.request.url);
 if(origin){try{if(new URL(origin).origin!==requestUrl.origin)return response({error:"Cross-origin requests are not allowed."},403);}catch{return response({error:"Invalid request origin."},403);}}
 let body;try{body=await context.request.json();}catch{return response({error:"Invalid request body."},400,origin);}
 if(!body||typeof body!=="object"||Array.isArray(body))return response({error:"Invalid request body."},400,origin);

 // Either typed text, or a voice recording (WAV, base64) that is sent straight to Gemini.
 let text="";let audio=null;
 if(body.audio){
  const data=typeof body.audio.data==="string"?body.audio.data:"";
  if(body.audio.mimeType!=="audio/wav"||!data)return response({error:"Voice recording is invalid. Please record again."},400,origin);
  if(data.length>MAX_AUDIO_BASE64)return response({error:"Recording is too long. Keep voice notes under two minutes."},413,origin);
  if(!/^[A-Za-z0-9+/=]+$/.test(data))return response({error:"Voice recording is invalid. Please record again."},400,origin);
  audio={mimeType:"audio/wav",data};
 }else{
  text=clean(body.text,MAX_TEXT);
  if(!text)return response({error:"Add a conversation first."},400,origin);
  if(String(body.text||"").length>MAX_TEXT)return response({error:"Keep each conversation under 18,000 characters."},413,origin);
 }

 const key=context.env.GEMINI_API_KEY;
 if(!key)return response({error:"Gemini is not configured yet. The site owner needs to add the GEMINI_API_KEY variable."},503,origin);
 const system=[
  "You are Dayline, a multilingual productivity assistant.",
  "Detect the language the speaker actually uses. It can be any language in the world, including African languages such as Hausa, Yoruba, Igbo, Kanuri, Fulfulde, Swahili, Amharic and Twi, and any other language, dialect or script. Do not ask the user to choose a language.",
  "Also detect the writing style: script (Latin, Arabic, Hausa Ajami, Chinese Simplified or Traditional, Cyrillic, Devanagari, and others), spelling and diacritics, formality (formal, casual, slang, Pidgin-style), and whether the speaker mixes languages or uses code-switching. Describe it briefly in detectedLanguage, for example \"Hausa (Latin script, casual)\" or \"Chinese (Simplified, formal)\".",
  "Nigerian Pidgin is its own language. Label it detectedLanguage Nigerian Pidgin with detectedLanguageCode pcm. Never label Pidgin as English, even though many of its words come from English. If the speaker mixes languages, name the main one and add the others, for example Nigerian Pidgin with English, and give the main code.",
  "detectedLanguageCode must be a BCP-47 code such as en, pcm, zh, yo, ha, ig, fr, ar, es.",
  "Understand the original speech or text directly. Never translate it into English before reasoning, and never translate the transcript.",
  "Write every title, owner, status, email subject and body, event title and description in the same language, script, spelling and register the speaker used. Match their style: casual stays casual, formal stays formal, Pidgin stays Pidgin, Hausa stays Hausa in the script they wrote, Chinese uses the characters they used. Only switch language if the speaker explicitly asks for another language.",
  "Extract only information supported by the conversation. Never invent people, amounts, dates, commitments, email addresses, or event times.",
  "Create tasks only for clear actions and responsibilities. Use empty strings when owner, due date, amount, or status is unknown.",
  "Create an email draft only when the conversation requests a message, email, reply, or update. Never send it.",
  "Create calendar events only when an event or meeting is mentioned. Use ISO 8601 for a known date and time. If year, time, or timezone is unclear, do not guess; leave start empty.",
  "Create businessItems only for clearly mentioned jobs, expenses, invoices, payments, or balances. kind must be job, expense, invoice, payment, balance, or other.",
  "The transcript field must contain the words as spoken or written in their original language. For audio, transcribe first, then extract.",
  "Every item must include quote: an exact, contiguous substring copied from the transcript in its original script. Never paraphrase a quote. Omit an item if no exact supporting quote exists.",
  "Do not treat questions, hypotheticals, negations, or suggestions as completed actions.",
  "The reply field is always required. Write it to the speaker in the same language, script and writing style they used (casual or formal to match them), as a short friendly message. If they asked a question, answer it. If the conversation is just chat or has no tasks, emails, events or business items, respond naturally and briefly explain what you understood, without inventing a task. If you did find items, summarise them in one or two sentences and say what to review. Never invent facts.",
  "Return JSON matching the schema and nothing else."
 ].join(" ");
 const parts=audio
  ?[{inlineData:{mimeType:audio.mimeType,data:audio.data}},{text:"VOICE RECORDING: transcribe the speech in the language spoken, then extract items from that transcript."}]
  :[{text:"ORIGINAL CONVERSATION:\n"+text}];
 const requestBody={systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts}],generationConfig:{maxOutputTokens:4096,temperature:0.15,responseMimeType:"application/json",responseSchema:schema}};
 try{
  const upstream=await fetchWithRetry(API+"?key="+encodeURIComponent(key),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(requestBody),signal:AbortSignal.timeout(40000)});
  const result=await upstream.json().catch(()=>({}));
  if(!upstream.ok){
   if(upstream.status===400||upstream.status===403)return response({error:"Gemini rejected the request. Check that your API key and model access are valid."},502,origin);
   if(upstream.status===429)return response({error:"Gemini is busy or the current quota has been reached. Wait a moment and try again."},429,origin);
   return response({detail:"HTTP "+upstream.status+": "+clean(result?.error?.message||"",300),error:"Gemini could not process this request. Please try again."},502,origin);
  }
  const raw=result?.candidates?.[0]?.content?.parts?.map(part=>part.text||"").join("")||"";
  if(!raw)return response({error:"Gemini returned no usable result. Try a shorter conversation."},502,origin);
  let parsed;try{parsed=JSON.parse(raw);}catch{return response({error:"Gemini returned unreadable data. Please try again."},502,origin);}
  const source=audio?clean(parsed.transcript,MAX_TEXT):text;
  if(audio&&!source)return response({error:"Dayline could not hear any speech. Try again, closer to the microphone."},422,origin);
  const output={
   detectedLanguage:clean(parsed.detectedLanguage,100)||"Not identified",
   detectedLanguageCode:clean(parsed.detectedLanguageCode,20),
   reply:clean(parsed.reply,3000),
   transcript:source,
   tasks:cleanItems(parsed.tasks,fields.tasks,source),
   emails:cleanItems(parsed.emails,fields.emails,source),
   events:cleanItems(parsed.events,fields.events,source),
   businessItems:cleanItems(parsed.businessItems,fields.businessItems,source)
  };
  return response(output,200,origin);
 }catch(error){
  if(error?.name==="TimeoutError")return response({error:"Gemini took too long to respond. Try again with a shorter conversation."},504,origin);
  return response({error:"Could not connect to Gemini. Check your connection and try again."},502,origin);
 }
}
export async function onRequestOptions(context){
 const origin=context.request.headers.get("Origin");
 const requestUrl=new URL(context.request.url);
 if(origin){try{if(new URL(origin).origin!==requestUrl.origin)return new Response(null,{status:403});}catch{return new Response(null,{status:403});}}
 return new Response(null,{headers:{"Access-Control-Allow-Origin":origin||requestUrl.origin,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"86400","Vary":"Origin"}});
}
