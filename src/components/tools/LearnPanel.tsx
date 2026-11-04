import { useSyncExternalStore } from 'react';
import { Link2, X } from 'lucide-react';
import { useStore } from '../../hooks/useStore';
import { tr } from '../../i18n';
import { LEARN_TARGETS, midiLearn } from '../../services/learnService';
import { learnStore } from '../../services/stores';
import { Card } from './ui';

const subscribeLearn = (callback: () => void): (() => void) => midiLearn.subscribe(callback);
const getArmed = (): string | null => midiLearn.getArmed();

export function LearnPanel() {
  const { mappings } = useStore(learnStore);
  const armed = useSyncExternalStore(subscribeLearn, getArmed, getArmed);

  return (
    <Card title="MIDI Learn" Icon={Link2} accent="text-cyan-400">
      <p className="text-[11px] leading-snug text-slate-400">
        {tr('Toque em "Aprender" e mexa em um knob ou fader do seu controlador. Ele passa a controlar aquele parâmetro.')}
      </p>
      <div className="flex flex-col gap-1.5">
        {LEARN_TARGETS.map((target) => {
          const mapping = mappings.find((m) => m.targetId === target.id);
          const isArmed = armed === target.id;
          return (
            <div key={target.id} className="flex items-center gap-2 rounded-lg border border-[#2e323b] bg-[#121316] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-200">{tr(target.label)}</span>
              {mapping && !isArmed && (
                <span className="rounded bg-cyan-950/60 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                  CC{mapping.cc}
                  {mapping.channel > 0 ? ` · CH${mapping.channel}` : ''}
                </span>
              )}
              <button
                type="button"
                onClick={() => (isArmed ? midiLearn.disarm() : midiLearn.arm(target.id))}
                className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition ${isArmed ? 'animate-pulse bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              >
                {isArmed ? tr('Mexa no controle...') : tr('Aprender')}
              </button>
              {mapping && (
                <button type="button" aria-label={tr('Remover mapeamento')} onClick={() => midiLearn.remove(target.id)} className="rounded p-1 text-slate-500 hover:bg-red-950/40 hover:text-red-400">
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {mappings.length > 0 && (
        <button type="button" onClick={() => midiLearn.clear()} className="self-start text-[10px] font-bold text-slate-500 underline hover:text-red-400">
          {tr('Remover todos os mapeamentos')}
        </button>
      )}
    </Card>
  );
}
