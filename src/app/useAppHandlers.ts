import { useCallback } from 'react';
import { tr } from '../i18n';
import { midiManager, VIRTUAL_ID } from '../services/midiService';
import { NativeMidi } from '../services/nativeMidi';
import { performanceEngine } from '../services/performanceService';
import { prefsStore, type Prefs } from '../services/stores';
import type { ToastType } from '../hooks/useToast';

type Notify = (text: string, type?: ToastType, durationMs?: number) => void;

interface UseAppHandlersArgs {
  prefs: Prefs;
  showMessage: Notify;
  setShowExit: (value: boolean) => void;
  setIsRouterRefreshing: (value: boolean) => void;
  refreshDevices: () => Promise<void>;
  firstConnectedDeviceId: string | undefined;
}

/**
 * Handlers de alto nível do App: notas, sustain, panic, saída, refresh do roteador
 * e nova rota. Isolado para ser testável e para o App.tsx ficar só como composição.
 */
export function useAppHandlers({
  prefs,
  showMessage,
  setShowExit,
  setIsRouterRefreshing,
  refreshDevices,
  firstConnectedDeviceId,
}: UseAppHandlersArgs) {
  const handleNoteOn = useCallback(
    (note: number, channel: number, velocity?: number, sourceId?: string) =>
      performanceEngine.noteOn(channel, note, velocity ?? prefsStore.get().velocity, sourceId),
    [],
  );

  const handleNoteOff = useCallback(
    (note: number, channel: number, sourceId?: string) =>
      performanceEngine.noteOff(channel, note, sourceId),
    [],
  );

  const handleDisabledPress = useCallback(() => {
    showMessage(tr('Conecte um destino MIDI ou carregue um SoundFont.'), 'warn', 2500);
  }, [showMessage]);

  const handleToggleSustain = useCallback(async () => {
    const next = !prefs.sustain;
    prefsStore.set({ sustain: next });
    try {
      // O Sustain na UI é global: enviamos CC64 para TODOS os 16 canais para
      // garantir que nenhum canal fique com o pedal "preso" após troca de canal.
      const jobs: Promise<unknown>[] = [];
      for (let ch = 1; ch <= 16; ch++) {
        jobs.push(midiManager.sendControlChange(ch, 64, next ? 127 : 0));
      }
      await Promise.all(jobs);
      showMessage(next ? tr('Sustain Ligado') : tr('Sustain Desligado'), 'info', 1500);
    } catch (error) {
      showMessage(tr('Erro ao enviar Sustain: {message}', { message: error instanceof Error ? error.message : '' }), 'error', 2500);
    }
  }, [prefs.sustain, showMessage]);

  const handlePanic = useCallback(async () => {
    try {
      const result = await midiManager.sendPanic();
      if (result.failed.length > 0) {
        showMessage(
          tr('MIDI Panic enviado parcialmente. Dispositivos sem resposta: {names}', { names: result.failed.join(', ') }),
          'warn',
          3500,
        );
      } else {
        showMessage(tr('MIDI Panic enviado'), 'info', 1500);
      }
    } catch {
      showMessage(tr('Falha no MIDI Panic'), 'error', 2500);
    }
  }, [showMessage]);

  const handleConfirmExit = useCallback(async () => {
    setShowExit(false);
    try {
      await NativeMidi.fecharApp();
    } catch {
      window.close();
    }
  }, [setShowExit]);

  const handleRefreshRouter = useCallback(async () => {
    setIsRouterRefreshing(true);
    try {
      await refreshDevices();
    } finally {
      setIsRouterRefreshing(false);
    }
  }, [refreshDevices, setIsRouterRefreshing]);

  const addNewRoute = useCallback(() => {
    midiManager.addRoute({ sourceId: VIRTUAL_ID, destinationId: firstConnectedDeviceId ?? '' });
  }, [firstConnectedDeviceId]);

  return {
    handleNoteOn,
    handleNoteOff,
    handleDisabledPress,
    handleToggleSustain,
    handlePanic,
    handleConfirmExit,
    handleRefreshRouter,
    addNewRoute,
  };
}
