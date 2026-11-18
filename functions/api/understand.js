const MODEL="gemini-3.5-flash-lite";
const API="https://generativelanguage.googleapis.com/v1beta/models/"+MODEL+":generateContent";
const schema={type:"OBJECT",properties:{
 detectedLanguage:{type:"STRING"},
 tasks:{type:"ARRAY",items:{type:"OBJECT",properties:{title:{type:"STRING"},owner:{type:"STRING"},dueDate:{type:"STRING"},amount:{type:"STRING"},status:{type:"STRING"},quote:{type:"STRING"}},required:["title","quote"]}},
 emails:{type:"ARRAY",items:{type:"OBJECT",properties:{title:{type:"STRING"},recipient:{type:"STRING"},subject:{type:"STRING"},body:{type:"STRING"},quote:{type:"STRING"}},required:["subject","body","quote"]}},
 events:{type:"ARRAY",items:{type:"OBJECT",properties:{title:{type:"STRING"},start:{type:"STRING"},location:{type:"STRING"},description:{type:"STRING"},quote:{type:"STRING"}},required:["title","quote"]}},
 businessItems:{type:"ARRAY",items:{type:"OBJECT",properties:{kind:{type:"STRING"},title:{type:"STRING"},amount:{type:"STRING"},dueDate:{type:"STRING"},counterparty:{type:"STRING"},status:{type:"STRING"},quote:{type:"STRING"}},required:["kind","title","quote"]}}
},required:["detectedLanguage","tasks","emails","events","businessItems"]};
export async function onRequestPost(context){
 const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*"};
 const fail=(message,status)=>new Response(JSON.stringify({error:message}),{status,headers});
 let body;try{body=await context.request.json();}catch{return fail("Invalid request body.",400);}
 const text=String(body.text||"").trim();if(!text)return fail("Add a conversation first.",400);if(text.length>18000)return fail("Keep each conversation under 18,000 characters.",413);
 const key=context.env.GEMINI_API_KEY||String(body.apiKey||"").trim();if(!key)return fail("Gemini is not configured. Add GEMINI_API_KEY to the server environment or enter a key in Settings.",503);
 const system=[
 "You are Dayline, a multilingual productivity assistant.",
 "Detect the language or languages used in the transcript. Do not ask the user to choose a language.",
 "Understand the original text directly. Do not translate it into English before reasoning.",
 "Return task titles and email drafts in the language used by the speaker unless another language is explicitly requested.",
 "Extract only information supported by the transcript. Never invent people, amounts, dates, commitments, email addresses, or event times.",
 "Create tasks only for clear actions and responsibilities. Use empty strings when owner, due date, amount, or status is unknown.",
 "Create an email draft only when the transcript requests a message, email, reply, or update. Never send it.",
 "Create calendar events only when an event or meeting is mentioned. Use ISO 8601 for a known date and time. If year or timezone is unclear, do not guess; leave start empty.",
 "Create businessItems only for clearly mentioned jobs, expenses, invoices, payments, or balances. kind must be job, expense, invoice, payment, balance, or other.",
 "Every item must include quote: an exact, contiguous substring copied from the original transcript in its original script. Never paraphrase a quote. Omit an item if no exact supporting quote exists.",
 "Do not treat questions, hypotheticals, negations, or suggestions as completed actions.",
 "Return JSON matching the schema and nothing else."
 ].join(" ");
 const requestBody={systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:"ORIGINAL CONVERSATION:\n"+text}]}],generationConfig:{temperature:0.15,responseMimeType:"application/json",responseSchema:schema}};
 try{
  const response=await fetch(API+"?key="+encodeURIComponent(key),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(requestBody)});
  const result=await response.json();if(!response.ok)return fail(result?.error?.message||"Gemini request failed ("+response.status+").",response.status===429?429:502);
  const raw=result?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";if(!raw)return fail("Gemini returned an empty response. Try a shorter conversation.",502);
  let parsed;try{parsed=JSON.parse(raw);}catch{return fail("Gemini returned unreadable structured data. Please try again.",502);}
  return new Response(JSON.stringify(parsed),{status:200,headers});
 }catch{return fail("Could not connect to Gemini. Check the network and try again.",502);}
}
export async function onRequestOptions(){return new Response(null,{headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type"}});}
