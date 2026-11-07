import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prefsStore } from '../services/stores';
import { en } from './en';
import { setLanguage, tr } from './index';

function listSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listSources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) && name !== 'en.ts' ? [path] : [];
  });
}

const SRC = join(process.cwd(), 'src');

/** Todos os textos passados a tr('...') e os rótulos de dados que também são traduzidos. */
function collectKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of listSources(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\btr\(\s*'((?:\\.|[^'\\])*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
  }
  const grab = (file: string, pattern: RegExp) => {
    for (const m of readFileSync(join(SRC, file), 'utf8').matchAll(pattern)) keys.add(m[1]);
  };
  grab('lib/scales.ts', /name: '([^']+)'/g);
  grab('constants/palettes.ts', /name: '([^']+)'/g);
  grab('services/learnService.ts', /label: '([^']+)'/g);
  
  // CORREÇÃO AQUI: As labels dos pads agora vivem no stores.ts
  grab('services/stores.ts', /label: '([^']+)'/g);
  grab('components/MidiPadGrid.tsx', /label: '([^']+)'/g);
  
  grab('components/tools/PerformancePanel.tsx', /(?:linear|soft|hard|fixed): '([^']+)'/g);
  grab('constants/gm.ts', /return '([^']+)'/g);
  const gm = readFileSync(join(SRC, 'constants/gm.ts'), 'utf8').match(/PRESET_CATEGORIES = \[([^\]]*)\]/);
  for (const m of (gm?.[1] ?? '').matchAll(/'([^']+)'/g)) keys.add(m[1]);
  return keys;
}

describe('i18n', () => {
  afterEach(() => setLanguage('pt-BR'));

  it('todo texto traduzível tem tradução em inglês', () => {
    const missing = [...collectKeys()].filter((key) => !(key in en));
    expect(missing).toEqual([]);
  });

  it('o dicionário não guarda traduções órfãs', () => {
    const used = collectKeys();
    const orphans = Object.keys(en).filter((key) => !used.has(key));
    expect(orphans).toEqual([]);
  });

  it('as traduções mantêm os mesmos {parâmetros} do original', () => {
    const params = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const [pt, english] of Object.entries(en)) expect(params(english)).toBe(params(pt));
  });

  it('em português devolve o texto original e interpola parâmetros', () => {
    setLanguage('pt-BR');
    expect(tr('Canal {n}', { n: 3 })).toBe('Canal 3');
    expect(tr('Texto sem tradução')).toBe('Texto sem tradução');
  });

  it('em inglês traduz e interpola; sem tradução cai no original', () => {
    setLanguage('en');
    expect(tr('Canal {n}', { n: 3 })).toBe('Channel 3');
    expect(tr('Texto sem tradução')).toBe('Texto sem tradução');
    expect(prefsStore.get().language).toBe('en');
  });

  it('parâmetro ausente é mantido visível em vez de virar "undefined"', () => {
    expect(tr('Canal {n}')).toBe('Canal {n}');
  });
});
