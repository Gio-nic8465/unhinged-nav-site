import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { handleApplication } from './handler.mjs';
Deno.serve(async (req: Request) => {
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return new Response(JSON.stringify({ok:false,error:'server_config'}),{status:503,headers:{'Content-Type':'application/json'}});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 return handleApplication(req,{
  hashIp:async(ip:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`creator-application:${key}:${ip}`)))).map(b=>b.toString(16).padStart(2,'0')).join(''),
  rateLimit:async(hash:string)=>{const {data,error}=await db.rpc('creator_application_rate_limit',{p_hash:hash});if(error)throw error;return data===true;},
  save:async(row:Record<string,unknown>)=>{const {error}=await db.from('creator_applications').insert(row);if(error&&error.code!=='23505')throw error;}
 });
});
