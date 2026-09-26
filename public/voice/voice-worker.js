// In-house narration voice engine, running entirely in the browser.
//
// Uses the open-weight Kokoro-82M text-to-speech model (Apache-2.0) via
// transformers.js. Our voices (see src/app/audit/voices.ts) are custom
// blends of Kokoro's Hindi speaker styles, which give English a natural
// Indian accent, with its most natural-sounding voices for warmth. No
// third-party voice API, no per-use cost: the model (~90 MB) downloads once
// and is cached by the browser.
//
// Messages in:  { type: "load" }
//               { type: "speak", id, text, voice: { mix: [[name, weight], ...] }, speed }
// Messages out: { type: "progress", loaded, total }  (model download)
//               { type: "ready", device }
//               { type: "audio", id, samples: Float32Array, sampleRate, segments: [{ text, start, end, words: [{ text, start, end }] }] }
//               { type: "error", id?, message }

const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js";
const PHONEMIZER_URL = "https://cdn.jsdelivr.net/npm/phonemizer@1.2.1/dist/phonemizer.js";
const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const SAMPLE_RATE = 24000;
const STYLE_DIM = 256;

let enginePromise = null;
const voiceCache = new Map();

function loadEngine() {
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    const [tf, ph] = await Promise.all([import(TRANSFORMERS_URL), import(PHONEMIZER_URL)]);
    // Quantized model on WASM: a ~90 MB one-time download that runs on any
    // modern browser. (WebGPU would need the 4x larger fp32 weights.)
    const device = "wasm";
    const files = new Map();
    const progress_callback = (p) => {
      if (p.status === "progress" && p.total) {
        files.set(p.file, { loaded: p.loaded, total: p.total });
        let loaded = 0;
        let total = 0;
        for (const f of files.values()) {
          loaded += f.loaded;
          total += f.total;
        }
        self.postMessage({ type: "progress", loaded, total });
      }
    };
    const [model, tokenizer] = await Promise.all([
      tf.StyleTextToSpeech2Model.from_pretrained(MODEL_ID, {
        dtype: "q8",
        device,
        progress_callback,
      }),
      tf.AutoTokenizer.from_pretrained(MODEL_ID),
    ]);
    self.postMessage({ type: "ready", device });
    return { tf, phonemize: ph.phonemize, model, tokenizer };
  })();
  enginePromise.catch(() => {
    enginePromise = null;
  });
  return enginePromise;
}

async function loadVoice(name) {
  if (voiceCache.has(name)) return voiceCache.get(name);
  const url = `https://huggingface.co/${MODEL_ID}/resolve/main/voices/${name}.bin`;
  let buf;
  let cache = null;
  try {
    cache = await caches.open("audit-voices");
    const hit = await cache.match(url);
    if (hit) buf = await hit.arrayBuffer();
  } catch {
    cache = null;
  }
  if (!buf) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Couldn't download voice "${name}"`);
    buf = await res.arrayBuffer();
    try {
      await cache?.put(url, new Response(buf.slice(0)));
    } catch {
      // caching is best-effort
    }
  }
  const data = new Float32Array(buf);
  voiceCache.set(name, data);
  return data;
}

