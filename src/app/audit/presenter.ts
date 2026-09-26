// The on-screen presenter: an illustrated narrator whose mouth follows the
// loudness of the actual narration (so it lip-syncs to the voice), with
// natural blinking and small head movements. Or, if the rep uploads a
// photo, their photo with a "speaking" glow that pulses with the voice.

export type PresenterStyle = "female" | "male";

export type Presenter = {
  style: PresenterStyle;
  name: string;
  caption: string; // e.g. "Pixel Agency"
  photo: HTMLImageElement | null;
  // Narration loudness at time t (0..1), 0 when silent.
  levelAt: (t: number) => number;
};

const SKIN = "#b07a57";
const SKIN_SHADE = "#9a6647";
const HAIR = "#1c1512";
const LIP = "#8f4a44";

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

function blinkAmount(t: number): number {
  // Blink roughly every 3-4.5 s, each lasting ~140 ms.
  const period = 3.7;
  const phase = (t + Math.sin(Math.floor(t / period) * 12.9) * 0.8) % period;
  if (phase < 0 || phase > 0.14) return 0;
  return Math.sin((phase / 0.14) * Math.PI);
}

function drawIllustrated(ctx: CanvasRenderingContext2D, p: Presenter, cx: number, cy: number, r: number, level: number, t: number) {
  // Background
  const bg = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r);
  bg.addColorStop(0, "#34466a");
  bg.addColorStop(1, "#131c2e");
  ctx.fillStyle = bg;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  const s = (r / 100) * 1.18; // portrait framing: head fills the circle
  const oy = cy + 8 * s;
  const bob = Math.sin(t * 1.7) * 1.1 * s - level * 1.4 * s;
  const tilt = Math.sin(t * 0.9) * 0.022 + Math.sin(t * 2.3) * level * 0.014;
  const female = p.style === "female";

  // Hair falling behind the shoulders (female)
  if (female) {
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.moveTo(cx - 46 * s, oy - 20 * s + bob);
    ctx.quadraticCurveTo(cx - 58 * s, oy + 40 * s, cx - 44 * s, oy + 78 * s);
    ctx.lineTo(cx + 44 * s, oy + 78 * s);
    ctx.quadraticCurveTo(cx + 58 * s, oy + 40 * s, cx + 46 * s, oy - 20 * s + bob);
    ctx.closePath();
    ctx.fill();
  }
  // Shoulders / jacket
  const jacket = ctx.createLinearGradient(cx, oy + 50 * s, cx, oy + 130 * s);
  jacket.addColorStop(0, female ? "#8a3442" : "#243352");
  jacket.addColorStop(1, female ? "#5e1f2b" : "#141d30");
  ctx.fillStyle = jacket;
  ctx.beginPath();
  ctx.ellipse(cx, oy + 112 * s, 86 * s, 58 * s, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = female ? "#f4ead3" : "#faf8f3";
  ctx.beginPath();
  ctx.moveTo(cx - 20 * s, oy + 55 * s);
  ctx.lineTo(cx, oy + 86 * s);
  ctx.lineTo(cx + 20 * s, oy + 55 * s);
  ctx.closePath();
  ctx.fill();
  // Neck
  const neck = ctx.createLinearGradient(cx, oy + 26 * s, cx, oy + 62 * s);
  neck.addColorStop(0, SKIN_SHADE);
  neck.addColorStop(1, SKIN);
  ctx.fillStyle = neck;
  ctx.beginPath();
  ctx.roundRect(cx - 13 * s, oy + 24 * s + bob, 26 * s, 36 * s, 6 * s);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, oy + bob);
  ctx.rotate(tilt);

  // Ears
  ctx.fillStyle = SKIN_SHADE;
  ctx.beginPath();
  ctx.ellipse(-37 * s, -8 * s, 6.5 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(37 * s, -8 * s, 6.5 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Face with soft light from the upper left
  const face = ctx.createRadialGradient(-10 * s, -22 * s, 4 * s, 0, -4 * s, 52 * s);
  face.addColorStop(0, "#c89170");
  face.addColorStop(0.7, SKIN);
  face.addColorStop(1, SKIN_SHADE);
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.moveTo(0, -52 * s);
  ctx.bezierCurveTo(26 * s, -52 * s, 36 * s, -34 * s, 36 * s, -10 * s);
  ctx.bezierCurveTo(36 * s, 16 * s, 22 * s, 38 * s, 0, 40 * s);
  ctx.bezierCurveTo(-22 * s, 38 * s, -36 * s, 16 * s, -36 * s, -10 * s);
  ctx.bezierCurveTo(-36 * s, -34 * s, -26 * s, -52 * s, 0, -52 * s);
  ctx.fill();
  if (female) {
    ctx.fillStyle = "#c8a15a";
    ctx.beginPath();
    ctx.arc(-37 * s, 4 * s, 2.4 * s, 0, Math.PI * 2);
    ctx.arc(37 * s, 4 * s, 2.4 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cheeks
  ctx.fillStyle = "rgba(190,90,80,0.13)";
  ctx.beginPath();
  ctx.ellipse(-21 * s, 10 * s, 8 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(21 * s, 10 * s, 8 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = HAIR;
  if (female) {
    // Side-parted hair framing the face
    ctx.beginPath();
    ctx.moveTo(-40 * s, 10 * s);
    ctx.bezierCurveTo(-46 * s, -40 * s, -20 * s, -62 * s, 6 * s, -60 * s);
    ctx.bezierCurveTo(34 * s, -58 * s, 46 * s, -34 * s, 40 * s, 12 * s);
    ctx.bezierCurveTo(36 * s, -16 * s, 30 * s, -34 * s, 14 * s, -42 * s);
    ctx.bezierCurveTo(4 * s, -30 * s, -14 * s, -26 * s, -30 * s, -30 * s);
    ctx.bezierCurveTo(-35 * s, -18 * s, -36 * s, -4 * s, -40 * s, 10 * s);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(8 * s, -56 * s);
    ctx.quadraticCurveTo(-18 * s, -48 * s, -32 * s, -26 * s);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-37 * s, -8 * s);
    ctx.bezierCurveTo(-42 * s, -46 * s, -16 * s, -62 * s, 4 * s, -60 * s);
    ctx.bezierCurveTo(30 * s, -60 * s, 44 * s, -42 * s, 37 * s, -8 * s);
    ctx.bezierCurveTo(34 * s, -26 * s, 28 * s, -36 * s, 16 * s, -38 * s);
    ctx.bezierCurveTo(0, -34 * s, -18 * s, -40 * s, -30 * s, -32 * s);
    ctx.bezierCurveTo(-34 * s, -24 * s, -35 * s, -16 * s, -37 * s, -8 * s);
    ctx.fill();
    // Trimmed beard shadow
    ctx.fillStyle = "rgba(28,21,18,0.18)";
    ctx.beginPath();
    ctx.moveTo(-32 * s, 6 * s);
    ctx.bezierCurveTo(-28 * s, 34 * s, 28 * s, 34 * s, 32 * s, 6 * s);
    ctx.bezierCurveTo(22 * s, 44 * s, -22 * s, 44 * s, -32 * s, 6 * s);
    ctx.fill();
  }

  // Eyebrows (lift slightly on emphasis)
  const brow = -20 * s - level * 1.6 * s;
  ctx.strokeStyle = HAIR;
  ctx.lineWidth = (female ? 2.2 : 3.2) * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-23 * s, brow + 1.5 * s);
  ctx.quadraticCurveTo(-15 * s, brow - 3 * s, -7 * s, brow + 0.5 * s);
  ctx.moveTo(7 * s, brow + 0.5 * s);
  ctx.quadraticCurveTo(15 * s, brow - 3 * s, 23 * s, brow + 1.5 * s);
  ctx.stroke();

  // Eyes with blink
  const open = 1 - blinkAmount(t);
  const look = Math.sin(t * 0.45) * 0.8 * s;
  for (const ex of [-14.5, 14.5]) {
    const eh = Math.max(0.5, 3.9 * open) * s;
    ctx.fillStyle = "#f7f1e6";
    ctx.beginPath();
    ctx.ellipse(ex * s, -7 * s, 6.2 * s, eh, 0, 0, Math.PI * 2);
    ctx.fill();
    if (open > 0.3) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ex * s, -7 * s, 6.2 * s, eh, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#4a2c1c";
      ctx.beginPath();
      ctx.arc(ex * s + look, -7 * s, 3.4 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#140c08";
      ctx.beginPath();
      ctx.arc(ex * s + look, -7 * s, 1.7 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(ex * s + look + 1.1 * s, -8.2 * s, 0.9 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Upper lid / lashes
    ctx.strokeStyle = "#1c1512";
    ctx.lineWidth = (female ? 1.9 : 1.3) * s;
    ctx.beginPath();
    ctx.ellipse(ex * s, -7 * s, 6.6 * s, eh + 0.4 * s, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  }

  // Nose
  ctx.strokeStyle = "rgba(120,72,48,0.8)";
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.moveTo(-1 * s, -2 * s);
  ctx.quadraticCurveTo(-4.5 * s, 9 * s, -2 * s, 11 * s);
  ctx.quadraticCurveTo(1.5 * s, 12.5 * s, 4.5 * s, 10.5 * s);
  ctx.stroke();

  // Mouth: a gentle smile at rest, opening with the voice's loudness.
  const mo = Math.max(0, level - 0.12) / 0.88;
  const mw = (10 + mo * 2.5) * s;
  const mh = mo * 8.5 * s;
  const my = 22 * s;
  if (mo > 0.04) {
    ctx.fillStyle = "#3a1614";
    ctx.beginPath();
    ctx.moveTo(-mw, my);
    ctx.quadraticCurveTo(0, my - 2 * s, mw, my);
    ctx.quadraticCurveTo(0, my + 2 * s + mh * 1.6, -mw, my);
    ctx.fill();
    ctx.fillStyle = "rgba(250,246,238,0.9)";
    ctx.beginPath();
    ctx.ellipse(0, my + 0.6 * s, mw * 0.72, Math.min(mh * 0.28, 1.8 * s), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(170,70,70,0.7)";
    ctx.beginPath();
    ctx.ellipse(0, my + mh * 0.95, mw * 0.5, Math.min(mh * 0.3, 2.4 * s), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = female ? LIP : "#7d4a3c";
  ctx.lineWidth = (female ? 2.4 : 1.8) * s;
  ctx.beginPath();
  ctx.moveTo(-mw, my);
  ctx.quadraticCurveTo(0, my + (mo > 0.04 ? -2 : 3) * s, mw, my);
  if (mo > 0.04) {
    ctx.moveTo(-mw, my);
    ctx.quadraticCurveTo(0, my + 2 * s + mh * 1.6, mw, my);
  }
  ctx.stroke();

  ctx.restore();
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
  if (p.photo) {
    const img = p.photo;
    const zoom = 1 + level * 0.015;
    const side = Math.min(img.width, img.height) / zoom;
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2.6, side, side, cx - r, cy - r, r * 2, r * 2);
  } else {
    drawIllustrated(ctx, p, cx, cy, r, level, t);
  }
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
