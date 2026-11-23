// All sound is synthesised with WebAudio: no audio files, no network.
// Engine hum, police siren, gunshot, punch, pickup blips and mission jingles.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq || 1800;
    const gain = ctx.createGain();
    gain.gain.value = vol || 0.4;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  return {
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    // speed 0..1 while driving; 0 and quiet when on foot.
    engine(speed) {
      if (!ctx || muted) return;
      engineGain.gain.value = speed > 0.02 ? 0.05 + speed * 0.06 : 0;
      engineOsc.frequency.value = 55 + speed * 130;
    },
    // Call every frame; the siren wails only while police are close.
    siren(dt, active) {
      if (!ctx || muted) return;
      sirenGain.gain.value = active ? 0.045 : 0;
      if (!active) return;
      sirenTimer += dt;
      if (sirenTimer > 0.45) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.value = sirenHigh ? 950 : 700;
      }
    },
    shot() {
      noise(0.12, 0.5, 2600);
    },
    punch() {
      noise(0.08, 0.35, 500);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.25);
      blip(990, 0.12, 'sine', 0.25, 0.08);
    },
    mission() {
      [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.16, 'triangle', 0.22, i * 0.11));
    },
    busted() {
      [392, 330, 262].forEach((f, i) => blip(f, 0.22, 'sawtooth', 0.16, i * 0.16));
    },
    denied() {
      blip(180, 0.15, 'square', 0.15);
    },
  };
}
