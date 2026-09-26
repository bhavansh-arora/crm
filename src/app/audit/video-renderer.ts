import type { VideoScene } from "@/lib/site-audit/types";

// Draws one frame of the walkthrough video onto a 1280x720 canvas for a given
// time `t` (seconds). Stateless per frame, so preview and recording are
// identical. Visual language: deep ink backgrounds, champagne-gold accents,
// serif display type, restrained motion.

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
  fonts: { display: string; body: string };
};

const INK_2 = "#131c2e";
const GOLD = "#c8a15a";
const GOLD_SOFT = "#e0c78f";
const IVORY = "#faf8f3";
const MUTED = "rgba(250,248,243,0.62)";
const ROSE = "#e5484d";

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const reveal = (local: number, at: number, dur = 0.6) => easeOut(clamp((local - at) / dur, 0, 1));

function scoreColor(score: number) {
  return score >= 75 ? "#3fb68b" : score >= 50 ? "#e0a93b" : ROSE;
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
  let lines = wrapLines(ctx, text, maxWidth);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…";
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  // Letter-spaced small caps for eyebrows (canvas letterSpacing isn't universal).
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return cx - x;
}

function spacedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number) {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return w - spacing;
}

function background(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, VIDEO_W, VIDEO_H);
  g.addColorStop(0, "#0a1020");
  g.addColorStop(1, INK_2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
  // Soft gold glow, top-left.
  const r = ctx.createRadialGradient(140, 40, 0, 140, 40, 700);
  r.addColorStop(0, "rgba(200,161,90,0.13)");
  r.addColorStop(1, "rgba(200,161,90,0)");
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
}

function vignette(ctx: CanvasRenderingContext2D) {
  const v = ctx.createRadialGradient(VIDEO_W / 2, VIDEO_H / 2, VIDEO_H * 0.45, VIDEO_W / 2, VIDEO_H / 2, VIDEO_W * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
}

// Blurred, darkened screenshot hero as a backdrop for title cards.
function screenshotBackdrop(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, t: number) {
  background(ctx);
  if (img) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.filter = "blur(18px) brightness(0.4) saturate(0.8)";
    const scale = (VIDEO_W / img.width) * (1.12 + t * 0.008);
    const srcH = Math.min(img.height, VIDEO_H / scale);
    ctx.drawImage(img, 0, 0, img.width, srcH, -60, -40, img.width * scale, srcH * scale);
    ctx.restore();
    ctx.fillStyle = "rgba(11,18,32,0.55)";
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
  }
  vignette(ctx);
}

function scoreRing(ctx: CanvasRenderingContext2D, f: RenderInput["fonts"], cx: number, cy: number, r: number, score: number, grade: string, progress: number) {
  const p = ease(clamp(progress, 0, 1));
  const shown = Math.round(score * p);
  // Hairline outer ring
  ctx.strokeStyle = "rgba(200,161,90,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 18, 0, Math.PI * 2);
  ctx.stroke();
  // Track
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(250,248,243,0.08)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // Value arc
  ctx.strokeStyle = scoreColor(score);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * shown) / 100);
  ctx.stroke();
  ctx.lineCap = "butt";

  ctx.textAlign = "center";
  ctx.fillStyle = IVORY;
  ctx.font = `600 ${Math.round(r * 0.78)}px ${f.display}`;
  ctx.fillText(String(shown), cx, cy + r * 0.2);
  ctx.textAlign = "left";
  ctx.fillStyle = GOLD;
  ctx.font = `600 ${Math.round(r * 0.12)}px ${f.body}`;
  const label = `GRADE ${grade}`;
  spaced(ctx, label, cx - spacedWidth(ctx, label, 2.5) / 2, cy + r * 0.45, 2.5);
  ctx.fillStyle = "rgba(250,248,243,0.45)";
  ctx.font = `500 ${Math.round(r * 0.095)}px ${f.body}`;
  const sub = "OUT OF 100";
  spaced(ctx, sub, cx - spacedWidth(ctx, sub, 2) / 2, cy + r * 0.62, 2);
}

