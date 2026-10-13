// V3 mascot: direct iPhone OAuth. Dedicated mascot session required.
// Direct iPhone access. Unofficial endpoint. Each variant owns its OAuth session.
const prefix='codex-direct-mascot';
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
const small=!config.runsInWidget||config.widgetFamily==='small';
const low=windows.some(w=>w.remainingPercent<=10);
const waiting=stale||!windows.length||windows.some(w=>w.resetsAt&&w.resetsAt*1000<=Date.now());
const mascotColor=waiting?'e8b86d':low?'f28b82':'75d5bb';
function mascot(){
  const d=new DrawContext();d.size=new Size(96,72);d.opaque=false;d.respectScreenScale=true;
  function block(x,y,w,h,c){d.setFillColor(new Color(c));d.fillRect(new Rect(x,y,w,h));}
  // Original pixel robot, drawn locally. No downloaded assets or credentials.
  block(28,65,40,4,'080e13');
  block(45,3,6,10,mascotColor);block(42,0,12,6,mascotColor);
  block(22,15,52,6,mascotColor);block(16,21,64,32,mascotColor);block(22,53,52,6,mascotColor);
  block(8,28,8,18,mascotColor);block(80,28,8,18,mascotColor);
  block(25,23,46,25,'182a32');block(25,23,46,3,'24424b');
  if(waiting){block(33,33,9,3,mascotColor);block(54,33,9,3,mascotColor);}
  else if(low){block(33,34,9,3,mascotColor);block(54,34,9,3,mascotColor);}
  else{block(34,29,6,10,'c5fff0');block(56,29,6,10,'c5fff0');block(35,29,2,3,'ffffff');block(57,29,2,3,'ffffff');}
  if(low){block(43,43,10,3,mascotColor);}
  else{block(42,40,3,3,mascotColor);block(51,40,3,3,mascotColor);block(45,43,6,3,mascotColor);}
  block(27,40,5,3,'579b91');block(64,40,5,3,'579b91');
  block(31,59,10,6,mascotColor);block(55,59,10,6,mascotColor);
  block(27,63,14,3,mascotColor);block(55,63,14,3,mascotColor);
  return d.getImage();
}
function centered(s,size,color,bold=false){const row=widget.addStack();row.addSpacer();text(row,s,size,color,bold);row.addSpacer();}
const header=widget.addStack();header.centerAlignContent();text(header,'Codex',small?12:17,'ffffff',true);header.addSpacer();
text(header,'●',10,windows.length?(stale?'e8b86d':'75d5bb'):'e8b86d');
if(!small){header.addSpacer(8);const icon=header.addImage(mascot());icon.imageSize=new Size(40,30);}
widget.addSpacer(small?4:10);
if(small){
  const row=widget.addStack();row.addSpacer();const icon=row.addImage(mascot());icon.imageSize=new Size(80,60);row.addSpacer();
  widget.addSpacer(2);centered(waiting?'Awaiting update':low?'Rest time':'Ready',13,mascotColor,true);widget.addSpacer(4);
  for(const w of windows){
    const expired=w.resetsAt&&w.resetsAt*1000<=Date.now();
    const label=w.durationMinutes%1440===0?w.durationMinutes/1440+'d':w.durationMinutes%60===0?w.durationMinutes/60+'h':w.durationMinutes+'m';
    centered(label+' · '+(expired?'Awaiting update':w.remainingPercent.toFixed(0)+'%'),10,'9aaab7');
  }
  if(!windows.length)centered('Quota unavailable',10,'9aaab7');
}
const cards=small?null:widget.addStack();if(cards)cards.layoutHorizontally();
function bar(parent,percent,color,width){
  const dc=new DrawContext();dc.size=new Size(width,5);dc.opaque=false;dc.respectScreenScale=true;
  dc.setFillColor(new Color('29343e'));dc.fillRect(new Rect(0,0,width,5));
  if(percent!==null){dc.setFillColor(new Color(color));dc.fillRect(new Rect(0,0,width*percent/100,5));}
  parent.addImage(dc.getImage());
}
for(let i=0;!small&&i<windows.length;i++){
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
if(!small&&!windows.length){text(widget,'Quota unavailable',15,'e8b86d');widget.addSpacer(4);text(widget,offline?error:'Tap to retry',10,'9aaab7');}
widget.addSpacer();
if(data?.observedAt){
  const d=new Date(data.observedAt);
  const stamp=d.toLocaleString('en-GB',small?{hour:'2-digit',minute:'2-digit'}:{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  text(widget,(stale?'Stale · ':'Updated ')+stamp,9,stale?'e8b86d':'9aaab7');
}else if(offline)text(widget,error+' · tap to retry',9,'e8b86d');
widget.refreshAfterDate=new Date(Date.now()+900000);
widget.url='scriptable:///run?scriptName='+encodeURIComponent(Script.name());
Script.setWidget(widget);if(!config.runsInWidget)await widget.presentSmall();Script.complete();
