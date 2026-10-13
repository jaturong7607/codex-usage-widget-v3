import { readFileSync, writeFileSync } from 'node:fs';
const root=new URL('../',import.meta.url);
const header=readFileSync(new URL('lib/direct-scriptable-header.js',root),'utf8');
const core=readFileSync(new URL('lib/direct-core.mjs',root),'utf8').replaceAll('export function','function');
for(const [name,prefix] of [['Codex V3.js','codex-direct-v2'],['Codex V3 Mascot.js','codex-direct-mascot']]){
 const url=new URL('scriptable/'+encodeURIComponent(name),root);
 const current=readFileSync(url,'utf8');
 const ui=current.slice(current.indexOf('const widget='));
 if(!ui.startsWith('const widget='))throw new Error('Widget UI missing');
 const comment=name.includes('Mascot')?'// V3 mascot: direct iPhone OAuth. Dedicated mascot session required.':'// V3 standard: direct iPhone OAuth. No Windows bridge required.';
 writeFileSync(url,comment+'\n'+header.replace('VARIANT_PREFIX',prefix)+'\n'+core+'\n'+ui);
}
console.log('Rebuilt both standalone Scriptable files without credentials.');
