import type { VideoScene } from "@/lib/site-audit/types";

// Draws one frame of the walkthrough video onto a 1280x720 canvas for a given
// time `t` (seconds). Stateless per frame so preview and recording are
// identical and seeking is trivial.

export const VIDEO_W = 1280;
export const VIDEO_H = 720;

export type TimedScene = VideoScene & { start: number; duration: number };

export type RenderInput = {
  scenes: TimedScene[];
  screenshot: HTMLImageElement | null;
  domain: string;
  score: number;
  grade: string;
  agencyName: string;
  agencyContact: string;
  outroPoints: string[];
};

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function scoreColor(score: number) {
  return score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#f43f5e";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 99): number {
  const lines = wrapLines(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

function background(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, VIDEO_W, VIDEO_H);
  g.addColorStop(0, "#0f172a");
  g.addColorStop(1, "#1e293b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
}

// Blurred, darkened hero of the screenshot as a backdrop for title cards.
function screenshotBackdrop(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, t: number) {
  background(ctx);
  if (!img) return;
  ctx.save();
  ctx.filter = "blur(14px) brightness(0.35)";
  const scale = (VIDEO_W / img.width) * (1.15 + t * 0.01);
  ctx.drawImage(img, 0, 0, img.width, Math.min(img.height, VIDEO_H / scale), -40, -40, img.width * scale, Math.min(img.height, VIDEO_H / scale) * scale);
  ctx.restore();
}

function scoreRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, score: number, grade: string, progress: number) {
  const shown = Math.round(score * ease(clamp(progress, 0, 1)));
  ctx.lineWidth = r * 0.16;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = scoreColor(score);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * shown) / 100);
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(r * 0.7)}px ${FONT}`;
  ctx.fillText(String(shown), cx, cy - r * 0.08);
  ctx.font = `500 ${Math.round(r * 0.2)}px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(`out of 100 · Grade ${grade}`, cx, cy + r * 0.42);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function subtitles(ctx: CanvasRenderingContext2D, narration: string, progress: number) {
  const words = narration.split(/\s+/).filter(Boolean);
  if (!words.length) return;
  const chunkSize = 13;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) chunks.push(words.slice(i, i + chunkSize).join(" "));
  const text = chunks[Math.min(chunks.length - 1, Math.floor(progress * chunks.length))];
  ctx.font = `500 24px ${FONT}`;
  const lines = wrapLines(ctx, text, 1080).slice(0, 2);
  const h = lines.length * 32 + 20;
  const y = VIDEO_H - 28 - h;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 40;
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  roundRect(ctx, (VIDEO_W - w) / 2, y, w, h, 10);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  lines.forEach((l, i) => ctx.fillText(l, VIDEO_W / 2, y + 34 + i * 32));
  ctx.textAlign = "left";
}

function drawIntro(ctx: CanvasRenderingContext2D, input: RenderInput, scene: TimedScene, local: number) {
  screenshotBackdrop(ctx, input.screenshot, local);
  const fade = clamp(local / 0.6, 0, 1);
  ctx.globalAlpha = fade;
  ctx.fillStyle = "#60a5fa";
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText("WEBSITE REVIEW", 90, 200);
  ctx.fillStyle = "#fff";
  ctx.font = `700 64px ${FONT}`;
  const endY = drawWrapped(ctx, input.domain, 90, 275, 640, 72, 2);
  ctx.font = `400 26px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  drawWrapped(ctx, scene.title === `Website review: ${input.domain}` ? "Speed · Security · Google · Mobile · Leads" : scene.title, 90, endY + 20, 640, 36, 3);
  if (input.agencyName) {
    ctx.font = `500 20px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText(`Prepared by ${input.agencyName}`, 90, 600);
  }
  scoreRing(ctx, 1000, 350, 150, input.score, input.grade, (local - 0.6) / 2);
  ctx.globalAlpha = 1;
}

