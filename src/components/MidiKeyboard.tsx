import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Power, Pause, LayoutGrid, Piano, SlidersHorizontal, Maximize, MoveHorizontal, ChevronLeft, ChevronRight, Activity, Minimize } from 'lucide-react';
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
  // NOVAS PROPS
  onPitchBend: (value: number) => void;
  onModWheel: (value: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

// ... (OCTAVE_NOTES mantidos)

export function MidiKeyboard({
  isConnected, selectedChannel, onSelectChannel, onNoteOn, onNoteOff, onDisabledPress,
  customWhiteKeyColor, customBlackKeyColor, onActiveNotesChange,
  isActive, onToggleActive, isSustainActive, onToggleSustain,
  selectedVelocity, onSelectVelocity, selectedPaletteId, onSelectPalette,
  onPitchBend, onModWheel, isFullscreen, onToggleFullscreen
}: MidiKeyboardProps) {
  // ... (estados mantidos)
  
  return (
    <section className="nexus-midi-keyboard flex min-h-0 w-full flex-1 flex-col gap-1 rounded-2xl border p-1 sm:p-1.5" style={{ background: 'linear-gradient(145deg, rgba(17,24,39,0.98), rgba(8,13,25,0.99))', borderColor: 'rgba(148,163,184,0.16)', boxShadow: '0 18px 50px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.035)' }}>
      
      {/* BARRA DE CONTROLES */}
      <div className="nexus-midi-controls relative z-50 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border px-2 py-1.5 sm:px-3" style={{ background: 'rgba(5,10,22,0.76)', borderColor: 'rgba(148,163,184,0.14)' }}>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex bg-[#0f172a] rounded-lg p-0.5 border border-[#1e293b]">
            <button type="button" onClick={() => { setViewMode('keyboard'); if (selectedChannel === 10 && lastPianoChannel !== 10) onSelectChannel(lastPianoChannel); }} className={`flex h-7 items-center gap-1.5 px-2.5 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'keyboard' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><Piano size={12} /> PIANO</button>
            <button type="button" onClick={() => { if (viewMode === 'keyboard') setLastPianoChannel(selectedChannel); setViewMode('pads'); if (selectedChannel !== 10) onSelectChannel(10); }} className={`flex h-7 items-center gap-1.5 px-2.5 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'pads' ? 'bg-cyan-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><LayoutGrid size={12} /> PADS</button>
          </div>
          <button type="button" onClick={onToggleActive} className={`flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-[10px] font-bold transition-all ${isActive ? 'border-cyan-700/50 bg-cyan-900/30 text-cyan-400' : 'border-slate-700 bg-slate-800/50 text-slate-500'}`}><Power size={14} /><span className="hidden sm:inline">{isActive ? 'ON' : 'OFF'}</span></button>
          <button type="button" onClick={onToggleSustain} className={`flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-[10px] font-bold transition-all ${isSustainActive ? 'border-amber-500/50 bg-amber-900/30 text-amber-400' : 'border-slate-700 bg-slate-800/50 text-slate-400'}`}><Pause size={14} /><span className="hidden sm:inline">SUSTAIN</span></button>
          
          {/* BOTÃO FULLSCREEN */}
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
           {/* ... (Canal e Settings mantidos) ... */}
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
           {/* ... (Quick Settings mantidos) ... */}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative flex flex-row gap-1">
        {/* NOVO: PAINEL DE PITCH BEND E MODULAÇÃO (À ESQUERDA) */}
        {viewMode === 'keyboard' && (
          <div className="flex flex-col gap-1 w-10 shrink-0 bg-[#0f172a] rounded-xl border border-[#1e293b] p-1 justify-between">
            {/* Pitch Bend */}
            <div className="flex flex-col items-center flex-1 w-full relative">
              <span className="text-[7px] font-bold text-slate-500 mb-1">PB</span>
              <input 
                type="range" min="0" max="16383" defaultValue="8192" 
                onChange={(e) => onPitchBend(Number(e.target.value))}
                onPointerUp={() => onPitchBend(8192)}
                className="absolute top-4 bottom-4 w-8 h-full opacity-0 cursor-ns-resize z-20"
                style={{ WebkitAppearance: 'slider-vertical', writingMode: 'vertical-lr', direction: 'rtl' }}
              />
              <div className="w-2 bg-[#05080f] rounded-full h-full border border-[#1e293b] relative overflow-hidden flex-1 my-1">
                <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-600 z-10" />
                <div className="absolute bottom-1/2 left-0 right-0 bg-fuchsia-600/50 z-0 h-1/2 opacity-50" />
              </div>
            </div>
            {/* Modulação */}
            <div className="flex flex-col items-center flex-1 w-full relative">
              <span className="text-[7px] font-bold text-slate-500 mb-1">MOD</span>
              <input 
                type="range" min="0" max="127" defaultValue="0" 
                onChange={(e) => onModWheel(Number(e.target.value))}
                className="absolute top-4 bottom-4 w-8 h-full opacity-0 cursor-ns-resize z-20"
                style={{ WebkitAppearance: 'slider-vertical', writingMode: 'vertical-lr', direction: 'rtl' }}
              />
              <div className="w-2 bg-[#05080f] rounded-full h-full border border-[#1e293b] relative overflow-hidden flex-1 my-1">
                 <div className="absolute bottom-0 left-0 right-0 bg-cyan-500/50 z-0 h-1/2" />
              </div>
            </div>
          </div>
        )}

        {/* TECLADO / PADS */}
        <div className="flex-1 min-h-0 relative flex flex-col">
          {viewMode === 'keyboard' ? (
            <div className="relative flex-1 flex overflow-hidden rounded-xl border border-[#1e293b]">
              {/* ... (Setas e Teclas mantidos) ... */}
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
