import { voiceMix, type VoiceSettings } from "./voices";

// Thin client for public/voice/voice-worker.js — our in-browser narration
// engine. One shared worker per tab; the model is downloaded once and then
// served from the browser cache on later visits.

type Pending = { resolve: (s: Float32Array<ArrayBuffer>) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
let readyPromise: Promise<void> | null = null;
const progressListeners = new Set<(fraction: number) => void>();
let readyResolve: (() => void) | null = null;
let readyReject: ((e: Error) => void) | null = null;

export const VOICE_SAMPLE_RATE = 24000;

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker("/voice/voice-worker.js", { type: "module" });
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (m.type === "progress") progressListeners.forEach((l) => l(m.total ? m.loaded / m.total : 0));
    else if (m.type === "ready") readyResolve?.();
    else if (m.type === "audio") {
      pending.get(m.id)?.resolve(m.samples);
      pending.delete(m.id);
    } else if (m.type === "error") {
      const err = new Error(m.message || "Voice engine error");
      if (m.id != null && pending.has(m.id)) {
        pending.get(m.id)!.reject(err);
        pending.delete(m.id);
      } else {
        readyReject?.(err);
      }
    }
  };
  worker.onerror = (e) => {
    console.error("Voice worker error", e.message, e.filename, e.lineno, e.error);
    const err = new Error(e.message || "Voice engine stopped unexpectedly");
    readyReject?.(err);
    pending.forEach((p) => p.reject(err));
    pending.clear();
    worker?.terminate();
    worker = null;
    readyPromise = null;
  };
  return worker;
}

export function loadVoiceEngine(onProgress?: (fraction: number) => void): Promise<void> {
  if (onProgress) progressListeners.add(onProgress);
  if (!readyPromise) {
    readyPromise = new Promise<void>((resolve, reject) => {
      readyResolve = resolve;
      readyReject = (e) => {
        readyPromise = null;
        reject(e);
      };
    });
    getWorker().postMessage({ type: "load" });
  }
  return readyPromise.finally(() => {
    if (onProgress) progressListeners.delete(onProgress);
  });
}

export async function synthesize(text: string, settings: VoiceSettings): Promise<Float32Array<ArrayBuffer>> {
  await loadVoiceEngine();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ type: "speak", id, text, voice: { mix: voiceMix(settings) }, speed: settings.speed });
  });
}
