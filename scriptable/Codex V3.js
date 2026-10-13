// V3 standard: direct iPhone OAuth. No Windows bridge required.
// Direct iPhone access. Unofficial endpoint. Each variant owns its OAuth session.
const prefix='codex-direct-v2';
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

function normalizeDirectUsage(raw, now=Date.now()) {
 const windows=[];
 for(const [slot,key] of [['primary','primary_window'],['secondary','secondary_window']]){
  const w=raw?.rate_limit?.[key];
  if(!w||typeof w.used_percent!=='number'||!Number.isFinite(w.used_percent)||w.used_percent<0||w.used_percent>100||!Number.isFinite(w.limit_window_seconds)||w.limit_window_seconds<=0)continue;
  windows.push({slot,remainingPercent:100-w.used_percent,usedPercent:w.used_percent,durationMinutes:w.limit_window_seconds/60,resetsAt:Number.isFinite(w.reset_at)&&w.reset_at>0?w.reset_at:null});
 }
 return {schemaVersion:1,observedAt:now,codex:{status:windows.length?'available':'unavailable',source:'direct wham/usage (unofficial)',windows}};
}
function tokenBundle(raw, oldRefresh, now=Date.now()){
 if(typeof raw?.access_token!=='string'||!raw.access_token||typeof (raw.refresh_token||oldRefresh)!=='string'||!(raw.refresh_token||oldRefresh))throw new Error('Invalid token response');
 return {accessToken:raw.access_token,refreshToken:raw.refresh_token||oldRefresh,expiresAt:Number.isFinite(raw.expires_in)&&raw.expires_in>0?now+raw.expires_in*1000:0};
}

const widget=new ListWidget();widget.backgroundColor=new Color('101820');widget.setPadding(14,16,12,16);
function text(parent,s,size=12,color='ffffff',bold=false){const t=parent.addText(s);t.font=bold?Font.semiboldSystemFont(size):Font.systemFont(size);t.textColor=new Color(color);t.lineLimit=1;t.minimumScaleFactor=0.75;return t;}
const age=data?.observedAt ? Date.now()-data.observedAt : Infinity;
const stale=offline||age>900000||age< -60000||data?.codex?.status==='stale';
const windows=(data?.codex?.windows||[]).filter(w=>Number.isFinite(w.remainingPercent)&&w.remainingPercent>=0&&w.remainingPercent<=100&&Number.isFinite(w.durationMinutes)&&w.durationMinutes>0).slice(0,2);
const small=config.widgetFamily==='small';
const header=widget.addStack();header.centerAlignContent();text(header,'Codex',17,'ffffff',true);header.addSpacer();
text(header,'●',10,windows.length?(stale?'e8b86d':'75d5bb'):'e8b86d');
widget.addSpacer(small?8:12);
const cards=widget.addStack();if(small)cards.layoutVertically();else cards.layoutHorizontally();
function bar(parent,percent,color,width){
  const dc=new DrawContext();dc.size=new Size(width,5);dc.opaque=false;dc.respectScreenScale=true;
  dc.setFillColor(new Color('29343e'));dc.fillRect(new Rect(0,0,width,5));
  if(percent!==null){dc.setFillColor(new Color(color));dc.fillRect(new Rect(0,0,width*percent/100,5));}
  parent.addImage(dc.getImage());
}
for(let i=0;i<windows.length;i++){
  const w=windows[i],expired=Number.isFinite(w.resetsAt)&&w.resetsAt*1000<=Date.now();
  if(i)cards.addSpacer(small?8:24);
  const card=cards.addStack();card.layoutVertically();
  const label=w.durationMinutes%1440===0?w.durationMinutes/1440+'d':w.durationMinutes%60===0?w.durationMinutes/60+'h':w.durationMinutes+'m';
  const color=stale?'e8b86d':w.remainingPercent<=10?'f28b82':w.remainingPercent<=30?'e8b86d':'75d5bb';
  if(small){const row=card.addStack();text(row,label,11,'9aaab7');row.addSpacer();text(row,expired?'Awaiting update':w.remainingPercent.toFixed(0)+'%',17,color,true);}
  else{text(card,label,11,'9aaab7');card.addSpacer(2);text(card,expired?'Awaiting update':w.remainingPercent.toFixed(1)+'%',30,color,true);}
  card.addSpacer(4);bar(card,expired?null:w.remainingPercent,color,small?122:128);card.addSpacer(4);
  if(w.resetsAt){const d=new Date(w.resetsAt*1000);text(card,'Reset '+d.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}),9,'9aaab7');}
}
if(!windows.length){text(widget,'Quota unavailable',15,'e8b86d');widget.addSpacer(4);text(widget,offline?error:'Tap to retry',10,'9aaab7');}
widget.addSpacer();
if(data?.observedAt){
  const d=new Date(data.observedAt);
  const stamp=d.toLocaleString('en-GB',small?{hour:'2-digit',minute:'2-digit'}:{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  text(widget,(stale?'Stale · ':'Updated ')+stamp,9,stale?'e8b86d':'9aaab7');
}else if(offline)text(widget,error+' · tap to retry',9,'e8b86d');
widget.refreshAfterDate=new Date(Date.now()+900000);
widget.url='scriptable:///run?scriptName='+encodeURIComponent(Script.name());
Script.setWidget(widget);if(!config.runsInWidget)await widget.presentMedium();Script.complete();
