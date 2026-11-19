/* Costa Luz: page controller, input, save slots and menu flow. */
(() => {
  'use strict';

  const sim = CostaSim;
  const $ = id => document.getElementById(id);
  const canvas = $('city');
  const renderer = CostaRender.createRenderer(canvas);
  const audio = CostaAudio.createSound();
  const keys = new Set();
  const saveKey = 'costa-luz-ledger-v2';
  const menuKey = 'costa-luz-sound';
  let state = sim.createState();
  let previous = performance.now();
  let frames = 0;
  let autosaveAt = 0;
  let pointer = { x: innerWidth / 2, y: innerHeight / 2 };

  const readSave = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(saveKey));
      return saved && sim.restore(saved) ? saved : null;
    } catch { return null; }
  };

  function paintMenu(mode) {
    const saved = readSave();
    $('menu').hidden = mode === 'play';
    $('hud').hidden = mode !== 'play';
    $('start').hidden = mode !== 'title';
    $('resume').hidden = $('save').hidden = mode !== 'pause';
    $('continue').hidden = mode !== 'title' || !saved;
    $('menu-mode').textContent = mode === 'pause' ? 'PAUSED · COSTA LUZ' : 'ORIGINAL HARBOR CITY · DESKTOP CHROME';
    if (mode === 'pause') $('menu-note').textContent = 'Progress is saved on this browser. Resume when you are ready.';
    else $('menu-note').textContent = saved ? `Checkpoint found: job ${Math.min(saved.job + 1, 6)} of 6 · $${saved.cash.toLocaleString('en-US')}` : 'The port keeps its secrets. Inez has other plans.';
    const sound = $('mute');
    sound.textContent = audio.muted ? 'Sound off' : 'Sound on';
    document.body.classList.toggle('playing', mode === 'play');
    document.body.dataset.mode = mode;
  }

  function setMode(mode) {
    state.mode = mode;
    keys.clear();
    paintMenu(mode);
  }

  function start(saved = null) {
    audio.unlock();
    if (saved) {
      const restored = sim.restore(saved);
      state = restored || sim.createState();
      setMode('play');
      sim.announce(state, 'Checkpoint restored. ' + (sim.jobs[state.job] ? sim.jobs[state.job].goal : 'Costa Luz is yours.'), 8);
    } else {
      state = sim.createState();
      setMode('play');
      sim.announce(state, 'INEZ: There you are. The harbor took everything from us. Today we take it back.', 9);
    }
    autosaveAt = state.time + 20;
    previous = performance.now();
  }

  function save(manual = false) {
    try {
      const data = { ...sim.saveData(state) };
      localStorage.setItem(saveKey, JSON.stringify(data));
      if (manual) {
        $('menu-note').textContent = 'Checkpoint written to this browser.';
        audio.play('save');
      }
      return true;
    } catch {
      if (manual) $('menu-note').textContent = 'This browser blocks local storage, so saves are unavailable.';
      return false;
    }
  }

  $('start').addEventListener('click', () => start());
  $('continue').addEventListener('click', () => { const saved = readSave(); if (saved) start(saved); });
  $('resume').addEventListener('click', () => { audio.unlock(); setMode('play'); previous = performance.now(); });
  $('save').addEventListener('click', () => save(true));
  $('mute').addEventListener('click', () => {
    audio.unlock();
    const muted = audio.toggle();
    localStorage.setItem(menuKey, muted ? 'off' : 'on');
    paintMenu(state.mode);
  });

  if (localStorage.getItem(menuKey) === 'off') audio.toggle();
  setMode('title');

  addEventListener('keydown', event => {
    const { code } = event;
    if (state.mode === 'play' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyM'].includes(code)) event.preventDefault();
    if (code === 'Escape' && !event.repeat) {
      if (state.mode === 'play') { save(); setMode('pause'); }
      else if (state.mode === 'pause') { setMode('play'); previous = performance.now(); }
      return;
    }
    if (state.mode !== 'play') return;
    keys.add(code);
    if (event.repeat) return;
    if (code === 'KeyE') {
      const before = state.job;
      sim.interact(state, audio.play);
      if (state.job !== before) save();
    }
    if (code === 'KeyM') state.showMap = !state.showMap;
  });
  addEventListener('keyup', event => keys.delete(event.code));
  addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointermove', event => { pointer = { x: event.clientX, y: event.clientY }; });
  canvas.addEventListener('pointerdown', event => {
    pointer = { x: event.clientX, y: event.clientY };
    if (state.mode !== 'play' || event.button !== 0) return;
    audio.unlock();
    sim.firePulse(state, renderer.unproject(event.clientX, event.clientY), audio.play);
  });
  addEventListener('contextmenu', event => event.preventDefault());

  const pressed = (...codes) => codes.some(code => keys.has(code));
  function frame(now) {
    const dt = Math.min(.05, Math.max(.001, (now - previous) / 1000));
    previous = now;
    const before = state.job;
    if (state.mode !== 'pause') {
      sim.step(state, {
        x: +pressed('KeyD', 'ArrowRight') - +pressed('KeyA', 'ArrowLeft'),
        y: +pressed('KeyS', 'ArrowDown') - +pressed('KeyW', 'ArrowUp'),
        brake: pressed('Space'),
        sprint: pressed('ShiftLeft', 'ShiftRight')
      }, dt, audio.play);
    }
    if (state.mode === 'play' && (state.job !== before || (state.time > autosaveAt && !state.wanted))) {
      autosaveAt = state.time + 25;
      save();
    }
    audio.motor(state.car ? state.car.speed : 0, state.mode === 'play' && !!state.car);
    audio.sirens(state.mode === 'play' && state.wanted > 0, state.wanted);
    renderer.render(state, dt);
    canvas.dataset.frames = ++frames;
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  // A tiny hook for the maker's play-test harness; it never changes gameplay.
  window.costaLuz = {
    get state() { return state; },
    jobs: sim.jobs,
    services: sim.services,
    frames: () => frames,
    save: () => save(true),
    start: () => start(),
    continue: () => { const saved = readSave(); if (saved) start(saved); },
    unproject: (x, y) => renderer.unproject(x, y),
    project: (x, y, z) => renderer.project(x, y, z),
    keys
  };
})();
