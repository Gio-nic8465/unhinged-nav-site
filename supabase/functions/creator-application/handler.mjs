export const allowedOrigin = origin => {
 if (!origin) return true;
 try { const u=new URL(origin); return u.protocol==='https:' && ['unhingednav.com','www.unhingednav.com','gio-nic8465.github.io'].includes(u.hostname); } catch { return false; }
};
export async function handleApplication(req, {save, rateLimit, hashIp, now=()=>new Date()}) {
 const origin=req.headers.get('origin');
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':allowedOrigin(origin)&&origin?origin:'https://unhingednav.com','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type','Vary':'Origin'};
 const json=(body,status)=>new Response(JSON.stringify(body),{status,headers});
 if (!allowedOrigin(origin)) return json({ok:false,error:'origin_not_allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
 // Bound actual streamed bytes, even when Content-Length is omitted or dishonest.
 let body;
 try {
  const reader=req.body?.getReader(); if(!reader)return json({ok:false,error:'invalid_json'},400);
  const chunks=[];let size=0;
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>12000){await reader.cancel();return json({ok:false,error:'payload_too_large'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
  body=JSON.parse(new TextDecoder().decode(bytes));
 }catch{return json({ok:false,error:'invalid_json'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body))return json({ok:false,error:'invalid_input'},400);
 if(typeof body.website==='string'&&body.website.trim())return json({ok:true},200);
 const text=k=>typeof body[k]==='string'?body[k].trim():'';
 const name=text('name'),email=text('email').toLowerCase(),country=text('country'),audience=text('audience'),phone_type=text('phone_type');
 let channel;
 try {channel=new URL(text('channel_url'));}catch{return json({ok:false,error:'invalid_channel'},400);}
 const host=channel.hostname.toLowerCase();
 const allowed=['youtube.com','youtu.be','tiktok.com','instagram.com','facebook.com'];
 if(channel.protocol!=='https:'||channel.username||channel.password||!allowed.some(h=>host===h||host===`www.${h}`)||channel.href.length>500)return json({ok:false,error:'invalid_channel'},400);
 if(!name||name.length>100||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||country.length<2||country.length>100||!audience||audience.length>1500||!['android','iphone'].includes(phone_type)||body.consent!==true)return json({ok:false,error:'invalid_input'},400);
 // Gateway must provide a trusted client address. Fail closed when unavailable.
 const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0].trim();
 if(!ip)return json({ok:false,error:'network_unavailable'},503);
 try {
  if(!await rateLimit(await hashIp(ip)))return json({ok:false,error:'rate_limited'},429);
  await save({name,email,country,channel_url:channel.href,phone_type,audience,consented_at:now().toISOString()});
  return json({ok:true},200);
 }catch{return json({ok:false,error:'save_failed'},503);}
}
