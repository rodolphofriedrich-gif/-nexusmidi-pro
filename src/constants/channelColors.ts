/** Uma cor por canal MIDI (como em uma DAW): ajuda a ver de relance qual canal toca cada instrumento. */
export const CHANNEL_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#64748B', '#94A3B8',
] as const;

/** Cor do canal (1–16). */
export const channelColor = (channel: number): string => CHANNEL_COLORS[(Math.max(1, Math.min(16, channel)) - 1) % 16];
