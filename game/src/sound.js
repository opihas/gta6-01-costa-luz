/* Costa Luz: original synthesized city ambience, engine and effects. */
const CostaAudio = (() => {
  'use strict';

  function createSound() {
    let audio = null;
    let master = null;
    let engine = null;
    let engineGain = null;
    let engineFilter = null;
    let siren = null;
    let sirenGain = null;
    let muted = false;
    let started = false;
    const notes = {
      success: [523, 659, 784, 1047],
      finale: [392, 523, 659, 784, 1047, 1319],
      door: [132, 74],
      pulse: [620, 180],
      disable: [210, 96, 320],
      bump: [86, 48],
      save: [392, 587],
      enemy: [300, 268]
    };

    function makeOsc(type, frequency, gainValue, time) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(gainValue, time);
      osc.connect(gain).connect(master);
      osc.start(time);
      return { osc, gain };
    }

    return {
      unlock() {
        if (!audio) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          audio = new Ctx();
          master = audio.createGain();
          master.gain.value = .8;
          master.connect(audio.destination);
          engine = audio.createOscillator();
          engineFilter = audio.createBiquadFilter();
          engineGain = audio.createGain();
          engine.type = 'sawtooth';
          engineFilter.type = 'lowpass';
          engineFilter.frequency.value = 420;
          engineGain.gain.value = 0;
          engine.connect(engineFilter).connect(engineGain).connect(master);
          engine.start();
          siren = audio.createOscillator();
          sirenGain = audio.createGain();
          siren.type = 'square';
          siren.frequency.value = 640;
          sirenGain.gain.value = 0;
          siren.connect(sirenGain).connect(master);
          siren.start();
        }
        if (audio.state === 'suspended') audio.resume().catch(() => {});
        started = true;
      },
      toggle() {
        muted = !muted;
        if (master) master.gain.setTargetAtTime(muted ? 0 : .8, audio.currentTime, .05);
        return muted;
      },
      get muted() { return muted; },
      play(name) {
        if (!audio || muted) return;
        const list = notes[name] || [];
        list.forEach((frequency, index) => {
          const time = audio.currentTime + index * .068;
          const { osc, gain } = makeOsc(name === 'pulse' || name === 'bump' ? 'triangle' : 'sine', frequency, name === 'bump' ? .09 : .1, time);
          gain.gain.exponentialRampToValueAtTime(.001, time + .17);
          osc.stop(time + .19);
        });
      },
      motor(speed, active) {
        if (!audio || !started) return;
        const now = audio.currentTime;
        engine.frequency.setTargetAtTime(34 + Math.abs(speed) * .26, now, .12);
        engineFilter.frequency.setTargetAtTime(340 + Math.abs(speed) * 2.4, now, .2);
        engineGain.gain.setTargetAtTime(muted || !active ? 0 : .018 + Math.abs(speed) * .00012, now, .18);
      },
      sirens(active, level) {
        if (!audio || !started) return;
        const now = audio.currentTime;
        sirenGain.gain.setTargetAtTime(muted || !active ? 0 : .006 + level * .0022, now, .3);
        siren.frequency.setTargetAtTime(520 + (Math.sin(now * 2.4) + 1) * 150, now, .12);
      }
    };
  }

  return { createSound };
})();
