import React, { useState, useRef, useEffect } from 'react';
import { Settings2, X, Save } from 'lucide-react';

interface MidiPadGridProps {
  /** Banco ativo (0 a 3). Agora é controlado pela barra superior do MidiKeyboard. */
  bank: number;
  isActive: boolean;
  isConnected: boolean;
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
  onDisabledPress: () => void;
  isFullscreen?: boolean;
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

export function MidiPadGrid({ bank, isActive, isConnected, onNoteOn, onNoteOff, onDisabledPress, isFullscreen }: MidiPadGridProps) {
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

  // Ao trocar de banco (botões na barra superior), solta qualquer nota que esteja presa
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
    // Cópia imutável (antes o código alterava o estado diretamente)
    const newBanks = banksData.map((b, bi) => (bi === bank ? b.map((p, pi) => (pi === editPadIndex ? newPad : p)) : b));
    setBanksData(newBanks);
    setEditPadIndex(null);
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-[#1e293b] bg-[#0a0f1c]">

      {/* MODAL DE EDIÇÃO */}
      {editPadIndex !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={handleSavePad} className="max-h-[92vh] w-full max-w-sm space-y-4 overflow-y-auto rounded-xl border border-slate-700 bg-[#0f172a] p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white">Editar Pad</h3>
              <button type="button" onClick={() => setEditPadIndex(null)}><X size={16} className="text-slate-400" /></button>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Nome do Pad</label>
              <input name="label" defaultValue={banksData[bank][editPadIndex].label} className="w-full rounded border border-slate-700 bg-[#0a0f1c] p-2 text-sm text-white" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Nota MIDI (0-127)</label>
              <input name="note" type="number" min="0" max="127" defaultValue={banksData[bank][editPadIndex].note} className="w-full rounded border border-slate-700 bg-[#0a0f1c] p-2 text-sm text-white" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Cor</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <label key={c} className="cursor-pointer">
                    <input type="radio" name="color" value={c} defaultChecked={banksData[bank][editPadIndex].color === c} className="peer sr-only" />
                    <div className={`h-6 w-6 rounded-full ${c} ring-white peer-checked:ring-2`} />
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2 font-bold text-white hover:bg-cyan-500">
              <Save size={16} /> Salvar Pad
            </button>
          </form>
        </div>
      )}

      {/* GRADE DE PADS (a faixa "PADS / Banco 1-4" foi movida para a barra superior) */}
      <div className="grid min-h-0 w-full flex-1 grid-cols-4 grid-rows-2 gap-1 p-1 sm:gap-1.5 sm:p-1.5">
        {banksData[bank].map((pad, index) => {
          const isPressed = pressedPads.has(pad.note);
          return (
            <div key={index}
              onPointerDown={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); pressPad(pad.note, e.pointerId); }}
              onPointerEnter={(e) => { if (activePointersRef.current.has(e.pointerId)) pressPad(pad.note, e.pointerId); }}
              onPointerUp={(e) => { releasePad(pad.note, e.pointerId); }}
              onPointerCancel={(e) => { releasePad(pad.note, e.pointerId); }}
              onLostPointerCapture={() => releasePad(pad.note, -1)}
              onContextMenu={(e) => { e.preventDefault(); setEditPadIndex(index); }}
              role="button"
              className={`relative flex min-h-0 cursor-pointer select-none flex-col items-center justify-center overflow-hidden rounded-lg border-2 transition-all duration-75 ${isPressed ? `border-white/80 ${pad.color} z-10 scale-[0.96] shadow-[0_0_15px_rgba(255,255,255,0.4)]` : 'border-[#1e293b] bg-[#0f172a] shadow-md hover:bg-[#151e2e]'} ${!isActive ? 'cursor-not-allowed opacity-50 grayscale' : ''}`}
              style={{ touchAction: 'none' }}>
              <div className={`absolute inset-0 ${pad.color} transition-opacity ${isPressed ? 'opacity-50' : 'opacity-10'}`} />

              {/* Engrenagem só fora da tela cheia (em tela cheia: toque longo / botão direito) */}
              {!isFullscreen && (
                <button type="button" onClick={(e) => { e.stopPropagation(); setEditPadIndex(index); }} className="absolute right-1 top-1 z-20 rounded bg-black/40 p-1 text-white/50 transition hover:bg-black/80 hover:text-white">
                  <Settings2 size={10} />
                </button>
              )}

              <div className="pointer-events-none z-10 flex h-full w-full flex-col items-center justify-center p-0.5">
                <span className={`w-full truncate px-0.5 text-center text-[11px] font-extrabold leading-tight drop-shadow-md sm:text-[13px] ${isPressed ? 'text-white' : 'text-slate-200'}`}>{pad.label}</span>
                <span className={`mt-0.5 font-mono text-[9px] font-bold ${isPressed ? 'text-white/80' : 'text-slate-500'}`}>N{pad.note}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
