// A soft, royalty-free ambient bed for the walkthrough video, synthesised
// on the fly (no audio files, no licensing). Slow, warm major-7th pads with
// a gentle low-pass — sits quietly under the narration.

const CHORDS = [
  [48, 55, 59, 64], // Cmaj7
  [45, 52, 55, 60], // Am7
  [41, 48, 52, 57], // Fmaj7
  [43, 50, 55, 59], // G6-ish
];

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export async function renderAmbientMusic(durationSec: number, sampleRate = 44100): Promise<AudioBuffer> {
  const length = Math.ceil((durationSec + 1) * sampleRate);
  const ctx = new OfflineAudioContext(2, length, sampleRate);

  const master = ctx.createGain();
  master.gain.value = 0.9;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 1100;
  lowpass.Q.value = 0.4;
  lowpass.connect(master);
  master.connect(ctx.destination);

  // Fade the whole bed in and out.
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(0.9, 2.5);
  master.gain.setValueAtTime(0.9, Math.max(2.5, durationSec - 3));
  master.gain.linearRampToValueAtTime(0, durationSec + 0.5);

  const chordLen = 6;
  for (let start = 0, i = 0; start < durationSec + 1; start += chordLen, i++) {
    const chord = CHORDS[i % CHORDS.length];
    chord.forEach((note, n) => {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = n === 0 ? "sine" : "triangle";
        osc.frequency.value = midiToHz(note + (n === 0 ? 0 : 12));
        osc.detune.value = detune;
        const g = ctx.createGain();
        const peak = n === 0 ? 0.05 : 0.018;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(peak, start + 2.2);
        g.gain.setValueAtTime(peak, start + chordLen - 0.5);
        g.gain.linearRampToValueAtTime(0, start + chordLen + 2);
        const pan = ctx.createStereoPanner();
        pan.pan.value = detune < 0 ? -0.35 : 0.35;
        osc.connect(g).connect(pan).connect(lowpass);
        osc.start(start);
        osc.stop(start + chordLen + 2.1);
      }
    });
  }
  return ctx.startRendering();
}
