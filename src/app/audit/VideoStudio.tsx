"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AuditReport, VideoScene } from "@/lib/site-audit/types";
import { estimateDuration, renderFrame, VIDEO_H, VIDEO_W, type RenderInput, type TimedScene } from "./video-renderer";

type Mode = "idle" | "preview" | "recording";

const MIME_CANDIDATES = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

function loadPref(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function savePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore — preference just won't persist
  }
}

export default function VideoStudio({ report }: { report: AuditReport }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scenes, setScenes] = useState<VideoScene[]>(report.videoScript);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [agencyName, setAgencyName] = useState("");
  const [agencyContact, setAgencyContact] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState("webm");
  const [error, setError] = useState<string | null>(null);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceBuffers, setVoiceBuffers] = useState<(AudioBuffer | null)[] | null>(null);
  const [editing, setEditing] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setAgencyName(loadPref("audit.agencyName"));
    setAgencyContact(loadPref("audit.agencyContact"));
    fetch("/api/site-audit/voice")
      .then((r) => r.json())
      .then((d) => setVoiceAvailable(!!d.enabled))
      .catch(() => {});
    return () => stopRef.current?.();
  }, []);

  useEffect(() => {
    setScenes(report.videoScript);
    setVoiceBuffers(null);
    setVideoUrl(null);
    if (!report.screenshot) {
      setImage(null);
      return;
    }
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = report.screenshot;
  }, [report]);

  const timed: TimedScene[] = useMemo(() => {
    let start = 0;
    return scenes.map((s, i) => {
      const buf = voiceBuffers?.[i];
      const duration = buf ? buf.duration + 0.9 : estimateDuration(s.narration);
      const t = { ...s, start, duration };
      start += duration;
      return t;
    });
  }, [scenes, voiceBuffers]);
  const total = timed.length ? timed[timed.length - 1].start + timed[timed.length - 1].duration : 0;

  const renderInput: RenderInput = useMemo(() => {
    const outroPoints =
      report.ai?.quickWins ??
      report.categories
        .flatMap((c) => c.checks)
        .filter((c) => c.status === "fail" && c.fix)
        .slice(0, 4)
        .map((c) => c.fix!);
    return {
      scenes: timed,
      screenshot: image,
      domain: report.domain,
      score: report.overallScore,
      grade: report.grade,
      agencyName: agencyName.trim(),
      agencyContact: agencyContact.trim(),
      outroPoints,
    };
  }, [timed, image, report, agencyName, agencyContact]);

  // Draw a poster frame whenever inputs change and nothing is playing.
  useEffect(() => {
    if (mode !== "idle") return;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) renderFrame(ctx, renderInput, Math.min(2.5, total));
  }, [renderInput, mode, total]);

  function getAudioCtx() {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  }

  async function generateVoice() {
    setVoiceLoading(true);
    setError(null);
    try {
      const ctx = getAudioCtx();
      const buffers = await Promise.all(
        scenes.map(async (s) => {
          const res = await fetch("/api/site-audit/voice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: s.narration }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || "Voice generation failed");
          }
          return ctx.decodeAudioData(await res.arrayBuffer());
        })
      );
      setVoiceBuffers(buffers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice generation failed");
    } finally {
      setVoiceLoading(false);
    }
  }

  function play(record: boolean) {
    const canvas = canvasRef.current;
    const ctx2d = canvas?.getContext("2d");
    if (!canvas || !ctx2d) return;
    stopRef.current?.();
    setError(null);
    if (record) setVideoUrl(null);

    const cleanups: (() => void)[] = [];
    let recorder: MediaRecorder | null = null;
    const chunks: Blob[] = [];

    // Audio: pre-generated AI voice is scheduled on the AudioContext (and so
    // can be recorded); otherwise preview uses the browser's speech voice.
    let audioStream: MediaStream | null = null;
    const audioStartAt = voiceBuffers ? getAudioCtx().currentTime + 0.15 : 0;
    if (voiceBuffers) {
      const actx = getAudioCtx();
      void actx.resume();
      const dest = record ? actx.createMediaStreamDestination() : null;
      audioStream = dest?.stream ?? null;
      timed.forEach((s, i) => {
        const buf = voiceBuffers[i];
        if (!buf) return;
        const src = actx.createBufferSource();
        src.buffer = buf;
        src.connect(actx.destination);
        if (dest) src.connect(dest);
        src.start(audioStartAt + s.start + 0.35);
        cleanups.push(() => {
          try {
            src.stop();
          } catch {
            // already stopped
          }
        });
      });
    }

    if (record) {
      const mimeType = MIME_CANDIDATES.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
      if (!mimeType) {
        setError("This browser can't record video — try Chrome, Edge or Safari on a computer.");
        return;
      }
      const stream = canvas.captureStream(30);
      audioStream?.getAudioTracks().forEach((t) => stream.addTrack(t));
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
        setVideoExt(mimeType.startsWith("video/mp4") ? "mp4" : "webm");
        setVideoUrl(URL.createObjectURL(blob));
      };
      recorder.start(1000);
    }

    const useSpeech = !voiceBuffers && !record && typeof speechSynthesis !== "undefined";
    if (useSpeech) speechSynthesis.cancel();
    let spokenIdx = -1;
    const startedAt = voiceBuffers ? performance.now() + 150 : performance.now();
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
      const t = Math.max(0, (performance.now() - startedAt) / 1000);
      renderFrame(ctx2d, renderInput, Math.min(t, total));
      setProgress(Math.min(1, t / total));
      if (useSpeech) {
        const idx = timed.findIndex((s) => t >= s.start && t < s.start + s.duration);
        if (idx !== -1 && idx !== spokenIdx) {
          spokenIdx = idx;
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(timed[idx].narration);
          u.rate = 1.02;
          speechSynthesis.speak(u);
        }
      }
      if (t >= total + 0.3) {
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
    if (patch.narration !== undefined) setVoiceBuffers(null);
  }

  const filename = `${report.domain.replace(/[^a-z0-9.-]/gi, "_")}-website-review.${videoExt}`;

  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">🎬 Walkthrough video</h2>
        <span className="text-xs text-slate-500">
          {scenes.length} scenes · {Math.round(total)}s · script {report.ai ? "written by AI from the screenshot" : "from template"}
        </span>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <input
          value={agencyName}
          onChange={(e) => {
            setAgencyName(e.target.value);
            savePref("audit.agencyName", e.target.value);
          }}
          placeholder="Your agency name (shown in the video)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={agencyContact}
          onChange={(e) => {
            setAgencyContact(e.target.value);
            savePref("audit.agencyContact", e.target.value);
          }}
          placeholder="Contact line, e.g. +91 98xxx · hello@agency.com"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-lg bg-slate-900 ring-1 ring-slate-200">
        <canvas ref={canvasRef} width={VIDEO_W} height={VIDEO_H} className="block h-auto w-full" />
      </div>
      {mode !== "idle" && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full ${mode === "recording" ? "bg-rose-500" : "bg-brand-500"}`} style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {error && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-rose-200">{error}</div>}

      <div className="mt-3 flex flex-wrap gap-2">
        {mode === "idle" ? (
          <>
            <button onClick={() => play(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
              ▶ Preview{!voiceBuffers && " (browser voice)"}
            </button>
            {voiceAvailable && (
              <button
                onClick={generateVoice}
                disabled={voiceLoading || !!voiceBuffers}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
              >
                {voiceBuffers ? "✓ AI voiceover ready" : voiceLoading ? "Generating voice…" : "🎙 Generate AI voiceover"}
              </button>
            )}
            <button onClick={() => play(true)} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              ⏺ Create video file
            </button>
            <button onClick={() => setEditing((e) => !e)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
              ✏️ {editing ? "Hide script" : "Edit script"}
            </button>
          </>
        ) : (
          <button onClick={() => stopRef.current?.()} className="rounded-lg px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50">
            ■ Stop
          </button>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {mode === "recording"
          ? "Recording in real time — keep this tab open and visible until it finishes."
          : voiceBuffers
            ? "The AI voiceover will be included in the exported video."
            : voiceAvailable
              ? "Generate the AI voiceover first to include narration in the video file; otherwise the video has on-screen captions only."
              : "The exported video includes on-screen captions. Add ELEVENLABS_API_KEY on the server to include an AI voiceover."}
      </p>

      {videoUrl && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-200">
          <video src={videoUrl} controls className="w-full rounded" />
          <a href={videoUrl} download={filename} className="mt-2 inline-block rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            ⬇ Download {videoExt.toUpperCase()}
          </a>
        </div>
      )}

      {editing && (
        <div className="mt-4 space-y-3">
          {scenes.map((s, i) => (
            <div key={i} className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold uppercase">
                  {i + 1}. {s.kind}
                </span>
                <span>· {Math.round(timed[i]?.duration ?? 0)}s</span>
                {s.kind !== "intro" && s.kind !== "outro" && (
                  <label className="ml-auto flex items-center gap-1">
                    Position on page
                    <input type="range" min={0} max={1} step={0.01} value={s.focus} onChange={(e) => updateScene(i, { focus: Number(e.target.value) })} />
                  </label>
                )}
              </div>
              <input
                value={s.title}
                onChange={(e) => updateScene(i, { title: e.target.value })}
                className="mb-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm font-medium"
              />
              <textarea
                value={s.narration}
                onChange={(e) => updateScene(i, { narration: e.target.value })}
                rows={2}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
