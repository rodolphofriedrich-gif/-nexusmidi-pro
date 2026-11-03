import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Power, Pause, LayoutGrid, Piano, SlidersHorizontal, Maximize, Minimize, MoveHorizontal, ChevronLeft, ChevronRight, Activity, X } from 'lucide-react';
import { MidiPadGrid } from './MidiPadGrid';
import { KEYBOARD_PALETTES } from '../constants/palettes';
import { tr } from '../i18n';

interface MidiKeyboardProps {
  isConnected: boolean;
  selectedChannel: number;
  onSelectChannel: (channel: number) => void;
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
  onDisabledPress: () => void;
  customWhiteKeyColor: string;
  customBlackKeyColor: string;
  onActiveNotesChange?: (count: number) => void;
  isActive: boolean;
  onToggleActive: () => void;
  isSustainActive: boolean;
  onToggleSustain: () => void;
  selectedVelocity: number;
  onSelectVelocity: (v: number) => void;
  selectedPaletteId: string;
  onSelectPalette: (id: string) => void;
  onPitchBend: (value: number) => void;
  onModWheel: (value: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
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

/* ---------- POPUP GENÉRICO (usado nas configurações e na lista de canais) ---------- */
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
        className={`flex max-h-[92vh] w-full ${widthClass} flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0f172a] shadow-2xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('Fechar')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-[#0a0f1c] text-slate-400 transition hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>
  );
}

export function MidiKeyboard({
  isConnected, selectedChannel, onSelectChannel, onNoteOn, onNoteOff, onDisabledPress,
  customWhiteKeyColor, customBlackKeyColor, onActiveNotesChange,
  isActive, onToggleActive, isSustainActive, onToggleSustain,
  selectedVelocity, onSelectVelocity, selectedPaletteId, onSelectPalette,
  onPitchBend, onModWheel, isFullscreen, onToggleFullscreen
}: MidiKeyboardProps) {
  const [viewMode, setViewMode] = useState<'keyboard' | 'pads'>('keyboard');
  const [startOctave, setStartOctave] = useState(3);
  const [keyWidth, setKeyWidth] = useState(MIN_KEY_WIDTH);
  const [minKeyWidth, setMinKeyWidth] = useState(MIN_KEY_WIDTH);
  const [isScrollLocked, setIsScrollLocked] = useState(false);
  const [pressedNotes, setPressedNotes] = useState<Set<number>>(() => new Set());

  const [pbValue, setPbValue] = useState(8192);
  const [modValue, setModValue] = useState(0);

  const [lastPianoChannel, setLastPianoChannel] = useState(selectedChannel);
  const [isChannelOpen, setIsChannelOpen] = useState(false);
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false);

  // Banco dos pads (agora controlado aqui, na barra superior)
  const [padBank, setPadBank] = useState(0);

  // Estado das setas de rolagem
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeNotesRef = useRef<Set<number>>(new Set());
  const activePointersRef = useRef<Map<number, number>>(new Map());

  const onNoteOffRef = useRef(onNoteOff);
  const onDisabledPressRef = useRef(onDisabledPress);

  useEffect(() => {
    if (onActiveNotesChange) onActiveNotesChange(pressedNotes.size);
  }, [pressedNotes.size, onActiveNotesChange]);

  useEffect(() => { onNoteOffRef.current = onNoteOff; }, [onNoteOff]);
  useEffect(() => { onDisabledPressRef.current = onDisabledPress; }, [onDisabledPress]);

  useEffect(() => {
    const updateMinSize = () => {
      const container = containerRef.current;
      if (!container || viewMode === 'pads') return;
      const availableWidth = Math.max(0, container.clientWidth - 12);
      const calculatedMin = Math.max(MIN_KEY_WIDTH, Math.floor(availableWidth / TOTAL_WHITE_KEYS));
      setMinKeyWidth(Math.min(MAX_KEY_WIDTH, calculatedMin));
      setKeyWidth((current) => Math.max(Math.min(MAX_KEY_WIDTH, calculatedMin), Math.min(MAX_KEY_WIDTH, current)));
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
  }, [viewMode]);

  /* ---------- Rolagem do teclado ---------- */
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
  }, [keyWidth, startOctave, isScrollLocked, viewMode, isFullscreen, updateScrollState]);

  const scrollKeyboard = (direction: 'left' | 'right') => {
    if (scrollViewportRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      scrollViewportRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  /* ---------- Notas ---------- */
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
                background: isPressed ? `linear-gradient(180deg, ${customWhiteKeyColor} 0%, #bfdbfe 100%)` : `linear-gradient(180deg, ${customWhiteKeyColor} 0%, ${customWhiteKeyColor} 88%, #cbd5e1 100%)`,
                borderColor: isPressed ? '#22d3ee' : 'rgba(100,116,139,0.75)',
                boxShadow: isPressed ? 'inset 0 3px 9px rgba(15,23,42,0.22), 0 0 12px rgba(34,211,238,0.28)' : '0 3px 0 rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.25)',
                transform: isPressed ? 'translateY(2px)' : 'translateY(0)', touchAction: 'none', opacity: keyOpacity,
              }}>
              <span className="mb-4 rounded px-1 text-[10px] font-bold select-none" style={{ color: isPressed ? '#075985' : '#1e293b', background: isPressed ? 'rgba(255,255,255,0.45)' : 'transparent' }}>{noteLabel}</span>
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
                background: isPressed ? 'linear-gradient(180deg, #38bdf8 0%, #0369a1 100%)' : `linear-gradient(180deg, ${customBlackKeyColor} 0%, ${customBlackKeyColor} 72%, #020617 100%)`,
                borderColor: isPressed ? '#67e8f9' : '#020617',
                boxShadow: isPressed ? '0 0 12px rgba(34,211,238,0.55), inset 0 0 5px rgba(255,255,255,0.25)' : '0 3px 4px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.1)',
                transform: isPressed ? 'translateY(2px)' : 'translateY(0)', touchAction: 'none', opacity: keyOpacity,
              }}>
              <span className="mb-4 text-[9px] font-bold select-none" style={{ color: isPressed ? '#ecfeff' : '#cbd5e1' }}>{noteDef.name}</span>
            </div>
          );
        }
      }
    }
    return keys;
  };

  const keyboardWidth = TOTAL_WHITE_KEYS * keyWidth;

  const arrowBtnClass = 'flex w-9 shrink-0 items-center justify-center bg-[#0f172a] text-slate-200 transition hover:bg-slate-700 active:bg-slate-600 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-[#0f172a]';

  return (
    <section className="nexus-midi-keyboard flex min-h-0 min-w-0 w-full flex-1 flex-col gap-1 rounded-2xl border p-1 sm:p-1.5" style={{ background: 'linear-gradient(145deg, rgba(17,24,39,0.98), rgba(8,13,25,0.99))', borderColor: 'rgba(148,163,184,0.16)', boxShadow: '0 18px 50px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.035)' }}>

      {/* ---------- BARRA SUPERIOR ---------- */}
      <div className="nexus-midi-controls relative z-50 flex shrink-0 items-center justify-between gap-2 rounded-xl border px-2 py-1.5 sm:px-3" style={{ background: 'rgba(5,10,22,0.76)', borderColor: 'rgba(148,163,184,0.14)' }}>
        <div className="custom-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto sm:gap-3" style={{ scrollbarWidth: 'none' }}>
          <div className="flex shrink-0 bg-[#0f172a] rounded-lg p-0.5 border border-[#1e293b]">
            <button type="button" onClick={() => { setViewMode('keyboard'); if (selectedChannel === 10 && lastPianoChannel !== 10) onSelectChannel(lastPianoChannel); }} className={`flex h-7 items-center gap-1.5 px-2.5 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'keyboard' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><Piano size={12} /> PIANO</button>
            <button type="button" onClick={() => { if (viewMode === 'keyboard') setLastPianoChannel(selectedChannel); setViewMode('pads'); if (selectedChannel !== 10) onSelectChannel(10); }} className={`flex h-7 items-center gap-1.5 px-2.5 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'pads' ? 'bg-cyan-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><LayoutGrid size={12} /> PADS</button>
          </div>

          <button type="button" onClick={onToggleActive} className={`flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-[10px] font-bold transition-all ${isActive ? 'border-cyan-700/50 bg-cyan-900/30 text-cyan-400' : 'border-slate-700 bg-slate-800/50 text-slate-500'}`}><Power size={14} /><span className="hidden sm:inline">{isActive ? 'ON' : 'OFF'}</span></button>

          <button type="button" onClick={onToggleFullscreen} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${isFullscreen ? 'bg-amber-600 border-amber-500 text-white' : 'bg-[#0f172a] border-[#1e293b] text-slate-400 hover:text-slate-200'}`}>
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>

          {/* MODO PIANO: oitava + sustain (agora também em tela cheia) */}
          {viewMode === 'keyboard' && (
            <>
              <div className="flex shrink-0 items-center overflow-hidden rounded-lg border" style={{ background: '#0f172a', borderColor: 'rgba(148,163,184,0.2)' }}>
                <button type="button" disabled={startOctave <= 1} onClick={() => setStartOctave((v) => Math.max(1, v - 1))} className="flex h-8 w-7 items-center justify-center text-lg font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-35">−</button>
                <span className="min-w-[32px] text-center font-mono text-xs font-bold text-cyan-300">C{startOctave}</span>
                <button type="button" disabled={startOctave >= 6} onClick={() => setStartOctave((v) => Math.min(6, v + 1))} className="flex h-8 w-7 items-center justify-center text-lg font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-35">+</button>
              </div>

              <button type="button" onClick={onToggleSustain} className={`flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-[10px] font-bold transition-all ${isSustainActive ? 'border-amber-500/50 bg-amber-900/30 text-amber-400' : 'border-slate-700 bg-slate-800/50 text-slate-400'}`}>
                <Pause size={14} /><span>SUSTAIN</span>
              </button>
            </>
          )}

          {/* MODO PADS: bancos 1 a 4 na barra superior */}
          {viewMode === 'pads' && (
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-[#1e293b] bg-[#0f172a] p-0.5">
              {[0, 1, 2, 3].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setPadBank(b)}
                  className={`h-7 whitespace-nowrap rounded-md px-2.5 text-[10px] font-bold transition-colors ${padBank === b ? 'border border-cyan-800/50 bg-cyan-900/40 text-cyan-300' : 'border border-transparent text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
                >
                  {tr('Banco {n}', { n: b + 1 })}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setIsChannelOpen(true)} className="flex h-8 items-center gap-1.5 rounded-lg border border-[#1e293b] bg-[#0f172a] px-2.5 text-slate-400 transition hover:bg-slate-800">
            <span className="text-[10px] font-bold uppercase">CH</span>
            <span className="min-w-[16px] text-center font-mono text-xs font-bold text-cyan-300">{String(selectedChannel).padStart(2, '0')}</span>
            <ChevronDown size={12} />
          </button>

          <button type="button" onClick={() => setIsQuickSettingsOpen(true)} className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${isQuickSettingsOpen ? 'bg-slate-700 border-slate-600 text-white' : 'bg-[#0f172a] border-[#1e293b] text-slate-400 hover:text-slate-200'}`}>
            <SlidersHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* ---------- POPUP: CANAL MIDI ---------- */}
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
                  className={`h-10 rounded-lg border font-mono text-sm transition-colors ${selected ? 'border-cyan-600/60 bg-cyan-900/50 font-bold text-cyan-300' : 'border-slate-800 bg-[#0a0f1c] text-slate-300 hover:bg-slate-800'}`}
                >
                  {String(ch).padStart(2, '0')}
                </button>
              );
            })}
          </div>
        </Popup>
      )}

      {/* ---------- POPUP: CONFIGURAÇÕES ---------- */}
      {isQuickSettingsOpen && (
        <Popup title={tr('Configurações')} onClose={() => setIsQuickSettingsOpen(false)} widthClass="max-w-2xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Coluna esquerda */}
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400"><Activity size={12} /> {tr('Intensidade (Velocity)')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {[{ id: 30, label: tr('Suave') }, { id: 64, label: tr('Médio') }, { id: 100, label: tr('Forte') }, { id: 127, label: tr('Máx.') }].map((v) => (
                    <button type="button" key={v.id} onClick={() => onSelectVelocity(v.id)} className={`flex flex-col items-center justify-center py-2 rounded-lg border transition-all ${selectedVelocity === v.id ? 'bg-cyan-900/40 border-cyan-600/50 text-cyan-300 font-bold shadow-[0_0_10px_rgba(8,145,178,0.2)]' : 'bg-[#0a0f1c] border-slate-800 text-slate-500 hover:bg-slate-800'}`}>
                      <span className="text-[10px] font-semibold">{v.label}</span><span className="text-[9px] font-mono opacity-80">{v.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400">{tr('Cores do Teclado')}</label>
                <div className="grid grid-cols-5 gap-2">
                  {KEYBOARD_PALETTES.map((pal) => (
                    <button type="button" key={pal.id} onClick={() => onSelectPalette(pal.id)} title={tr(pal.name)} className={`relative h-9 w-full rounded-lg overflow-hidden border-2 transition-all ${selectedPaletteId === pal.id ? 'border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'border-[#1e293b] hover:border-slate-500'}`}>
                      <div className="absolute inset-0 flex"><div className="w-2/3 h-full" style={{ backgroundColor: pal.white }} /><div className="w-1/3 h-full" style={{ backgroundColor: pal.black }} /></div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Coluna direita */}
            {viewMode === 'keyboard' ? (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase text-slate-400"><span>{tr('Zoom do Teclado')}</span><span className="font-mono text-cyan-300">{keyWidth}px</span></label>
                  <input type="range" min={minKeyWidth} max={MAX_KEY_WIDTH} value={keyWidth} onChange={(e) => setKeyWidth(Number(e.target.value))} className="h-1.5 w-full cursor-pointer accent-cyan-400" />
                </div>

                <button type="button" onClick={() => setIsScrollLocked(!isScrollLocked)} className={`flex w-full items-center justify-between rounded-lg border p-2.5 transition-colors ${isScrollLocked ? 'bg-amber-900/20 border-amber-700/50 text-amber-400' : 'bg-[#0a0f1c] border-slate-800 text-slate-400'}`}>
                  <span className="flex items-center gap-2 text-xs font-bold">{isScrollLocked ? <Maximize size={14} /> : <MoveHorizontal size={14} />} {tr('Travar Rolagem')}</span>
                  <div className={`relative h-4 w-8 rounded-full transition-colors ${isScrollLocked ? 'bg-amber-500' : 'bg-slate-700'}`}><div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${isScrollLocked ? 'left-4' : 'left-0.5'}`} /></div>
                </button>
              </div>
            ) : (
              <div className="hidden sm:block" />
            )}
          </div>
        </Popup>
      )}

      {/* ---------- ÁREA PRINCIPAL ---------- */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-row gap-1">
        {viewMode === 'keyboard' && (
          <div className="relative flex w-10 shrink-0 flex-col justify-between gap-1 rounded-xl border border-[#1e293b] bg-[#0f172a] p-1">

            {/* PB */}
            <div className="relative flex w-full flex-1 flex-col items-center">
              <span className="absolute top-0 z-10 text-[7px] font-bold text-slate-500">PB</span>
              <div className="relative my-auto h-[80%] w-2 rounded-full border border-[#1e293b] bg-[#05080f]">
                <div className="absolute top-1/2 left-0 right-0 z-10 h-px bg-slate-600" />
                <div className="absolute top-1/2 left-0 right-0 h-1/2 bg-fuchsia-600/50 opacity-50" style={{ bottom: '50%' }} />
                <div className="absolute left-1/2 z-30 h-3 w-5 -translate-x-1/2 rounded bg-gradient-to-b from-slate-300 to-slate-500 shadow"
                     style={{ bottom: `calc(${(pbValue / 16383) * 100}% - 6px)` }} />
              </div>
              <input
                type="range" min="0" max="16383" value={pbValue}
                onChange={(e) => { const val = Number(e.target.value); setPbValue(val); onPitchBend(val); }}
                onPointerUp={() => { setPbValue(8192); onPitchBend(8192); }}
                className="absolute top-4 bottom-4 z-40 h-full w-8 cursor-ns-resize opacity-0"
                style={{ WebkitAppearance: 'slider-vertical', writingMode: 'vertical-lr', direction: 'rtl' }}
              />
            </div>

            {/* MOD */}
            <div className="relative flex w-full flex-1 flex-col items-center">
              <span className="absolute top-0 z-10 text-[7px] font-bold text-slate-500">MOD</span>
              <div className="relative my-auto h-[80%] w-2 rounded-full border border-[#1e293b] bg-[#05080f]">
                <div className="absolute bottom-0 left-0 right-0 z-10 bg-cyan-500/50" style={{ height: `${(modValue / 127) * 100}%` }} />
                <div className="absolute left-1/2 z-30 h-3 w-5 -translate-x-1/2 rounded bg-gradient-to-b from-slate-300 to-slate-500 shadow"
                     style={{ bottom: `calc(${(modValue / 127) * 100}% - 6px)` }} />
              </div>
              <input
                type="range" min="0" max="127" value={modValue}
                onChange={(e) => { const val = Number(e.target.value); setModValue(val); onModWheel(val); }}
                className="absolute top-4 bottom-4 z-40 h-full w-8 cursor-ns-resize opacity-0"
                style={{ WebkitAppearance: 'slider-vertical', writingMode: 'vertical-lr', direction: 'rtl' }}
              />
            </div>
          </div>
        )}

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {viewMode === 'keyboard' ? (
            <div ref={containerRef} className="relative flex min-w-0 flex-1 overflow-hidden rounded-xl border border-[#1e293b]">

              {/* Seta esquerda: coluna própria, nunca fica atrás das teclas */}
              {!isScrollLocked && (
                <button type="button" aria-label={tr('Rolar para a esquerda')} disabled={!canScrollLeft} onClick={() => scrollKeyboard('left')} className={`${arrowBtnClass} border-r border-[#1e293b]`}>
                  <ChevronLeft size={24} />
                </button>
              )}

              <div
                ref={scrollViewportRef}
                onScroll={updateScrollState}
                className={`nexus-midi-viewport relative z-0 min-w-0 flex-1 ${isScrollLocked ? 'overflow-hidden' : 'overflow-x-auto overflow-y-hidden'}`}
                style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(30,41,59,0.72), rgba(2,6,23,0.98) 78%)', touchAction: isScrollLocked ? 'none' : 'pan-x', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
              >
                <div className="relative flex h-full items-stretch p-0.5" style={{ width: `${keyboardWidth}px`, minWidth: `${keyboardWidth}px`, marginInline: isScrollLocked ? 'auto' : undefined }}>
                  {renderKeys()}
                </div>
              </div>

              {/* Seta direita: coluna própria */}
              {!isScrollLocked && (
                <button type="button" aria-label={tr('Rolar para a direita')} disabled={!canScrollRight} onClick={() => scrollKeyboard('right')} className={`${arrowBtnClass} border-l border-[#1e293b]`}>
                  <ChevronRight size={24} />
                </button>
              )}
            </div>
          ) : (
            <div className="h-full min-h-0 w-full flex-1 py-0.5">
              <MidiPadGrid bank={padBank} isActive={isActive} isConnected={isConnected} onNoteOn={onNoteOn} onNoteOff={onNoteOff} onDisabledPress={onDisabledPress} isFullscreen={isFullscreen} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
