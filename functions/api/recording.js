const REPO="favour187/dayline";
const BRANCH="main";
const MAX_BASE64=40000000;
function response(body,status){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});}
function safeEqual(a,b){
 if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
function extFor(mime){
 if(mime.startsWith("audio/mp4"))return "m4a";
 if(mime.startsWith("audio/ogg"))return "ogg";
 if(mime.startsWith("audio/wav"))return "wav";
 return "webm";
}
export async function onRequestPost(context){
 const env=context.env;
 if(!env.RECORDER_PASSWORD||!env.GITHUB_TOKEN)return response({error:"Recorder is not configured yet."},503);
 let body;try{body=await context.request.json();}catch{return response({error:"Invalid request."},400);}
 if(!safeEqual(String(body?.password||""),env.RECORDER_PASSWORD))return response({error:"Wrong password."},401);
 const mime=String(body.mimeType||"audio/webm").split(";")[0];
 const data=typeof body.data==="string"?body.data:"";
 if(!data||data.length>MAX_BASE64)return response({error:"Recording is empty or too large."},413);
 if(!/^[A-Za-z0-9+/=]+$/.test(data))return response({error:"Invalid recording data."},400);
 const stamp=new Date().toISOString().replace(/[:.]/g,"-");
 const path="recordings/voiceover-"+stamp+"."+extFor(mime);
 const upstream=await fetch("https://api.github.com/repos/"+REPO+"/contents/"+path,{
  method:"PUT",
  headers:{"Authorization":"Bearer "+env.GITHUB_TOKEN,"Accept":"application/vnd.github+json","Content-Type":"application/json","User-Agent":"dayline-recorder"},
  body:JSON.stringify({message:"Add voice recording "+stamp,content:data,branch:BRANCH})
 });
 const result=await upstream.json().catch(()=>({}));
 if(!upstream.ok)return response({error:"GitHub rejected the upload (HTTP "+upstream.status+"). "+(result?.message||"")},502);
 return response({path,url:result?.content?.html_url||("https://github.com/"+REPO+"/blob/"+BRANCH+"/"+path)},200);
}
export async function onRequestOptions(){return new Response(null,{status:204});}
