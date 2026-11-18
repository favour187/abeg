const MODEL="gemini-3.5-flash-lite";
const API="https://generativelanguage.googleapis.com/v1beta/models/"+MODEL+":generateContent";
const MAX_JSON=60000;
const schema={type:"OBJECT",properties:{
 tasks:{type:"ARRAY",items:{type:"OBJECT",properties:{title:{type:"STRING"},status:{type:"STRING"}},required:["title"]}},
 emails:{type:"ARRAY",items:{type:"OBJECT",properties:{title:{type:"STRING"},subject:{type:"STRING"},body:{type:"STRING"}},required:["subject","body"]}},
 events:{type:"ARRAY",items:{type:"OBJECT",properties:{title:{type:"STRING"},location:{type:"STRING"},description:{type:"STRING"}},required:["title"]}},
 businessItems:{type:"ARRAY",items:{type:"OBJECT",properties:{title:{type:"STRING"},counterparty:{type:"STRING"},status:{type:"STRING"}},required:["title"]}}
},required:["tasks","emails","events","businessItems"]};
const KEYS={tasks:["title","status"],emails:["title","subject","body"],events:["title","location","description"],businessItems:["title","counterparty","status"]};
function clean(value,max=5000){return typeof value==="string"?value.trim().slice(0,max):"";}
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
 const target=clean(body.targetLanguage,80);
 if(!target)return response({error:"Choose a language to translate into."},400,origin);
 const results=body.results;
 if(!results||typeof results!=="object")return response({error:"Nothing to translate yet."},400,origin);
 const payloadText=JSON.stringify(results);
 if(payloadText.length>MAX_JSON)return response({error:"Too much text to translate at once."},413,origin);
 const suppliedKey=clean(body.apiKey,2000);
 const key=context.env.GEMINI_API_KEY||suppliedKey;
 if(!key)return response({error:"Gemini is not configured. Add GEMINI_API_KEY to the server environment or enter a key in Settings."},503,origin);
 const system=[
  "You translate short workplace items for Dayline.",
  "Translate the human-readable text fields into the target language named by the user, written naturally for that language.",
  "Keep the same number of items in each array and the same order. Do not add or remove items.",
  "Keep names of people and companies, and amounts and numbers, as they are. Keep ISO dates and times unchanged.",
  "Return JSON matching the schema and nothing else."
 ].join(" ");
 const requestBody={systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:"TARGET LANGUAGE: "+target+"\nITEMS (JSON):\n"+payloadText}]}],generationConfig:{temperature:0.2,responseMimeType:"application/json",responseSchema:schema}};
 try{
  const upstream=await fetch(API+"?key="+encodeURIComponent(key),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(requestBody),signal:AbortSignal.timeout(30000)});
  const result=await upstream.json().catch(()=>({}));
  if(!upstream.ok){
   if(upstream.status===429)return response({error:"Gemini is busy or the current quota has been reached. Wait a moment and try again."},429,origin);
   return response({error:"Translation failed. Please try again."},502,origin);
  }
  const raw=result?.candidates?.[0]?.content?.parts?.map(part=>part.text||"").join("")||"";
  let parsed;try{parsed=JSON.parse(raw);}catch{return response({error:"Translation returned unreadable data. Please try again."},502,origin);}
  const output={};
  Object.entries(KEYS).forEach(([cat,keys])=>{
   const list=Array.isArray(parsed[cat])?parsed[cat].slice(0,12):[];
   output[cat]=list.map(item=>{const next={};keys.forEach(k=>next[k]=clean(item?.[k],k==="body"?5000:500));return next;});
  });
  return response(output,200,origin);
 }catch(error){
  if(error?.name==="TimeoutError")return response({error:"Translation took too long. Try again."},504,origin);
  return response({error:"Could not connect to Gemini. Check your connection and try again."},502,origin);
 }
}
export async function onRequestOptions(context){
 const origin=context.request.headers.get("Origin");
 const requestUrl=new URL(context.request.url);
 if(origin){try{if(new URL(origin).origin!==requestUrl.origin)return new Response(null,{status:403});}catch{return new Response(null,{status:403});}}
 return new Response(null,{headers:{"Access-Control-Allow-Origin":origin||requestUrl.origin,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"86400","Vary":"Origin"}});
}
