/**
 * Tabela de intervalos (em semitons) para acordes.
 * O `root` (nota-raiz do pad) + cada intervalo = nota MIDI enviada.
 * `single` e `custom` são tratados à parte:
 *   - single: usa só a nota-raiz
 *   - custom: usa o array `chordIntervals` salvo no pad
 */

export type ChordType =
  | 'single'
  | 'maj'
  | 'min'
  | 'dim'
  | 'aug'
  | 'sus2'
  | 'sus4'
  | '7'
  | 'maj7'
  | 'm7'
  | 'dim7'
  | 'm7b5'
  | 'custom';

/** Intervalos das tríades/tétrades clássicas. `single` e `custom` não têm entrada aqui. */
export const CHORD_INTERVALS: Record<Exclude<ChordType, 'single' | 'custom'>, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
};

/** Abreviação mostrada no canto superior esquerdo do pad. Vazio = sem badge (pad single). */
export const CHORD_BADGE: Record<ChordType, string> = {
  single: '',
  maj: 'maj',
  min: 'min',
  dim: 'dim',
  aug: 'aug',
  sus2: 'sus2',
  sus4: 'sus4',
  '7': '7',
  maj7: 'maj7',
  m7: 'm7',
  dim7: 'dim7',
  m7b5: 'm7b5',
  custom: '★',
};

/**
 * Resolve quais notas MIDI um pad dispara.
 * Filtra notas fora de 0–127 (ex.: acorde em nota 126 com intervalo 7 estoura) e devolve
 * sempre um array não vazio (`[rootNote]` em caso de intervalos inválidos).
 */
export function resolveChordNotes(
  rootNote: number,
  type: ChordType,
  customIntervals?: number[],
): number[] {
  if (type === 'single') return [rootNote];
  const intervals =
    type === 'custom'
      ? (customIntervals ?? [0])
      : (CHORD_INTERVALS[type] ?? [0]);
  const notes = intervals
    .map((i) => rootNote + i)
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 127);
  return notes.length > 0 ? notes : [rootNote];
}
