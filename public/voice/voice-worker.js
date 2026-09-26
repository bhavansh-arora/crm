// In-house narration voice engine, running entirely in the browser.
//
// Uses the open-weight Kokoro-82M text-to-speech model (Apache-2.0) via
// transformers.js. Our voices ("Aarohi", "Arjun") are custom blends of
// Kokoro's Hindi speaker styles, which speak English with a natural Indian
// accent, optionally mixed with a British speaker for extra clarity. No
// third-party voice API, no per-use cost: the model (~90 MB) downloads once
// and is cached by the browser.
//
// Messages in:  { type: "load" }
//               { type: "speak", id, text, voice: { mix: [[name, weight], ...] }, speed }
// Messages out: { type: "progress", loaded, total }  (model download)
//               { type: "ready", device }
//               { type: "audio", id, samples: Float32Array, sampleRate }
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
    .replace(/\b([a-z0-9-]+)\.(com|in|co\.in|net|org|io|co|biz|info)\b/gi, (_, d, tld) => `${d} dot ${tld.replace(".", " dot ")}`)
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

function splitSentences(text) {
  const parts = text.match(/[^.!?]+[.!?]+["')]*|[^.!?]+$/g) || [text];
  // Merge very short fragments so prosody stays natural.
  const out = [];
  for (const p of parts.map((s) => s.trim()).filter(Boolean)) {
    if (out.length && (out[out.length - 1].length < 25 || p.length < 12)) out[out.length - 1] += " " + p;
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

async function speak({ id, text, voice, speed }) {
  const { tf, phonemize, model, tokenizer } = await loadEngine();
  const pieces = [];
  const gap = new Float32Array(Math.round(SAMPLE_RATE * 0.22));
  for (const sentence of splitSentences(normalize(text))) {
    // "en" = British-style espeak phonemes; Indian English is non-rhotic, so
    // this pairs better with the Hindi speaker styles than en-us does.
    const phonemes = (await phonemize(sentence, "en")).join(" ").replace(/r/g, "ɹ").replace(/x/g, "k").replace(/ʲ/g, "j");
    const { input_ids } = tokenizer(phonemes, { truncation: true });
    const style = await blendedStyle(voice.mix, input_ids.dims.at(-1));
    const { waveform } = await model({
      input_ids,
      style: new tf.Tensor("float32", style, [1, STYLE_DIM]),
      speed: new tf.Tensor("float32", [speed ?? 1], [1]),
    });
    if (pieces.length) pieces.push(gap);
    pieces.push(waveform.data);
  }
  const length = pieces.reduce((s, p) => s + p.length, 0);
  const samples = new Float32Array(length);
  let o = 0;
  for (const p of pieces) {
    samples.set(p, o);
    o += p.length;
  }
  self.postMessage({ type: "audio", id, samples, sampleRate: SAMPLE_RATE }, [samples.buffer]);
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
