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
  // Upper teeth: a soft, shaded band just under the upper lip, a little
  // narrower than the mouth (teeth don't reach the corners).
  const teethH = Math.min((bottom - top) * 0.26, P.mouthWidth * Math.hypot(F.a, F.b) * 0.065);
  const midX = (topEdge[0].x + topEdge[topEdge.length - 1].x) / 2;
  const teethEdge = topEdge.slice(1, -1).map((p) => ({ x: midX + (p.x - midX) * 0.86, y: p.y }));
  if (teethEdge.length > 1 && teethH > 0.6) {
    const tg = ctx.createLinearGradient(0, top, 0, top + teethH);
    tg.addColorStop(0, "rgba(120,96,86,0.55)");
    tg.addColorStop(0.35, "rgba(226,218,204,0.82)");
    tg.addColorStop(1, "rgba(196,184,170,0.7)");
    ctx.fillStyle = tg;
    ctx.beginPath();
    teethEdge.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    [...teethEdge].reverse().forEach((p, i, arr) => {
      // Rounded ends: shorter at the sides.
      const u = arr.length > 1 ? Math.abs(i / (arr.length - 1) - 0.5) * 2 : 0;
      ctx.lineTo(p.x, p.y + teethH * (1 - u * u * 0.6));
    });
    ctx.closePath();
    ctx.fill();
  }
  // Tongue
  const mid = toDest({ x: P.mouthCenter, y: P.seamAt(P.mouthCenter) + O * 0.8 });
  ctx.fillStyle = "rgba(150,62,60,0.75)";
  ctx.beginPath();
  ctx.ellipse(mid.x, mid.y, P.halfMouth * F.a * 0.55, Math.max(1, O * F.a * 0.3), 0, 0, Math.PI * 2);
  ctx.fill();
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
