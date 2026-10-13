import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDirectUsage, tokenBundle } from '../lib/direct-core.mjs';
test('actual zero usage stays 100 percent remaining',()=>{
 const d=normalizeDirectUsage({rate_limit:{primary_window:{used_percent:0,limit_window_seconds:18000,reset_at:2000000000}}},100);
 assert.equal(d.codex.windows[0].remainingPercent,100);assert.equal(d.codex.windows[0].durationMinutes,300);
});
test('null, strings and invalid percentages never become real quota',()=>{
 for(const used of [null,'10',NaN,-1,101])assert.equal(normalizeDirectUsage({rate_limit:{primary_window:{used_percent:used,limit_window_seconds:18000}}}).codex.windows.length,0);
 assert.equal(normalizeDirectUsage({}).codex.status,'unavailable');
});
test('reset timestamp is seconds and unknown reset stays unknown',()=>{
 assert.equal(normalizeDirectUsage({rate_limit:{primary_window:{used_percent:20,limit_window_seconds:60,reset_at:null}}}).codex.windows[0].resetsAt,null);
});
test('refresh keeps rotated tokens as one bundle and rejects incomplete responses',()=>{
 assert.equal(tokenBundle({access_token:'new',refresh_token:'rotated',expires_in:3600},'old',100).refreshToken,'rotated');
 assert.equal(tokenBundle({access_token:'new',expires_in:3600},'old',100).refreshToken,'old');
 assert.throws(()=>tokenBundle({},'old'));
});
