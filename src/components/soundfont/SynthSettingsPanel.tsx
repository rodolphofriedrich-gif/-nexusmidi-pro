import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Settings2, Volume2, Zap, ChevronDown } from 'lucide-react';
import { tr } from '../../i18n';
import type { SynthSettings } from '../../services/synthTypes';
import { StudioSlider } from '../StudioSlider';

interface Props {
  settings: SynthSettings;
  onUpdateSetting: (key: keyof SynthSettings, value: number) => void;
  onReset: () => void;
  channel: number;
  onChannelChange: (channel: number) => void;
  defaultTab?: TabId;
}

type TabId = 'fx' | 'sound' | 'system';

export function SynthSettingsPanel({
  settings,
  onUpdateSetting,
  onReset,
  channel,
  onChannelChange,
  defaultTab = 'fx',
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [isChannelOpen, setIsChannelOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    if (!isChannelOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsChannelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isChannelOpen]);

  const set = (key: keyof SynthSettings) => (value: number) => onUpdateSetting(key, value);
  const tabClass = (id: TabId, active: string) =>
    `flex h-7 items-center gap-1.5 rounded-md px-3 text-[10px] font-bold transition-colors ${activeTab === id ? active : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`;
  const sectionTitle = 'mb-3 border-b border-[var(--border-color)] pb-1 text-xs font-bold text-indigo-400';
  const globalNote = <p className="-mt-2 mb-2 text-[10px] text-[var(--text-muted)]">{tr('Global: vale para todos os canais')}</p>;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)]">
      {/* Header: abas (esquerda) + canal/reset (direita). Quebra em 2 linhas em telas estreitas. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] bg-[var(--bg-app)] p-2">
        <div className="flex shrink-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)] p-0.5">
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

        <div className="flex shrink-0 items-center gap-1.5">
          
          {/* DROPDOWN CUSTOMIZADO DE CANAL */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsChannelOpen(!isChannelOpen)}
              className="flex h-7 min-w-[64px] items-center justify-between gap-2 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-2 font-mono text-[10px] font-bold text-indigo-400 outline-none transition-colors hover:bg-indigo-500/20 focus:border-indigo-500"
            >
              CH {String(channel).padStart(2, '0')}
              <ChevronDown size={12} className={`transition-transform ${isChannelOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isChannelOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 max-h-48 w-24 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)] p-1 shadow-2xl custom-scrollbar">
                {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => { onChannelChange(ch); setIsChannelOpen(false); }}
                    className={`flex w-full items-center rounded px-2 py-1.5 font-mono text-[10px] font-bold transition-colors ${
                      ch === channel ? 'bg-indigo-500/20 text-indigo-400' : 'text-[var(--text-main)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    CH {String(ch).padStart(2, '0')}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 rounded-md border border-rose-900/50 bg-rose-950/30 px-2 py-1 text-[10px] font-bold text-rose-400 transition-colors hover:bg-rose-900/50"
          >
            <RotateCcw size={12} /> {tr('Reset')}
          </button>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
        {activeTab === 'fx' && (
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <h3 className={sectionTitle}>{tr('Delay Customizado')}</h3>
              {globalNote}
              <StudioSlider label={tr('Tempo (Delay)')} sublabel="ms" value={settings.delayTime} min={0} max={1000} step={10} onChange={set('delayTime')} />
              <StudioSlider label={tr('Feedback')} value={settings.delayFeedback} min={0} max={90} onChange={set('delayFeedback')} />
              <StudioSlider label={tr('Mix (Nível)')} value={settings.delayMix} min={0} max={100} onChange={set('delayMix')} />
            </div>
            <div>
              <h3 className={sectionTitle}>{tr('EQ & Compressor')}</h3>
              {globalNote}
              <StudioSlider label={tr('EQ Graves (Low)')} sublabel="dB" value={settings.eqLow} min={-15} max={15} onChange={set('eqLow')} />
              <StudioSlider label={tr('EQ Médios (Mid)')} sublabel="dB" value={settings.eqMid} min={-15} max={15} onChange={set('eqMid')} />
              <StudioSlider label={tr('EQ Agudos (High)')} sublabel="dB" value={settings.eqHigh} min={-15} max={15} onChange={set('eqHigh')} />
              <StudioSlider label={tr('Compressor Threshold')} sublabel="dB" value={settings.compThreshold} min={-60} max={0} onChange={set('compThreshold')} />
            </div>
          </div>
        )}

        {activeTab === 'sound' && (
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <h3 className={sectionTitle}>{tr('Envelope (ADSR)')}</h3>
              <StudioSlider label={tr('Attack (Ataque)')} value={settings.attack} min={0} max={127} onChange={set('attack')} />
              <StudioSlider label={tr('Release (Liberação)')} value={settings.release} min={0} max={127} onChange={set('release')} />
            </div>
            <div>
              <h3 className={sectionTitle}>{tr('Filtro & Modulação')}</h3>
              <StudioSlider label={tr('Cutoff (Corte)')} value={settings.cutoff} min={0} max={127} onChange={set('cutoff')} />
              <StudioSlider label={tr('Resonance (Ressonância)')} value={settings.resonance} min={0} max={127} onChange={set('resonance')} />
              <StudioSlider label={tr('Vibrato (Profundidade)')} value={settings.vibrato} min={0} max={127} onChange={set('vibrato')} />
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <h3 className={sectionTitle}>{tr('Afinação e Pitch')}</h3>
              <StudioSlider label={tr('Ajuste Fino (Fine Tune)')} sublabel="ct" value={settings.fineTune} min={-100} max={100} onChange={set('fineTune')} />
              <StudioSlider label={tr('Alcance do Pitch Bend')} sublabel="st" value={settings.pitchBendRange} min={1} max={24} onChange={set('pitchBendRange')} />
            </div>
            <div>
              <h3 className={sectionTitle}>{tr('Desempenho (Mobile)')}</h3>
              {globalNote}
              <StudioSlider label={tr('Polifonia Máxima')} sublabel={tr('vozes')} value={settings.maxPolyphony} min={1} max={128} onChange={set('maxPolyphony')} />
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
