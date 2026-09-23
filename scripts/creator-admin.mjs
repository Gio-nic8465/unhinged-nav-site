// Operator-only tool. Never bundle this file or its environment into the website.
// Usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/creator-admin.mjs list-applications
//        ... node scripts/creator-admin.mjs create-pending <application UUID>
//        ... node scripts/creator-admin.mjs link <creator UUID>
const base='https://lmzzcnbtzjqwnufmtdjh.supabase.co/rest/v1';
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!key)throw Error('Set SUPABASE_SERVICE_ROLE_KEY in your private operator environment. Do not paste it into source files.');
const [command,id]=process.argv.slice(2);
const uuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x||'');
async function call(path,options={}){
 const response=await fetch(base+path,{...options,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation',...options.headers}});
 if(!response.ok)throw Error(`Operation failed (${response.status}); inspect server logs privately.`);
 return response.json();
}
if(command==='list-applications'){
 console.log(JSON.stringify(await call('/creator_applications?select=id,name,country,channel_url,phone_type,status,created_at&order=created_at.desc&limit=100'),null,2));
}else if(command==='create-pending'&&uuid(id)){
 const existing=await call(`/creators?application_id=eq.${id}&select=id,status`);
 const rows=existing.length?existing:await call('/creators',{method:'POST',body:JSON.stringify({application_id:id})});
 console.log(JSON.stringify(rows.map(({id,status})=>({id,status})),null,2));
}else if(command==='link'&&uuid(id)){
 const rows=await call(`/creators?id=eq.${id}&select=referral_code,status,pilot_starts_at,pilot_ends_at,agreement_version,agreement_accepted_at`);
 const c=rows[0],now=Date.now();
 if(!c||c.status!=='active'||!c.agreement_version||!c.agreement_accepted_at||!(Date.parse(c.pilot_starts_at)<=now&&Date.parse(c.pilot_ends_at)>now))throw Error('Creator is not enrolled in an active accepted pilot. No recruitment link issued.');
 console.log(`https://unhingednav.com/?ref=${encodeURIComponent(c.referral_code)}`);
}else throw Error('Use list-applications, create-pending <application UUID>, or link <creator UUID>.');
