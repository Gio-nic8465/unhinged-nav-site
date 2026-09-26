import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {evaluateCommission} from '../lib/commission.mjs';
import {handleApplication} from '../supabase/functions/creator-application/handler.mjs';
const now=new Date('2026-09-23T00:00:00Z');
function eligible(){return {purchase:{verified:true,transactionId:'tx1',verifiedCustomerId:'customer1',attributionVerified:true,purchasedAt:'2026-07-01T00:00:00Z',currency:'USD'},terms:{approvedVersion:'test-only',entitlementVerified:true,rateBps:2000,rounding:'floor'},settlement:{reportId:'report1',bankReference:'bank1',allocationId:'allocation1',transactionId:'tx1',reconciled:true,platformPeriodCompletedAt:'2026-09-01T00:00:00Z',receivedAt:'2026-09-02T00:00:00Z',clearedAt:'2026-09-03T00:00:00Z',currency:'USD',basis:'gross_allocated',grossMinor:'10000',refundMinor:'1000',reversalMinor:'200',chargebackMinor:'300',taxMinor:'500',platformFeeMinor:'1500',exclusionsReconciled:true,clearedNetMinor:'6500'},alreadyPaidMinor:'0'};}
test('signup alone cannot earn commission',()=>assert.deepEqual(evaluateCommission({},now),{status:'attribution_only',payableMinor:'0'}));
test('all five exclusions deducted from cleared gross allocation',()=>assert.equal(evaluateCommission(eligible(),now).payableMinor,'1300'));
for(const [name,mutate] of [
 ['unapproved terms',x=>x.terms.approvedVersion=null],['no attribution',x=>x.purchase.attributionVerified=false],
 ['platform takes over 30 days',x=>x.settlement.platformPeriodCompletedAt='2026-10-01T00:00:00Z'],
 ['no bank receipt',x=>x.settlement.receivedAt=null],['no clearance',x=>x.settlement.clearedAt=null],
 ['unreconciled exclusion',x=>x.settlement.exclusionsReconciled=false],['currency mismatch',x=>x.settlement.currency='EUR'],
 ['net already deducted',x=>x.settlement.basis='platform_net'],['partial clearance',x=>x.settlement.clearedNetMinor='100'],
 ['negative amount',x=>x.settlement.refundMinor='-1'],['unverified purchase',x=>x.purchase.verified=false],
 ['dispute',x=>x.disputeOpen=true],['missing bank evidence',x=>x.settlement.bankReference=null]
])test(name+' holds payment',()=>{const x=eligible();mutate(x);assert.equal(evaluateCommission(x,now).status,'held');});
test('already paid amounts cannot pay twice; subsequent refund requires review',()=>{const x=eligible();x.alreadyPaidMinor='1300';assert.equal(evaluateCommission(x,now).payableMinor,'0');x.settlement.refundMinor='2000';assert.equal(evaluateCommission(x,now).status,'adjustment_review');});
test('large money is exact and not rounded by floating point',()=>{const x=eligible();x.settlement.grossMinor='9007199254740993000';x.settlement.clearedNetMinor='9007199254740993000';assert.equal(evaluateCommission(x,now).payableMinor,'1801439850948197900');});
const body={name:'Test Creator',email:'TEST@example.invalid',country:'US',channel_url:'https://www.youtube.com/@test',phone_type:'android',audience:'Test audience',consent:true};
const request=(b=body,origin='https://unhingednav.com')=>new Request('https://example.test',{method:'POST',headers:{origin,'x-forwarded-for':'192.0.2.1'},body:JSON.stringify(b)});
let saved;
const dependencies={save:async row=>{saved=row},rateLimit:async()=>true,hashIp:async()=> 'a'.repeat(64),now:()=>now};
test('application validates and saves canonical fields without activation',async()=>{const r=await handleApplication(request({...body,status:'active',rate_bps:9999}),dependencies);assert.equal(r.status,200);assert.equal(saved.email,'test@example.invalid');assert.equal(saved.status,undefined);assert.equal(saved.rate_bps,undefined);});
for(const [label,b,status] of [['null',null,400],['array',[],400],['no consent',{...body,consent:false},400],['bad channel',{...body,channel_url:'javascript:alert(1)'},400],['lookalike',{...body,channel_url:'https://youtube.com.evil.test'},400],['oversize',{...body,audience:'a'.repeat(13000)},413]])test('application rejects '+label,async()=>assert.equal((await handleApplication(request(b),dependencies)).status,status));
test('application rejects bad origin and rate limit; persistence failure is not success',async()=>{assert.equal((await handleApplication(request(body,'https://evil.test'),dependencies)).status,403);assert.equal((await handleApplication(request(),{...dependencies,rateLimit:async()=>false})).status,429);assert.equal((await handleApplication(request(),{...dependencies,save:async()=>{throw Error()}})).status,503);});
test('referral code is validated, carried internally and never to external sites',async()=>{
 const links=['/#beta','/android-beta/','https://youtube.com/@someone','mailto:hello@example.com'].map(href=>({href,getAttribute(){return this.href},setAttribute(_,v){this.href=v}}));
 const window={location:{search:'?ref=abc12345',href:'https://unhingednav.com/?ref=abc12345',origin:'https://unhingednav.com'},document:{querySelectorAll:()=>links}};
 vm.runInNewContext(await readFile('assets/creator-referral.js','utf8'),{window,URL,URLSearchParams});
 assert.equal(window.UnhingedReferral.codeFrom('?ref=<bad>'),null);assert.equal(window.UnhingedReferral.codeFrom(''),null);
 assert.equal(links[0].href,'/?ref=ABC12345#beta');assert.equal(links[1].href,'/android-beta/?ref=ABC12345');assert.equal(links[2].href,'https://youtube.com/@someone');assert.equal(links[3].href,'mailto:hello@example.com');
});
test('migration protects records and atomically captures signup claims',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create table public.beta_signups(id uuid primary key default gen_random_uuid(),email text unique not null);grant usage on schema public to service_role;grant select,insert on public.beta_signups to service_role;`);
 await db.exec(await readFile('supabase/migrations/20260923025106_founding_creator_program.sql','utf8'));
 await db.exec(`insert into public.creators(referral_code,status,pilot_starts_at,pilot_ends_at,agreement_version,agreement_accepted_at) values('TESTCODE1','active',now()-interval '1 day',now()+interval '89 days','test',now());`);
 await assert.rejects(db.exec(`insert into public.creators(referral_code,pilot_starts_at,pilot_ends_at) values('TOOLONG1',now(),now()+interval '91 days');`));
 await db.exec(`set role service_role; insert into public.beta_signups(email,creator_referral_code) values('one@example.invalid','TESTCODE1'),('two@example.invalid','BADCODE1'),('three@example.invalid',null);`);
 const {rows}=await db.query('select status from public.creator_referral_claims order by status');assert.deepEqual(rows.map(x=>x.status),['invalid_or_inactive','pending_review']);
 assert.equal((await db.query('select count(*)::int as n from public.creator_commission_ledger')).rows[0].n,0);
 await assert.rejects(db.exec(`insert into public.beta_signups(email,creator_referral_code) values('one@example.invalid','BADCODE2');`));
 assert.equal((await db.query('select count(*)::int as n from public.creator_referral_claims')).rows[0].n,2);
 await assert.rejects(db.exec(`update public.creator_referral_claims set claimed_code='CHANGED1';`));
 for(let i=0;i<6;i++){const r=await db.query(`select public.creator_application_rate_limit($1) as allowed`,['a'.repeat(64)]);assert.equal(r.rows[0].allowed,i<5);}
 await db.exec('reset role;set role anon');
 for(const table of ['creator_applications','creators','creator_referral_claims','creator_commercial_terms','creator_commission_ledger'])await assert.rejects(db.query(`select * from public.${table}`));
 await assert.rejects(db.query(`select public.creator_application_rate_limit($1)`,['b'.repeat(64)]));
 await db.exec('reset role;set role authenticated');await assert.rejects(db.query('select * from public.creators'));
 }finally{await db.close();}
});
