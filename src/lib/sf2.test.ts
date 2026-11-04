import { describe, expect, it } from 'vitest';
import { buildInstrumentList } from './instruments';
import { parseSf2Presets, summarizePresets } from './sf2';
import { makeSf2 } from './testSf2';

describe('parseSf2Presets', () => {
  it('lê nome, banco e programa e ignora o registro terminador', () => {
    const buffer = makeSf2([
      { name: 'Grand Piano', bank: 0, program: 0 },
      { name: 'Standard Kit', bank: 128, program: 0 },
      { name: 'Strings', bank: 0, program: 48 },
    ]);
    expect(parseSf2Presets(buffer)).toEqual([
      { name: 'Grand Piano', bank: 0, program: 0 },
      { name: 'Strings', bank: 0, program: 48 },
      { name: 'Standard Kit', bank: 128, program: 0 },
    ]);
  });

  it('arquivo que não é SF2 devolve lista vazia, sem lançar erro', () => {
    expect(parseSf2Presets(new ArrayBuffer(4))).toEqual([]);
    expect(parseSf2Presets(new Uint8Array(64).buffer)).toEqual([]);
  });

  it('resume quantos instrumentos e quantos kits de bateria existem', () => {
    const presets = parseSf2Presets(
      makeSf2([
        { name: 'A', bank: 0, program: 0 },
        { name: 'B', bank: 0, program: 1 },
        { name: 'Kit', bank: 128, program: 0 },
      ]),
    );
    expect(summarizePresets(presets)).toEqual({ total: 3, drums: 1 });
  });
});

describe('buildInstrumentList', () => {
  const libs = [
    { id: 'a', name: 'a.sf2' },
    { id: 'b', name: 'b.sf2' },
  ];
  const presets = {
    a: [{ name: 'Piano A', bank: 0, program: 0 }],
    b: [
      { name: 'Piano B', bank: 0, program: 0 },
      { name: 'Kit B', bank: 128, program: 0 },
    ],
  };

  it('sem bibliotecas ativas a lista é vazia (não inventa instrumentos)', () => {
    expect(buildInstrumentList([], presets, libs)).toEqual([]);
  });

  it('só lista os instrumentos das bibliotecas ativas', () => {
    const list = buildInstrumentList(['a'], presets, libs);
    expect(list.map((i) => i.name)).toEqual(['Piano A']);
  });

  it('instrumento repetido: vence a biblioteca de maior prioridade', () => {
    const list = buildInstrumentList(['b', 'a'], presets, libs);
    expect(list.find((i) => i.programNumber === 0 && !i.isDrum)?.libraryName).toBe('b.sf2');
    expect(list).toHaveLength(2);
  });

  it('baterias ficam na categoria "Baterias" e vêm depois dos melódicos', () => {
    const list = buildInstrumentList(['b'], presets, libs);
    expect(list.map((i) => [i.name, i.category])).toEqual([
      ['Piano B', 'Piano'],
      ['Kit B', 'Baterias'],
    ]);
  });
});
