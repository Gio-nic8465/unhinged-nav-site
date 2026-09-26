import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {stripTypeScriptTypes} from 'node:module';import {readFile} from 'node:fs/promises';
const source=stripTypeScriptTypes((await readFile('supabase/functions/beta-signup/index.ts','utf8')).replace(/^import .*;\n/,''));
const body={name:'Tester',email:'tester@example.invalid',phoneType:'Android',country:'US',emailConsent:'yes'};
async function run(payload,duplicate=false){let handler,row;const db = {
 from(table) {
  assert.equal(table, 'beta_signups');
  return { insert(value) {
   row=value;
   return { select() { return { single: async () => duplicate
    ? {data:null,error:{code:'23505'}}
    : {data:{id:'test-id'},error:null}
   }; } };
  } };
 }
};
vm.runInNewContext(source,{createClient:()=>db,Deno:{env:{get:key=>key==='RESEND_API_KEY'?undefined:'test-only'},serve:fn=>handler=fn},Request,Response,URL,TextEncoder,Uint8Array,crypto,console:{error(){}},Date,fetch:()=>{throw Error('Must not send mail in tests')}});
const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{'content-type':'application/json',origin:'https://unhingednav.com'},body:JSON.stringify(payload)}));return {response,row};}
test('ordinary signup contract unchanged',async()=>{const {response,row}=await run(body);assert.equal(response.status,201);assert.equal(row.email_consent,true);assert.equal(row.phone_type,'android');assert.equal(row.creator_referral_code,null);assert.equal(row.status,'new');});
test('valid referral added to same atomic signup insert',async()=>{const {response,row}=await run({...body,creator_referral_code:'testcode1'});assert.equal(response.status,201);assert.equal(row.creator_referral_code,'TESTCODE1');});
test('invalid code cannot break regular signup',async()=>{const {response,row}=await run({...body,creator_referral_code:'<script>'});assert.equal(response.status,201);assert.equal(row.creator_referral_code,null);});
test('duplicate keeps original signup, with original duplicate response',async()=>{const {response}=await run({...body,creator_referral_code:'TESTCODE2'},true);assert.deepEqual(await response.json(),{ok:true,duplicate:true});});
test('existing consent requirement preserved',async()=>{const {response}=await run({...body,emailConsent:false});assert.equal(response.status,400);});
