"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mobileChecklist } from "@/lib/site-audit/checklist";
import type { AuditReport, VideoScene } from "@/lib/site-audit/types";
import { BODY_FONT, DISPLAY_FONT } from "./fonts";
import { renderAmbientMusic } from "./music";
import { estimateDuration, renderFrame, VIDEO_H, VIDEO_W, type RenderInput, type TimedScene } from "./video-renderer";
import { loadVoiceEngine, synthesize, VOICE_SAMPLE_RATE, type SpeechSegment } from "./voice-engine";
import { DEFAULT_VOICE_SETTINGS, VOICES, type VoiceSettings } from "./voices";

type Mode = "idle" | "preview" | "recording";
type VoiceStatus =
  | { state: "idle" }
  | { state: "loading"; progress: number }
  | { state: "generating"; done: number; total: number }
  | { state: "error"; message: string };

const MIME_CANDIDATES = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
const MUSIC_GAIN = 0.55;

function loadPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function savePref(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // preference just won't persist
  }
}

const settingsKey = (s: VoiceSettings) => `${s.voice}|${s.accent.toFixed(2)}|${s.speed.toFixed(2)}`;

// Narration starts this long into each scene (after the crossfade), and the
// captions use the same offset so they track the voice exactly.
const SPEECH_LEAD = 0.55;
const SPEECH_TAIL = 0.6;

type Narration = { buffer: AudioBuffer; segments: SpeechSegment[] };

function Slider({ label, value, min, max, step, left, right, onChange }: {
  label: string; value: number; min: number; max: number; step: number; left: string; right: string; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ivory/50">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-gold-500" />
      <span className="mt-0.5 flex justify-between text-[11px] text-ivory/40">
        <span>{left}</span>
        <span>{right}</span>
      </span>
    </label>
  );
}

