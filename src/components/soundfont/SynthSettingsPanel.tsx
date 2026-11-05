import { useEffect, useState } from 'react';
import { RotateCcw, Settings2, Volume2, Zap } from 'lucide-react';
import { tr } from '../../i18n';
import type { SynthSettings } from '../../services/synthTypes';

interface Props {
  settings: SynthSettings;
  onUpdateSetting: (key: keyof SynthSettings, value: number) => void;
  onReset: () => void;
  defaultTab?: TabId;
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

// Definido FORA do painel: se fosse criado dentro, cada movimento do slider remontaria o componente
// e o arraste seria interrompido.
function SliderRow({ label, value, min, max, step = 1, unit = '%', onChange }: SliderRowProps) {
  return (
    <div className="mb-3 flex flex-col gap-1">
      <label className="flex items-center justify-between text-[11px] font-bold text-[var(--text-main)]">
        <span>{label}</span>
        <span className="rounded border border-indigo-900/50 bg-indigo-950/50 px-1.5 py-0.5 font-mono text-indigo-400">
          {value}
          {unit}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-indigo-500"
      />
    </div>
  );
}

type TabId = 'fx' | 'sound' | 'system';

export function SynthSettingsPanel({ settings, onUpdateSetting, onReset, defaultTab = 'fx' }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const set = (key: keyof SynthSettings) => (value: number) => onUpdateSetting(key, value);
  const tabClass = (id: TabId, active: string) =>
    `flex h-7 items-center gap-1.5 rounded-md px-3 text-[10px] font-bold transition-colors ${activeTab === id ? active : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`;
  const sectionTitle = 'mb-3 border-b border-[var(--border-color)] pb-1 text-xs font-bold text-indigo-400';

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)]">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-app)] p-2">
        <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)] p-0.5">
          <button type="button" onClick={() => setActiveTab('fx')} className={tabClass('fx', 'bg-indigo-600 text-white')}>
            <Zap size={12} /> {tr('EFEITOS')}
          </button>
          <button type="button" onClick={() => setActiveTab('sound')} className={tabClass('sound', 'bg-indigo-600 text-white')}>
            <Volume2 size={12} /> {tr('TIMBRE')}
          </button>
          <button type="button" onClick={() => setActiveTab('system')} className={tabClass('system', 'bg-indigo-600 text-white')}>
            <Settings2 size={12} /> {tr('SISTEMA')}
          </button>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 rounded-md border border-rose-900/50 bg-rose-950/30 px-2 py-1 text-[10px] font-bold text-rose-400 transition-colors hover:bg-rose-900/50"
        >
          <RotateCcw size={12} /> {tr('Reset')}
        </button>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
        {activeTab === 'fx' && (
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <h3 className={sectionTitle}>{tr('Delay Customizado')}</h3>
              <SliderRow label={tr('Tempo (Delay)')} value={settings.delayTime} min={0} max={1000} step={10} unit="ms" onChange={set('delayTime')} />
              <SliderRow label={tr('Feedback')} value={settings.delayFeedback} min={0} max={90} onChange={set('delayFeedback')} />
              <SliderRow label={tr('Mix (Nível)')} value={settings.delayMix} min={0} max={100} onChange={set('delayMix')} />
            </div>
            <div>
              <h3 className={sectionTitle}>{tr('EQ & Compressor')}</h3>
              <SliderRow label={tr('EQ Graves (Low)')} value={settings.eqLow} min={-15} max={15} unit="dB" onChange={set('eqLow')} />
              <SliderRow label={tr('EQ Médios (Mid)')} value={settings.eqMid} min={-15} max={15} unit="dB" onChange={set('eqMid')} />
              <SliderRow label={tr('EQ Agudos (High)')} value={settings.eqHigh} min={-15} max={15} unit="dB" onChange={set('eqHigh')} />
              <SliderRow label={tr('Compressor Threshold')} value={settings.compThreshold} min={-60} max={0} unit="dB" onChange={set('compThreshold')} />
            </div>
          </div>
        )}

        {activeTab === 'sound' && (
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <h3 className={sectionTitle}>{tr('Envelope (ADSR)')}</h3>
              <SliderRow label={tr('Attack (Ataque)')} value={settings.attack} min={0} max={127} unit="" onChange={set('attack')} />
              <SliderRow label={tr('Release (Liberação)')} value={settings.release} min={0} max={127} unit="" onChange={set('release')} />
            </div>
            <div>
              <h3 className={sectionTitle}>{tr('Filtro & Modulação')}</h3>
              <SliderRow label={tr('Cutoff (Corte)')} value={settings.cutoff} min={0} max={127} unit="" onChange={set('cutoff')} />
              <SliderRow label={tr('Resonance (Ressonância)')} value={settings.resonance} min={0} max={127} unit="" onChange={set('resonance')} />
              <SliderRow label={tr('Vibrato (Profundidade)')} value={settings.vibrato} min={0} max={127} unit="" onChange={set('vibrato')} />
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <h3 className={sectionTitle}>{tr('Afinação e Pitch')}</h3>
              <SliderRow label={tr('Ajuste Fino (Fine Tune)')} value={settings.fineTune} min={-100} max={100} unit="ct" onChange={set('fineTune')} />
              <SliderRow label={tr('Alcance do Pitch Bend')} value={settings.pitchBendRange} min={1} max={24} unit="st" onChange={set('pitchBendRange')} />
            </div>
            <div>
              <h3 className={sectionTitle}>{tr('Desempenho (Mobile)')}</h3>
              <SliderRow label={tr('Polifonia Máxima')} value={settings.maxPolyphony} min={1} max={128} unit={` ${tr('vozes')}`} onChange={set('maxPolyphony')} />
              <p className="mt-2 text-[10px] leading-tight text-[var(--text-muted)]">
                {tr('Ao atingir o limite, a nota mais antiga é encerrada para dar lugar à nova. Reduza em celulares mais antigos.')}
              </p>
              <p className="mt-2 text-[10px] leading-tight text-[var(--text-muted)]">{tr('As configurações são salvas automaticamente.')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
