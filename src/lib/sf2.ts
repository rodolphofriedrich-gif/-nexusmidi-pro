/**
 * Leitura dos instrumentos (presets) de um arquivo SoundFont 2.
 * Só percorre os cabeçalhos da estrutura RIFF até o chunk `phdr`, então não copia nem decodifica
 * as amostras de áudio (que podem ter centenas de MB).
 */

export interface Sf2Preset {
  name: string;
  /** Banco do preset. 0–127 = melódicos; 128 = kits de bateria (padrão General MIDI/SF2). */
  bank: number;
  /** Número do programa (0–127). */
  program: number;
}

const PHDR_RECORD_SIZE = 38;
const NAME_SIZE = 20;
export const DRUM_BANK = 128;

const fourCC = (view: DataView, offset: number): string =>
  String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );

function readName(view: DataView, offset: number): string {
  let out = '';
  for (let i = 0; i < NAME_SIZE; i++) {
    const code = view.getUint8(offset + i);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out.trim();
}

/** Devolve os presets do SF2, ordenados por banco e programa. Arquivo inválido → lista vazia. */
export function parseSf2Presets(buffer: ArrayBuffer): Sf2Preset[] {
  const view = new DataView(buffer);
  const length = view.byteLength;
  if (length < 12 || fourCC(view, 0) !== 'RIFF' || fourCC(view, 8) !== 'sfbk') return [];

  // Percorre os chunks de nível superior procurando LIST/pdta.
  let offset = 12;
  while (offset + 8 <= length) {
    const id = fourCC(view, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'LIST' && body + 4 <= length && fourCC(view, body) === 'pdta') {
      const end = Math.min(body + size, length);
      return readPhdr(view, body + 4, end);
    }
    offset = body + size + (size % 2); // chunks têm alinhamento par
  }
  return [];
}

function readPhdr(view: DataView, start: number, end: number): Sf2Preset[] {
  let offset = start;
  while (offset + 8 <= end) {
    const id = fourCC(view, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'phdr') {
      const records = Math.floor(Math.min(size, end - body) / PHDR_RECORD_SIZE);
      const presets: Sf2Preset[] = [];
      // O último registro é o terminador "EOP" e não é um instrumento.
      for (let i = 0; i < records - 1; i++) {
        const at = body + i * PHDR_RECORD_SIZE;
        presets.push({
          name: readName(view, at),
          program: view.getUint16(at + NAME_SIZE, true),
          bank: view.getUint16(at + NAME_SIZE + 2, true),
        });
      }
      return presets
        .filter((p) => p.program <= 127)
        .sort((a, b) => a.bank - b.bank || a.program - b.program);
    }
    offset = body + size + (size % 2);
  }
  return [];
}

export const isDrumBank = (bank: number): boolean => bank >= DRUM_BANK;

/** Resumo para exibir na biblioteca. */
export function summarizePresets(presets: readonly Sf2Preset[]): { total: number; drums: number } {
  const drums = presets.filter((p) => isDrumBank(p.bank)).length;
  return { total: presets.length, drums };
}
