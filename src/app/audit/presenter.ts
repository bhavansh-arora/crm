// The on-screen presenter: a real photo (the rep's own, uploaded in the
// studio) that lip-syncs to the narration — see photo-talker.ts — framed in
// a circle with a subtle glow that follows the voice.

import type { FaceGeometry } from "./face-landmarks";
import { drawTalkingPhoto } from "./photo-talker";

export type Presenter = {
  name: string;
  caption: string; // e.g. "Pixel Agency"
  photo: HTMLImageElement;
  // Face landmarks for the photo, which let it lip-sync.
  face: FaceGeometry;
  // Narration loudness at time t (0..1), 0 when silent.
  levelAt: (t: number) => number;
};

// Loudness envelope of a narration clip: RMS per 1/50 s, normalised so
// normal speech sits around 0.6-0.9.
export const ENVELOPE_RATE = 50;
export function loudnessEnvelope(buffer: AudioBuffer): Float32Array {
  const data = buffer.getChannelData(0);
  const hop = Math.round(buffer.sampleRate / ENVELOPE_RATE);
  const n = Math.ceil(data.length / hop);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const end = Math.min(data.length, (i + 1) * hop);
    for (let k = i * hop; k < end; k++) sum += data[k] * data[k];
    env[i] = Math.sqrt(sum / Math.max(1, end - i * hop));
  }
  const sorted = Array.from(env).sort((a, b) => a - b);
  const ref = sorted[Math.floor(n * 0.9)] || 1;
  for (let i = 0; i < n; i++) env[i] = Math.min(1, env[i] / ref) ** 0.8;
  return env;
}

export function drawPresenter(
  ctx: CanvasRenderingContext2D,
  p: Presenter,
  cx: number,
  cy: number,
  r: number,
  t: number,
  fonts: { display: string; body: string },
  opts: { showName?: boolean; alpha?: number } = {}
) {
  const level = Math.max(0, Math.min(1, p.levelAt(t)));
  const alpha = opts.alpha ?? 1;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Speaking glow
  ctx.strokeStyle = `rgba(200,161,90,${0.35 + level * 0.55})`;
  ctx.lineWidth = 2 + level * 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 5 + level * 4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#131c2e";
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#131c2e";
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  drawTalkingPhoto(ctx, p.photo, p.face, cx, cy, r, t, level);
  ctx.restore();

  ctx.strokeStyle = "rgba(250,248,243,0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  if (opts.showName !== false && p.name) {
    const label = p.caption ? `${p.name} · ${p.caption}` : p.name;
    ctx.font = `600 ${Math.min(16, Math.max(11, Math.round(r * 0.2)))}px ${fonts.body}`;
    const w = ctx.measureText(label).width + 22;
    const ly = cy + r - 8;
    ctx.fillStyle = "rgba(11,18,32,0.92)";
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, ly, w, Math.min(28, Math.max(20, r * 0.34)), 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(200,161,90,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#faf8f3";
    ctx.textAlign = "center";
    ctx.fillText(label, cx, ly + Math.min(28, Math.max(20, r * 0.34)) * 0.68);
    ctx.textAlign = "left";
  }
  ctx.restore();
}
