import React, { useState, useRef, useEffect } from 'react';
import { Settings2, X, Save } from 'lucide-react';
import { tr } from '../i18n';
import { CHORD_BADGE, resolveChordNotes, type ChordType } from '../constants/chords';
import { useStore } from '../hooks/useStore';
import { padsStore, type PadData } from '../services/stores';

interface MidiPadGridProps {
  bank: number;
  isActive: boolean;
  isConnected: boolean;
  onNoteOn: (note: number, velocity?: number, sourceId?: string) => void;
  onNoteOff: (note: number, sourceId?: string) => void;
  onDisabledPress: () => void;
  isEditMode: boolean;
}

const CHORD_TYPES: ReadonlyArray<{ id: ChordType; label: string }> = [
  { id: 'single', label: 'Nota única' },
  { id: 'maj', label: 'Maior' },
  { id: 'min', label: 'Menor' },
  { id: 'dim', label: 'Diminuto' },
  { id: 'aug', label: 'Aumentado' },
  { id: 'sus2', label: 'Sus2' },
  { id: 'sus4', label: 'Sus4' },
  { id: '7', label: 'Sétima (7)' },
  { id: 'maj7', label: 'Sétima maior (maj7)' },
  { id: 'm7', label: 'Menor com sétima (m7)' },
  { id: 'dim7', label: 'Diminuto com sétima (dim7)' },
  { id: 'm7b5', label: 'Meio-diminuto (m7b5)' },
  { id: 'custom', label: 'Customizado' },
];

const COLORS = ['bg-blue-500', 'bg-red-500', 'bg-yellow-500', 'bg-green-500', 'bg-cyan-500', 'bg-pink-500', 'bg-purple-500', 'bg-orange-500'];

