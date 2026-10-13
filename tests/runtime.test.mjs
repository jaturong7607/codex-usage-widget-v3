import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const code=readFileSync(new URL('../lib/direct-scriptable-header.js',import.meta.url),'utf8').replace('VARIANT_PREFIX','test-direct')+'\n'+readFileSync(new URL('../lib/direct-core.mjs',import.meta.url),'utf8').replaceAll('export function','function')+'\nreturn {data,offline,error};';
function token(){return 'header.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,'https://api.openai.com/auth':{chatgpt_account_id:'test-account'}})).toString('base64url')+'.signature';}
async function run(bundle,responses,oldCache=null){
 const store=new Map(bundle?[['test-direct-oauth',JSON.stringify(bundle)]]:[]);let cache=oldCache?JSON.stringify(oldCache):null;const requests=[];
 class Request{constructor(url){this.url=url;}async loadJSON(){requests.push(this);const next=responses.shift();if(next instanceof Error)throw next;if(!next)throw new Error('Unexpected request');this.response={statusCode:next.status};return next.body;}}
 const fm={joinPath:(a,b)=>a+'/'+b,libraryDirectory:()=>'/cache',fileExists:()=>cache!==null,readString:()=>cache,writeString:(p,v)=>{cache=v;}};
 const result=await new AsyncFunction('Keychain','FileManager','config','Data','Request','Alert',code)({get:k=>store.get(k),set:(k,v)=>store.set(k,v)},{local:()=>fm},{runsInWidget:true},{fromBase64String:b=>({toRawString:()=>Buffer.from(b,'base64').toString('utf8')})},Request,null);
 return {...result,store,requests};
}
test('401 retries once, stores rotated bundle and uses new bearer',async()=>{
 const access=token();const r=await run({accessToken:access,refreshToken:'old-refresh',expiresAt:Date.now()+3600000},[
 {status:401,body:{}},{status:200,body:{access_token:access,refresh_token:'new-refresh',expires_in:3600}},
 {status:200,body:{rate_limit:{primary_window:{used_percent:5,limit_window_seconds:18000}}}}]);
 assert.equal(r.offline,false);assert.equal(r.requests.length,3);assert.equal(JSON.parse(r.store.get('test-direct-oauth')).refreshToken,'new-refresh');assert.equal(r.data.codex.windows[0].remainingPercent,95);
});
test('network failure preserves observation timestamp and marks offline',async()=>{
 const old={observedAt:123,codex:{status:'available',windows:[]}};
 const r=await run({accessToken:token(),refreshToken:'old-refresh',expiresAt:Date.now()+3600000},[new Error('network')],old);
 assert.equal(r.offline,true);assert.equal(r.data.observedAt,123);assert.equal(r.error,'Connection failed');
});
test('no login makes no requests and repeated 401 stops after one retry',async()=>{
 assert.equal((await run(null,[])).requests.length,0);
 const access=token();const r=await run({accessToken:access,refreshToken:'old',expiresAt:Date.now()+3600000},[{status:401,body:{}},{status:200,body:{access_token:access,refresh_token:'new',expires_in:3600}},{status:401,body:{}}]);
 assert.equal(r.requests.length,3);assert.equal(r.error,'Sign in again');assert.equal(r.offline,true);
});
