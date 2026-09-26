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
  mobileShot: HTMLImageElement | null;
  mobileChecklist: { label: string; ok: boolean }[];
  headline: { current: string; rewrite: string; problems: string[] };
  funnel: { id: "tof" | "mof" | "bof"; name: string; goal: string; score: number; line: string }[];
  biggestLeak: "tof" | "mof" | "bof";
  proof: { quotes: string[]; trust: string[]; points: string[] };
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
  const chunkCount = Math.ceil(words.length / chunkSize);
  const ci = Math.min(chunkCount - 1, Math.floor(progress * chunkCount));
  const chunk = words.slice(ci * chunkSize, ci * chunkSize + chunkSize);
  // Words already "spoken" in this chunk are bright; the rest are dimmed.
  const within = progress * chunkCount - ci;
  const spoken = Math.floor(within * chunk.length * 1.05);

  ctx.font = `400 23px ${f.body}`;
  const lines = wrapLines(ctx, chunk.join(" "), 1000).slice(0, 2);
  const lh = 32;
  const h = lines.length * lh + 22;
  const y = VIDEO_H - 30 - h;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 48;
  ctx.fillStyle = "rgba(7,11,20,0.8)";
  roundRect(ctx, (VIDEO_W - w) / 2, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(200,161,90,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();

  let wordIdx = 0;
  lines.forEach((line, li) => {
    const lw = ctx.measureText(line).width;
    let x = (VIDEO_W - lw) / 2;
    for (const word of line.split(" ")) {
      ctx.fillStyle = wordIdx < spoken ? IVORY : "rgba(250,248,243,0.42)";
      ctx.fillText(word, x, y + 34 + li * lh);
      x += ctx.measureText(word + " ").width;
      wordIdx++;
    }
  });
}

const CHAPTER_LABEL: Partial<Record<TimedScene["kind"], string>> = {
  mobile: "MOBILE FIRST IMPRESSION",
  headline: "HEADLINE & MESSAGE",
  funnel: "THE MARKETING FUNNEL",
  proof: "TRUST & TESTIMONIALS",
  walkthrough: "PAGE WALKTHROUGH",
  issue: "PAGE WALKTHROUGH",
};

function chapterLabel(ctx: CanvasRenderingContext2D, f: RenderInput["fonts"], kind: TimedScene["kind"], n: number, local: number) {
  const label = CHAPTER_LABEL[kind];
  if (!label) return;
  ctx.globalAlpha = reveal(local, 0.1);
  ctx.fillStyle = GOLD;
  ctx.fillRect(56, 38, 18, 2);
  ctx.font = `600 12px ${f.body}`;
  ctx.fillStyle = "rgba(250,248,243,0.6)";
  spaced(ctx, `CHAPTER ${String(n).padStart(2, "0")}  ·  ${label}`, 84, 43, 2.4);
  ctx.globalAlpha = 1;
}

function checkIcon(ctx: CanvasRenderingContext2D, x: number, y: number, ok: boolean) {
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = ok ? "#3fb68b" : ROSE;
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  if (ok) {
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x - 1, y + 4);
    ctx.lineTo(x + 6, y - 4);
  } else {
    ctx.moveTo(x - 4, y - 4);
    ctx.lineTo(x + 4, y + 4);
    ctx.moveTo(x + 4, y - 4);
    ctx.lineTo(x - 4, y + 4);
  }
  ctx.stroke();
}

