// Our narrator voices. Each is a custom blend of Kokoro's Hindi speaker
// styles (which give English a natural Indian accent) with its most
// natural-sounding, highest-rated voices (Heart, Bella, Emma, Michael…) for
// human warmth and expressive intonation. "Accent" slides between the
// Indian styles and the natural-voice styles.

export type VoiceId = "meera" | "kavya" | "ananya" | "rohan" | "dev";

export type VoicePreset = {
  id: VoiceId;
  name: string;
  description: string;
  indian: [string, number][];
  natural: [string, number][];
  // Share of the Indian styles at the middle of the Accent slider.
  indianShare: number;
  gender: "female" | "male";
};

export const VOICES: VoicePreset[] = [
  {
    id: "meera",
    gender: "female",
    name: "Meera",
    description: "Warm, friendly and natural · female",
    indian: [["hf_alpha", 1]],
    natural: [["af_heart", 1]],
    indianShare: 0.45,
  },
  {
    id: "kavya",
    gender: "female",
    name: "Kavya",
    description: "Bright, energetic and upbeat · female",
    indian: [["hf_beta", 1]],
    natural: [
      ["af_bella", 0.75],
      ["af_heart", 0.25],
    ],
    indianShare: 0.4,
  },
  {
    id: "ananya",
    gender: "female",
    name: "Ananya",
    description: "Crisp, polished and professional · female",
    indian: [
      ["hf_alpha", 0.6],
      ["hf_beta", 0.4],
    ],
    natural: [["bf_emma", 1]],
    indianShare: 0.5,
  },
  {
    id: "rohan",
    gender: "male",
    name: "Rohan",
    description: "Confident, conversational · male",
    indian: [["hm_omega", 1]],
    natural: [
      ["am_michael", 0.65],
      ["am_fenrir", 0.35],
    ],
    indianShare: 0.45,
  },
  {
    id: "dev",
    gender: "male",
    name: "Dev",
    description: "Relaxed, easy-going · male",
    indian: [["hm_psi", 1]],
    natural: [
      ["am_puck", 0.6],
      ["bm_george", 0.4],
    ],
    indianShare: 0.4,
  },
];

// accent: 0 = most natural/neutral, 0.5 = the preset's tuned balance, 1 = strongest Indian accent.
export type VoiceSettings = { voice: VoiceId; accent: number; speed: number };

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = { voice: "meera", accent: 0.5, speed: 1.06 };

export function voicePreset(id: string): VoicePreset {
  return VOICES.find((v) => v.id === id) ?? VOICES[0];
}

export function voiceMix(settings: VoiceSettings): [string, number][] {
  const preset = voicePreset(settings.voice);
  const a = Math.min(1, Math.max(0, settings.accent));
  // Map the slider so its midpoint lands on the preset's tuned balance.
  const share = a <= 0.5 ? (a / 0.5) * preset.indianShare : preset.indianShare + ((a - 0.5) / 0.5) * (0.85 - preset.indianShare);
  return [
    ...preset.indian.map(([n, w]) => [n, w * share] as [string, number]),
    ...preset.natural.map(([n, w]) => [n, w * (1 - share)] as [string, number]),
  ];
}