export function MidiPadGrid({ bank, isActive, isConnected, onNoteOn, onNoteOff, onDisabledPress, isEditMode }: MidiPadGridProps) {
  const { banks } = useStore(padsStore);
  const banksData = banks;

  const [pressedPads, setPressedPads] = useState<Set<number>>(() => new Set());
  const [editPadIndex, setEditPadIndex] = useState<number | null>(null);
  const [editChordType, setEditChordType] = useState<ChordType>('single');

  const activePointersRef = useRef<Map<number, number>>(new Map());
  const activePadNotesRef = useRef<Map<number, number[]>>(new Map());
  const noteRefCountRef = useRef<Map<number, number>>(new Map());

  const onNoteOnRef = useRef(onNoteOn);
  const onNoteOffRef = useRef(onNoteOff);

  useEffect(() => { onNoteOnRef.current = onNoteOn; }, [onNoteOn]);
  useEffect(() => { onNoteOffRef.current = onNoteOff; }, [onNoteOff]);

  const incNote = (note: number): boolean => {
    const count = noteRefCountRef.current.get(note) ?? 0;
    noteRefCountRef.current.set(note, count + 1);
    return count === 0;
  };

  const decNote = (note: number): boolean => {
    const count = noteRefCountRef.current.get(note) ?? 0;
    if (count <= 1) {
      noteRefCountRef.current.delete(note);
      return true;
    }
    noteRefCountRef.current.set(note, count - 1);
    return false;
  };

  const pressPad = (padIndex: number, pointerId: number) => {
    if (!isActive || !isConnected) { onDisabledPress(); return; }
    const pad = banksData[bank][padIndex];
    if (!pad) return;

    const previousPadIndex = activePointersRef.current.get(pointerId);
    if (previousPadIndex !== undefined && previousPadIndex !== padIndex) {
      releasePad(previousPadIndex, pointerId);
    }

    if (activePadNotesRef.current.has(padIndex)) {
      activePointersRef.current.set(pointerId, padIndex);
      return;
    }

    const notes = resolveChordNotes(pad.note, pad.chordType ?? 'single', pad.chordIntervals);
    const velocity = pad.velocity ?? 100;
    const sourceId = `pad-${bank}-${padIndex}`;

    activePadNotesRef.current.set(padIndex, notes);
    activePointersRef.current.set(pointerId, padIndex);
    setPressedPads((current) => { const next = new Set(current); next.add(padIndex); return next; });

    for (const note of notes) {
      if (incNote(note)) void onNoteOnRef.current(note, velocity, sourceId);
    }
  };

  const releasePad = (padIndex: number, pointerId: number) => {
    activePointersRef.current.delete(pointerId);

    let stillPressed = false;
    activePointersRef.current.forEach((idx) => { if (idx === padIndex) stillPressed = true; });
    if (stillPressed) return;

    const notes = activePadNotesRef.current.get(padIndex);
    if (!notes) return;
    activePadNotesRef.current.delete(padIndex);
    setPressedPads((current) => { const next = new Set(current); next.delete(padIndex); return next; });

    const sourceId = `pad-${bank}-${padIndex}`;
    for (const note of notes) {
      if (decNote(note)) void onNoteOffRef.current(note, sourceId);
    }
  };

  const releaseAllNotes = () => {
    const entries = Array.from(activePadNotesRef.current.entries());
    activePadNotesRef.current.clear();
    activePointersRef.current.clear();
    noteRefCountRef.current.clear();
    setPressedPads(new Set());
    for (const [padIndex, notes] of entries) {
      const sourceId = `pad-${bank}-${padIndex}`;
      for (const note of notes) void onNoteOffRef.current(note, sourceId);
    }
  };

  useEffect(() => {
    const handleGlobalPointerUp = (e: PointerEvent) => {
      const padIndex = activePointersRef.current.get(e.pointerId);
      if (padIndex !== undefined) releasePad(padIndex, e.pointerId);
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
  }, [bank]);

  useEffect(() => {
    releaseAllNotes();
    setEditPadIndex(null);
  }, [bank]);

  const handleSavePad = (e: React.FormEvent) => {
    e.preventDefault();
    if (editPadIndex === null) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const chordType = String(formData.get('chordType') ?? 'single') as ChordType;
    let chordIntervals: number[] | undefined;
    if (chordType === 'custom') {
      const raw = String(formData.get('chordIntervals') ?? '');
      chordIntervals = raw
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n >= 0 && n <= 127);
      if (chordIntervals.length === 0) chordIntervals = [0];
    }
    const newPad: PadData = {
      note: Number(formData.get('note')),
      label: String(formData.get('label')),
      color: String(formData.get('color')),
      velocity: Number(formData.get('velocity')),
      chordType,
      chordIntervals,
    };

    padsStore.set((prev) => ({
      banks: prev.banks.map((b, bi) => (bi === bank ? b.map((p, pi) => (pi === editPadIndex ? newPad : p)) : b))
    }));

    setEditPadIndex(null);
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)]">

      {editPadIndex !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={handleSavePad} className="max-h-[92dvh] w-full max-w-sm space-y-4 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text-main)]">{tr('Editar Pad')}</h3>
              <button type="button" aria-label={tr('Fechar')} onClick={() => setEditPadIndex(null)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"><X size={18} /></button>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]">{tr('Nome do Pad')}</label>
              <input name="label" defaultValue={banksData[bank][editPadIndex].label} className="w-full h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-main)]" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]">{tr('Nota MIDI (0-127)')}</label>
              <input name="note" type="number" min="0" max="127" defaultValue={banksData[bank][editPadIndex].note} className="w-full h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-main)]" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]">{tr('Velocity (0-127)')}</label>
              <input name="velocity" type="number" min="0" max="127" defaultValue={banksData[bank][editPadIndex].velocity ?? 100} className="w-full h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-main)]" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]">{tr('Tipo de Acorde')}</label>
              <select
                name="chordType"
                value={editChordType}
                onChange={(e) => setEditChordType(e.target.value as ChordType)}
                className="w-full h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-main)]"
              >
                {CHORD_TYPES.map(({ id, label }) => (
                  <option key={id} value={id}>{tr(label)}</option>
                ))}
              </select>
            </div>
            {editChordType === 'custom' && (
              <div>
                <label className="mb-1 block text-xs text-[var(--text-muted)]">{tr('Intervalos (semitons, separados por vírgula)')}</label>
                <input
                  name="chordIntervals"
                  type="text"
                  defaultValue={(banksData[bank][editPadIndex].chordIntervals ?? [0, 4, 7]).join(', ')}
                  placeholder="0, 4, 7"
                  className="w-full h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-main)]"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]">{tr('Cor')}</label>
              <div className="flex flex-wrap gap-3">
                {COLORS.map((c) => (
                  <label key={c} className="cursor-pointer">
                    <input type="radio" name="color" value={c} defaultChecked={banksData[bank][editPadIndex].color === c} className="peer sr-only" />
                    <div className={`h-8 w-8 rounded-full ${c} ring-[var(--nexus-primary)] peer-checked:ring-2`} />
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="flex w-full h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-500 mt-2">
              <Save size={18} /> {tr('Salvar Pad')}
            </button>
          </form>
        </div>
      )}

      <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden p-1.5">
        <div className="grid h-full max-w-full aspect-[3/1] grid-cols-4 grid-rows-4 gap-1.5">
          {banksData[bank].map((pad, index) => {
            const isPressed = pressedPads.has(index);
            const chordBadge = pad.chordType ? CHORD_BADGE[pad.chordType] : '';
            return (
              <div key={index}
                onPointerDown={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); pressPad(index, e.pointerId); }}
                onPointerEnter={(e) => { if (activePointersRef.current.has(e.pointerId)) pressPad(index, e.pointerId); }}
                onPointerUp={(e) => { releasePad(index, e.pointerId); }}
                onPointerCancel={(e) => { releasePad(index, e.pointerId); }}
                onLostPointerCapture={() => releasePad(index, -1)}
                onContextMenu={(e) => { e.preventDefault(); if (isEditMode) { setEditPadIndex(index); setEditChordType(pad.chordType ?? 'single'); } }}
                role="button"
                className={`relative flex min-h-0 cursor-pointer select-none flex-col items-center justify-center overflow-hidden rounded-xl border-2 transition-all duration-100 ease-out ${
                  isPressed
                    ? 'scale-[0.97] z-10 border-cyan-400/80 shadow-[0_0_20px_rgba(34,211,238,0.4)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-elevated)] shadow-sm hover:border-slate-400'
                } ${!isActive ? 'cursor-not-allowed opacity-50 grayscale' : ''}`}
                style={{ touchAction: 'none' }}
              >
                <div
                  className={`absolute inset-0 transition-opacity duration-100 ${pad.color} ${isPressed ? 'opacity-100' : 'opacity-10'}`}
                />

                {isPressed && <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />}

                {chordBadge && (
                  <span className="pointer-events-none absolute left-1 top-1 z-20 rounded bg-black/45 px-1 py-0.5 font-mono text-[8px] font-bold text-white/90">
                    {chordBadge}
                  </span>
                )}

                {isEditMode && (
                  <button
                    type="button"
                    aria-label={tr('Editar Pad')}
                    onClick={(e) => { e.stopPropagation(); setEditPadIndex(index); setEditChordType(pad.chordType ?? 'single'); }}
                    className={`absolute right-1.5 top-1.5 z-20 rounded-md p-1.5 transition-all ${isPressed ? 'bg-black/20 text-white/80' : 'bg-black/10 text-black/50 hover:bg-black/30 dark:bg-black/40 dark:text-white/50 dark:hover:bg-black/80 dark:hover:text-white'}`}
                  >
                    <Settings2 size={12} />
                  </button>
                )}

                <div className="pointer-events-none z-10 flex h-full w-full flex-col items-center justify-center p-0.5">
                  <span className={`w-full truncate px-1 text-center text-[11px] font-extrabold leading-tight drop-shadow-md sm:text-xs ${isPressed ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-[var(--text-main)]'}`}>{pad.label}</span>
                  <span className={`mt-0.5 font-mono text-[9px] font-bold ${isPressed ? 'text-white/90' : 'text-[var(--text-muted)]'}`}>N{pad.note}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