function drawMobile(ctx: CanvasRenderingContext2D, input: RenderInput, scene: TimedScene, local: number) {
  const f = input.fonts;
  background(ctx);
  const img = input.mobileShot;

  // Phone slides up into place.
  const slide = reveal(local, 0.1, 1.1);
  // Fit the whole first screen (the fold is the bottom edge of the image).
  const screenH = 500;
  const screenW = img ? Math.round((img.width / img.height) * screenH) : 231;
  const phoneW = screenW + 24;
  const phoneH = screenH + 34;
  const px = 190;
  const py = 66 + (1 - slide) * 80;
  ctx.globalAlpha = slide;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = "#05070d";
  roundRect(ctx, px, py, phoneW, phoneH, 44);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(250,248,243,0.18)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, px, py, phoneW, phoneH, 44);
  ctx.stroke();

  const sx = px + 12;
  const sy = py + 17;
  ctx.save();
  roundRect(ctx, sx, sy, screenW, screenH, 34);
  ctx.clip();
  ctx.fillStyle = "#fff";
  ctx.fillRect(sx, sy, screenW, screenH);
  if (img) ctx.drawImage(img, sx, sy, screenW, screenH);
  else {
    ctx.fillStyle = "#94a3b8";
    ctx.font = `500 16px ${f.body}`;
    ctx.textAlign = "center";
    ctx.fillText(input.domain, sx + screenW / 2, sy + screenH / 2);
    ctx.textAlign = "left";
  }
  ctx.restore();
  // Notch
  ctx.fillStyle = "#05070d";
  roundRect(ctx, px + phoneW / 2 - 50, py + 10, 100, 22, 11);
  ctx.fill();
  ctx.globalAlpha = 1;

  // "The fold" marker along the bottom of the first screen.
  const fold = reveal(local, 1.4, 0.8);
  if (fold > 0) {
    const fy = sy + screenH - 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = `rgba(200,161,90,${fold})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px - 60, fy);
    ctx.lineTo(px - 60 + (phoneW + 120) * fold, fy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = fold;
    ctx.fillStyle = GOLD;
    ctx.font = `700 11px ${f.body}`;
    spaced(ctx, "THE FOLD", px + phoneW + 70, fy + 4, 2.4);
    ctx.fillStyle = "rgba(250,248,243,0.45)";
    ctx.font = `400 12px ${f.body}`;
    ctx.fillText("Below this line, visitors must scroll", px + phoneW + 70, fy + 22);
    ctx.globalAlpha = 1;
  }

  // Right panel: what a visitor needs on this screen.
  const panelX = 590;
  ctx.globalAlpha = reveal(local, 0.4);
  ctx.fillStyle = GOLD;
  ctx.font = `600 13px ${f.body}`;
  spaced(ctx, "ABOVE THE FOLD ON A PHONE", panelX, 150, 2.6);
  ctx.fillStyle = IVORY;
  ctx.font = `600 38px ${f.display}`;
  let y = drawWrapped(ctx, scene.title, panelX, 206, 620, 46, 2) + 22;
  ctx.font = `400 21px ${f.body}`;
  input.mobileChecklist.slice(0, 5).forEach((c, i) => {
    ctx.globalAlpha = reveal(local, 1.0 + i * 0.45);
    checkIcon(ctx, panelX + 11, y - 7, c.ok);
    ctx.fillStyle = c.ok ? "rgba(250,248,243,0.9)" : "rgba(250,248,243,0.9)";
    ctx.fillText(c.label, panelX + 36, y);
    ctx.fillStyle = c.ok ? "rgba(63,182,139,0.9)" : "rgba(255,138,141,0.95)";
    ctx.font = `600 13px ${f.body}`;
    const tag = c.ok ? "VISIBLE" : "MISSING";
    spaced(ctx, tag, panelX + 560 - spacedWidth(ctx, tag, 2), y - 1, 2);
    ctx.font = `400 21px ${f.body}`;
    ctx.fillStyle = "rgba(250,248,243,0.08)";
    ctx.fillRect(panelX, y + 16, 560, 1);
    y += 54;
  });
  ctx.globalAlpha = 1;
}

function drawHeadline(ctx: CanvasRenderingContext2D, input: RenderInput, scene: TimedScene, local: number) {
  const f = input.fonts;
  screenshotBackdrop(ctx, input.screenshot, local);
  const current = scene.currentHeadline || input.headline.current || "No clear headline";
  const rewrite = scene.rewrite || input.headline.rewrite;
  const x = 150;
  const maxW = 980;

  ctx.globalAlpha = reveal(local, 0.2);
  ctx.fillStyle = "rgba(250,248,243,0.5)";
  ctx.font = `600 13px ${f.body}`;
  spaced(ctx, "YOUR HEADLINE TODAY", x, 170, 2.6);

  ctx.globalAlpha = reveal(local, 0.4, 0.8);
  ctx.fillStyle = GOLD;
  ctx.font = `600 110px ${f.display}`;
  ctx.fillText("\u201C", x - 70, 268);
  ctx.fillStyle = "rgba(250,248,243,0.88)";
  ctx.font = `500 40px ${f.display}`;
  const lines = wrapLines(ctx, current, maxW).slice(0, 3);
  lines.forEach((l, i) => ctx.fillText(l, x, 236 + i * 52));
  const afterCurrent = 236 + lines.length * 52;

  // Strike through once the narrator has made the point (only if we have a rewrite).
  if (rewrite) {
    const strike = reveal(local, Math.min(3.2, scene.duration * 0.35), 0.7);
    if (strike > 0) {
      ctx.strokeStyle = ROSE;
      ctx.lineWidth = 3;
      lines.forEach((l, i) => {
        const w = ctx.measureText(l).width;
        ctx.beginPath();
        ctx.moveTo(x, 236 + i * 52 - 13);
        ctx.lineTo(x + w * strike, 236 + i * 52 - 13);
        ctx.stroke();
      });
    }
    const at = Math.min(4.0, scene.duration * 0.45);
    ctx.globalAlpha = reveal(local, at);
    ctx.fillStyle = GOLD;
    ctx.font = `600 13px ${f.body}`;
    spaced(ctx, "A STRONGER HEADLINE", x, afterCurrent + 50, 2.6);
    // Typewriter reveal.
    const chars = Math.floor(rewrite.length * clamp((local - at - 0.3) / 1.6, 0, 1));
    ctx.fillStyle = IVORY;
    ctx.font = `600 46px ${f.display}`;
    const rl = wrapLines(ctx, rewrite, maxW).slice(0, 2);
    let remaining = chars;
    rl.forEach((l, i) => {
      const part = l.slice(0, Math.max(0, remaining));
      remaining -= l.length + 1;
      ctx.fillText(part, x, afterCurrent + 110 + i * 56);
    });
  } else {
    ctx.globalAlpha = reveal(local, 1.8);
    ctx.font = `400 22px ${f.body}`;
    let y = afterCurrent + 50;
    input.headline.problems.slice(0, 3).forEach((p, i) => {
      ctx.globalAlpha = reveal(local, 1.8 + i * 0.5);
      ctx.fillStyle = "#ff8a8d";
      ctx.fillText("—", x, y);
      ctx.fillStyle = "rgba(250,248,243,0.85)";
      y = drawWrapped(ctx, p, x + 34, y, maxW - 34, 30, 2) + 12;
    });
  }
  ctx.globalAlpha = 1;
}

function drawFunnel(ctx: CanvasRenderingContext2D, input: RenderInput, scene: TimedScene, local: number) {
  const f = input.fonts;
  background(ctx);
  const cx = 360;
  const top = 120;
  const layerH = 150;
  const widths = [520, 390, 260, 150];
  // Highlight each stage in turn as the narrator walks down the funnel.
  const activeIdx = Math.min(2, Math.floor(clamp((local - 1) / Math.max(scene.duration - 2, 1), 0, 0.999) * 3));

  input.funnel.forEach((stage, i) => {
    const appear = reveal(local, 0.2 + i * 0.35, 0.7);
    ctx.globalAlpha = appear;
    const y = top + i * layerH;
    const w1 = widths[i];
    const w2 = widths[i + 1];
    const leak = stage.id === input.biggestLeak;
    const active = i === activeIdx;
    ctx.beginPath();
    ctx.moveTo(cx - w1 / 2, y);
    ctx.lineTo(cx + w1 / 2, y);
    ctx.lineTo(cx + w2 / 2, y + layerH - 10);
    ctx.lineTo(cx - w2 / 2, y + layerH - 10);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y, 0, y + layerH);
    const base = stage.score >= 75 ? "63,182,139" : stage.score >= 50 ? "224,169,59" : "229,72,77";
    g.addColorStop(0, `rgba(${base},${active ? 0.38 : 0.2})`);
    g.addColorStop(1, `rgba(${base},${active ? 0.22 : 0.1})`);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = active ? 2 : 1;
    ctx.strokeStyle = `rgba(${base},${active ? 0.95 : 0.5})`;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = IVORY;
    ctx.font = `700 13px ${f.body}`;
    const tag = stage.id.toUpperCase();
    spaced(ctx, tag, cx - spacedWidth(ctx, tag, 3) / 2, y + 40, 3);
    ctx.font = `600 40px ${f.display}`;
    ctx.fillText(String(stage.score), cx, y + 88);
    ctx.font = `400 13px ${f.body}`;
    ctx.fillStyle = "rgba(250,248,243,0.6)";
    ctx.fillText(stage.goal, cx, y + 112);
    ctx.textAlign = "left";

    if (leak) {
      const pulse = 0.5 + 0.5 * Math.sin(local * 4);
      ctx.fillStyle = `rgba(229,72,77,${0.75 + 0.25 * pulse})`;
      roundRect(ctx, cx + w1 / 2 - 8, y + layerH / 2 - 26, 118, 28, 14);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `700 11px ${f.body}`;
      spaced(ctx, "BIGGEST LEAK", cx + w1 / 2 + 6, y + layerH / 2 - 7, 1.8);
      // Drips falling out of the leaking stage.
      for (let d = 0; d < 3; d++) {
        const phase = (local * 0.8 + d / 3) % 1;
        ctx.fillStyle = `rgba(229,72,77,${0.8 * (1 - phase)})`;
        ctx.beginPath();
        ctx.arc(cx + w2 / 2 + 10 + d * 14, y + layerH - 10 + phase * 60, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  // Right panel: stage-by-stage verdicts.
  const panelX = 700;
  ctx.globalAlpha = reveal(local, 0.3);
  ctx.fillStyle = GOLD;
  ctx.font = `600 13px ${f.body}`;
  spaced(ctx, "TOF  ·  MOF  ·  BOF", panelX, 120, 2.6);
  ctx.fillStyle = IVORY;
  ctx.font = `600 36px ${f.display}`;
  let y = drawWrapped(ctx, scene.title, panelX, 172, 520, 44, 2) + 26;
  input.funnel.forEach((stage, i) => {
    ctx.globalAlpha = reveal(local, 0.9 + i * 0.5) * (i === activeIdx ? 1 : 0.55);
    ctx.fillStyle = i === activeIdx ? GOLD_SOFT : "rgba(250,248,243,0.7)";
    ctx.font = `600 18px ${f.display}`;
    ctx.fillText(stage.name, panelX, y);
    ctx.fillStyle = "rgba(250,248,243,0.82)";
    ctx.font = `400 17px ${f.body}`;
    y = drawWrapped(ctx, stage.line, panelX, y + 28, 520, 25, 3) + 22;
  });
  ctx.globalAlpha = 1;
}

function stars(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  for (let i = 0; i < 5; i++) {
    const cx = x + i * (size * 2.4);
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? size : size * 0.45;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      ctx.lineTo(cx + r * Math.cos(a), y + r * Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();
  }
}

function drawProof(ctx: CanvasRenderingContext2D, input: RenderInput, scene: TimedScene, local: number) {
  const f = input.fonts;
  background(ctx);
  const quote = scene.quote || input.proof.quotes[0] || "";

  ctx.globalAlpha = reveal(local, 0.2);
  ctx.fillStyle = GOLD;
  ctx.font = `600 13px ${f.body}`;
  spaced(ctx, "SOCIAL PROOF", 96, 130, 2.6);
  ctx.fillStyle = IVORY;
  ctx.font = `600 40px ${f.display}`;
  let y = drawWrapped(ctx, scene.title, 96, 188, 520, 48, 2) + 20;
  ctx.font = `400 20px ${f.body}`;
  const points = scene.bullets?.length ? scene.bullets : input.proof.points;
  points.slice(0, 3).forEach((b, i) => {
    ctx.globalAlpha = reveal(local, 1.2 + i * 0.4);
    ctx.fillStyle = GOLD;
    ctx.save();
    ctx.translate(100, y - 6);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.restore();
    ctx.fillStyle = "rgba(250,248,243,0.86)";
    y = drawWrapped(ctx, b, 120, y, 480, 29, 2) + 14;
  });

  // Trust chips
  if (input.proof.trust.length) {
    let cxp = 96;
    let cy = Math.max(y + 16, 440);
    ctx.font = `500 15px ${f.body}`;
    input.proof.trust.slice(0, 4).forEach((t, i) => {
      ctx.globalAlpha = reveal(local, 1.6 + i * 0.3);
      const w = ctx.measureText(t).width + 28;
      if (cxp + w > 620) {
        cxp = 96;
        cy += 44;
      }
      ctx.strokeStyle = "rgba(63,182,139,0.6)";
      ctx.lineWidth = 1;
      roundRect(ctx, cxp, cy, w, 32, 16);
      ctx.stroke();
      ctx.fillStyle = "rgba(250,248,243,0.85)";
      ctx.fillText(t, cxp + 14, cy + 21);
      cxp += w + 10;
    });
  }

  // Testimonial card (or an empty one making the absence obvious).
  const cardX = 680;
  const cardY = 150;
  const cardW = 520;
  const cardH = 380;
  const pop = reveal(local, 0.5, 0.9);
  ctx.globalAlpha = pop;
  ctx.save();
  ctx.translate(0, (1 - pop) * 30);
  if (quote) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = IVORY;
    roundRect(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = GOLD;
    stars(ctx, cardX + 44, cardY + 52, 11);
    ctx.fillStyle = "rgba(200,161,90,0.35)";
    ctx.font = `600 120px ${f.display}`;
    ctx.fillText("\u201C", cardX + cardW - 110, cardY + 110);
    ctx.fillStyle = "#1d2940";
    ctx.font = `italic 500 24px ${f.display}`;
    drawWrapped(ctx, quote, cardX + 44, cardY + 112, cardW - 88, 36, 6);
    ctx.fillStyle = "#64748b";
    ctx.font = `600 12px ${f.body}`;
    spaced(ctx, "FOUND ON YOUR WEBSITE", cardX + 44, cardY + cardH - 36, 2.2);
  } else {
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = "rgba(229,72,77,0.7)";
    ctx.lineWidth = 2;
    roundRect(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(250,248,243,0.12)";
    stars(ctx, cardX + cardW / 2 - 50, cardY + 140, 14);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff8a8d";
    ctx.font = `600 30px ${f.display}`;
    ctx.fillText("No testimonials found", cardX + cardW / 2, cardY + 220);
    ctx.fillStyle = "rgba(250,248,243,0.6)";
    ctx.font = `400 18px ${f.body}`;
    ctx.fillText("Nothing on the page proves others trust you.", cardX + cardW / 2, cardY + 256);
    ctx.textAlign = "left";
  }
  ctx.restore();
  ctx.globalAlpha = 1;
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
  const frameY = 66;
  const frameH = 530;
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

  // A guiding cursor glides in and taps the section being discussed.
  const cur = reveal(local, 0.6, 1.2);
  if (cur > 0) {
    const tx = viewX + viewW * 0.62;
    const ty = focusScreenY + 10;
    const sx = viewX + viewW + 40;
    const sy = viewY + viewH + 20;
    const cxp = sx + (tx - sx) * cur;
    const cyp = sy + (ty - sy) * cur;
    const tap = clamp((local - 1.8) / 0.5, 0, 1);
    if (tap > 0 && tap < 1) {
      ctx.strokeStyle = `rgba(200,161,90,${1 - tap})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cxp, cyp, 8 + tap * 26, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(cxp, cyp);
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 22);
    ctx.lineTo(6, 16);
    ctx.lineTo(11, 26);
    ctx.lineTo(15, 24);
    ctx.lineTo(10, 14);
    ctx.lineTo(18, 14);
    ctx.closePath();
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#0b1220";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

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
}

