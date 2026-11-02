import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Power, Pause, LayoutGrid, Piano, SlidersHorizontal, Maximize, Minimize, MoveHorizontal, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
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
const MIN_KEY_WIDTH = 35;
const MAX_KEY_WIDTH = 95;

export function MidiKeyboard({
  isConnected, selectedChannel, onSelectChannel, onNoteOn, onNoteOff, onDisabledPress,
  customWhiteKeyColor, customBlackKeyColor, onActiveNotesChange,
  isActive, onToggleActive, isSustainActive, onToggleSustain,
  selectedVelocity, onSelectVelocity, selectedPaletteId, onSelectPalette,
  onPitchBend, onModWheel, isFullscreen, onToggleFullscreen
}: MidiKeyboardProps) {
  const [viewMode, setViewMode] = useState<'keyboard' | 'pads'>('keyboard');
  const [startOctave, setStartOctave] = useState(3);
  const [keyWidth, setKeyWidth] = useState(60);
  const [minKeyWidth, setMinKeyWidth] = useState(MIN_KEY_WIDTH);
  const [isScrollLocked, setIsScrollLocked] = useState(false);
  const [pressedNotes, setPressedNotes] = useState<Set<number>>(() => new Set());

  const [pbValue, setPbValue] = useState(8192);
  const [modValue, setModValue] = useState(0);

  const [lastPianoChannel, setLastPianoChannel] = useState(selectedChannel);
  const [isChannelOpen, setIsChannelOpen] = useState(false);
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false);
  
  const settingsRef = useRef<HTMLDivElement>(null);
  const channelDropdownRef = useRef<HTMLDivElement>(null);
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
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsQuickSettingsOpen(false);
      }
      if (channelDropdownRef.current && !channelDropdownRef.current.contains(event.target as Node)) {
        setIsChannelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  return (
    <section className="nexus-midi-keyboard flex min-h-0 w-full flex-1 flex-col gap-1 rounded-2xl border p-1 sm:p-1.5" style={{ background: 'linear-gradient(145deg, rgba(17,24,39,0.98), rgba(8,13,25,0.99))', borderColor: 'rgba(148,163,184,0.16)', boxShadow: '0 18px 50px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.035)' }}>
      
      <div className="nexus-midi-controls relative z-50 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border px-2 py-1.5 sm:px-3" style={{ background: 'rgba(5,10,22,0.76)', borderColor: 'rgba(148,163,184,0.14)' }}>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex bg-[#0f172a] rounded-lg p-0.5 border border-[#1e293b]">
            <button type="button" onClick={() => { setViewMode('keyboard'); if (selectedChannel === 10 && lastPianoChannel !== 10) onSelectChannel(lastPianoChannel); }} className={`flex h-7 items-center gap-1.5 px-2.5 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'keyboard' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><Piano size={12} /> PIANO</button>
            <button type="button" onClick={() => { if (viewMode === 'keyboard') setLastPianoChannel(selectedChannel); setViewMode('pads'); if (selectedChannel !== 10) onSelectChannel(10); }} className={`flex h-7 items-center gap-1.5 px-2.5 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'pads' ? 'bg-cyan-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><LayoutGrid size={12} /> PADS</button>
          </div>
          <button type="button" onClick={onToggleActive} className={`flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-[10px] font-bold transition-all ${isActive ? 'border-cyan-700/50 bg-cyan-900/30 text-cyan-400' : 'border-slate-700 bg-slate-800/50 text-slate-500'}`}><Power size={14} /><span className="hidden sm:inline">{isActive ? 'ON' : 'OFF'}</span></button>
          
          {/* SUSTAIN: Só aparece se NÃO estiver em fullscreen */}
          {!isFullscreen && (
            <button type="button" onClick={onToggleSustain} className={`flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-[10px] font-bold transition-all ${isSustainActive ? 'border-amber-500/50 bg-amber-900/30 text-amber-400' : 'border-slate-700 bg-slate-800/50 text-slate-400'}`}><Pause size={14} /><span className="hidden sm:inline">SUSTAIN</span></button>
          )}
          
          <button type="button" onClick={onToggleFullscreen} className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${isFullscreen ? 'bg-amber-600 border-amber-500 text-white' : 'bg-[#0f172a] border-[#1e293b] text-slate-400 hover:text-slate-200'}`}>
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>

          {viewMode === 'keyboard' && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center overflow-hidden rounded-lg border" style={{ background: '#0f172a', borderColor: 'rgba(148,163,184,0.2)' }}>
                <button type="button" disabled={startOctave <= 1} onClick={() => setStartOctave((v) => Math.max(1, v - 1))} className="flex h-8 w-7 items-center justify-center text-lg font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-35">−</button>
                <span className="min-w-[32px] text-center font-mono text-xs font-bold text-cyan-300">C{startOctave}</span>
                <button type="button" disabled={startOctave >= 6} onClick={() => setStartOctave((v) => Math.min(6, v + 1))} className="flex h-8 w-7 items-center justify-center text-lg font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-35">+</button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2" ref={settingsRef}>
          <div className="relative" ref={channelDropdownRef}>
            <button type="button" onClick={() => setIsChannelOpen(!isChannelOpen)} className="flex h-8 items-center gap-1.5 rounded-lg border border-[#1e293b] bg-[#0f172a] px-2.5 transition hover:bg-slate-800 text-slate-400">
              <span className="text-[10px] font-bold uppercase">CH</span>
              <span className="min-w-[16px] text-center font-mono text-xs font-bold text-cyan-300">{String(selectedChannel).padStart(2, '0')}</span>
              <ChevronDown size={12} />
            </button>
            {isChannelOpen && (
              <div className="absolute top-full right-0 z-[150] mt-2 max-h-48 w-24 overflow-y-auto rounded-xl border border-slate-700 bg-[#0f172a] shadow-2xl custom-scrollbar">
                <div className="nexus-dropdown-list flex flex-col gap-0.5 p-1">
                  {Array.from({ length: 16 }, (_, i) => {
                    const ch = i + 1; const selected = selectedChannel === ch;
                    return (
                      <button key={ch} type="button" onClick={() => { onSelectChannel(ch); setIsChannelOpen(false); }} className={`justify-center py-1.5 font-mono text-xs rounded transition-colors ${selected ? 'bg-cyan-900/50 text-cyan-300 font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>{String(ch).padStart(2, '0')}</button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button type="button" onClick={() => setIsQuickSettingsOpen(!isQuickSettingsOpen)} className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${isQuickSettingsOpen ? 'bg-slate-700 border-slate-600 text-white' : 'bg-[#0f172a] border-[#1e293b] text-slate-400 hover:text-slate-200'}`}>
            <SlidersHorizontal size={14} />
          </button>

          {/* MENU DE CONFIGURAÇÕES RÁPIDAS MAIS LARGO */}
          {isQuickSettingsOpen && (
            <div className="absolute top-full right-0 z-[150] mt-2 w-[340px] sm:w-[400px] max-h-[75vh] overflow-y-auto custom-scrollbar rounded-xl border border-slate-700 bg-[#0f172a] p-3 shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
              
              <div>
                <label className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400 mb-1.5"><Activity size={12} /> {tr('Intensidade (Velocity)')}</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[{ id: 30, label: tr('Suave') }, { id: 64, label: tr('Médio') }, { id: 100, label: tr('Forte') }, { id: 127, label: tr('Max') }].map((v) => (
                    <button type="button" key={v.id} onClick={() => onSelectVelocity(v.id)} className={`flex flex-col items-center justify-center py-1.5 rounded-lg border transition-all ${selectedVelocity === v.id ? 'bg-cyan-900/40 border-cyan-600/50 text-cyan-300 font-bold shadow-[0_0_10px_rgba(8,145,178,0.2)]' : 'bg-[#0a0f1c] border-slate-800 text-slate-500 hover:bg-slate-800'}`}>
                      <span className="text-[10px] font-semibold">{v.label}</span><span className="text-[9px] font-mono opacity-80">{v.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px w-full bg-slate-800" />
              
              <div>
                <label className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400 mb-1.5">{tr('Cores do Teclado')}</label>
                <div className="grid grid-cols-6 gap-1.5">
                  {KEYBOARD_PALETTES.map((pal) => (
                    <button type="button" key={pal.id} onClick={() => onSelectPalette(pal.id)} title={tr(pal.name)} className={`relative h-7 w-full rounded-lg overflow-hidden border-2 transition-all ${selectedPaletteId === pal.id ? 'border-cyan-400 scale-105 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'border-[#1e293b] hover:border-slate-500 hover:scale-105'}`}>
                      <div className="absolute inset-0 flex"><div className="w-2/3 h-full" style={{ backgroundColor: pal.white }} /><div className="w-1/3 h-full" style={{ backgroundColor: pal.black }} /></div>
                    </button>
                  ))}
                </div>
              </div>

              {viewMode === 'keyboard' && (
                <>
                  <div className="h-px w-full bg-slate-800" />
                  <div>
                    <label className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400 mb-1.5"><span>{tr('Zoom do Teclado')}</span><span className="font-mono text-cyan-300">{keyWidth}px</span></label>
                    <input type="range" min={minKeyWidth} max={MAX_KEY_WIDTH} value={keyWidth} onChange={(e) => setKeyWidth(Number(e.target.value))} className="h-1.5 w-full cursor-pointer accent-cyan-400" />
                  </div>
                  <div className="h-px w-full bg-slate-800" />
                  <button type="button" onClick={() => setIsScrollLocked(!isScrollLocked)} className={`flex items-center justify-between w-full p-1.5 rounded-lg border transition-colors ${isScrollLocked ? 'bg-amber-900/20 border-amber-700/50 text-amber-400' : 'bg-[#0a0f1c] border-slate-800 text-slate-400'}`}>
                    <span className="text-xs font-bold flex items-center gap-2">{isScrollLocked ? <Maximize size={14} /> : <MoveHorizontal size={14} />} {tr('Rolagem Livre')}</span>
                    <div className={`w-8 h-4 rounded-full transition-colors relative ${isScrollLocked ? 'bg-amber-500' : 'bg-slate-700'}`}><div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isScrollLocked ? 'left-4' : 'left-0.5'}`} /></div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative flex flex-row gap-1">
        {viewMode === 'keyboard' && (
          <div className="flex flex-col gap-1 w-10 shrink-0 bg-[#0f172a] rounded-xl border border-[#1e293b] p-1 justify-between relative">
            {/* PB Container */}
            <div className="flex flex-col items-center flex-1 w-full relative">
              <span className="text-[7px] font-bold text-slate-500 mb-1">PB</span>
              <input 
                type="range" min="0" max="16383" value={pbValue} 
                onChange={(e) => { const val = Number(e.target.value); setPbValue(val); onPitchBend(val); }}
                onPointerUp={() => { setPbValue(8192); onPitchBend(8192); }}
                className="absolute top-4 bottom-4 w-8 h-full opacity-0 cursor-ns-resize z-20"
                style={{ WebkitAppearance: 'slider-vertical', writingMode: 'vertical-lr', direction: 'rtl' }}
              />
              <div className="w-2 bg-[#05080f] rounded-full h-full border border-[#1e293b] relative overflow-hidden flex-1 my-1">
                <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-600 z-10" />
                <div className="absolute bottom-1/2 left-0 right-0 bg-fuchsia-600/50 z-0 h-1/2 opacity-50" />
              </div>
              {/* THUMB VISUAL DO PB */}
              <div 
                className="absolute w-5 h-3 bg-gradient-to-b from-slate-300 to-slate-500 rounded shadow pointer-events-none z-30"
                style={{ bottom: `calc(${(pbValue / 16383) * 100}% - 6px)` }}
              />
            </div>

            {/* MOD Container */}
            <div className="flex flex-col items-center flex-1 w-full relative">
              <span className="text-[7px] font-bold text-slate-500 mb-1">MOD</span>
              <input 
                type="range" min="0" max="127" value={modValue} 
                onChange={(e) => { const val = Number(e.target.value); setModValue(val); onModWheel(val); }}
                className="absolute top-4 bottom-4 w-8 h-full opacity-0 cursor-ns-resize z-20"
                style={{ WebkitAppearance: 'slider-vertical', writingMode: 'vertical-lr', direction: 'rtl' }}
              />
              <div className="w-2 bg-[#05080f] rounded-full h-full border border-[#1e293b] relative overflow-hidden flex-1 my-1">
                 <div className="absolute bottom-0 left-0 right-0 bg-cyan-500/50 z-0" style={{ height: `${(modValue / 127) * 100}%` }} />
              </div>
              {/* THUMB VISUAL DO MOD */}
              <div 
                className="absolute w-5 h-3 bg-gradient-to-b from-slate-300 to-slate-500 rounded shadow pointer-events-none z-30"
                style={{ bottom: `calc(${(modValue / 127) * 100}% - 6px)` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 relative flex flex-col">
          {viewMode === 'keyboard' ? (
            <div className="relative flex-1 flex overflow-hidden rounded-xl border border-[#1e293b]">
              
              {/* SETAS DE ROLAGEM FIXAS */}
              {!isScrollLocked && (
                <>
                  <button type="button" aria-label={tr('Rolar para a esquerda')} onClick={() => scrollKeyboard('left')} className="absolute left-1 top-1/2 -translate-y-1/2 z-[60] p-1.5 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-sm shadow-md transition-all active:scale-95 border border-white/10">
                    <ChevronLeft size={20} />
                  </button>
                  <button type="button" aria-label={tr('Rolar para a direita')} onClick={() => scrollKeyboard('right')} className="absolute right-1 top-1/2 -translate-y-1/2 z-[60] p-1.5 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-sm shadow-md transition-all active:scale-95 border border-white/10">
                    <ChevronRight size={20} />
                  </button>
                </>
              )}

              <div ref={scrollViewportRef} className={`nexus-midi-viewport relative flex-1 ${isScrollLocked ? 'overflow-hidden' : 'overflow-x-auto overflow-y-hidden'}`} style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(30,41,59,0.72), rgba(2,6,23,0.98) 78%)', touchAction: isScrollLocked ? 'none' : 'pan-x', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                <div className="relative flex h-full items-stretch p-0.5" style={{ width: `${keyboardWidth}px`, minWidth: `${keyboardWidth}px`, marginInline: isScrollLocked ? 'auto' : undefined }}>
                  {renderKeys()}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 w-full h-full py-0.5">
              <MidiPadGrid isActive={isActive} isConnected={isConnected} onNoteOn={onNoteOn} onNoteOff={onNoteOff} onDisabledPress={onDisabledPress} isFullscreen={isFullscreen} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
