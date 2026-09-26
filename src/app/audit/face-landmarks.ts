// Finds the face in an uploaded presenter photo using Google's open-source
// MediaPipe Face Landmarker (runs in the browser; the ~4 MB model is
// fetched once). We keep only the points the talking-photo renderer needs.

const VISION_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type Pt = { x: number; y: number };

// All coordinates are in the photo's pixel space.
export type FaceGeometry = {
  width: number;
  height: number;
  upperInner: Pt[]; // inner edge of the upper lip, corner → corner
  lowerInner: Pt[]; // inner edge of the lower lip, corner → corner
  upperOuter: Pt[];
  lowerOuter: Pt[];
  leftCorner: Pt;
  rightCorner: Pt;
  noseBottom: Pt;
  chin: Pt;
  jawLeft: Pt;
  jawRight: Pt;
  foreheadTop: Pt;
  leftEye: Pt;
  rightEye: Pt;
};

const IDX = {
  upperInner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
  lowerInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
  upperOuter: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
  lowerOuter: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let landmarkerPromise: Promise<any> | null = null;

function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import(/* webpackIgnore: true */ VISION_URL);
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
      return vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "IMAGE",
        numFaces: 1,
      });
    })();
    landmarkerPromise.catch(() => {
      landmarkerPromise = null;
    });
  }
  return landmarkerPromise;
}

export async function detectFace(img: HTMLImageElement): Promise<FaceGeometry | null> {
  const landmarker = await getLandmarker();
  const result = landmarker.detect(img);
  const lm: { x: number; y: number }[] | undefined = result?.faceLandmarks?.[0];
  if (!lm) return null;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const p = (i: number): Pt => ({ x: lm[i].x * w, y: lm[i].y * h });
  const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  return {
    width: w,
    height: h,
    upperInner: IDX.upperInner.map(p),
    lowerInner: IDX.lowerInner.map(p),
    upperOuter: IDX.upperOuter.map(p),
    lowerOuter: IDX.lowerOuter.map(p),
    leftCorner: p(61),
    rightCorner: p(291),
    noseBottom: p(2),
    chin: p(152),
    jawLeft: p(172),
    jawRight: p(397),
    foreheadTop: p(10),
    leftEye: mid(p(33), p(133)),
    rightEye: mid(p(362), p(263)),
  };
}
