import type { FaceGeometry } from "./face-landmarks";

// Makes a real photo speak. The lower face is covered by a triangle mesh
// that's split along the lip line; as the narration gets louder the jaw and
// lower lip move down (the upper lip lifts a touch), opening a gap that we
// fill with a mouth interior — shadow, upper teeth, tongue. Each mesh
// triangle is drawn with its own affine transform, so the skin, lips and
// chin stretch naturally with the movement.

type Pt = { x: number; y: number };

const COLS = 14;
const ROWS_ABOVE = 3;
const ROWS_BELOW = 7;

type Prepared = {
  region: HTMLCanvasElement;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  mouthCenter: number;
  halfMouth: number;
  mouthWidth: number;
  seamAt: (x: number) => number;
};

const cache = new WeakMap<HTMLImageElement, Prepared>();

function interpY(points: Pt[], x: number): number {
  const pts = [...points].sort((a, b) => a.x - b.x);
  if (x <= pts[0].x) return pts[0].y;
  if (x >= pts[pts.length - 1].x) return pts[pts.length - 1].y;
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i].x) {
      const f = (x - pts[i - 1].x) / (pts[i].x - pts[i - 1].x || 1);
      return pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f;
    }
  }
  return pts[pts.length - 1].y;
}

function prepare(img: HTMLImageElement, g: FaceGeometry): Prepared {
  const hit = cache.get(img);
  if (hit) return hit;
  const mouthWidth = g.rightCorner.x - g.leftCorner.x;
  const x0 = Math.max(0, Math.min(g.jawLeft.x, g.leftCorner.x - mouthWidth * 0.9));
  const x1 = Math.min(g.width, Math.max(g.jawRight.x, g.rightCorner.x + mouthWidth * 0.9));
  const y0 = Math.max(0, g.noseBottom.y);
  const y1 = Math.min(g.height, g.chin.y + (g.chin.y - g.noseBottom.y) * 0.45);
  const region = document.createElement("canvas");
  region.width = Math.ceil(x1 - x0);
  region.height = Math.ceil(y1 - y0);
  region.getContext("2d")!.drawImage(img, x0, y0, region.width, region.height, 0, 0, region.width, region.height);
  const seamPts = g.upperInner.map((p, i) => ({ x: (p.x + g.lowerInner[i].x) / 2, y: (p.y + g.lowerInner[i].y) / 2 }));
  const cornerY = (g.leftCorner.y + g.rightCorner.y) / 2;
  const prepared: Prepared = {
    region,
    x0,
    y0,
    x1,
    y1,
    mouthCenter: (g.leftCorner.x + g.rightCorner.x) / 2,
    halfMouth: mouthWidth / 2,
    mouthWidth,
    seamAt: (x) => (x < g.leftCorner.x || x > g.rightCorner.x ? cornerY + (interpY(seamPts, x) - cornerY) * 0.3 : interpY(seamPts, x)),
  };
  cache.set(img, prepared);
  return prepared;
}

// Maps photo coordinates to the canvas: centre the face in the circle,
// with a slight, natural head movement.
function framing(g: FaceGeometry, cx: number, cy: number, r: number, t: number, level: number) {
  const faceH = g.chin.y - g.foreheadTop.y;
  const k = ((r * 2) * 0.55) / faceH;
  const fcx = (g.leftEye.x + g.rightEye.x + g.chin.x * 2) / 4;
  const fcy = (g.leftEye.y + g.rightEye.y) / 2 + (g.chin.y - (g.leftEye.y + g.rightEye.y) / 2) * 0.35;
  const rot = Math.sin(t * 0.8) * 0.012 + Math.sin(t * 1.9) * level * 0.006;
  const scale = k * (1 + Math.sin(t * 0.55) * 0.006);
  const dy = Math.sin(t * 1.3) * r * 0.004 - level * r * 0.004;
  // Never let the photo's edge show inside the circle.
  const cover = (r * 2 * 1.04) / Math.min(g.width, g.height);
  const sc = Math.max(scale, cover);
  const cos = Math.cos(rot) * sc;
  const sin = Math.sin(rot) * sc;
  let e = cx - (cos * fcx - sin * fcy);
  let f = cy + r * 0.04 + dy - (sin * fcx + cos * fcy);
  // Clamp so the image spans [cx-r, cx+r] × [cy-r, cy+r] (small rotation ignored).
  const pad = r * 0.02;
  e = Math.min(cx - r - pad, Math.max(cx + r + pad - g.width * sc, e));
  f = Math.min(cy - r - pad, Math.max(cy + r + pad - g.height * sc, f));
  // [a c e; b d f] for ctx.setTransform
  return { a: cos, b: sin, c: -sin, d: cos, e, f };
}

