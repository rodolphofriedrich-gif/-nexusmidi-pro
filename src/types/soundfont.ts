/** Um instrumento (preset) realmente presente em um SoundFont importado. */
export interface SoundFontPreset {
  /** `${idDaBiblioteca}:${banco}:${programa}` */
  id: string;
  libraryId: string;
  libraryName: string;
  /** Programa MIDI (0–127). */
  programNumber: number;
  /** Banco do SF2: 0–127 melódico, 128 = kit de bateria. */
  bankNumber: number;
  name: string;
  category: string;
  isDrum: boolean;
}
