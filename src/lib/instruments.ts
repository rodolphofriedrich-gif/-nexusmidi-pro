import type { SoundFontPreset } from '../types/soundfont';
import { categoryOfProgram } from '../constants/gm';
import { isDrumBank, type Sf2Preset } from './sf2';

export interface LibraryRef {
  id: string;
  name: string;
}

/**
 * Junta os instrumentos das bibliotecas ATIVAS em uma única lista.
 * `activeIds` está em ordem de prioridade: se dois SoundFonts têm o mesmo banco+programa,
 * vence o que vem primeiro (é o mesmo critério que o motor de áudio usa para tocar).
 */
export function buildInstrumentList(
  activeIds: readonly string[],
  presetsById: Readonly<Record<string, readonly Sf2Preset[] | undefined>>,
  libraries: readonly LibraryRef[],
): SoundFontPreset[] {
  const nameOf = new Map(libraries.map((l) => [l.id, l.name] as const));
  const seen = new Set<string>();
  const out: SoundFontPreset[] = [];

  for (const libraryId of activeIds) {
    for (const p of presetsById[libraryId] ?? []) {
      const slot = `${p.bank}:${p.program}`;
      if (seen.has(slot)) continue;
      seen.add(slot);
      const isDrum = isDrumBank(p.bank);
      out.push({
        id: `${libraryId}:${slot}`,
        libraryId,
        libraryName: nameOf.get(libraryId) ?? libraryId,
        programNumber: p.program,
        bankNumber: p.bank,
        name: p.name || (isDrum ? `Drum Kit ${p.program}` : `Preset ${p.program}`),
        category: isDrum ? 'Baterias' : categoryOfProgram(p.program),
        isDrum,
      });
    }
  }

  return out.sort((a, b) => Number(a.isDrum) - Number(b.isDrum) || a.bankNumber - b.bankNumber || a.programNumber - b.programNumber);
}