function drawScene(ctx: CanvasRenderingContext2D, input: RenderInput, idx: number, local: number) {
  const { scenes } = input;
  const scene = scenes[idx];
  const prevFocus = idx > 0 ? scenes[idx - 1].focus : 0;
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  switch (scene.kind) {
    case "intro":
      drawIntro(ctx, input, scene, local);
      break;
    case "outro":
      drawOutro(ctx, input, scene, local);
      break;
    case "mobile":
      drawMobile(ctx, input, scene, local);
      break;
    case "headline":
      drawHeadline(ctx, input, scene, local);
      break;
    case "funnel":
      drawFunnel(ctx, input, scene, local);
      break;
    case "proof":
      drawProof(ctx, input, scene, local);
      break;
    default: {
      const body = scenes.filter((s) => s.kind === "walkthrough" || s.kind === "issue");
      drawBrowserScene(ctx, input, scene, body.indexOf(scene) + 1, body.length, prevFocus, local);
    }
  }
  const label = CHAPTER_LABEL[scene.kind];
  if (label) {
    // Consecutive walkthrough/issue scenes share one chapter.
    const labels: string[] = [];
    for (let i = 0; i <= idx; i++) {
      const l = CHAPTER_LABEL[scenes[i].kind];
      if (l && labels[labels.length - 1] !== l) labels.push(l);
    }
    chapterLabel(ctx, input.fonts, scene.kind, labels.length, local);
  }
  vignette(ctx);
}

// The previous scene's final frame, cached for crossfades.
let fadeCache: { key: string; canvas: HTMLCanvasElement } | null = null;

const CROSSFADE = 0.6;

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

  drawScene(ctx, input, idx, local);

  if (idx > 0 && local < CROSSFADE && typeof document !== "undefined") {
    const prev = scenes[idx - 1];
    const key = `${idx}|${prev.start}|${prev.duration}|${prev.title}|${input.agencyName}`;
    if (!fadeCache || fadeCache.key !== key) {
      const off = fadeCache?.canvas ?? document.createElement("canvas");
      off.width = VIDEO_W;
      off.height = VIDEO_H;
      const octx = off.getContext("2d")!;
      drawScene(octx, input, idx - 1, prev.duration - 0.01);
      fadeCache = { key, canvas: off };
    }
    ctx.globalAlpha = 1 - easeOut(local / CROSSFADE);
    ctx.drawImage(fadeCache.canvas, 0, 0);
    ctx.globalAlpha = 1;
  } else if (idx === 0 && local < 0.6) {
    ctx.fillStyle = `rgba(11,18,32,${1 - easeOut(local / 0.6)})`;
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
