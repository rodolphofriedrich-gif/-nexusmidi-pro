import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Settings2, X, Save } from 'lucide-react';
import { tr } from '../i18n';

interface MidiPadGridProps {
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
  color: string; // ex: 'bg-blue-500'
}

const DEFAULT_BANKS: PadData[][] = [
  // Banco 1
  [
    { note: 36, label: 'Bumbo', color: 'bg-blue-500' },
    { note: 38, label: 'Caixa', color: 'bg-red-500' },
    { note: 42, label: 'Chimbal F.', color: 'bg-yellow-500' },
    { note: 46, label: 'Chimbal A.', color: 'bg-yellow-400' },
    { note: 41, label: 'Tom G.', color: 'bg-green-500' },
    { note: 45, label: 'Tom M.', color: 'bg-green-400' },
    { note: 48, label: 'Tom A.', color: 'bg-green-300' },
    { note: 50, label: 'Tom Alto', color: 'bg-teal-500' },
  ],
  // Banco 2
  [
    { note: 49, label: 'Prato C.', color: 'bg-cyan-500' },
    { note: 51, label: 'Prato R.', color: 'bg-cyan-400' },
    { note: 39, label: 'Palmas', color: 'bg-orange-500' },
    { note: 56, label: 'Cabaça', color: 'bg-amber-500' },
    { note: 54, label: 'Pandeiro', color: 'bg-pink-500' },
    { note: 60, label: 'Bongo A.', color: 'bg-purple-500' },
    { note: 61, label: 'Bongo G.', color: 'bg-purple-400' },
    { note: 76, label: 'Madeira', color: 'bg-stone-500' },
  ],
  // Banco 3 e 4 (Customizáveis)
  [...Array(8)].map((_, i) => ({ note: 60 + i, label: `Nota ${60 + i}`, color: 'bg-slate-600' })),
  [...Array(8)].map((_, i) => ({ note: 72 + i, label: `Nota ${72 + i}`, color: 'bg-slate-500' })),
];

const COLORS = ['bg-blue-500', 'bg-red-500', 'bg-yellow-500', 'bg-green-500', 'bg-cyan-500', 'bg-pink-500', 'bg-purple-500', 'bg-orange-500'];

export function MidiPadGrid({ isActive, isConnected, onNoteOn, onNoteOff, onDisabledPress, isFullscreen }: MidiPadGridProps) {
  const [bank, setBank] = useState(0);
  const [banksData, setBanksData] = useState<PadData[][]>(() => {
    const saved = localStorage.getItem('nexus_pads_data');
    return saved ? JSON.parse(saved) : DEFAULT_BANKS;
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

  const switchBank = (newBank: number) => {
    if (newBank !== bank) { releaseAllNotes(); setBank(newBank); }
  };

  const handleSavePad = (e: React.FormEvent) => {
    e.preventDefault();
    if (editPadIndex === null) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const newPad: PadData = {
      note: Number(formData.get('note')),
      label: String(formData.get('label')),
      color: String(formData.get('color')),
    };
    const newBanks = [...banksData];
    newBanks[bank][editPadIndex] = newPad;
    setBanksData(newBanks);
    setEditPadIndex(null);
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#0a0f1c] rounded-xl border border-[#1e293b] overflow-hidden relative">
      
      {/* MODAL DE EDIÇÃO DE PAD */}
      {editPadIndex !== null && (
        <div className="absolute inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSavePad} className="bg-[#0f172a] border border-slate-700 rounded-xl p-4 w-full max-w-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white">Editar Pad</h3>
              <button type="button" onClick={() => setEditPadIndex(null)}><X size={16} className="text-slate-400" /></button>
            </div>
            
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nome do Pad</label>
              <input name="label" defaultValue={banksData[bank][editPadIndex].label} className="w-full bg-[#0a0f1c] border border-slate-700 rounded p-2 text-sm text-white" required />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nota MIDI (0-127)</label>
              <input name="note" type="number" min="0" max="127" defaultValue={banksData[bank][editPadIndex].note} className="w-full bg-[#0a0f1c] border border-slate-700 rounded p-2 text-sm text-white" required />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cor</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <label key={c} className="cursor-pointer">
                    <input type="radio" name="color" value={c} defaultChecked={banksData[bank][editPadIndex].color === c} className="peer sr-only" />
                    <div className={`w-6 h-6 rounded-full ${c} peer-checked:ring-2 ring-white`} />
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2">
              <Save size={16} /> Salvar Pad
            </button>
          </form>
        </div>
      )}

      {/* BARRA DE BANCOS */}
      <div className="flex items-center justify-between bg-[#0f172a] border-b border-[#1e293b] px-2 py-1 shrink-0">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">{isFullscreen ? tr('Pads') : tr('Pads de Bateria')}</span>
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3].map((b) => (
             <button key={b} type="button" onClick={() => switchBank(b)} className={`flex items-center gap-0.5 px-2 py-1 rounded text-[9px] font-bold transition-all ${bank === b ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-800/50' : 'text-slate-500 hover:bg-slate-800 border border-transparent'}`}>
               {tr('Banco {n}', { n: b + 1 })}
             </button>
          ))}
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-4 grid-rows-2 gap-1 sm:gap-1.5 w-full h-full p-1 sm:p-1.5">
        {banksData[bank].map((pad, index) => {
          const isPressed = pressedPads.has(pad.note);
          return (
            <div key={index} 
              onPointerDown={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); pressPad(pad.note, e.pointerId); }}
              onPointerEnter={(e) => { if (activePointersRef.current.has(e.pointerId)) pressPad(pad.note, e.pointerId); }}
              onPointerUp={(e) => { releasePad(pad.note, e.pointerId); }}
              onPointerCancel={(e) => { releasePad(pad.note, e.pointerId); }}
              onLostPointerCapture={() => releasePad(pad.note, -1)}
              onContextMenu={(e) => { e.preventDefault(); setEditPadIndex(index); }} // Editar ao segurar (long press)
              role="button"
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 transition-all duration-75 select-none cursor-pointer overflow-hidden ${isPressed ? `border-white/80 ${pad.color} shadow-[0_0_15px_rgba(255,255,255,0.4)] scale-[0.96] z-10` : `border-[#1e293b] bg-[#0f172a] hover:bg-[#151e2e] shadow-md`} ${!isActive ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
              style={{ touchAction: 'none' }}>
              <div className={`absolute inset-0 opacity-10 ${pad.color} ${isPressed ? 'opacity-50' : ''} transition-opacity`} />
              
              {/* Botão de engrenagem para editar no canto */}
              <button type="button" onClick={(e) => { e.stopPropagation(); setEditPadIndex(index); }} className="absolute top-1 right-1 z-20 p-1 bg-black/40 rounded hover:bg-black/80 text-white/50 hover:text-white transition">
                <Settings2 size={10} />
              </button>

              <div className="flex flex-col items-center justify-center h-full w-full p-0.5 z-10 pointer-events-none">
                <span className={`text-[11px] sm:text-[13px] font-extrabold text-center leading-tight drop-shadow-md truncate w-full px-0.5 ${isPressed ? 'text-white' : 'text-slate-200'}`}>{pad.label}</span>
                <span className={`text-[9px] font-mono mt-0.5 font-bold ${isPressed ? 'text-white/80' : 'text-slate-500'}`}>N{pad.note}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