export default function VideoStudio({ report }: { report: AuditReport }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scenes, setScenes] = useState<VideoScene[]>(report.videoScript);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [mobileImage, setMobileImage] = useState<HTMLImageElement | null>(null);
  const [fontsReady, setFontsReady] = useState(0);
  const [agencyName, setAgencyName] = useState("");
  const [agencyContact, setAgencyContact] = useState("");
  const [voice, setVoice] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [includeVoice, setIncludeVoice] = useState(true);
  const [includeMusic, setIncludeMusic] = useState(true);
  const [mode, setMode] = useState<Mode>("idle");
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState("webm");
  const [error, setError] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>({ state: "idle" });
  const [voiceBuffers, setVoiceBuffers] = useState<Map<string, Narration>>(new Map());
  const [editing, setEditing] = useState(false);
  const [sampling, setSampling] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicRef = useRef<{ duration: number; buffer: AudioBuffer } | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const fonts = useMemo(() => ({ display: DISPLAY_FONT, body: BODY_FONT }), []);

  useEffect(() => {
    setAgencyName(loadPref("audit.agencyName", ""));
    setAgencyContact(loadPref("audit.agencyContact", ""));
    // Merge so settings saved before a new option existed pick up its default.
    // Settings saved for a voice that no longer exists fall back to the defaults.
    const saved = loadPref<Partial<VoiceSettings>>("audit.voice", {});
    setVoice(VOICES.some((v) => v.id === saved.voice) ? { ...DEFAULT_VOICE_SETTINGS, ...saved } : DEFAULT_VOICE_SETTINGS);
    setIncludeMusic(loadPref("audit.music", true));
    // Canvas text only picks up web fonts once they're loaded.
    Promise.all([
      document.fonts.load(`600 40px ${fonts.display}`),
      document.fonts.load(`italic 500 40px ${fonts.display}`),
      document.fonts.load(`400 20px ${fonts.body}`),
      document.fonts.load(`600 20px ${fonts.body}`),
    ])
      .then(() => setFontsReady((n) => n + 1))
      .catch(() => {});
    return () => stopRef.current?.();
  }, [fonts]);

  useEffect(() => {
    setScenes(report.videoScript);
    setVideoUrl(null);
    const load = (src: string | null, set: (img: HTMLImageElement | null) => void) => {
      if (!src) return set(null);
      const img = new Image();
      img.onload = () => set(img);
      img.src = src;
    };
    load(report.screenshot, setImage);
    load(report.mobileScreenshot, setMobileImage);
  }, [report]);

  const vKey = settingsKey(voice);
  const bufferFor = (s: VideoScene) => voiceBuffers.get(`${vKey}|${s.narration}`) ?? null;
  const voiceReady = scenes.every((s) => bufferFor(s));

  const timed: TimedScene[] = useMemo(() => {
    let start = 0;
    return scenes.map((s) => {
      const n = includeVoice ? voiceBuffers.get(`${vKey}|${s.narration}`) : undefined;
      const duration = n ? SPEECH_LEAD + n.buffer.duration + SPEECH_TAIL : estimateDuration(s.narration);
      const t: TimedScene = { ...s, start, duration, speech: n ? { lead: SPEECH_LEAD, segments: n.segments } : undefined };
      start += duration;
      return t;
    });
  }, [scenes, voiceBuffers, vKey, includeVoice]);
  const total = timed.length ? timed[timed.length - 1].start + timed[timed.length - 1].duration : 0;

  const renderInput: RenderInput = useMemo(() => {
    const outroPoints =
      report.ai?.quickWins ??
      report.categories
        .flatMap((c) => c.checks)
        .filter((c) => c.status === "fail" && c.fix)
        .slice(0, 4)
        .map((c) => c.fix!);
    const content = report.content;
    const ai = report.ai;
    const leak = ai?.funnel.biggestLeak ?? [...report.funnel].sort((a, b) => a.score - b.score)[0].id;
    const funnelLine = (id: "tof" | "mof" | "bof") => {
      if (ai) return ai.funnel[id];
      const stage = report.funnel.find((f) => f.id === id)!;
      const gaps = stage.items.filter((i) => i.status === "no").map((i) => i.label.toLowerCase());
      return gaps.length ? `Missing: ${gaps.slice(0, 3).join(", ")}.` : "In good shape.";
    };
    return {
      scenes: timed,
      screenshot: image,
      mobileShot: mobileImage,
      mobileChecklist: mobileChecklist(report),
      headline: {
        current: ai?.headlineReview.current ?? content.heroHeadline ?? "",
        rewrite: ai?.headlineReview.rewrites[0] ?? "",
        problems: ai?.headlineReview.problems ?? [],
      },
      funnel: report.funnel.map((f) => ({ id: f.id, name: f.name, goal: f.goal, score: f.score, line: funnelLine(f.id) })),
      biggestLeak: leak,
      proof: {
        quotes: content.testimonials,
        trust: content.trustSignals,
        sectionTitle: content.proofSection ?? null,
        points: ai?.socialProof.recommendations ?? [
          "Show your Google rating near the top",
          "Add real names, cities and photos",
          "Feature one strong customer story",
        ],
      },
      domain: report.domain,
      score: report.overallScore,
      grade: report.grade,
      agencyName: agencyName.trim(),
      agencyContact: agencyContact.trim(),
      outroPoints,
      fonts,
    };
  }, [timed, image, mobileImage, report, agencyName, agencyContact, fonts]);

  useEffect(() => {
    if (mode !== "idle") return;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) renderFrame(ctx, renderInput, Math.min(3.2, total));
  }, [renderInput, mode, total, fontsReady]);

  // Broadcast-style voice processing: a little chest warmth, less boxiness,
  // extra presence, and gentle compression for a steady, commanding delivery.
  function voiceChain(actx: BaseAudioContext, outputs: AudioNode[]): AudioNode {
    const warmth = actx.createBiquadFilter();
    warmth.type = "lowshelf";
    warmth.frequency.value = 170;
    warmth.gain.value = 3.5;
    const mud = actx.createBiquadFilter();
    mud.type = "peaking";
    mud.frequency.value = 420;
    mud.Q.value = 1.1;
    mud.gain.value = -2;
    const presence = actx.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 3200;
    presence.Q.value = 0.9;
    presence.gain.value = 2.5;
    const comp = actx.createDynamicsCompressor();
    comp.threshold.value = -22;
    comp.knee.value = 8;
    comp.ratio.value = 3;
    comp.attack.value = 0.008;
    comp.release.value = 0.2;
    const makeup = actx.createGain();
    makeup.gain.value = 1.35;
    warmth.connect(mud).connect(presence).connect(comp).connect(makeup);
    outputs.forEach((o) => makeup.connect(o));
    return warmth;
  }

  function getAudioCtx() {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  }

  function toAudioBuffer(samples: Float32Array<ArrayBuffer>): AudioBuffer {
    const buf = getAudioCtx().createBuffer(1, samples.length, VOICE_SAMPLE_RATE);
    buf.copyToChannel(samples, 0);
    return buf;
  }

  function updateVoice(patch: Partial<VoiceSettings>) {
    const next = { ...voice, ...patch };
    setVoice(next);
    savePref("audit.voice", next);
  }

  async function ensureEngine() {
    setVoiceStatus({ state: "loading", progress: 0 });
    await loadVoiceEngine((p) => setVoiceStatus({ state: "loading", progress: p }));
  }

  async function hearSample() {
    void getAudioCtx().resume();
    setSampling(true);
    setError(null);
    try {
      await ensureEngine();
      setVoiceStatus({ state: "idle" });
      const preset = VOICES.find((v) => v.id === voice.voice)!;
      const { samples } = await synthesize(
        `Hi, I'm ${preset.name}! I've just gone through ${report.domain}, and there are a few things I really want to show you.`,
        voice
      );
      const actx = getAudioCtx();
      const src = actx.createBufferSource();
      src.buffer = toAudioBuffer(samples);
      src.connect(voiceChain(actx, [actx.destination]));
      src.start();
    } catch (err) {
      setVoiceStatus({ state: "error", message: err instanceof Error ? err.message : "Voice engine failed" });
    } finally {
      setSampling(false);
    }
  }

  async function generateVoiceover(): Promise<Map<string, Narration> | null> {
    setError(null);
    try {
      await ensureEngine();
      const next = new Map(voiceBuffers);
      const todo = scenes.filter((s) => !next.has(`${vKey}|${s.narration}`));
      let done = scenes.length - todo.length;
      setVoiceStatus({ state: "generating", done, total: scenes.length });
      for (const s of todo) {
        const speech = await synthesize(s.narration, voice);
        next.set(`${vKey}|${s.narration}`, { buffer: toAudioBuffer(speech.samples), segments: speech.segments });
        done++;
        setVoiceStatus({ state: "generating", done, total: scenes.length });
      }
      setVoiceBuffers(next);
      setVoiceStatus({ state: "idle" });
      return next;
    } catch (err) {
      setVoiceStatus({ state: "error", message: err instanceof Error ? err.message : "Voice engine failed" });
      return null;
    }
  }

  async function getMusic(duration: number): Promise<AudioBuffer | null> {
    if (!includeMusic) return null;
    if (musicRef.current && Math.abs(musicRef.current.duration - duration) < 0.5) return musicRef.current.buffer;
    const buffer = await renderAmbientMusic(duration);
    musicRef.current = { duration, buffer };
    return buffer;
  }

  async function play(record: boolean) {
    // Create/resume audio inside the click itself: browsers only allow audio
    // to start during a user gesture, and narration can take a while.
    const actx = getAudioCtx();
    void actx.resume();
    let buffers = voiceBuffers;
    if (includeVoice && !voiceReady) {
      if (!record) {
        // Preview without waiting: fall back to the browser voice below.
      } else {
        // If the voice can't be prepared, still export — with captions only.
        const generated = await generateVoiceover();
        if (generated) buffers = generated;
      }
    }

    // Recompute timing with the freshest buffers.
    let start = 0;
    const sceneTimes = scenes.map((s) => {
      const n = includeVoice ? buffers.get(`${vKey}|${s.narration}`) : undefined;
      const duration = n ? SPEECH_LEAD + n.buffer.duration + SPEECH_TAIL : estimateDuration(s.narration);
      const t = { ...s, start, duration, buf: n?.buffer, speech: n ? { lead: SPEECH_LEAD, segments: n.segments } : undefined };
      start += duration;
      return t;
    });
    const runTotal = start;
    const input: RenderInput = { ...renderInput, scenes: sceneTimes };
    const haveVoice = includeVoice && sceneTimes.every((s) => s.buf);

    const canvas = canvasRef.current;
    const ctx2d = canvas?.getContext("2d");
    if (!canvas || !ctx2d) return;
    stopRef.current?.();
    setError(null);
    if (record) setVideoUrl(null);

    await Promise.race([actx.resume(), new Promise((r) => setTimeout(r, 1500))]);
    const music = await getMusic(runTotal);
    const dest = record ? actx.createMediaStreamDestination() : null;
    const cleanups: (() => void)[] = [];
    const t0 = actx.currentTime + 0.25;
    // Drive the picture from the audio clock so narration stays in sync; if
    // the browser kept audio suspended, fall back to the wall clock.
    const wallStart = performance.now() + 250;
    const now = () => (actx.state === "running" ? actx.currentTime - t0 : (performance.now() - wallStart) / 1000);

    const schedule = (buffer: AudioBuffer, at: number, gain = 1, isVoice = false) => {
      const src = actx.createBufferSource();
      src.buffer = buffer;
      const g = actx.createGain();
      g.gain.value = gain;
      src.connect(g);
      const outs: AudioNode[] = dest ? [actx.destination, dest] : [actx.destination];
      if (isVoice) g.connect(voiceChain(actx, outs));
      else outs.forEach((o) => g.connect(o));
      src.start(at);
      cleanups.push(() => {
        try {
          src.stop();
        } catch {
          // already stopped
        }
      });
    };
    if (haveVoice) sceneTimes.forEach((s) => schedule(s.buf!, t0 + s.start + SPEECH_LEAD, 1, true));
    if (music) schedule(music, t0, MUSIC_GAIN);

    let recorder: MediaRecorder | null = null;
    const chunks: Blob[] = [];
    if (record) {
      const mimeType = MIME_CANDIDATES.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
      if (!mimeType) {
        cleanups.forEach((c) => c());
        setError("This browser can't record video — please use Chrome, Edge or Safari on a computer.");
        return;
      }
      const stream = canvas.captureStream(30);
      dest?.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
        setVideoExt(mimeType.startsWith("video/mp4") ? "mp4" : "webm");
        setVideoUrl(URL.createObjectURL(blob));
      };
      recorder.start(1000);
    }

    // Preview fallback: the browser's own voice, preferring an Indian English one.
    const useSpeech = !haveVoice && includeVoice && !record && typeof speechSynthesis !== "undefined";
    const indianVoice = useSpeech ? speechSynthesis.getVoices().find((v) => v.lang === "en-IN") : undefined;
    if (useSpeech) speechSynthesis.cancel();
    let spokenIdx = -1;
    let raf = 0;
    let stopped = false;

    const stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      cleanups.forEach((c) => c());
      if (useSpeech) speechSynthesis.cancel();
      if (recorder && recorder.state !== "inactive") recorder.stop();
      stopRef.current = null;
      setMode("idle");
      setProgress(0);
    };
    stopRef.current = stop;

    const tick = () => {
      const t = Math.max(0, now());
      renderFrame(ctx2d, input, Math.min(t, runTotal));
      setProgress(Math.min(1, t / runTotal));
      if (useSpeech) {
        const idx = sceneTimes.findIndex((s) => t >= s.start && t < s.start + s.duration);
        if (idx !== -1 && idx !== spokenIdx) {
          spokenIdx = idx;
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(sceneTimes[idx].narration);
          if (indianVoice) u.voice = indianVoice;
          u.lang = "en-IN";
          u.rate = voice.speed;
          speechSynthesis.speak(u);
        }
      }
      if (t >= runTotal + 0.4) {
        stop();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    setMode(record ? "recording" : "preview");
    raf = requestAnimationFrame(tick);
  }

  function updateScene(i: number, patch: Partial<VideoScene>) {
    setScenes((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  const filename = `${report.domain.replace(/[^a-z0-9.-]/gi, "_")}-website-review.${videoExt}`;
  const busy = voiceStatus.state === "loading" || voiceStatus.state === "generating";

  return (
    <section className="overflow-hidden rounded-2xl bg-ink-900 text-ivory shadow-xl ring-1 ring-ink-700">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-700 px-6 py-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-400">Walkthrough film</div>
          <h2 className="mt-1 font-display text-2xl font-semibold">Narrated video review</h2>
        </div>
        <div className="text-xs text-ivory/50">
          {scenes.length} scenes · {Math.round(total)}s · script {report.ai ? "written by AI from the live site" : "from template"}
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
        {/* Stage */}
        <div className="p-6">
          <div className="overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10">
            <canvas ref={canvasRef} width={VIDEO_W} height={VIDEO_H} className="block h-auto w-full" />
          </div>
          <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full transition-[width] duration-100 ${mode === "recording" ? "bg-rose-500" : "bg-gold-500"}`}
              style={{ width: `${(mode === "idle" ? 0 : progress) * 100}%` }}
            />
          </div>

          {error && <div className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-500/30">{error}</div>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {mode === "idle" ? (
              <>
                <button
                  onClick={() => play(true)}
                  disabled={busy}
                  className="rounded-full bg-gold-500 px-5 py-2.5 text-sm font-semibold text-ink-950 shadow-lg shadow-gold-500/20 transition hover:bg-gold-400 disabled:opacity-60"
                >
                  Create video
                </button>
                <button
                  onClick={() => play(false)}
                  disabled={busy}
                  className="rounded-full px-5 py-2.5 text-sm font-medium text-ivory ring-1 ring-white/20 transition hover:bg-white/5 disabled:opacity-60"
                >
                  ▶ Preview
                </button>
                {includeVoice && !voiceReady && (
                  <button
                    onClick={generateVoiceover}
                    disabled={busy}
                    className="rounded-full px-5 py-2.5 text-sm font-medium text-ivory/80 ring-1 ring-white/10 transition hover:bg-white/5 disabled:opacity-60"
                  >
                    Prepare narration
                  </button>
                )}
                <button onClick={() => setEditing((e) => !e)} className="ml-auto text-sm text-ivory/60 underline-offset-4 hover:text-ivory hover:underline">
                  {editing ? "Hide script" : "Edit script"}
                </button>
              </>
            ) : (
              <button onClick={() => stopRef.current?.()} className="rounded-full px-5 py-2.5 text-sm font-medium text-rose-300 ring-1 ring-rose-400/40 hover:bg-rose-500/10">
                ■ Stop
              </button>
            )}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-ivory/45">
            {mode === "recording"
              ? "Recording in real time — keep this tab open and in view until it finishes."
              : voiceStatus.state === "loading"
                ? `Loading our narration voice… ${Math.round(voiceStatus.progress * 100)}% (one-time ~90 MB download, then it's cached)`
                : voiceStatus.state === "generating"
                  ? `Recording narration… scene ${Math.min(voiceStatus.done + 1, voiceStatus.total)} of ${voiceStatus.total}`
                  : voiceStatus.state === "error"
                    ? `Narration voice unavailable: ${voiceStatus.message}. The video will use captions only.`
                    : includeVoice && !voiceReady
                      ? "Preview uses your browser's voice until the narration is prepared. \"Create video\" prepares it automatically."
                      : "Everything is rendered privately in your browser."}
          </p>

          {videoUrl && (
            <div className="mt-5 rounded-xl bg-white/5 p-4 ring-1 ring-gold-500/30">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-400">Your video is ready</div>
              <video src={videoUrl} controls className="w-full rounded-lg" />
              <a
                href={videoUrl}
                download={filename}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-ivory px-5 py-2.5 text-sm font-semibold text-ink-900 transition hover:bg-white"
              >
                ↓ Download {videoExt.toUpperCase()}
              </a>
            </div>
          )}
        </div>

        {/* Controls */}
        <aside className="space-y-6 border-t border-ink-700 bg-ink-800/60 p-6 lg:border-l lg:border-t-0">
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ivory/50">Narrator</div>
            <div className="space-y-2">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => updateVoice({ voice: v.id })}
                  className={`w-full rounded-xl px-4 py-3 text-left transition ${
                    voice.voice === v.id ? "bg-gold-500/10 ring-1 ring-gold-500/60" : "ring-1 ring-white/10 hover:bg-white/5"
                  }`}
                >
                  <div className="font-display text-lg">{v.name}</div>
                  <div className="text-xs text-ivory/55">{v.description}</div>
                </button>
              ))}
            </div>
            <button
              onClick={hearSample}
              disabled={sampling || busy}
              className="mt-3 w-full rounded-full py-2 text-sm font-medium text-gold-300 ring-1 ring-gold-500/40 transition hover:bg-gold-500/10 disabled:opacity-60"
            >
              {sampling ? (voiceStatus.state === "loading" ? `Loading voice… ${Math.round(voiceStatus.progress * 100)}%` : "Speaking…") : "♪ Hear this voice"}
            </button>
          </div>

          <Slider label="Accent" value={voice.accent} min={0} max={1} step={0.05} left="Neutral" right="Strong Indian" onChange={(v) => updateVoice({ accent: v })} />
          <Slider label="Pace" value={voice.speed} min={0.9} max={1.25} step={0.02} left="Relaxed" right="Fast" onChange={(v) => updateVoice({ speed: v })} />

          <div className="space-y-2 text-sm">
            <label className="flex items-center justify-between gap-3">
              <span className="text-ivory/80">Voice narration</span>
              <input type="checkbox" checked={includeVoice} onChange={(e) => setIncludeVoice(e.target.checked)} className="h-4 w-4 accent-gold-500" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-ivory/80">Background music</span>
              <input
                type="checkbox"
                checked={includeMusic}
                onChange={(e) => {
                  setIncludeMusic(e.target.checked);
                  savePref("audit.music", e.target.checked);
                }}
                className="h-4 w-4 accent-gold-500"
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ivory/50">Your branding</div>
            <input
              value={agencyName}
              onChange={(e) => {
                setAgencyName(e.target.value);
                savePref("audit.agencyName", e.target.value);
              }}
              placeholder="Agency name"
              className="w-full rounded-lg bg-ink-900 px-3 py-2 text-sm text-ivory ring-1 ring-white/10 placeholder:text-ivory/30 focus:ring-gold-500/60"
            />
            <input
              value={agencyContact}
              onChange={(e) => {
                setAgencyContact(e.target.value);
                savePref("audit.agencyContact", e.target.value);
              }}
              placeholder="+91 98xxx xxxxx · hello@agency.in"
              className="w-full rounded-lg bg-ink-900 px-3 py-2 text-sm text-ivory ring-1 ring-white/10 placeholder:text-ivory/30 focus:ring-gold-500/60"
            />
          </div>
        </aside>
      </div>

      {editing && (
        <div className="space-y-3 border-t border-ink-700 p-6">
          {scenes.map((s, i) => (
            <div key={i} className="rounded-xl bg-ink-800 p-4 ring-1 ring-white/5">
              <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-ivory/45">
                <span className="font-semibold text-gold-400">
                  {String(i + 1).padStart(2, "0")} · {s.kind}
                </span>
                <span>{Math.round(timed[i]?.duration ?? 0)}s</span>
                {bufferFor(s) && <span className="text-emerald-400/80">narrated</span>}
                {s.kind !== "intro" && s.kind !== "outro" && (
                  <label className="ml-auto flex items-center gap-2 normal-case tracking-normal">
                    Position on page
                    <input type="range" min={0} max={1} step={0.01} value={s.focus} onChange={(e) => updateScene(i, { focus: Number(e.target.value) })} className="accent-gold-500" />
                  </label>
                )}
              </div>
              <input
                value={s.title}
                onChange={(e) => updateScene(i, { title: e.target.value })}
                className="mb-2 w-full rounded-lg bg-ink-900 px-3 py-2 font-display text-base text-ivory ring-1 ring-white/10 focus:ring-gold-500/60"
              />
              <textarea
                value={s.narration}
                onChange={(e) => updateScene(i, { narration: e.target.value })}
                rows={2}
                className="w-full rounded-lg bg-ink-900 px-3 py-2 text-sm text-ivory/85 ring-1 ring-white/10 focus:ring-gold-500/60"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