function subtitles(ctx: CanvasRenderingContext2D, f: RenderInput["fonts"], narration: string, progress: number) {
  const words = narration.split(/\s+/).filter(Boolean);
  if (!words.length) return;
  const chunkSize = 12;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) chunks.push(words.slice(i, i + chunkSize).join(" "));
  const text = chunks[Math.min(chunks.length - 1, Math.floor(progress * chunks.length))];
  ctx.font = `400 23px ${f.body}`;
  const lines = wrapLines(ctx, text, 1000).slice(0, 2);
  const lh = 32;
  const h = lines.length * lh + 22;
  const y = VIDEO_H - 30 - h;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 48;
  ctx.fillStyle = "rgba(7,11,20,0.78)";
  roundRect(ctx, (VIDEO_W - w) / 2, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(200,161,90,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = IVORY;
  ctx.textAlign = "center";
  lines.forEach((l, i) => ctx.fillText(l, VIDEO_W / 2, y + 34 + i * lh));
  ctx.textAlign = "left";
}

function drawIntro(ctx: CanvasRenderingContext2D, input: RenderInput, scene: TimedScene, local: number) {
  const f = input.fonts;
  screenshotBackdrop(ctx, input.screenshot, local);

  ctx.globalAlpha = reveal(local, 0.2);
  ctx.fillStyle = GOLD;
  ctx.font = `600 15px ${f.body}`;
  spaced(ctx, "WEBSITE AUDIT  ·  CONFIDENTIAL REVIEW", 96, 212, 3.2);

  ctx.globalAlpha = reveal(local, 0.45, 0.8);
  ctx.fillStyle = IVORY;
  ctx.font = `600 70px ${f.display}`;
  const endY = drawWrapped(ctx, input.domain, 96, 300, 620, 80, 2);

  // Gold rule draws in
  const rule = reveal(local, 0.9, 0.9);
  ctx.globalAlpha = 1;
  ctx.fillStyle = GOLD;
  ctx.fillRect(96, endY - 20, 120 * rule, 2);

  ctx.globalAlpha = reveal(local, 1.1);
  ctx.font = `italic 500 27px ${f.display}`;
  ctx.fillStyle = MUTED;
  const sub = scene.title && !/^website review/i.test(scene.title) ? scene.title : "An honest look at what's costing you customers";
  drawWrapped(ctx, sub, 96, endY + 32, 600, 38, 2);

  if (input.agencyName) {
    ctx.globalAlpha = reveal(local, 1.4);
    ctx.font = `500 14px ${f.body}`;
    ctx.fillStyle = "rgba(250,248,243,0.5)";
    spaced(ctx, "PREPARED BY", 96, 596, 2.5);
    ctx.font = `600 22px ${f.display}`;
    ctx.fillStyle = IVORY;
    ctx.fillText(input.agencyName, 96, 628);
  }

  ctx.globalAlpha = reveal(local, 0.6, 0.8);
  scoreRing(ctx, f, 985, 345, 145, input.score, input.grade, (local - 0.8) / 2.2);
  ctx.globalAlpha = 1;
}

function drawOutro(ctx: CanvasRenderingContext2D, input: RenderInput, scene: TimedScene, local: number) {
  const f = input.fonts;
  screenshotBackdrop(ctx, input.screenshot, local);

  ctx.globalAlpha = reveal(local, 0.1);
  scoreRing(ctx, f, 250, 320, 118, input.score, input.grade, 1);

  ctx.globalAlpha = reveal(local, 0.3);
  ctx.fillStyle = GOLD;
  ctx.font = `600 15px ${f.body}`;
  spaced(ctx, "THE PATH FORWARD", 470, 150, 3.2);
  ctx.fillStyle = IVORY;
  ctx.font = `600 44px ${f.display}`;
  let y = drawWrapped(ctx, scene.title, 470, 208, 720, 54, 2) + 6;

  const points = scene.bullets?.length ? scene.bullets : input.outroPoints;
  ctx.font = `400 22px ${f.body}`;
  points.slice(0, 4).forEach((p, i) => {
    ctx.globalAlpha = reveal(local, 0.9 + i * 0.45);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(482, y + 22, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(477, y + 22);
    ctx.lineTo(481, y + 26);
    ctx.lineTo(488, y + 18);
    ctx.stroke();
    ctx.fillStyle = "rgba(250,248,243,0.9)";
    y = drawWrapped(ctx, p, 506, y + 30, 700, 30, 2) + 12;
  });

  if (input.agencyName || input.agencyContact) {
    ctx.globalAlpha = reveal(local, 1.6, 0.8);
    const cy = 548;
    const g = ctx.createLinearGradient(470, cy, 1210, cy + 96);
    g.addColorStop(0, "rgba(200,161,90,0.20)");
    g.addColorStop(1, "rgba(200,161,90,0.06)");
    ctx.fillStyle = g;
    roundRect(ctx, 470, cy, 740, 96, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(200,161,90,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = IVORY;
    ctx.font = `600 27px ${f.display}`;
    ctx.fillText(input.agencyName ? `Let ${input.agencyName} fix this for you` : "Let's fix this together", 500, cy + 42);
    if (input.agencyContact) {
      ctx.font = `500 19px ${f.body}`;
      ctx.fillStyle = GOLD_SOFT;
      ctx.fillText(input.agencyContact, 500, cy + 74);
    }
  }
  ctx.globalAlpha = 1;
}

function drawBrowserScene(
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  scene: TimedScene,
  sceneNumber: number,
  sceneCount: number,
  prevFocus: number,
  local: number
) {
  const f = input.fonts;
  background(ctx);
  const img = input.screenshot;
  const isMobileShot = !!img && img.width < 800;
  const frameW = isMobileShot ? 340 : 780;
  const frameX = isMobileShot ? 170 : 48;
  const frameY = 44;
  const frameH = 552;
  const barH = isMobileShot ? 26 : 40;
  const viewW = frameW - 2;
  const viewH = frameH - barH - 1;
  const viewX = frameX + 1;
  const viewY = frameY + barH;
  const isIssue = scene.kind === "issue";

  // Frame shadow + body
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#1a2336";
  roundRect(ctx, frameX, frameY, frameW, frameH, isMobileShot ? 26 : 14);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(250,248,243,0.10)";
  ctx.lineWidth = 1;
  roundRect(ctx, frameX, frameY, frameW, frameH, isMobileShot ? 26 : 14);
  ctx.stroke();

  if (!isMobileShot) {
    ["#5b6475", "#5b6475", "#5b6475"].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(frameX + 22 + i * 17, frameY + barH / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "rgba(250,248,243,0.06)";
    roundRect(ctx, frameX + 180, frameY + 9, frameW - 360, barH - 18, 11);
    ctx.fill();
    ctx.fillStyle = "rgba(250,248,243,0.6)";
    ctx.font = `500 13px ${f.body}`;
    ctx.textAlign = "center";
    ctx.fillText(input.domain, frameX + frameW / 2, frameY + barH / 2 + 5);
    ctx.textAlign = "left";
  } else {
    ctx.fillStyle = "rgba(250,248,243,0.2)";
    roundRect(ctx, frameX + frameW / 2 - 36, frameY + 10, 72, 6, 3);
    ctx.fill();
  }

  ctx.save();
  roundRect(ctx, viewX, viewY, viewW, viewH, isMobileShot ? 22 : 12);
  ctx.clip();
  ctx.fillStyle = "#fff";
  ctx.fillRect(viewX, viewY, viewW, viewH);
  let focusScreenY = viewY + viewH * 0.35;
  if (img) {
    const zoom = 1 + 0.035 * clamp(local / Math.max(scene.duration, 1), 0, 1);
    const scale = (viewW / img.width) * zoom;
    const pageH = img.height * scale;
    const maxScroll = Math.max(0, pageH - viewH);
    const target = (fc: number) => clamp(fc * pageH - viewH * 0.35, 0, maxScroll);
    const move = ease(clamp(local / 1.6, 0, 1));
    const drift = Math.min(36, maxScroll) * clamp((local - 1.6) / Math.max(scene.duration - 1.6, 1), 0, 1);
    const scrollY = clamp(target(prevFocus) + (target(scene.focus) - target(prevFocus)) * move + drift, 0, maxScroll);
    const offsetX = (viewW - img.width * scale) / 2;
    ctx.drawImage(img, viewX + offsetX, viewY - scrollY, img.width * scale, pageH);
    focusScreenY = viewY + clamp(scene.focus * pageH - scrollY, 40, viewH - 40);

    if (maxScroll > 0) {
      const barLen = Math.max(30, (viewH / pageH) * viewH);
      ctx.fillStyle = "rgba(11,18,32,0.35)";
      roundRect(ctx, viewX + viewW - 7, viewY + 4 + (scrollY / maxScroll) * (viewH - barLen - 8), 4, barLen, 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "#94a3b8";
    ctx.font = `500 22px ${f.body}`;
    ctx.textAlign = "center";
    ctx.fillText(input.domain, viewX + viewW / 2, viewY + viewH / 2);
    ctx.textAlign = "left";
  }

  // Spotlight: dim everything except a band around the section being discussed.
  const spot = reveal(local, 1.5, 0.7);
  if (spot > 0) {
    const bandH = isMobileShot ? 150 : 190;
    const top = clamp(focusScreenY - bandH * 0.45, viewY + 8, viewY + viewH - bandH - 8);
    ctx.fillStyle = `rgba(7,11,20,${0.42 * spot})`;
    ctx.fillRect(viewX, viewY, viewW, top - viewY);
    ctx.fillRect(viewX, top + bandH, viewW, viewY + viewH - top - bandH);
    ctx.strokeStyle = isIssue ? `rgba(229,72,77,${0.95 * spot})` : `rgba(200,161,90,${0.95 * spot})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    roundRect(ctx, viewX + 12, top, viewW - 24, bandH, 10);
    ctx.stroke();
    if (isIssue) {
      // Marker tag on the band
      ctx.fillStyle = `rgba(229,72,77,${spot})`;
      roundRect(ctx, viewX + 24, top - 13, 92, 26, 13);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `700 12px ${f.body}`;
      spaced(ctx, "ISSUE", viewX + 44, top + 5, 2);
    }
  }
  ctx.restore();

  // Side panel
  const panelX = isMobileShot ? 580 : 880;
  const panelW = VIDEO_W - panelX - 56;
  ctx.globalAlpha = reveal(local, 0.25);

  ctx.fillStyle = GOLD;
  ctx.font = `500 30px ${f.display}`;
  ctx.fillText(String(sceneNumber).padStart(2, "0"), panelX, 96);
  const nw = ctx.measureText(String(sceneNumber).padStart(2, "0")).width;
  ctx.fillStyle = "rgba(250,248,243,0.35)";
  ctx.font = `400 16px ${f.body}`;
  ctx.fillText(`/ ${String(sceneCount).padStart(2, "0")}`, panelX + nw + 8, 96);

  const label = isIssue ? "ISSUE FOUND" : "WALKTHROUGH";
  ctx.font = `700 12px ${f.body}`;
  const lw = spacedWidth(ctx, label, 2.4) + 26;
  ctx.strokeStyle = isIssue ? "rgba(229,72,77,0.8)" : "rgba(200,161,90,0.7)";
  ctx.lineWidth = 1;
  roundRect(ctx, panelX, 122, lw, 28, 14);
  ctx.stroke();
  ctx.fillStyle = isIssue ? "#ff8a8d" : GOLD_SOFT;
  spaced(ctx, label, panelX + 13, 141, 2.4);

  ctx.globalAlpha = reveal(local, 0.45, 0.7);
  ctx.fillStyle = IVORY;
  ctx.font = `600 36px ${f.display}`;
  let y = drawWrapped(ctx, scene.title, panelX, 208, panelW, 44, 4);

  ctx.fillStyle = GOLD;
  ctx.fillRect(panelX, y + 2, 48 * reveal(local, 0.8, 0.6), 2);
  y += 40;

  ctx.font = `400 20px ${f.body}`;
  (scene.bullets ?? []).slice(0, 3).forEach((b, i) => {
    ctx.globalAlpha = reveal(local, 1.0 + i * 0.4);
    ctx.fillStyle = isIssue ? "#ff8a8d" : GOLD;
    ctx.save();
    ctx.translate(panelX + 4, y - 6);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.restore();
    ctx.fillStyle = "rgba(250,248,243,0.86)";
    y = drawWrapped(ctx, b, panelX + 24, y, panelW - 24, 29, 3) + 16;
  });
  ctx.globalAlpha = 1;

  // Brand mark
  if (input.agencyName) {
    ctx.font = `600 12px ${f.body}`;
    ctx.fillStyle = "rgba(250,248,243,0.4)";
    const txt = input.agencyName.toUpperCase();
    spaced(ctx, txt, VIDEO_W - 56 - spacedWidth(ctx, txt, 2.4), 44, 2.4);
  }
  vignette(ctx);
}

export function renderFrame(ctx: CanvasRenderingContext2D, input: RenderInput, t: number) {
  const { scenes } = input;
  const total = scenes.length ? scenes[scenes.length - 1].start + scenes[scenes.length - 1].duration : 0;
  let idx = scenes.findIndex((s) => t >= s.start && t < s.start + s.duration);
  if (idx === -1) idx = t >= total ? scenes.length - 1 : 0;
  const scene = scenes[idx];
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  if (!scene) {
    background(ctx);
    return;
  }
  const local = t - scene.start;
  const prevFocus = idx > 0 ? scenes[idx - 1].focus : 0;

  if (scene.kind === "intro") drawIntro(ctx, input, scene, local);
  else if (scene.kind === "outro") drawOutro(ctx, input, scene, local);
  else {
    const body = scenes.filter((s) => s.kind !== "intro" && s.kind !== "outro");
    drawBrowserScene(ctx, input, scene, body.indexOf(scene) + 1, body.length, prevFocus, local);
  }

  // Dip from ink at each scene boundary.
  const fadeIn = clamp(local / 0.45, 0, 1);
  if (fadeIn < 1) {
    ctx.fillStyle = `rgba(11,18,32,${1 - easeOut(fadeIn)})`;
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
  }

  subtitles(ctx, input.fonts, scene.narration, clamp(local / scene.duration, 0, 0.999));

  // Hairline progress
  ctx.fillStyle = "rgba(250,248,243,0.08)";
  ctx.fillRect(0, VIDEO_H - 3, VIDEO_W, 3);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, VIDEO_H - 3, VIDEO_W * clamp(t / Math.max(total, 0.001), 0, 1), 3);
}

export function estimateDuration(narration: string): number {
  const words = narration.split(/\s+/).filter(Boolean).length;
  return Math.max(4.5, words / 2.5 + 1.4);
}