// Spell out things a TTS engine would otherwise mangle in audit narration.
function normalize(text) {
  return text
    .replace(/₹\s?([\d,]+(?:\.\d+)?)\s?(lakh|crore|k)?/gi, (_, n, unit) => `${n.replace(/,/g, "")} ${unit ? unit + " " : ""}rupees`)
    .replace(/(\d+)\s?\/\s?100\b/g, "$1 out of 100")
    .replace(/(\d+(?:\.\d+)?)\s?%/g, "$1 percent")
    .replace(/(\d+(?:\.\d+)?)\s?ms\b/g, "$1 milliseconds")
    .replace(/(\d+(?:\.\d+)?)\s?s\b/g, "$1 seconds")
    .replace(/(\d+(?:\.\d+)?)\s?KB\b/g, "$1 kilobytes")
    .replace(/(\d+(?:\.\d+)?)\s?MB\b/g, "$1 megabytes")
    .replace(/https?:\/\//gi, "")
    .replace(/\bwww\./gi, "")
    .replace(/\b([a-z0-9-]+)\.(co\.in|com|in|net|org|io|co|biz|info|store|shop|online|site|app|dev|ai|tech|xyz|me|us|uk)\b/gi, (_, d, tld) => `${d} dot ${tld.replace(".", " dot ")}`)
    .replace(/\bSEO\b/g, "S.E.O.")
    .replace(/\bHTTPS\b/g, "H.T.T.P.S.")
    .replace(/\bHTTP\b/g, "H.T.T.P.")
    .replace(/\bURL(s?)\b/g, "U.R.L.$1")
    .replace(/\bCTA(s?)\b/g, "call-to-action$1")
    .replace(/\bCMS\b/g, "C.M.S.")
    .replace(/\bSSL\b/g, "S.S.L.")
    .replace(/\bCDN\b/g, "C.D.N.")
    .replace(/\bUI\b/g, "U.I.")
    .replace(/\bUX\b/g, "U.X.")
    .replace(/\bH1\b/g, "H-one")
    .replace(/\be\.g\./gi, "for example")
    .replace(/\bi\.e\./gi, "that is")
    .replace(/&/g, " and ")
    .replace(/[—–]/g, ", ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Split on sentence-ending punctuation followed by a space (so "site.com"
// or "3.5" stay intact), merging very short fragments so prosody stays natural.
function splitSentences(text) {
  const parts = [];
  let buf = "";
  for (let i = 0; i < text.length; i++) {
    buf += text[i];
    if (/[.!?]/.test(text[i]) && (i + 1 >= text.length || /\s/.test(text[i + 1]))) {
      parts.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  const out = [];
  for (const p of parts.filter(Boolean)) {
    if (out.length && (out[out.length - 1].length < 18 || p.length < 10)) out[out.length - 1] += " " + p;
    else out.push(p);
  }
  return out;
}

async function blendedStyle(mix, tokenCount) {
  const offset = STYLE_DIM * Math.min(Math.max(tokenCount - 2, 0), 509);
  const style = new Float32Array(STYLE_DIM);
  const totalWeight = mix.reduce((s, [, w]) => s + w, 0) || 1;
  for (const [name, weight] of mix) {
    const v = await loadVoice(name);
    const w = weight / totalWeight;
    for (let i = 0; i < STYLE_DIM; i++) style[i] += v[offset + i] * w;
  }
  return style;
}

// People don't speak every sentence at the same speed; a small, repeatable
// variation keeps the delivery lively instead of metronomic.
const PACE_VARIATION = [0, 0.03, -0.02, 0.025, -0.015, 0.01];

// Punctuation Kokoro understands. It must reach the model (espeak drops it),
// or commas and full stops produce no pauses and words run together.
const PUNCT = ';:,.!?¡¿—…"«»“”(){}[]';
const PUNCT_RUN = new RegExp(`(\\s*[${PUNCT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]+\\s*)+`, "g");

async function toPhonemes(phonemize, text) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(PUNCT_RUN)) {
    if (m.index > last) parts.push({ punct: false, text: text.slice(last, m.index) });
    parts.push({ punct: true, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ punct: false, text: text.slice(last) });
  const out = await Promise.all(parts.map(async (p) => (p.punct ? p.text : (await phonemize(p.text, "en-us")).join(" "))));
  return out
    .join("")
    .replace(/ʲ/g, "j")
    .replace(/r/g, "ɹ")
    .replace(/x/g, "k")
    .replace(/ɬ/g, "l")
    .trim();
}

// Per-word timing for captions. The model doesn't report durations, so we
// read them off the audio: find the real pauses, match them to the
// sentence's commas/colons, and spread the words in between by how many
// speech sounds each has.
async function wordTimings(phonemize, sentence, wave) {
  const words = sentence.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const weights = await Promise.all(
    words.map(async (w) => {
      const core = normalize(w.replace(/^[^\w₹$]+|[^\w%]+$/g, ""));
      if (!core) return 1;
      const ph = (await phonemize(core, "en-us")).join("").replace(/[ˈˌː\s]/g, "");
      return Math.max(1, ph.length);
    })
  );

  const FRAME = 240; // 10 ms
  const n = Math.floor(wave.length / FRAME);
  const rms = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let sum = 0;
    for (let k = 0; k < FRAME; k++) {
      const v = wave[f * FRAME + k];
      sum += v * v;
    }
    rms[f] = Math.sqrt(sum / FRAME);
  }
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const thr = Math.max(0.008, sorted[Math.floor(n * 0.95)] * 0.08);
  let first = 0;
  while (first < n && rms[first] < thr) first++;
  let lastF = n - 1;
  while (lastF > first && rms[lastF] < thr) lastF--;
  const speechStart = (first * FRAME) / SAMPLE_RATE;
  const speechEnd = ((lastF + 1) * FRAME) / SAMPLE_RATE;

  // Silent runs inside the speech (candidate pauses), >= 60 ms.
  const pauses = [];
  for (let f = first; f <= lastF; f++) {
    if (rms[f] >= thr) continue;
    let g = f;
    while (g <= lastF && rms[g] < thr) g++;
    if (g - f >= 6) pauses.push({ start: (f * FRAME) / SAMPLE_RATE, end: (g * FRAME) / SAMPLE_RATE });
    f = g;
  }

  // Word indices followed by a spoken break.
  const breaks = [];
  words.forEach((w, i) => {
    if (i < words.length - 1 && /[,;:—…)]$|^\S+\s*—$/.test(w)) breaks.push(i);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const cum = [];
  weights.reduce((acc, w, i) => ((cum[i] = acc + w), acc + w), 0);
  const expected = (i) => speechStart + ((speechEnd - speechStart) * cum[i]) / total;

  // Match each break to the nearest unused pause around where we'd expect it.
  const anchors = [];
  const used = new Set();
  for (const b of breaks) {
    let best = -1;
    let bestDist = 0.7;
    pauses.forEach((p, pi) => {
      if (used.has(pi)) return;
      const d = Math.abs((p.start + p.end) / 2 - expected(b));
      if (d < bestDist) {
        bestDist = d;
        best = pi;
      }
    });
    if (best >= 0) {
      used.add(best);
      anchors.push({ word: b, end: pauses[best].start, next: pauses[best].end });
    }
  }
  anchors.sort((a, b) => a.word - b.word);

  const timings = new Array(words.length);
  let spanStart = speechStart;
  let firstWord = 0;
  const spans = [...anchors, { word: words.length - 1, end: speechEnd, next: speechEnd }];
  for (const a of spans) {
    let w = 0;
    for (let i = firstWord; i <= a.word; i++) w += weights[i];
    let t = spanStart;
    for (let i = firstWord; i <= a.word; i++) {
      const d = ((a.end - spanStart) * weights[i]) / w;
      timings[i] = { text: words[i], start: t, end: t + d };
      t += d;
    }
    spanStart = a.next;
    firstWord = a.word + 1;
  }
  return timings;
}

async function speak({ id, text, voice, speed }) {
  const { tf, phonemize, model, tokenizer } = await loadEngine();
  const pieces = [];
  const segments = [];
  const gap = new Float32Array(Math.round(SAMPLE_RATE * 0.18));
  let cursor = 0;
  const sentences = splitSentences(text);
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    // American-style (rhotic) phonemes: Indian English pronounces the "r",
    // and in testing they were clearly more intelligible ("store", not "stor").
    const phonemes = await toPhonemes(phonemize, normalize(sentence));
    const { input_ids } = tokenizer(phonemes, { truncation: true });
    const style = await blendedStyle(voice.mix, input_ids.dims.at(-1));
    const pace = (speed ?? 1) * (1 + PACE_VARIATION[i % PACE_VARIATION.length]);
    const { waveform } = await model({
      input_ids,
      style: new tf.Tensor("float32", style, [1, STYLE_DIM]),
      speed: new tf.Tensor("float32", [pace], [1]),
    });
    if (pieces.length) {
      pieces.push(gap);
      cursor += gap.length;
    }
    const offset = cursor / SAMPLE_RATE;
    const words = (await wordTimings(phonemize, sentence, waveform.data)).map((w) => ({ ...w, start: w.start + offset, end: w.end + offset }));
    segments.push({ text: sentence, start: offset, end: (cursor + waveform.data.length) / SAMPLE_RATE, words });
    pieces.push(waveform.data);
    cursor += waveform.data.length;
  }
  const samples = new Float32Array(cursor);
  let o = 0;
  for (const p of pieces) {
    samples.set(p, o);
    o += p.length;
  }
  self.postMessage({ type: "audio", id, samples, sampleRate: SAMPLE_RATE, segments }, [samples.buffer]);
}

// Process one request at a time — the model isn't re-entrant.
let queue = Promise.resolve();
self.onmessage = (e) => {
  const msg = e.data;
  queue = queue.then(async () => {
    try {
      if (msg.type === "load") await loadEngine();
      else if (msg.type === "speak") await speak(msg);
    } catch (err) {
      self.postMessage({ type: "error", id: msg.id, message: err instanceof Error ? err.message : String(err) });
    }
  });
};
