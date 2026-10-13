// Direct iPhone access. Unofficial endpoint. Each variant owns its OAuth session.
const prefix='VARIANT_PREFIX';
const fm=FileManager.local();
const cache=fm.joinPath(fm.libraryDirectory(),prefix+'.json');
const credentialKey=prefix+'-oauth';
const tokenURL='https://auth.openai.com/oauth/token';
const usageURL='https://chatgpt.com/backend-api/wham/usage';
const clientId='app_EMoamEEZ73f0CkXaXp7hrann';
function loadBundle(){try{return JSON.parse(Keychain.get(credentialKey));}catch{return null;}}
function jwtPayload(token){try{let b=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');while(b.length%4)b+='=';return JSON.parse(Data.fromBase64String(b).toRawString());}catch{return null;}}
function accountId(token){const p=jwtPayload(token),a=p?.['https://api.openai.com/auth'];return a?.chatgpt_account_id||a?.account_id||p?.chatgpt_account_id||p?.account_id||null;}
async function refresh(bundle){
 const r=new Request(tokenURL);r.method='POST';r.timeoutInterval=15;
 r.headers={'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'};
 r.body='grant_type=refresh_token&client_id='+encodeURIComponent(clientId)+'&refresh_token='+encodeURIComponent(bundle.refreshToken);
 let raw;try{raw=await r.loadJSON();}catch{throw new Error('Connection failed');}
 if(r.response?.statusCode!==200){throw new Error(r.response?.statusCode===400||r.response?.statusCode===401?'Sign in again':'Connection failed');}
 const updated=tokenBundle(raw,bundle.refreshToken);
 // One Keychain write immediately saves both rotated tokens before any usage read.
 Keychain.set(credentialKey,JSON.stringify(updated));return updated;
}
async function usage(bundle){
 const id=accountId(bundle.accessToken);if(!id)throw new Error('Sign in again');
 const r=new Request(usageURL);r.timeoutInterval=15;r.headers={Authorization:'Bearer '+bundle.accessToken,'ChatGPT-Account-Id':id,Accept:'application/json'};
 let raw;try{raw=await r.loadJSON();}catch{throw new Error('Connection failed');}
 if(r.response?.statusCode!==200){const e=new Error(r.response?.statusCode===401?'Sign in again':r.response?.statusCode===403?'Access unavailable':'Connection failed');e.status=r.response?.statusCode;throw e;}
 return normalizeDirectUsage(raw);
}
if(!config.runsInWidget){
 const a=new Alert();a.title='Codex Direct setup';
 a.message='Paste a dedicated OAuth refresh token for THIS variant only. Never use your relay token or share this session with another widget. Credentials stay in Keychain.';
 a.addSecureTextField('Dedicated refresh token');a.addAction('Save');a.addCancelAction('Keep current');
 if(await a.presentAlert()===0){const value=a.textFieldValue(0).trim();if(!value||value.length<20||/\s/.test(value)||/^[a-f0-9]{64}$/.test(value))throw new Error('Use a dedicated OAuth refresh token, not the relay token');Keychain.set(credentialKey,JSON.stringify({refreshToken:value,accessToken:'',expiresAt:0}));if(fm.fileExists(cache))fm.remove(cache);}
}
let data=null,offline=false,error='Setup required';
try{
 let bundle=loadBundle();if(!bundle?.refreshToken)throw new Error('Setup required');
 const exp=jwtPayload(bundle.accessToken)?.exp;
 const expiry=bundle.expiresAt||(Number.isFinite(exp)?exp*1000:0);
 if(!bundle.accessToken||!expiry||expiry<Date.now()+300000)bundle=await refresh(bundle);
 try{data=await usage(bundle);}catch(e){if(e.status!==401)throw e;bundle=await refresh(loadBundle()||bundle);data=await usage(bundle);}
 fm.writeString(cache,JSON.stringify(data));
}catch(e){
 offline=true;error=['Setup required','Sign in again','Access unavailable'].includes(e.message)?e.message:'Connection failed';
 try{if(fm.fileExists(cache))data=JSON.parse(fm.readString(cache));}catch{}
}
