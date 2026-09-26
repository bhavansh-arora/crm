// Our narrator voices. Each is a custom blend of Kokoro's Hindi speaker
// styles (which speak English with a natural Indian accent) plus a small
// share of a British speaker for crisper consonants. "Accent" slides the
// blend between the two; the defaults are tuned for a warm, polished,
// clearly Indian-English delivery.

export type VoiceId = "aarohi" | "arjun";

export type VoicePreset = {
  id: VoiceId;
  name: string;
  description: string;
  indian: [string, number][];
  clarity: string;
};

export const VOICES: VoicePreset[] = [
  {
    id: "aarohi",
    name: "Aarohi",
    description: "Warm, polished female voice · Indian English",
    indian: [
      ["hf_alpha", 0.65],
      ["hf_beta", 0.35],
    ],
    clarity: "bf_emma",
  },
  {
    id: "arjun",
    name: "Arjun",
    description: "Calm, confident male voice · Indian English",
    indian: [
      ["hm_omega", 0.6],
      ["hm_psi", 0.4],
    ],
    clarity: "bm_george",
  },
];

// authority: 0 = natural pitch, 1 = deepest. The voice is synthesised a
// little faster and played back slower, which lowers the pitch without
// changing the pace — a deeper, more commanding delivery.
export type VoiceSettings = { voice: VoiceId; accent: number; speed: number; authority: number };

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = { voice: "aarohi", accent: 0.85, speed: 0.92, authority: 0.6 };

// Playback-rate factor for a given authority (1 = unchanged, 0.88 = ~2 semitones lower).
export function depthFactor(settings: VoiceSettings): number {
  return 1 - 0.12 * Math.min(1, Math.max(0, settings.authority ?? 0));
}

export function voiceMix(settings: VoiceSettings): [string, number][] {
  const preset = VOICES.find((v) => v.id === settings.voice) ?? VOICES[0];
  const accent = Math.min(1, Math.max(0.5, settings.accent));
  return [...preset.indian.map(([n, w]) => [n, w * accent] as [string, number]), [preset.clarity, 1 - accent]];
}
