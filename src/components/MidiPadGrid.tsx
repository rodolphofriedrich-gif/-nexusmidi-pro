import React, { useState, useRef, useEffect } from 'react';
import { Settings2, X, Save } from 'lucide-react';

interface MidiPadGridProps {
  bank: number;
  isActive: boolean;
  isConnected: boolean;
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
  onDisabledPress: () => void;
  isEditMode: boolean;
}

export interface PadData {
  note: number;
  label: string;
  color: string;
}

const DEFAULT_BANKS: PadData[][] = [
  [
    { note: 36, label: 'Bumbo', color: 'bg-blue-500' },
    { note: 38, label: 'Caixa', color: 'bg-red-500' },
    { note: 42, label: 'Chimbal F.', color: 'bg-yellow-500' },
    { note: 46, label: 'Chimbal A.', color: 'bg-yellow-400' },
    { note: 41, label: 'Tom Grave', color: 'bg-green-500' },
    { note: 45, label: 'Tom Médio', color: 'bg-green-400' },
    { note: 48, label: 'Tom Agudo', color: 'bg-green-300' },
    { note: 50, label: 'Tom Alto', color: 'bg-teal-500' },
  ],
  [
    { note: 49, label: 'Prato Ataque', color: 'bg-cyan-500' },
    { note: 51, label: 'Prato Cond.', color: 'bg-cyan-400' },
    { note: 39, label: 'Palmas', color: 'bg-orange-500' },
    { note: 56, label: 'Cabaça', color: 'bg-amber-500' },
    { note: 54, label: 'Pandeiro', color: 'bg-pink-500' },
    { note: 60, label: 'Bongo A.', color: 'bg-purple-500' },
    { note: 61, label: 'Bongo G.', color: 'bg-purple-400' },
    { note: 76, label: 'Bloco Mad.', color: 'bg-stone-500' },
  ],
  [...Array(8)].map((_, i) => ({ note: 60 + i, label: `Nota ${60 + i}`, color: 'bg-slate-600' })),
  [...Array(8)].map((_, i) => ({ note: 72 + i, label: `Nota ${72 + i}`, color: 'bg-slate-500' })),
];

const COLORS = ['bg-blue-500', 'bg-red-500', 'bg-yellow-500', 'bg-green-500', 'bg-cyan-500', 'bg-pink-500', 'bg-purple-500', 'bg-orange-500'];