function drawOutro(ctx: CanvasRenderingContext2D, input: RenderInput, scene: TimedScene, local: number) {
  screenshotBackdrop(ctx, input.screenshot, local);
  ctx.globalAlpha = clamp(local / 0.6, 0, 1);
  scoreRing(ctx, 230, 300, 120, input.score, input.grade, 1);
  ctx.fillStyle = "#fff";
  ctx.font = `700 44px ${FONT}`;
  let y = drawWrapped(ctx, scene.title, 430, 170, 780, 52, 2);
  ctx.font = `400 24px ${FONT}`;
  y += 10;
  const points = scene.bullets?.length ? scene.bullets : input.outroPoints;
  points.slice(0, 4).forEach((p, i) => {
    const appear = clamp((local - 0.8 - i * 0.5) / 0.4, 0, 1);
    ctx.globalAlpha = appear;
    ctx.fillStyle = "#34d399";
    ctx.fillText("✓", 430, y + 30);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    y = drawWrapped(ctx, p, 466, y + 30, 750, 32, 2) + 6;
  });
  ctx.globalAlpha = 1;
  if (input.agencyName || input.agencyContact) {
    ctx.fillStyle = "#2f56d1";
    roundRect(ctx, 430, 540, 780, 90, 16);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText(input.agencyName ? `Let ${input.agencyName} fix this for you` : "Let's fix this together", 460, 580);
    if (input.agencyContact) {
      ctx.font = `400 22px ${FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(input.agencyContact, 460, 613);
    }
  }
}

function drawBrowserScene(ctx: CanvasRenderingContext2D, input: RenderInput, scene: TimedScene, prevFocus: number, local: number) {
  background(ctx);
  const img = input.screenshot;
  const isMobileShot = !!img && img.width < 800;
  const frameW = isMobileShot ? 360 : 800;
  const frameX = isMobileShot ? 150 : 36;
  const frameY = 36;
  const frameH = 560;
  const barH = isMobileShot ? 28 : 38;
  const viewW = frameW - 16;
  const viewH = frameH - barH - 8;
  const viewX = frameX + 8;
  const viewY = frameY + barH;

  // Pulsing red glow for problem scenes.
  if (scene.kind === "issue") {
    const pulse = 0.5 + 0.5 * Math.sin(local * 4);
    ctx.save();
    ctx.shadowColor = `rgba(244,63,94,${0.35 + 0.35 * pulse})`;
    ctx.shadowBlur = 40;
    ctx.fillStyle = "#1e293b";
    roundRect(ctx, frameX, frameY, frameW, frameH, 16);
    ctx.fill();
    ctx.restore();
  }

  // Window chrome
  ctx.fillStyle = "#e2e8f0";
  roundRect(ctx, frameX, frameY, frameW, frameH, 16);
  ctx.fill();
  if (!isMobileShot) {
    ["#f87171", "#fbbf24", "#34d399"].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(frameX + 22 + i * 18, frameY + barH / 2, 6, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#fff";
    roundRect(ctx, frameX + 90, frameY + 8, frameW - 110, barH - 16, 8);
    ctx.fill();
    ctx.fillStyle = "#475569";
    ctx.font = `400 14px ${FONT}`;
    ctx.fillText(input.domain, frameX + 104, frameY + barH / 2 + 5);
  } else {
    ctx.fillStyle = "#94a3b8";
    roundRect(ctx, frameX + frameW / 2 - 40, frameY + 10, 80, 8, 4);
    ctx.fill();
  }

  ctx.save();
  roundRect(ctx, viewX, viewY, viewW, viewH, 8);
  ctx.clip();
  ctx.fillStyle = "#fff";
  ctx.fillRect(viewX, viewY, viewW, viewH);
  if (img) {
    const zoom = 1 + 0.04 * clamp(local / Math.max(scene.duration, 1), 0, 1);
    const scale = (viewW / img.width) * zoom;
    const pageH = img.height * scale;
    const maxScroll = Math.max(0, pageH - viewH);
    const target = (f: number) => clamp(f * pageH - viewH * 0.35, 0, maxScroll);
    const move = ease(clamp(local / 1.4, 0, 1));
    const drift = Math.min(40, maxScroll) * clamp((local - 1.4) / Math.max(scene.duration - 1.4, 1), 0, 1);
    const scrollY = clamp(target(prevFocus) + (target(scene.focus) - target(prevFocus)) * move + drift, 0, maxScroll);
    const offsetX = (viewW - img.width * scale) / 2;
    ctx.drawImage(img, viewX + offsetX, viewY - scrollY, img.width * scale, pageH);

    // Scrollbar
    if (maxScroll > 0) {
      const barLen = Math.max(30, (viewH / pageH) * viewH);
      ctx.fillStyle = "rgba(15,23,42,0.35)";
      roundRect(ctx, viewX + viewW - 8, viewY + (scrollY / maxScroll) * (viewH - barLen), 5, barLen, 3);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "#94a3b8";
    ctx.font = `500 22px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(input.domain, viewX + viewW / 2, viewY + viewH / 2);
    ctx.textAlign = "left";
  }
  ctx.restore();

  // Side panel
  const panelX = isMobileShot ? 560 : 870;
  const panelW = VIDEO_W - panelX - 40;
  const appear = clamp((local - 0.3) / 0.5, 0, 1);
  ctx.globalAlpha = appear;
  const badge = scene.kind === "issue" ? { text: "PROBLEM", color: "#f43f5e" } : { text: "WALKTHROUGH", color: "#3b82f6" };
  ctx.font = `700 15px ${FONT}`;
  const bw = ctx.measureText(badge.text).width + 24;
  ctx.fillStyle = badge.color;
  roundRect(ctx, panelX, 70, bw, 30, 15);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(badge.text, panelX + 12, 91);

  ctx.font = `700 36px ${FONT}`;
  let y = drawWrapped(ctx, scene.title, panelX, 150, panelW, 44, 4);
  ctx.font = `400 22px ${FONT}`;
  y += 16;
  (scene.bullets ?? []).slice(0, 3).forEach((b, i) => {
    ctx.globalAlpha = clamp((local - 0.8 - i * 0.4) / 0.4, 0, 1);
    ctx.fillStyle = scene.kind === "issue" ? "#fb7185" : "#60a5fa";
    ctx.fillText("●", panelX, y + 4);
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    y = drawWrapped(ctx, b, panelX + 26, y + 4, panelW - 26, 30, 3) + 14;
  });
  ctx.globalAlpha = 1;
}

export function renderFrame(ctx: CanvasRenderingContext2D, input: RenderInput, t: number) {
  const { scenes } = input;
  const total = scenes.length ? scenes[scenes.length - 1].start + scenes[scenes.length - 1].duration : 0;
  let idx = scenes.findIndex((s) => t >= s.start && t < s.start + s.duration);
  if (idx === -1) idx = t >= total ? scenes.length - 1 : 0;
  const scene = scenes[idx];
  if (!scene) {
    background(ctx);
    return;
  }
  const local = t - scene.start;
  const prevFocus = idx > 0 ? scenes[idx - 1].focus : 0;

  if (scene.kind === "intro") drawIntro(ctx, input, scene, local);
  else if (scene.kind === "outro") drawOutro(ctx, input, scene, local);
  else drawBrowserScene(ctx, input, scene, prevFocus, local);

  // Crossfade in from black at each scene boundary.
  const fadeIn = clamp(local / 0.35, 0, 1);
  if (fadeIn < 1) {
    ctx.fillStyle = `rgba(15,23,42,${1 - fadeIn})`;
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
  }

  subtitles(ctx, scene.narration, clamp(local / scene.duration, 0, 0.999));

  // Progress bar
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, VIDEO_H - 6, VIDEO_W, 6);
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(0, VIDEO_H - 6, VIDEO_W * clamp(t / Math.max(total, 0.001), 0, 1), 6);
}

export function estimateDuration(narration: string): number {
  const words = narration.split(/\s+/).filter(Boolean).length;
  return Math.max(4, words / 2.6 + 1.2);
}
