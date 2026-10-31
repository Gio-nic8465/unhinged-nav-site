(() => {
  const root = document.querySelector('[data-showcase]');
  if (!root) return;
  const video = root.querySelector('video');
  const status = root.querySelector('[data-showcase-status]');
  const sound = root.querySelector('[data-showcase-sound]');
  const replay = root.querySelector('[data-showcase-replay]');
  const title = root.querySelector('[data-showcase-title]');
  const transcript = root.querySelector('[data-showcase-transcript]');
  const buttons = [...root.querySelectorAll('[data-showcase-mode]')];
  const params = new URLSearchParams(location.search);
  const embedded = root.dataset.showcase === 'app';
  let manifest, selected = 'codependent', generation = 0;
  let pending = null;
  const tellApp = event => {
    if (embedded && window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({event,mode:selected}));
  };
  const updateSound = () => { sound.textContent = video.muted ? '▶ Watch & hear the characters' : 'Mute sound'; };
  const pause = () => { ++generation; video.pause(); };
  const play = (audible, restart = false) => {
    if (document.hidden) return;
    const id = ++generation;
    if (restart) video.currentTime = 0;
    video.muted = !audible;
    updateSound();
    status.textContent = audible ? 'Playing with sound. Captions are included.' : 'Silent preview. Tap Watch & hear for sound.';
    video.play().catch(() => {
      if (id !== generation) return;
      status.textContent = 'Tap Watch & hear to start playback. You can still read every line below.';
      tellApp('blocked');
    });
  };
  const selectMode = (mode, audible = false) => {
    if (!manifest) { pending = {mode,audible}; return; }
    if (!manifest.modes[mode]) return;
    pause(); selected = mode;
    const data = manifest.modes[mode];
    title.textContent = mode[0].toUpperCase()+mode.slice(1)+' · '+data.cast.map(c => c.name).join(' / ');
    transcript.replaceChildren(...data.cast.map(c => {
      const p = document.createElement('p');
      const strong = document.createElement('strong'); strong.textContent = c.name+': ';
      p.append(strong, document.createTextNode(c.line)); return p;
    }));
    buttons.forEach(b => b.setAttribute('aria-pressed',String(b.dataset.showcaseMode === mode)));
    video.setAttribute('aria-label','Watch the three '+mode+' characters');
    document.querySelectorAll('.mode-switch button').forEach(b => { const active=b.dataset.mode === mode; b.classList.toggle('active',active); b.setAttribute('aria-pressed',String(active)); });
    document.querySelectorAll('.character-switch button').forEach(b => { b.hidden=b.dataset.mode !== mode; const active=b.dataset.character === data.cast[0].id; b.classList.toggle('active',active); b.setAttribute('aria-pressed',String(active)); });
    const first=data.cast[0], label=document.getElementById('sample-label'), line=document.getElementById('sample-line');
    if (label) label.textContent=first.name+' · '+mode[0].toUpperCase()+mode.slice(1);
    if (line) line.textContent='“'+first.line+'”';
    video.poster = data.poster; video.src = data.src;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (audible || !reduced) play(audible);
    else { video.muted = true; updateSound(); status.textContent = 'Tap Watch & hear to play the introduction.'; }
  };
  window.UnhingedShowcase = {selectMode,pause};
  buttons.forEach(b => b.addEventListener('click',() => selectMode(b.dataset.showcaseMode,true)));
  sound.addEventListener('click',() => {
    if (!manifest) { status.textContent = 'Still loading. You can skip the preview and continue.'; return; }
    if (!video.muted && !video.paused && !video.ended) { video.muted = true; updateSound(); }
    else play(true,video.ended || video.muted);
  });
  replay.addEventListener('click',() => { if (manifest) play(true,true); });
  video.addEventListener('volumechange',updateSound);
  video.addEventListener('playing',() => {
    const audio = document.getElementById('mode-audio');
    if (audio) { audio.pause(); document.querySelectorAll('.speaking,.voice.playing').forEach(el => el.classList.remove('speaking','playing')); }
    tellApp('playing');
  });
  video.addEventListener('ended',() => { status.textContent = 'Found your copilot? Choose another mode or continue below.'; tellApp('ended'); });
  video.addEventListener('error',() => { status.textContent = 'The video could not load. Check your connection, then tap Replay. The transcript is available below.'; tellApp('error'); });
  document.addEventListener('visibilitychange',() => { if (document.hidden) pause(); });
  window.addEventListener('pagehide',pause);
  document.querySelectorAll('[data-open-beta],.character-switch button').forEach(b => b.addEventListener('click',pause));
  const skip = root.querySelector('[data-showcase-skip]');
  skip?.addEventListener('click',() => { pause(); document.getElementById('modes')?.scrollIntoView({behavior:'smooth'}); });
  // An off-screen preview must not keep speaking over the rest of the page.
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { if (!entries[0].isIntersecting) pause(); },{threshold:0}).observe(video);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),12000);
  fetch('/media/showcases/manifest.json',{signal:controller.signal}).then(r => { if (!r.ok) throw Error('unavailable'); return r.json(); }).then(data => {
    manifest = data;
    sound.disabled = replay.disabled = false;
    const initial = pending || {mode:params.get('mode') || 'codependent',audible:embedded && params.get('sound') === '1'};
    selectMode(initial.mode,initial.audible);
    tellApp('ready');
  }).catch(() => { status.textContent = 'The preview is unavailable right now. You can continue without watching it.'; tellApp('error'); }).finally(() => clearTimeout(timeout));
})();