type M = ReturnType<typeof framing>;
const apply = (m: M, p: Pt): Pt => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f });

// Affine transform taking triangle (s0,s1,s2) onto (d0,d1,d2).
function triangleTransform(s: Pt[], d: Pt[]) {
  const [s0, s1, s2] = s;
  const [d0, d1, d2] = d;
  const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
  if (Math.abs(den) < 1e-6) return null;
  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den;
  const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den;
  const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den;
  const dd = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den;
  return { a, b, c, d: dd, e: d0.x - a * s0.x - c * s0.y, f: d0.y - b * s0.x - dd * s0.y };
}

function drawTriangle(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, s: Pt[], d: Pt[]) {
  const m = triangleTransform(s, d);
  if (!m) return;
  // Grow the clip by ~0.7px so neighbouring triangles don't show seams.
  const cx = (d[0].x + d[1].x + d[2].x) / 3;
  const cy = (d[0].y + d[1].y + d[2].y) / 3;
  ctx.save();
  ctx.beginPath();
  d.forEach((p, i) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const x = p.x + (dx / len) * 0.7;
    const y = p.y + (dy / len) * 0.7;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.clip();
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.drawImage(src, 0, 0);
  ctx.restore();
}

// Edge polylines are left corner → right corner; returns y at x.
function edgeY(edge: Pt[], x: number): number {
  for (let i = 1; i < edge.length; i++) {
    if (x <= edge[i].x) {
      const f = (x - edge[i - 1].x) / (edge[i].x - edge[i - 1].x || 1);
      return edge[i - 1].y + (edge[i].y - edge[i - 1].y) * Math.max(0, Math.min(1, f));
    }
  }
  return edge[edge.length - 1].y;
}

// Upper teeth from the centre outwards: [width as a share of the half-mouth,
// relative length, pointedness]. They get narrower and darker towards the
// corners because the dental arch curves away from the viewer.
const UPPER_TEETH: [number, number, number][] = [
  [0.27, 1, 0], // central incisor
  [0.2, 0.86, 0], // lateral incisor
  [0.17, 0.9, 0.45], // canine
  [0.14, 0.74, 0.15], // premolar (mostly in shadow)
];
const LOWER_TEETH: [number, number, number][] = [
  [0.2, 1, 0],
  [0.19, 0.95, 0],
  [0.18, 0.9, 0.35],
];

function toothPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, point: number, down: boolean) {
  // A rectangle whose free edge is rounded (and slightly pointed for canines).
  const r = Math.min(w * 0.42, h * 0.5);
  const dir = down ? 1 : -1;
  const tip = y + dir * h;
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, tip - dir * r);
  ctx.quadraticCurveTo(x + w, tip, x + w - r, tip + dir * point * r * 0.3);
  ctx.lineTo(x + w / 2, tip + dir * point * r * 0.6);
  ctx.lineTo(x + r, tip + dir * point * r * 0.3);
  ctx.quadraticCurveTo(x, tip, x, tip - dir * r);
  ctx.closePath();
}

