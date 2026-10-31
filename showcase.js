(() => {
 const root=document.querySelector('[data-showcase]');if(!root)return;
 const video=root.querySelector('video'),status=root.querySelector('[data-showcase-status]');
 const title=root.querySelector('[data-showcase-title]'),caption=root.querySelector('[data-showcase-current]');
 const picker=root.querySelector('[data-character-picker]'),dialog=root.querySelector('[data-preview-dialog]');
 const pauseButton=root.querySelector('[data-showcase-pause]'),sound=root.querySelector('[data-showcase-sound]'),replay=root.querySelector('[data-showcase-replay]');
 const closeButton=root.querySelector('[data-preview-close]');
 const modes=[...root.querySelectorAll('[data-showcase-mode]')],cards=[...root.querySelectorAll('[data-showcase-character]')];
 const params=new URLSearchParams(location.search),embedded=root.dataset.showcase==='app';
 let manifest,mode='codependent',current=null,generation=0;
 const send=event=>{if(embedded&&window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({event,mode,character:current?.id}));};
 const labels=()=>{pauseButton.textContent=video.paused?'Play':'Pause';sound.textContent=video.muted?'Unmute':'Mute';};
 const pause=()=>{++generation;video.pause();labels();};
 const stop=()=>{pause();video.removeAttribute('src');video.load();};
 const play=(restart=false)=>{
  if(document.hidden||!current)return;
  const id=++generation;
  if(video.error)video.load();if(restart)video.currentTime=0;
  video.play().then(()=>{if(id===generation)labels();}).catch(()=>{if(id!==generation)return;status.textContent='Tap Play to start this preview.';labels();send('blocked');});
 };
 const showMode=next=>{
  if(!['codependent','sarcastic','adult'].includes(next))return;
  stop();if(dialog?.open)dialog.close();mode=next;current=null;
  cards.forEach(card=>{card.hidden=card.dataset.showcaseGroup!==mode;card.setAttribute('aria-pressed','false');});
  modes.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.showcaseMode===mode)));
  document.querySelectorAll('.mode-switch button').forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  document.querySelectorAll('.character-switch button').forEach(b=>{b.hidden=b.dataset.mode!==mode;});
  if(picker)picker.hidden=false;
  status.textContent='Tap a face to watch and hear that character. One preview plays at a time.';
 };
 const showCharacter=id=>{
  if(!manifest){status.textContent='The preview is still loading. The pictures and quotes are ready to browse.';return;}
  const data=manifest.modes[mode]?.cast.find(c=>c.id===id);if(!data)return;
  stop();current=data;
  cards.forEach(c=>c.setAttribute('aria-pressed',String(c.dataset.showcaseCharacter===id)));
  title.textContent=data.name;caption.textContent=data.line;
  video.poster=data.preview.poster;video.src=data.preview.src;video.muted=false;
  video.setAttribute('aria-label',data.name+' speaking preview');
  if(dialog&&!dialog.open){if(root.dataset.single==='true')dialog.show();else dialog.showModal();}
  status.textContent='Only '+data.name+' is speaking. Use Pause, Replay or Close.';
  play();
 };
 window.UnhingedShowcase={selectMode:showMode,selectCharacter:showCharacter,pause};
 modes.forEach(b=>b.addEventListener('click',()=>showMode(b.dataset.showcaseMode)));
 cards.forEach(c=>c.addEventListener('click',()=>showCharacter(c.dataset.showcaseCharacter)));
 pauseButton.addEventListener('click',()=>{if(video.paused)play(video.ended);else pause();});
 sound.addEventListener('click',()=>{video.muted=!video.muted;labels();});
 replay.addEventListener('click',()=>play(true));
 closeButton?.addEventListener('click',()=>{if(dialog)dialog.close();else stop();});
 dialog?.addEventListener('close',stop);
 video.addEventListener('playing',()=>{const audio=document.getElementById('mode-audio');if(audio)audio.pause();labels();send('playing');});
 video.addEventListener('pause',labels);video.addEventListener('volumechange',labels);
 video.addEventListener('ended',()=>{labels();status.textContent=(current?.name||'This character')+' has finished. Replay or choose another face.';send('ended');});
 video.addEventListener('error',()=>{if(!current)return;status.textContent='Preview unavailable. Try Replay, or close and keep browsing.';send('error');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',pause);
 document.querySelectorAll('[data-open-beta],.character-switch button').forEach(b=>b.addEventListener('click',pause));
 root.querySelector('[data-showcase-skip]')?.addEventListener('click',()=>{pause();document.getElementById('modes')?.scrollIntoView({behavior:'smooth'});});
 showMode(params.get('mode')||'codependent');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 fetch('/media/showcases/manifest.json',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('unavailable');return r.json();}).then(data=>{
  manifest=data;send('ready');
  if(embedded&&manifest.modes[mode]?.cast.some(c=>c.id===params.get('character'))){if(picker)picker.hidden=true;root.dataset.single='true';showCharacter(params.get('character'));}
 }).catch(()=>{status.textContent='Previews are unavailable right now. You can still see the pictures and quotes.';send('error');}).finally(()=>clearTimeout(timeout));
})();
