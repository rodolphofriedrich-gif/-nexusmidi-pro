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