function drawTeethRow(
  ctx: CanvasRenderingContext2D,
  edge: Pt[],
  midX: number,
  halfW: number,
  height: number,
  teeth: [number, number, number][],
  down: boolean,
  tone: number
) {
  // Scale the arch so it reaches ~80% of the way to the mouth corners.
  const total = teeth.reduce((a, [w]) => a + w, 0);
  const k = (halfW * 0.8) / total;
  for (const side of [-1, 1]) {
    let offset = 0;
    teeth.forEach(([w, len, point], i) => {
      const tw = w * k;
      const x = side < 0 ? midX - offset - tw : midX + offset;
      offset += tw;
      const cx = x + tw / 2;
      const y = edgeY(edge, cx) + (down ? -0.5 : 0.5);
      const h = height * len;
      const depth = 1 - (i / teeth.length) * 0.5; // farther teeth are in shadow
      const g = ctx.createLinearGradient(0, y, 0, y + (down ? h : -h));
      const c = (v: number) => Math.round(v * depth * tone);
      // Warm ivory, slightly translucent at the biting edge like real enamel.
      g.addColorStop(0, `rgb(${c(206)},${c(194)},${c(178)})`);
      g.addColorStop(0.45, `rgb(${c(226)},${c(217)},${c(200)})`);
      g.addColorStop(0.85, `rgb(${c(214)},${c(205)},${c(190)})`);
      g.addColorStop(1, `rgb(${c(176)},${c(168)},${c(160)})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      toothPath(ctx, x, y, tw, h, point, down);
      ctx.fill();
      // A faint seam where neighbouring teeth meet — no dark gaps.
      ctx.strokeStyle = `rgba(120,92,80,${0.16 * depth})`;
      ctx.lineWidth = Math.max(0.4, tw * 0.025);
      ctx.stroke();
    });
  }
}

function drawMouthInterior(ctx: CanvasRenderingContext2D, topEdge: Pt[], bottomEdge: Pt[], mouthW: number, open: number) {
  const left = topEdge[0];
  const right = topEdge[topEdge.length - 1];
  const midX = (left.x + right.x) / 2;
  const halfW = (right.x - left.x) / 2;
  const top = Math.min(...topEdge.map((p) => p.y));
  const bottom = Math.max(...bottomEdge.map((p) => p.y));
  const gap = bottom - top;

  // Tongue, low in the mouth.
  const tongueY = edgeY(bottomEdge, midX) - gap * 0.18;
  const tg = ctx.createRadialGradient(midX, tongueY - gap * 0.1, 1, midX, tongueY, halfW * 0.7);
  tg.addColorStop(0, "rgba(176,84,82,0.95)");
  tg.addColorStop(1, "rgba(110,40,40,0.9)");
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.ellipse(midX, tongueY + gap * 0.2, halfW * 0.62, Math.max(1, gap * 0.42), 0, Math.PI, 0);
  ctx.fill();

  // Lower teeth only show once the jaw is well open.
  if (open > 0.45) {
    const lh = Math.min(gap * 0.18, mouthW * 0.05) * Math.min(1, (open - 0.45) / 0.35);
    drawTeethRow(ctx, bottomEdge, midX, halfW * 0.7, lh, LOWER_TEETH, false, 0.78);
  }

  // Upper teeth hang from under the upper lip.
  const uh = Math.min(gap * 0.6, mouthW * 0.11);
  drawTeethRow(ctx, topEdge, midX, halfW, uh, UPPER_TEETH, true, 1);

  // Shadow from the upper lip onto the teeth, and darker mouth corners.
  const sh = ctx.createLinearGradient(0, top, 0, top + uh * 0.55);
  sh.addColorStop(0, "rgba(40,14,12,0.55)");
  sh.addColorStop(1, "rgba(40,14,12,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(left.x, top - 1, right.x - left.x, uh * 0.55 + 1);
  for (const c of [left, right]) {
    const cg = ctx.createRadialGradient(c.x, (top + bottom) / 2, 0, c.x, (top + bottom) / 2, halfW * 0.45);
    cg.addColorStop(0, "rgba(18,5,5,0.85)");
    cg.addColorStop(1, "rgba(18,5,5,0)");
    ctx.fillStyle = cg;
    ctx.fillRect(c.x - halfW * 0.45, top - 2, halfW * 0.9, gap + 4);
  }
}

export function drawTalkingPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  g: FaceGeometry,
  cx: number,
  cy: number,
  r: number,
  t: number,
  level: number
) {
  const P = prepare(img, g);
  const F = framing(g, cx, cy, r, t, level);

  // 1. The whole photo, framed.
  ctx.save();
  ctx.transform(F.a, F.b, F.c, F.d, F.e, F.f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();

  // Mouth opening in photo pixels; soft floor so small noise doesn't twitch.
  const open = Math.max(0, level - 0.1) / 0.9;
  const O = open * P.mouthWidth * 0.24;
  if (O < 0.4) return;

  const taper = (x: number) => {
    const u = (x - P.mouthCenter) / P.halfMouth;
    return Math.abs(u) >= 1 ? 0 : Math.sqrt(1 - u * u);
  };
  const jaw = (x: number) => Math.exp(-(((x - P.mouthCenter) / (P.halfMouth * 1.5)) ** 2));
  const below = (y: number) => (y <= g.chin.y ? 1 : Math.max(0, 1 - (y - g.chin.y) / (P.y1 - g.chin.y)));

  // Build the two meshes (source positions + displaced positions).
  const xs = Array.from({ length: COLS + 1 }, (_, i) => P.x0 + ((P.x1 - P.x0) * i) / COLS);
  const upper: { s: Pt; d: Pt }[][] = [];
  for (let i = 0; i <= ROWS_ABOVE; i++) {
    upper.push(
      xs.map((x) => {
        const seam = P.seamAt(x);
        const y = P.y0 + ((seam - P.y0) * i) / ROWS_ABOVE;
        const dy = -O * 0.1 * taper(x) * (i / ROWS_ABOVE);
        return { s: { x, y }, d: { x, y: y + dy } };
      })
    );
  }
  const lower: { s: Pt; d: Pt }[][] = [];
  for (let j = 0; j <= ROWS_BELOW; j++) {
    lower.push(
      xs.map((x) => {
        const seam = P.seamAt(x);
        const y = seam + ((P.y1 - seam) * j) / ROWS_BELOW;
        const dy = j === 0 ? O * taper(x) : O * Math.max(taper(x) * 0.95, jaw(x)) * below(y);
        return { s: { x, y }, d: { x, y: y + dy } };
      })
    );
  }

  // 2. Mouth interior, visible through the gap between the lips.
  const toDest = (p: Pt) => apply(F, p);
  const inside = xs.map((x, i) => ({ x, i })).filter(({ x }) => x > g.leftCorner.x && x < g.rightCorner.x);
  const topEdge = [g.leftCorner, ...inside.map(({ i }) => upper[ROWS_ABOVE][i].d), g.rightCorner].map(toDest);
  const bottomEdge = [g.leftCorner, ...inside.map(({ i }) => lower[0][i].d), g.rightCorner].map(toDest);
  ctx.save();
  ctx.beginPath();
  topEdge.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  [...bottomEdge].reverse().forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.closePath();
  const top = Math.min(...topEdge.map((p) => p.y));
  const bottom = Math.max(...bottomEdge.map((p) => p.y));
  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, "#2a0d0c");
  grad.addColorStop(1, "#140505");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.clip();
  // Teeth, tongue and depth: drawn in mouth-space so they scale with this
  // face's mouth and follow the lips as they move.
  drawMouthInterior(ctx, topEdge, bottomEdge, P.mouthWidth * Math.hypot(F.a, F.b), open);
  ctx.restore();

  // 3. The warped lower face on top.
  const src = (p: Pt): Pt => ({ x: p.x - P.x0, y: p.y - P.y0 });
  const drawMesh = (mesh: { s: Pt; d: Pt }[][]) => {
    for (let r0 = 0; r0 < mesh.length - 1; r0++) {
      for (let c0 = 0; c0 < COLS; c0++) {
        const a = mesh[r0][c0];
        const b = mesh[r0][c0 + 1];
        const c = mesh[r0 + 1][c0];
        const d = mesh[r0 + 1][c0 + 1];
        drawTriangle(ctx, P.region, [src(a.s), src(b.s), src(c.s)], [toDest(a.d), toDest(b.d), toDest(c.d)]);
        drawTriangle(ctx, P.region, [src(b.s), src(d.s), src(c.s)], [toDest(b.d), toDest(d.d), toDest(c.d)]);
      }
    }
  };
  drawMesh(upper);
  drawMesh(lower);
}
