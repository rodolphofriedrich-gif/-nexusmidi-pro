/** Uma cor por canal MIDI (como em uma DAW): ajuda a ver de relance qual canal toca cada instrumento. */
export const CHANNEL_COLORS = [
  '#F87171', '#FB923C', '#FBBF24', '#A3E635',
  '#4ADE80', '#2DD4BF', '#22D3EE', '#60A5FA',
  '#818CF8', '#A78BFA', '#C084FC', '#E879F9',
  '#F472B6', '#FB7185', '#94A3B8', '#D6D3D1',
] as const;

/** Cor do canal (1–16). */
export const channelColor = (channel: number): string => CHANNEL_COLORS[(Math.max(1, Math.min(16, channel)) - 1) % 16];
