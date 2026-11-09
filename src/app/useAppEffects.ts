import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { applyTheme, subscribeSystemTheme } from '../lib/applyTheme';
import { midiManager } from '../services/midiService';
import { acquireWakeLock, releaseWakeLock } from '../services/wakeLockService';
import type { Language, Prefs } from '../services/stores';

type OpenMenu = 'usb' | 'ble' | null;
type Theme = Prefs['theme'];

/**
 * Registra o listener do botão "voltar" do Android com `useRef` para evitar
 * vazamento de listeners (bug já corrigido — o listener é removido no cleanup).
 * Navegação de volta por camada: sidebar → menu → popup de canal → dialog → app.
 */
export function useAndroidBackButton(args: {
  isSidebarOpen: boolean;
  openMenu: OpenMenu;
  isPadChannelOpen: boolean;
  showExit: boolean;
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
  setOpenMenu: Dispatch<SetStateAction<OpenMenu>>;
  setIsPadChannelOpen: Dispatch<SetStateAction<boolean>>;
  setShowExit: Dispatch<SetStateAction<boolean>>;
}) {
  const {
    isSidebarOpen, openMenu, isPadChannelOpen, showExit,
    setIsSidebarOpen, setOpenMenu, setIsPadChannelOpen, setShowExit,
  } = args;

  const uiStateRef = useRef({ isSidebarOpen, openMenu, isPadChannelOpen, showExit });
  useEffect(() => {
    uiStateRef.current = { isSidebarOpen, openMenu, isPadChannelOpen, showExit };
  }, [isSidebarOpen, openMenu, isPadChannelOpen, showExit]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let backListener: { remove: () => void } | undefined;
    const handleBack = () => {
      const state = uiStateRef.current;
      if (state.isSidebarOpen) { setIsSidebarOpen(false); return; }
      if (state.openMenu) { setOpenMenu(null); return; }
      if (state.isPadChannelOpen) { setIsPadChannelOpen(false); return; }
      if (state.showExit) { setShowExit(false); return; }
      setShowExit(true);
    };
    CapApp.addListener('backButton', handleBack).then((l) => { backListener = l; });
    return () => { if (backListener) backListener.remove(); };
  }, [setIsSidebarOpen, setOpenMenu, setIsPadChannelOpen, setShowExit]);
}

/** Sincroniza `<html lang>` e aplica o tema; reage a mudança do SO quando `theme === 'system'`. */
export function useLanguageAndTheme(language: Language, theme: Theme) {
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    return subscribeSystemTheme(() => applyTheme('system'));
  }, [theme]);
}

/** Mantém o Wake Lock ativo conforme a preferência; reativa ao voltar para a aba visível. */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      if (enabled) void acquireWakeLock();
      else void releaseWakeLock();
    };
    apply();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && enabled) void acquireWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      void releaseWakeLock();
    };
  }, [enabled]);
}

/** Nível do VU meter: atualizado por atividade MIDI, zera após 150 ms de silêncio. */
export function useVuMeter(): number {
  const [vuLevel, setVuLevel] = useState(0);

  useEffect(() => {
    let lastActivity = 0;
    const onActivity = (velocity: number) => {
      lastActivity = Date.now();
      setVuLevel(velocity);
    };
    midiManager.addActivityListener(onActivity);
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > 150) setVuLevel(0);
    }, 200);
    return () => {
      midiManager.removeActivityListener(onActivity);
      clearInterval(interval);
    };
  }, []);

  return vuLevel;
}
