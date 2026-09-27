// A royalty-free music bed for the walkthrough video, synthesised on the fly
// (no audio files, no licensing): warm major-7th pads, a soft four-on-the-floor
// pulse and a plucked arpeggio for momentum, plus a whoosh on every scene
// change and a low hit under the opening hook. Mixed to sit under narration.

const CHORDS = [
  [48, 55, 59, 64], // Cmaj7
  [45, 52, 55, 60], // Am7
  [41, 48, 52, 57], // Fmaj7
  [43, 50, 55, 59], // G6-ish
];
const BPM = 104;

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 1234567;
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 16807) % 2147483647;
    d[i] = (seed / 2147483647) * 2 - 1;
  }
  return buf;
}

// `cues` are scene-change times (seconds); each gets a whoosh that peaks on the cut.
export async function renderAmbientMusic(durationSec: number, cues: number[] = [], sampleRate = 44100): Promise<AudioBuffer> {
  const length = Math.ceil((durationSec + 1) * sampleRate);
  const ctx = new OfflineAudioContext(2, length, sampleRate);

  const out = ctx.createGain();
  out.connect(ctx.destination);

  // Music bus (fades in/out); effects bypass the fade.
  const master = ctx.createGain();
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 1400;
  lowpass.Q.value = 0.4;
  lowpass.connect(master);
  master.connect(out);
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(0.9, 1.2);
  master.gain.setValueAtTime(0.9, Math.max(1.2, durationSec - 3));
  master.gain.linearRampToValueAtTime(0, durationSec + 0.5);

  const beat = 60 / BPM;
  const bar = beat * 4;
  const chordLen = bar * 2;

  // Pads
  for (let start = 0, i = 0; start < durationSec + 1; start += chordLen, i++) {
    const chord = CHORDS[i % CHORDS.length];
    chord.forEach((note, n) => {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = n === 0 ? "sine" : "triangle";
        osc.frequency.value = midiToHz(note + (n === 0 ? 0 : 12));
        osc.detune.value = detune;
        const g = ctx.createGain();
        const peak = n === 0 ? 0.04 : 0.013;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(peak, start + 0.8);
        g.gain.setValueAtTime(peak, start + chordLen - 0.3);
        g.gain.linearRampToValueAtTime(0, start + chordLen + 0.8);
        const pan = ctx.createStereoPanner();
        pan.pan.value = detune < 0 ? -0.35 : 0.35;
        osc.connect(g).connect(pan).connect(lowpass);
        osc.start(start);
        osc.stop(start + chordLen + 0.9);
      }
    });

    // Plucked arpeggio on eighth notes, alternating ear to ear.
    const arp = [chord[1], chord[2], chord[3], chord[2] + 12, chord[3], chord[2], chord[1] + 12, chord[3]];
    for (let k = 0; k < 16; k++) {
      const at = start + k * (beat / 2);
      if (at > durationSec) break;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = midiToHz(arp[k % arp.length] + 12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(k % 4 === 0 ? 0.03 : 0.018, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0005, at + 0.28);
      const pan = ctx.createStereoPanner();
      pan.pan.value = k % 2 ? 0.4 : -0.4;
      osc.connect(g).connect(pan).connect(lowpass);
      osc.start(at);
      osc.stop(at + 0.3);
    }
  }

  // Soft kick on every beat and a hushed hi-hat on the off-beats, after the hook.
  const noise = noiseBuffer(ctx, 2);
  const hatFilter = ctx.createBiquadFilter();
  hatFilter.type = "highpass";
  hatFilter.frequency.value = 7000;
  hatFilter.connect(master);
  for (let at = bar; at < durationSec - 1; at += beat) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, at);
    osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
    osc.connect(g).connect(master);
    osc.start(at);
    osc.stop(at + 0.25);

    const h = ctx.createBufferSource();
    h.buffer = noise;
    const hg = ctx.createGain();
    const ht = at + beat / 2;
    hg.gain.setValueAtTime(0.022, ht);
    hg.gain.exponentialRampToValueAtTime(0.0005, ht + 0.06);
    h.connect(hg).connect(hatFilter);
    h.start(ht, (at * 0.37) % 1.5, 0.08);
  }

  // Opening hit under the hook.
  {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(90, 0.05);
    osc.frequency.exponentialRampToValueAtTime(32, 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, 1.6);
    osc.connect(g).connect(out);
    osc.start(0.05);
    osc.stop(1.7);
  }

  // Whooshes: filtered noise sweeping up into each cut, then falling away.
  for (const cue of cues) {
    const s = cue - 0.45;
    if (s < 0 || cue > durationSec) continue;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(350, s);
    bp.frequency.exponentialRampToValueAtTime(3200, cue);
    bp.frequency.exponentialRampToValueAtTime(900, cue + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.16, cue - 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, cue + 0.35);
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(-0.5, s);
    pan.pan.linearRampToValueAtTime(0.5, cue + 0.35);
    src.connect(bp).connect(g).connect(pan).connect(out);
    src.start(s, (cue * 0.53) % 1, 0.85);
  }

  return ctx.startRendering();
}
