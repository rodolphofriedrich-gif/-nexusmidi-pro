import { Play, Sliders, Sparkles, Volume2 } from 'lucide-react';
import { tr } from '../../i18n';
import type { SoundFontPreset } from '../../types/soundfont';

interface Props {
  /** Instrumento do canal ativo. `null` = ainda não escolhido (ou o SoundFont dele está desligado). */
  preset: SoundFontPreset | null;
  /** Há SoundFont ligado? Só então o botão "Ouvir" faz sentido. */
  canPlay: boolean;
  volume: number;
  onVolumeChange: (value: number) => void;
  reverb: number;
  onReverbChange: (value: number) => void;
  transpose: number;
  onTransposeChange: (value: number) => void;
  onAudition: () => void;
}

export function ActiveSoundFontCard({
  preset,
  canPlay,
  volume,
  onVolumeChange,
  reverb,
  onReverbChange,
  transpose,
  onTransposeChange,
  onAudition,
}: Props) {
  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-indigo-500/40 bg-gradient-to-b from-indigo-950/30 to-[var(--bg-panel)]/60 p-2.5 shadow-md backdrop-blur-sm sm:rounded-2xl sm:p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate text-[9px] font-semibold uppercase tracking-wide text-indigo-400 sm:text-[10px]">
            <span className="shrink-0 rounded bg-indigo-900/80 px-1.5 font-mono text-[9px] font-bold text-indigo-300">
              {preset ? `${preset.isDrum ? 'KIT' : 'PRG'} #${String(preset.programNumber).padStart(3, '0')}` : 'PRG #---'}
            </span>
            {preset && (
              <>
                <span aria-hidden="true" className="opacity-40">·</span>
                <span className="shrink-0 text-[var(--text-muted)]">{tr(preset.category)}</span>
              </>
            )}
          </div>
          <h2 className="mt-0.5 truncate text-base font-bold leading-tight tracking-tight text-[var(--text-main)] sm:text-lg">{preset ? preset.name : tr('Escolha um instrumento')}</h2>
        </div>
        <button
          type="button"
          onClick={onAudition}
          disabled={!canPlay}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold text-white transition-all hover:bg-indigo-500 active:scale-95 sm:text-xs"
        >
          <Play className="h-3 w-3 fill-current" />
          <span>{tr('Ouvir')}</span>
        </button>
      </div>

      <div className="grid grid-cols-[1fr_1fr_auto] gap-3 border-t border-[var(--border-color)] pt-2 text-xs">
        <div className="flex min-w-0 items-center gap-1">
          <Volume2 className="h-3 w-3 shrink-0 text-indigo-400" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex justify-between text-[10px] font-medium leading-none text-[var(--text-muted)]">
              <span>{tr('Vol')}</span>
              <span className="font-mono">{volume}%</span>
            </div>
            <input
              type="range"
              aria-label={tr('Volume')}
              min="0"
              max="100"
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="block h-4 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[var(--bg-app)] [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500"
            />
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-1">
          <Sparkles className="h-3 w-3 shrink-0 text-indigo-400" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex justify-between text-[10px] font-medium leading-none text-[var(--text-muted)]">
              <span>{tr('Rev')}</span>
              <span className="font-mono">{reverb}%</span>
            </div>
            <input
              type="range"
              aria-label="Reverb"
              min="0"
              max="100"
              value={reverb}
              onChange={(e) => onReverbChange(Number(e.target.value))}
              className="block h-4 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[var(--bg-app)] [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500"
            />
          </div>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-1">
          <Sliders className="h-3 w-3 shrink-0 text-indigo-400" aria-label={tr('Transpor')} />
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label={tr('Transpor para baixo')}
              onClick={() => onTransposeChange(Math.max(-12, transpose - 1))}
              className="flex h-6 w-6 items-center justify-center rounded bg-[var(--bg-elevated)] text-xs text-[var(--text-main)] hover:bg-[var(--bg-panel)]"
            >
              -
            </button>
            <span className="w-6 text-center font-mono text-[11px] font-semibold tabular-nums text-[var(--text-main)]">
              {transpose > 0 ? `+${transpose}` : transpose}
            </span>
            <button
              type="button"
              aria-label={tr('Transpor para cima')}
              onClick={() => onTransposeChange(Math.min(12, transpose + 1))}
              className="flex h-6 w-6 items-center justify-center rounded bg-[var(--bg-elevated)] text-xs text-[var(--text-main)] hover:bg-[var(--bg-panel)]"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
