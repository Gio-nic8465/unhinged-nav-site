const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
(async()=>{
 const element=(dataset={})=>({dataset,textContent:'',hidden:false,attrs:{},events:{},classList:{toggle(){}},setAttribute(k,v){this.attrs[k]=v},addEventListener(type,fn){this.events[type]=fn}});
 const video=Object.assign(element(),{muted:true,paused:true,ended:false,error:null,currentTime:0,plays:0,loads:0,behavior:'resolve',removeAttribute(k){delete this[k]},pause(){this.paused=true},load(){this.loads++;this.error=null},play(){this.plays++;this.paused=false;if(this.behavior==='reject')return Promise.reject(Error('NotAllowedError'));if(this.behavior==='pending')return new Promise((yes,no)=>{this.rejectOld=no});return Promise.resolve()}});
 const status=element(),sound=element(),replay=element(),pauseButton=element(),title=element(),caption=element(),picker=element(),close=element();
 const dialog=Object.assign(element(),{open:false,showModal(){this.open=true},show(){this.open=true},close(){this.open=false;this.events.close?.()}});
 const modes=['codependent','sarcastic','adult'].map(mode=>element({showcaseMode:mode}));
 const groups={codependent:['brenda','marty','hal'],sarcastic:['graham','roxie','raven'],adult:['frankie','rita','vivienne']};
 const cards=Object.entries(groups).flatMap(([group,ids])=>ids.map(id=>element({showcaseGroup:group,showcaseCharacter:id})));
 const nodes={'video':video,'[data-showcase-status]':status,'[data-showcase-sound]':sound,'[data-showcase-replay]':replay,'[data-showcase-pause]':pauseButton,'[data-showcase-title]':title,'[data-showcase-current]':caption,'[data-character-picker]':picker,'[data-preview-dialog]':dialog,'[data-preview-close]':close};
 const root=element({showcase:'website'});root.querySelector=s=>nodes[s];root.querySelectorAll=s=>s==='[data-showcase-mode]'?modes:cards;
 const doc={hidden:false,events:{},querySelector:()=>root,querySelectorAll:()=>[],getElementById:()=>null,addEventListener(type,fn){this.events[type]=fn}};
 const win={events:{},addEventListener(type,fn){this.events[type]=fn}};
 const manifest={modes:Object.fromEntries(Object.entries(groups).map(([mode,ids])=>[mode,{cast:ids.map(id=>({id,name:id,line:id+' complete speaking line.',preview:{src:id+'.mp4',poster:id+'.jpg'}}))}]))};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../showcase.js'),'utf8'),{window:win,document:doc,location:{search:''},URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:async()=>({ok:true,json:async()=>manifest})});
 const flush=()=>new Promise(resolve=>setImmediate(resolve));await flush();
 assert.equal(video.plays,0,'page load is silent');assert.equal(cards.filter(c=>!c.hidden).length,3);
 for(const button of modes){button.events.click();assert.equal(video.plays,0,'mode taps never play');assert.equal(cards.filter(c=>!c.hidden).length,3);assert(cards.filter(c=>!c.hidden).every(c=>c.dataset.showcaseGroup===button.dataset.showcaseMode));}
 win.UnhingedShowcase.selectMode('sarcastic');cards.find(c=>c.dataset.showcaseCharacter==='roxie').events.click();await flush();assert.equal(video.src,'roxie.mp4');assert.equal(title.textContent,'roxie');assert(dialog.open);assert(!video.muted);
 video.currentTime=2;sound.events.click();assert.equal(video.currentTime,2,'mute never rewinds');assert(video.muted);
 video.ended=true;video.paused=true;const plays=video.plays;video.events.ended();assert.equal(video.plays,plays,'end never advances to another character');assert.equal(video.src,'roxie.mp4');assert.match(status.textContent,/roxie has finished/);
 video.behavior='pending';win.UnhingedShowcase.selectCharacter('graham');const rejectOld=video.rejectOld;video.behavior='resolve';win.UnhingedShowcase.selectCharacter('raven');rejectOld(Error('cancelled'));await flush();assert.equal(video.src,'raven.mp4');assert(!video.muted);assert(!/Tap Play/.test(status.textContent),'old rejected playback cannot change a newer preview');
 close.events.click();assert(!dialog.open);assert(video.paused);assert(!video.src);
 video.behavior='reject';win.UnhingedShowcase.selectCharacter('roxie');await flush();assert.match(status.textContent,/Tap Play/);video.behavior='resolve';pauseButton.events.click();await flush();
 doc.hidden=true;doc.events.visibilitychange();assert(video.paused);const stopped=video.plays;replay.events.click();assert.equal(video.plays,stopped,'hidden pages cannot restart');doc.hidden=false;
 video.error={code:2};replay.events.click();await flush();assert.equal(video.currentTime,0);assert.equal(video.error,null);
 win.UnhingedShowcase.selectMode('codependent');assert(!dialog.open);assert(video.paused);const source=video.src;win.UnhingedShowcase.selectCharacter('roxie');assert.equal(video.src,source,'cross-mode characters cannot start');
 console.log('PASS: silent mode changes, exactly three cards, individual preview, mute preserves position, no auto-advance, stale callback protection, blocked-play recovery, close/background stop and retry.');
})().catch(error=>{console.error(error);process.exitCode=1});
