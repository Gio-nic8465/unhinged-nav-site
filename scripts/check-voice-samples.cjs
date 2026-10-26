const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path'),crypto=require('crypto');
const site=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(site,'index.html'),'utf8');
assert.equal((html.match(/<audio id="mode-audio"/g)||[]).length,1);
assert(!/speechSynthesis|Neighbor Nancy|ny-copilot|codependent-female-preview\.wav/.test(html));
const manifest=JSON.parse(fs.readFileSync(path.join(site,'media/voices/samples.json'),'utf8'));
assert.equal(manifest.length,9);
assert(html.includes('200 feet'), 'U.S. distance display');
assert(!/\bmeters\b|\bmetres\b|\bbullshit\b|\bdamn\b/i.test(html), 'Public demo copy uses feet and bleeps');
for (const sample of manifest) {
 if (sample.id === 'vivienne') assert.match(sample.line, /^Continue ahead when it is safe\./);
 else assert.match(sample.line, /two hundred feet/);
 assert(!/meters|metres|bullshit|damn/i.test(sample.line));
 if (sample.mode === 'Adult') {
  assert.match(sample.line, /\[bleep\]/);
  assert.equal(sample.bleep.toneHz, 1000);
  assert.equal(sample.bleep.toneSeconds, sample.id === 'vivienne' ? 0.4 : 0.38);
 } else assert.equal(sample.bleep, null);
}
function elem(attrs={}){
 const values=new Set((attrs.class||'').split(' ').filter(Boolean));
 return {dataset:{},textContent:'',hidden:Object.hasOwn(attrs,'hidden'),attrs,
 setAttribute(k,v){this.attrs[k]=v},addEventListener(t,f){this.click=f},
 classList:{add(...v){v.forEach(x=>values.add(x))},remove(...v){v.forEach(x=>values.delete(x))},contains(v){return values.has(v)},toggle(v,on){on?values.add(v):values.delete(v)}}};
}
function parse(tag){
 const attrs=Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
 if(/\shidden(?:>|\s)/.test(tag))attrs.hidden='';
 const item=elem(attrs); for(const [k,v]of Object.entries(attrs))if(k.startsWith('data-'))item.dataset[k.slice(5)]=v;
 return item;
}
const characters=[...html.matchAll(/<button[^>]*data-character="[^"]+"[^>]*>/g)].map(m=>parse(m[0]));
const modes=[...html.matchAll(/<button[^>]*data-mode="[^"]+"[^>]*>/g)].filter(m=>!m[0].includes('data-character')).map(m=>parse(m[0]));
assert.equal(characters.length,9);assert.equal(modes.length,3);assert.equal(characters.filter(c=>!c.hidden).length,3);
const map=Object.fromEntries(['voice-card','sample-label','sample-line','sample-note','sample-direction','sample-direction-label'].map(id=>[id,elem()]));
let rejectLast;
const audio={src:'',plays:0,pauses:0,pause(){this.pauses++},play(){this.plays++;return new Promise((yes,no)=>{rejectLast=no})}};
map['mode-audio']=audio;
vm.runInNewContext(html.slice(html.indexOf('      const samples ='),html.indexOf('      const betaDialog =')),{document:{getElementById:id=>map[id],querySelectorAll:s=>s==='.mode-switch button'?modes:characters}});
assert.equal(audio.plays,0,'Never autoplay on page load');
for(const [i,mode]of modes.entries()){
 mode.click();const visible=characters.filter(c=>!c.hidden);assert.equal(visible.length,3);assert(visible.every(c=>c.dataset.mode===mode.dataset.mode));
 assert.equal(mode.attrs['aria-pressed'],'true');
 for(const c of visible){
  c.click();const m=manifest.find(s=>s.id===c.dataset.character);
  assert(m);assert.equal(audio.src,'/media/voices/'+m.file);
  assert.equal(map['sample-label'].textContent,m.name+' · '+m.mode);
  assert.equal(map['sample-line'].textContent,'“'+m.line+'”');
  assert.equal(map['sample-direction'].textContent,m.id==='vivienne'?'Continue ahead when it is safe.':'Left onto Main Street in 200 feet');
  assert.equal(map['sample-direction-label'].textContent,m.id==='vivienne'?'GUIDANCE PREVIEW':'NEXT TURN');
  assert.equal(c.attrs['aria-pressed'],'true');
  assert.equal(characters.filter(x=>x.classList.contains('active')).length,1);
  audio.onplaying();assert(c.classList.contains('speaking'));assert(map['voice-card'].classList.contains('playing'));
  audio.onended();assert(!c.classList.contains('speaking'));assert(!map['voice-card'].classList.contains('playing'));
  const b=fs.readFileSync(path.join(site,'media/voices',m.file));
  assert.equal(b.length,m.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),m.sha256);
 }
}
modes[0].click();audio.onplaying();const staleReject=rejectLast,staleEnd=audio.onended;
modes[1].click();audio.onplaying();staleEnd();staleReject(Error('cancelled'));
setImmediate(()=>{
 assert(map['voice-card'].classList.contains('playing'),'stale callbacks cannot stop newer playback');
 audio.onerror();assert.match(map['sample-note'].textContent,/Tap the character/);assert(!map['voice-card'].classList.contains('playing'));
 characters[4].click();audio.onplaying();assert.match(map['sample-note'].textContent,/Nine app characters/);
 assert(map['voice-card'].classList.contains('playing'));audio.onended();
 for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(!script[0].includes('application/ld+json'))new vm.Script(script[1]);
 console.log('PASS: 9 characters, 3 mode groups, no autoplay/provider calls/system voice, all audio hashes, correct labels, selection, switching, stale callbacks, error/retry and completion; inline scripts parse.');
});
