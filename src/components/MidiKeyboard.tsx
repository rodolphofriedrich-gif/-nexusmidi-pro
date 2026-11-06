import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Activity, X, Maximize, MoveHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { tr } from '../i18n';

export interface MidiKeyboardHandle {
  openChannelPopup: () => void;
  openSettingsPopup: () => void;
}

interface MidiKeyboardProps {
  startOctave: number;
  isConnected: boolean;
  selectedChannel: number;
  onSelectChannel: (channel: number) => void;
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
  onDisabledPress: () => void;
  onActiveNotesChange?: (count: number) => void;
  isActive: boolean;
  isSustainActive: boolean;
  onToggleSustain: () => void;
  selectedVelocity: number;
  onSelectVelocity: (v: number) => void;
  onPitchBend: (value: number) => void;
  onModWheel: (value: number) => void;
}

const OCTAVE_NOTES = [
  { semitone: 0, name: 'C', type: 'white' },
  { semitone: 1, name: 'C#', type: 'black' },
  { semitone: 2, name: 'D', type: 'white' },
  { semitone: 3, name: 'D#', type: 'black' },
  { semitone: 4, name: 'E', type: 'white' },
  { semitone: 5, name: 'F', type: 'white' },
  { semitone: 6, name: 'F#', type: 'black' },
  { semitone: 7, name: 'G', type: 'white' },
  { semitone: 8, name: 'G#', type: 'black' },
  { semitone: 9, name: 'A', type: 'white' },
  { semitone: 10, name: 'A#', type: 'black' },
  { semitone: 11, name: 'B', type: 'white' },
] as const;

const TOTAL_WHITE_KEYS = 14;
const MIN_KEY_WIDTH = 52;
const MAX_KEY_WIDTH = 95;

// Cores Oficiais do Teclado (branco natural / grafite), feedback em CIANO (atividade MIDI)
const WHITE_KEY_BG = 'linear-gradient(180deg, #f5f2ea 0%, #e6e3db 88%, #cfccc4 100%)';
const WHITE_KEY_PRESSED_BG = 'linear-gradient(180deg, #22d3ee 0%, #cffafe 100%)';
const BLACK_KEY_BG = 'linear-gradient(180deg, #2a2e38 0%, #1a1d25 72%, #0a0c11 100%)';
const BLACK_KEY_PRESSED_BG = 'linear-gradient(180deg, #22d3ee 0%, #0e7490 100%)';

interface PopupProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}

