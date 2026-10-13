export function normalizeDirectUsage(raw, now=Date.now()) {
 const windows=[];
 for(const [slot,key] of [['primary','primary_window'],['secondary','secondary_window']]){
  const w=raw?.rate_limit?.[key];
  if(!w||typeof w.used_percent!=='number'||!Number.isFinite(w.used_percent)||w.used_percent<0||w.used_percent>100||!Number.isFinite(w.limit_window_seconds)||w.limit_window_seconds<=0)continue;
  windows.push({slot,remainingPercent:100-w.used_percent,usedPercent:w.used_percent,durationMinutes:w.limit_window_seconds/60,resetsAt:Number.isFinite(w.reset_at)&&w.reset_at>0?w.reset_at:null});
 }
 return {schemaVersion:1,observedAt:now,codex:{status:windows.length?'available':'unavailable',source:'direct wham/usage (unofficial)',windows}};
}
export function tokenBundle(raw, oldRefresh, now=Date.now()){
 if(typeof raw?.access_token!=='string'||!raw.access_token||typeof (raw.refresh_token||oldRefresh)!=='string'||!(raw.refresh_token||oldRefresh))throw new Error('Invalid token response');
 return {accessToken:raw.access_token,refreshToken:raw.refresh_token||oldRefresh,expiresAt:Number.isFinite(raw.expires_in)&&raw.expires_in>0?now+raw.expires_in*1000:0};
}
