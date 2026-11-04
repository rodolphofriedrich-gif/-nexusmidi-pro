import type { Sf2Preset } from './sf2';

/** Monta um SF2 mínimo (RIFF sfbk → LIST pdta → phdr) só com os cabeçalhos de preset. */
export function makeSf2(presets: Sf2Preset[]): ArrayBuffer {
  const records = [...presets, { name: 'EOP', bank: 0, program: 0 }];
  const phdrSize = records.length * 38;
  const total = 12 + 8 + 4 + 8 + phdrSize;
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, total - 8, true);
  text(8, 'sfbk');
  text(12, 'LIST');
  view.setUint32(16, 4 + 8 + phdrSize, true);
  text(20, 'pdta');
  text(24, 'phdr');
  view.setUint32(28, phdrSize, true);
  records.forEach((p, i) => {
    const at = 32 + i * 38;
    text(at, p.name);
    view.setUint16(at + 20, p.program, true);
    view.setUint16(at + 22, p.bank, true);
  });
  return buffer;
}