function Popup({ title, onClose, children, widthClass = 'max-w-md' }: PopupProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`flex max-h-[92dvh] w-full ${widthClass} flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-2xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('Fechar')}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-muted)] transition hover:text-[var(--text-main)]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>
  );
}

export const MidiKeyboard = forwardRef<MidiKeyboardHandle, MidiKeyboardProps>(({
  startOctave,
  isConnected, selectedChannel, onSelectChannel, onNoteOn, onNoteOff, onDisabledPress,
  onActiveNotesChange,
  isActive, isSustainActive, onToggleSustain,
  selectedVelocity, onSelectVelocity,
  onPitchBend, onModWheel
}, ref) => {
  const [keyWidth, setKeyWidth] = useState(MIN_KEY_WIDTH);
  const [minKeyWidth, setMinKeyWidth] = useState(MIN_KEY_WIDTH);
  const [isScrollLocked, setIsScrollLocked] = useState(false);
  const [pressedNotes, setPressedNotes] = useState<Set<number>>(() => new Set());

  const [pbValue, setPbValue] = useState(8192);
  const [modValue, setModValue] = useState(0);

  const [isChannelOpen, setIsChannelOpen] = useState(false);
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeNotesRef = useRef<Set<number>>(new Set());
  const activePointersRef = useRef<Map<number, number>>(new Map());

  const onNoteOffRef = useRef(onNoteOff);
  const onDisabledPressRef = useRef(onDisabledPress);

  useImperativeHandle(ref, () => ({
    openChannelPopup: () => setIsChannelOpen(true),
    openSettingsPopup: () => setIsQuickSettingsOpen(true),
  }));

  useEffect(() => {
    if (onActiveNotesChange) onActiveNotesChange(pressedNotes.size);
  }, [pressedNotes.size, onActiveNotesChange]);

  useEffect(() => { onNoteOffRef.current = onNoteOff; }, [onNoteOff]);
  useEffect(() => { onDisabledPressRef.current = onDisabledPress; }, [onDisabledPress]);

  useEffect(() => {
    const updateMinSize = () => {
      const container = containerRef.current;
      if (!container) return;
      const availableWidth = Math.max(0, container.clientWidth - 12);
      // Em telas largas as teclas crescem para preencher a largura (sem sobrar espaço vazio ao lado).
      const calculatedMin = Math.max(MIN_KEY_WIDTH, Math.floor(availableWidth / TOTAL_WHITE_KEYS));
      setMinKeyWidth(calculatedMin);
      setKeyWidth((current) => Math.min(Math.max(MAX_KEY_WIDTH, calculatedMin), Math.max(calculatedMin, current)));
    };
    updateMinSize();
    let observer: ResizeObserver | undefined;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateMinSize);
      observer.observe(containerRef.current);
    }
    window.addEventListener('resize', updateMinSize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateMinSize);
    };
  }, []);

  const updateScrollState = useCallback(() => {
    const el = scrollViewportRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollViewportRef.current;
    let observer: ResizeObserver | undefined;
    if (el && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateScrollState);
      observer.observe(el);
    }
    window.addEventListener('resize', updateScrollState);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateScrollState);
    };
  }, [keyWidth, startOctave, isScrollLocked, updateScrollState]);

  const scrollKeyboard = (direction: 'left' | 'right') => {
    if (scrollViewportRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      scrollViewportRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const pressNote = (note: number, pointerId: number) => {
    if (!isActive) return;
    if (!isConnected) { onDisabledPressRef.current(); return; }

    const previousNote = activePointersRef.current.get(pointerId);
    if (previousNote !== undefined && previousNote !== note) releaseNote(previousNote, pointerId);

    if (!activeNotesRef.current.has(note)) {
      activeNotesRef.current.add(note);
      setPressedNotes((current) => { const next = new Set(current); next.add(note); return next; });
      void onNoteOn(note);
    }
    activePointersRef.current.set(pointerId, note);
  };

  const releaseNote = (note: number, pointerId: number) => {
    activePointersRef.current.delete(pointerId);
    let isStillPressed = false;
    activePointersRef.current.forEach((heldNote) => { if (heldNote === note) isStillPressed = true; });
    if (!isStillPressed && activeNotesRef.current.has(note)) {
      activeNotesRef.current.delete(note);
      setPressedNotes((current) => { const next = new Set(current); next.delete(note); return next; });
      void onNoteOffRef.current(note);
    }
  };

  useEffect(() => {
    const releaseAllNotes = () => {
      const notes = Array.from(activeNotesRef.current);
      activeNotesRef.current.clear();
      activePointersRef.current.clear();
      setPressedNotes(new Set());
      for (const note of notes) void onNoteOffRef.current(note);
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      const note = activePointersRef.current.get(e.pointerId);
      if (note !== undefined) releaseNote(note, e.pointerId);
    };

    window.addEventListener('blur', releaseAllNotes);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('blur', releaseAllNotes);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
      releaseAllNotes();
    };
  }, []);

  const renderKeys = () => {
    const keys: React.ReactNode[] = [];
    let whiteIndex = 0;

    for (let octave = startOctave; octave <= startOctave + 1; octave++) {
      for (const noteDef of OCTAVE_NOTES) {
        const midiNote = (octave + 1) * 12 + noteDef.semitone;
        if (midiNote > 127) continue;
        const isWhite = noteDef.type === 'white';
        const isPressed = pressedNotes.has(midiNote);
        const noteLabel = noteDef.name === 'C' ? `C${octave}` : noteDef.name;

        const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
          pressNote(midiNote, e.pointerId);
        };
        const handlePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
          if (activePointersRef.current.has(e.pointerId)) pressNote(midiNote, e.pointerId);
        };
        const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => { releaseNote(midiNote, e.pointerId); };
        const keyOpacity = isActive ? 1 : 0.5;

        if (isWhite) {
          whiteIndex++;
          keys.push(
            <div key={midiNote} role="button" onPointerDown={handlePointerDown} onPointerEnter={handlePointerEnter} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onLostPointerCapture={() => releaseNote(midiNote, -1)}
              className="relative z-10 flex h-full shrink-0 cursor-pointer flex-col items-center justify-end rounded-b-lg border transition-[filter,transform,box-shadow] duration-75 select-none"
              style={{
                width: `${keyWidth}px`,
                background: isPressed ? WHITE_KEY_PRESSED_BG : WHITE_KEY_BG,
                borderColor: isPressed ? '#22d3ee' : 'rgba(120,128,145,0.75)',
                boxShadow: isPressed ? 'inset 0 3px 9px rgba(15,23,42,0.22), 0 0 12px rgba(34,211,238,0.28)' : '0 4px 0 rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.9)',
                transform: isPressed ? 'translateY(2px)' : 'translateY(0)', touchAction: 'none', opacity: keyOpacity,
              }}>
              <span className="mb-4 rounded px-1 text-xs font-bold select-none" style={{ color: isPressed ? '#0e7490' : '#64748b', background: isPressed ? 'rgba(255,255,255,0.45)' : 'transparent' }}>{noteLabel}</span>
            </div>
          );
        } else {
          const blackWidth = keyWidth * 0.58;
          const left = (whiteIndex - 1) * keyWidth + keyWidth - blackWidth / 2;
          keys.push(
            <div key={midiNote} role="button" onPointerDown={handlePointerDown} onPointerEnter={handlePointerEnter} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onLostPointerCapture={() => releaseNote(midiNote, -1)}
              className="absolute top-0 z-30 flex h-[62%] cursor-pointer flex-col items-center justify-end rounded-b-sm border select-none"
              style={{
                width: `${blackWidth}px`, left: `${left}px`,
                background: isPressed ? BLACK_KEY_PRESSED_BG : BLACK_KEY_BG,
                borderColor: isPressed ? '#67e8f9' : '#05070c',
                boxShadow: isPressed ? '0 0 12px rgba(34,211,238,0.55), inset 0 0 5px rgba(255,255,255,0.25)' : '0 3px 4px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)',
                transform: isPressed ? 'translateY(2px)' : 'translateY(0)', touchAction: 'none', opacity: keyOpacity,
              }}>
              <span className="mb-4 text-[11px] font-bold select-none" style={{ color: isPressed ? '#ecfeff' : '#cbd5e1' }}>{noteDef.name}</span>
            </div>
          );
        }
      }
    }
    return keys;
  };

  const keyboardWidth = TOTAL_WHITE_KEYS * keyWidth;

  return (
    <section className="nexus-midi-keyboard flex min-h-0 min-w-0 w-full flex-1 flex-col gap-1 rounded-2xl border p-1 sm:p-1.5 relative" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-color)', boxShadow: '0 18px 50px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.035)' }}>
      
      {isChannelOpen && (
        <Popup title={tr('Canal MIDI')} onClose={() => setIsChannelOpen(false)} widthClass="max-w-xs">
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 16 }, (_, i) => {
              const ch = i + 1;
              const selected = selectedChannel === ch;
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => { onSelectChannel(ch); setIsChannelOpen(false); }}
                  className={`h-12 rounded-lg border font-mono text-sm transition-colors ${selected ? 'border-indigo-500/60 bg-indigo-500/20 font-bold text-[var(--nexus-primary)]' : 'border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-main)] hover:bg-[var(--bg-elevated)]'}`}
                >
                  {String(ch).padStart(2, '0')}
                </button>
              );
            })}
          </div>
        </Popup>
      )}

      {isQuickSettingsOpen && (
        <Popup title={tr('Configurações')} onClose={() => setIsQuickSettingsOpen(false)} widthClass="max-w-2xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-[var(--text-muted)]"><Activity size={14} /> {tr('Intensidade (Velocity)')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {[{ id: 30, label: tr('Suave') }, { id: 64, label: tr('Médio') }, { id: 100, label: tr('Forte') }, { id: 127, label: tr('Máx.') }].map((v) => (
                    <button type="button" key={v.id} onClick={() => onSelectVelocity(v.id)} className={`flex flex-col items-center justify-center py-3 rounded-lg border transition-all ${selectedVelocity === v.id ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-[0_0_10px_rgba(99,102,241,0.3)]' : 'bg-[var(--bg-app)] border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}>
                      <span className="text-xs font-semibold">{v.label}</span><span className="text-[11px] font-mono opacity-80">{v.id}</span>
                    </button>
                  ))}
                </div>
              </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-2 flex items-center justify-between text-xs font-bold uppercase text-[var(--text-muted)]"><span>{tr('Zoom do Teclado')}</span><span className="font-mono text-[var(--nexus-primary)]">{keyWidth}px</span></label>
                <input type="range" min={minKeyWidth} max={Math.max(MAX_KEY_WIDTH, minKeyWidth)} value={keyWidth} onChange={(e) => setKeyWidth(Number(e.target.value))} className="h-2 w-full cursor-pointer accent-indigo-500" />
              </div>

              <button type="button" onClick={() => setIsScrollLocked(!isScrollLocked)} className={`flex w-full items-center justify-between rounded-lg border p-3 transition-colors ${isScrollLocked ? 'bg-amber-900/20 border-amber-700/50 text-amber-500' : 'bg-[var(--bg-app)] border-[var(--border-color)] text-[var(--text-muted)]'}`}>
                <span className="flex items-center gap-2 text-sm font-bold">{isScrollLocked ? <Maximize size={16} /> : <MoveHorizontal size={16} />} {tr('Travar Rolagem')}</span>
                <div className={`relative h-5 w-9 rounded-full transition-colors ${isScrollLocked ? 'bg-amber-500' : 'bg-slate-700'}`}><div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${isScrollLocked ? 'left-4.5' : 'left-0.5'}`} /></div>
              </button>
            </div>
          </div>
        </Popup>
      )}

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-row gap-1">
        <div className="relative flex w-12 shrink-0 flex-col justify-between gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-1">
          <div className="relative flex w-full flex-1 flex-col items-center">
            <span className="absolute top-0 z-10 text-[9px] font-bold text-[var(--text-muted)]">PB</span>
            <div className="relative my-auto h-[80%] w-3 rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] shadow-inner">
              <div className="absolute top-1/2 left-0 right-0 z-10 h-px bg-slate-600" />
              <div className="absolute top-1/2 left-0 right-0 h-1/2 bg-indigo-500/50 opacity-50" style={{ bottom: '50%' }} />
              <div className="absolute left-1/2 z-30 h-5 w-8 -translate-x-1/2 rounded-sm bg-gradient-to-b from-gray-300 via-gray-400 to-gray-600 border border-gray-500 shadow-[0_2px_5px_rgba(0,0,0,0.8)]"
                   style={{ bottom: `calc(${(pbValue / 16383) * 100}% - 10px)` }} />
            </div>
            <input
              type="range" min="0" max="16383" value={pbValue}
              onChange={(e) => { const val = Number(e.target.value); setPbValue(val); onPitchBend(val); }}
              onPointerUp={() => { setPbValue(8192); onPitchBend(8192); }}
              className="absolute top-4 bottom-4 z-40 h-full w-full cursor-ns-resize opacity-0"
              style={{ WebkitAppearance: 'slider-vertical', writingMode: 'vertical-lr', direction: 'rtl' }}
            />
          </div>
          <div className="relative flex w-full flex-1 flex-col items-center">
            <span className="absolute top-0 z-10 text-[9px] font-bold text-[var(--text-muted)]">MOD</span>
            <div className="relative my-auto h-[80%] w-3 rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] shadow-inner">
              <div className="absolute bottom-0 left-0 right-0 z-10 bg-cyan-500/50" style={{ height: `${(modValue / 127) * 100}%` }} />
              <div className="absolute left-1/2 z-30 h-5 w-8 -translate-x-1/2 rounded-sm bg-gradient-to-b from-gray-300 via-gray-400 to-gray-600 border border-gray-500 shadow-[0_2px_5px_rgba(0,0,0,0.8)]"
                   style={{ bottom: `calc(${(modValue / 127) * 100}% - 10px)` }} />
            </div>
            <input
              type="range" min="0" max="127" value={modValue}
              onChange={(e) => { const val = Number(e.target.value); setModValue(val); onModWheel(val); }}
              className="absolute top-4 bottom-4 z-40 h-full w-full cursor-ns-resize opacity-0"
              style={{ WebkitAppearance: 'slider-vertical', writingMode: 'vertical-lr', direction: 'rtl' }}
            />
          </div>
        </div>

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div ref={containerRef} className="relative flex min-w-0 flex-1 overflow-hidden rounded-xl border border-[var(--border-color)]">
            {!isScrollLocked && (
              <button type="button" aria-label={tr('Rolar para a esquerda')} disabled={!canScrollLeft} onClick={() => scrollKeyboard('left')} className="flex w-12 shrink-0 items-center justify-center border-r border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] disabled:opacity-20 disabled:hover:bg-[var(--bg-panel)]">
                <ChevronLeft size={28} />
              </button>
            )}
            <div
              ref={scrollViewportRef}
              onScroll={updateScrollState}
              className={`nexus-midi-viewport relative z-0 flex min-w-0 flex-1 flex-col ${isScrollLocked ? 'overflow-hidden' : 'overflow-x-auto overflow-y-hidden'}`}
              style={{ background: 'var(--bg-app)', touchAction: isScrollLocked ? 'none' : 'pan-x', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              {/* A tecla nunca fica mais alta que ~7x a largura: mantém a proporção de um piano em telas altas. */}
              <div
                className="relative mt-auto flex h-full shrink-0 items-stretch p-0.5"
                style={{ width: `${keyboardWidth}px`, minWidth: `${keyboardWidth}px`, maxHeight: `${Math.round(keyWidth * 7)}px`, marginInline: isScrollLocked ? 'auto' : undefined }}
              >
                {renderKeys()}
              </div>
            </div>
            {!isScrollLocked && (
              <button type="button" aria-label={tr('Rolar para a direita')} disabled={!canScrollRight} onClick={() => scrollKeyboard('right')} className="flex w-12 shrink-0 items-center justify-center border-l border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] disabled:opacity-20 disabled:hover:bg-[var(--bg-panel)]">
                <ChevronRight size={28} />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});
