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