export function MidiPadGrid({ bank, isActive, isConnected, onNoteOn, onNoteOff, onDisabledPress, isEditMode }: MidiPadGridProps) {
  const [banksData, setBanksData] = useState<PadData[][]>(() => {
    try {
      const saved = localStorage.getItem('nexus_pads_data');
      return saved ? JSON.parse(saved) : DEFAULT_BANKS;
    } catch {
      return DEFAULT_BANKS;
    }
  });
  const [pressedPads, setPressedPads] = useState<Set<number>>(() => new Set());
  const [editPadIndex, setEditPadIndex] = useState<number | null>(null);

  const activePointersRef = useRef<Map<number, number>>(new Map());
  const activeNotesRef = useRef<Set<number>>(new Set());
  const onNoteOffRef = useRef(onNoteOff);

  useEffect(() => { onNoteOffRef.current = onNoteOff; }, [onNoteOff]);
  useEffect(() => { localStorage.setItem('nexus_pads_data', JSON.stringify(banksData)); }, [banksData]);

  const pressPad = (note: number, pointerId: number) => {
    if (!isActive || !isConnected) { onDisabledPress(); return; }
    const previousNote = activePointersRef.current.get(pointerId);
    if (previousNote !== undefined && previousNote !== note) releasePad(previousNote, pointerId);
    if (!activeNotesRef.current.has(note)) {
      activeNotesRef.current.add(note);
      setPressedPads((current) => { const next = new Set(current); next.add(note); return next; });
      void onNoteOn(note);
    }
    activePointersRef.current.set(pointerId, note);
  };

  const releasePad = (note: number, pointerId: number) => {
    activePointersRef.current.delete(pointerId);
    let isStillPressed = false;
    activePointersRef.current.forEach((heldNote) => { if (heldNote === note) isStillPressed = true; });
    if (!isStillPressed && activeNotesRef.current.has(note)) {
      activeNotesRef.current.delete(note);
      setPressedPads((current) => { const next = new Set(current); next.delete(note); return next; });
      void onNoteOffRef.current(note);
    }
  };

  const releaseAllNotes = () => {
    const notes = Array.from(activeNotesRef.current);
    activeNotesRef.current.clear();
    activePointersRef.current.clear();
    setPressedPads(new Set());
    for (const note of notes) void onNoteOffRef.current(note);
  };

  useEffect(() => {
    const handleGlobalPointerUp = (e: PointerEvent) => {
      const note = activePointersRef.current.get(e.pointerId);
      if (note !== undefined) releasePad(note, e.pointerId);
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

  useEffect(() => {
    releaseAllNotes();
    setEditPadIndex(null);
  }, [bank]);

  const handleSavePad = (e: React.FormEvent) => {
    e.preventDefault();
    if (editPadIndex === null) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const newPad: PadData = {
      note: Number(formData.get('note')),
      label: String(formData.get('label')),
      color: String(formData.get('color')),
    };
    const newBanks = banksData.map((b, bi) => (bi === bank ? b.map((p, pi) => (pi === editPadIndex ? newPad : p)) : b));
    setBanksData(newBanks);
    setEditPadIndex(null);
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)]">

      {editPadIndex !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={handleSavePad} className="max-h-[92vh] w-full max-w-sm space-y-4 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text-main)]">Editar Pad</h3>
              <button type="button" onClick={() => setEditPadIndex(null)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"><X size={18} /></button>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]">Nome do Pad</label>
              <input name="label" defaultValue={banksData[bank][editPadIndex].label} className="w-full h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-main)]" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]">Nota MIDI (0-127)</label>
              <input name="note" type="number" min="0" max="127" defaultValue={banksData[bank][editPadIndex].note} className="w-full h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-main)]" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]">Cor</label>
              <div className="flex flex-wrap gap-3">
                {COLORS.map((c) => (
                  <label key={c} className="cursor-pointer">
                    <input type="radio" name="color" value={c} defaultChecked={banksData[bank][editPadIndex].color === c} className="peer sr-only" />
                    <div className={`h-8 w-8 rounded-full ${c} ring-white peer-checked:ring-2`} />
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="flex w-full h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 text-sm font-bold text-white hover:bg-cyan-500 mt-2">
              <Save size={18} /> Salvar Pad
            </button>
          </form>
        </div>
      )}

      <div className="grid min-h-0 w-full flex-1 grid-cols-4 grid-rows-2 gap-2 p-2">
        {banksData[bank].map((pad, index) => {
          const isPressed = pressedPads.has(pad.note);
          return (
            <div key={index}
              onPointerDown={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); pressPad(pad.note, e.pointerId); }}
              onPointerEnter={(e) => { if (activePointersRef.current.has(e.pointerId)) pressPad(pad.note, e.pointerId); }}
              onPointerUp={(e) => { releasePad(pad.note, e.pointerId); }}
              onPointerCancel={(e) => { releasePad(pad.note, e.pointerId); }}
              onLostPointerCapture={() => releasePad(pad.note, -1)}
              onContextMenu={(e) => { e.preventDefault(); if (isEditMode) setEditPadIndex(index); }}
              role="button"
              className={`relative flex min-h-0 cursor-pointer select-none flex-col items-center justify-center overflow-hidden rounded-xl border-2 transition-all duration-100 ease-out ${
                isPressed 
                  ? 'scale-[0.97] z-10 border-white/80 shadow-[0_0_20px_rgba(255,255,255,0.4)]' 
                  : 'border-[var(--border-color)] bg-[var(--bg-elevated)] shadow-sm hover:border-slate-400'
              } ${!isActive ? 'cursor-not-allowed opacity-50 grayscale' : ''}`}
              style={{ touchAction: 'none' }}
            >
              <div 
                className={`absolute inset-0 transition-opacity duration-100 ${pad.color} ${isPressed ? 'opacity-100' : 'opacity-10'}`} 
              />

              {isPressed && <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />}

              {isEditMode && (
                <button type="button" onClick={(e) => { e.stopPropagation(); setEditPadIndex(index); }} className={`absolute right-2 top-2 z-20 rounded-md p-2 transition-all ${isPressed ? 'bg-black/20 text-white/80' : 'bg-black/10 text-black/50 hover:bg-black/30 dark:bg-black/40 dark:text-white/50 dark:hover:bg-black/80 dark:hover:text-white'}`}>
                  <Settings2 size={14} />
                </button>
              )}

              <div className="pointer-events-none z-10 flex h-full w-full flex-col items-center justify-center p-1">
                <span className={`w-full truncate px-1 text-center text-xs font-extrabold leading-tight drop-shadow-md sm:text-sm ${isPressed ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-[var(--text-main)]'}`}>{pad.label}</span>
                <span className={`mt-1 font-mono text-[10px] font-bold ${isPressed ? 'text-white/90' : 'text-[var(--text-muted)]'}`}>N{pad.note}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
