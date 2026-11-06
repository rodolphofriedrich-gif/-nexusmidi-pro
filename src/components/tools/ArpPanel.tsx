import { Repeat } from 'lucide-react';
import { useStore } from '../../hooks/useStore';
import { tr } from '../../i18n';
import type { ArpPattern, ArpRate } from '../../lib/arpeggiator';
import { runtimeStore, toolsStore } from '../../services/stores';
import { Card, Field, RangeRow, Segmented, Toggle } from './ui';

export function ArpPanel() {
  const tools = useStore(toolsStore);
  const runtime = useStore(runtimeStore);
  const setArp = (patch: Partial<typeof tools.arp>) => toolsStore.set((t) => ({ ...t, arp: { ...t.arp, ...patch } }));

  const patterns: Array<{ id: ArpPattern; label: string }> = [
    { id: 'up', label: tr('Subindo') },
    { id: 'down', label: tr('Descendo') },
    { id: 'updown', label: tr('Sobe/Desce') },
    { id: 'random', label: tr('Aleatório') },
    { id: 'asPlayed', label: tr('Como tocado') },
  ];
  const rates: Array<{ id: ArpRate; label: string }> = (['1/4', '1/8', '1/16', '1/32'] as const).map((id) => ({ id, label: id }));

  return (
    <Card title={tr('Arpejador')} Icon={Repeat} accent="text-[var(--nexus-primary)]">
      <Toggle
        checked={runtime.arpEnabled}
        onChange={(arpEnabled) => runtimeStore.set({ arpEnabled })}
        label={tr('Arpejador ligado')}
        hint={tr('Segure uma ou mais teclas do piano para arpejar.')}
      />
      <Field label={tr('Padrão')}>
        <Segmented value={tools.arp.pattern} options={patterns} onChange={(pattern) => setArp({ pattern })} />
      </Field>
      <Field label={tr('Velocidade (nota)')}>
        <Segmented value={tools.arp.rate} options={rates} onChange={(rate) => setArp({ rate })} />
      </Field>
      <Field label={tr('Oitavas')}>
        <Segmented value={tools.arp.octaves} options={[1, 2, 3, 4].map((n) => ({ id: n, label: String(n) }))} onChange={(octaves) => setArp({ octaves })} />
      </Field>
      <RangeRow label={tr('Duração da nota (gate)')} value={Math.round(tools.arp.gate * 100)} min={10} max={100} unit="%" onChange={(v) => setArp({ gate: v / 100 })} />
      <Toggle checked={tools.arp.latch} onChange={(latch) => setArp({ latch })} label={tr('Latch (segurar)')} hint={tr('Mantém o arpejo ao soltar as teclas.')} />
    </Card>
  );
}
