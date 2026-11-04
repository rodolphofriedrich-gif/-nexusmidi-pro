import './services/learnService';
import './services/performanceService';
import './services/metronomeService';
import { flushAllStores } from './lib/storeCore';
import { channelsStore, synthSettingsStore } from './services/stores';
import { soundFontLibrary } from './services/soundFontLibrary';
import { synthService } from './services/synthService';

let started = false;

/** Liga os serviços que precisam viver durante todo o app (e não apenas enquanto uma tela está aberta). */
export function startAppServices(): void {
  if (started) return;
  started = true;

  const applyAll = (): void => {
    const settings = synthSettingsStore.get();
    const channels = channelsStore.get();
    synthService.setChannelPrograms(channels.assignments, channels.banks);
    synthService.applySettings(settings);
    synthService.applyMix(settings.volume, channels.muted, channels.solo);
  };

  // Configurações do sintetizador → motor de áudio (só o que mudou).
  let previousSettings = synthSettingsStore.get();
  synthSettingsStore.subscribe(() => {
    const next = synthSettingsStore.get();
    synthService.applySettings(next, previousSettings);
    if (next.volume !== previousSettings.volume) {
      const c = channelsStore.get();
      synthService.applyMix(next.volume, c.muted, c.solo);
    }
    previousSettings = next;
  });

  // Mute/solo
  let previousChannels = channelsStore.get();
  channelsStore.subscribe(() => {
    const next = channelsStore.get();
    if (next.muted !== previousChannels.muted || next.solo !== previousChannels.solo) {
      synthService.applyMix(synthSettingsStore.get().volume, next.muted, next.solo);
    }
    previousChannels = next;
  });

  // Todo SoundFont novo começa "limpo": reaplica programas, efeitos e mix.
  soundFontLibrary.setOnLoaded(applyAll);
  void soundFontLibrary.restore();

  // Ao ir para segundo plano (ou fechar), grava o que ainda estava aguardando o "debounce".
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAllStores();
  });
  window.addEventListener('pagehide', flushAllStores);

  // Navegadores só liberam áudio após um gesto do usuário.
  const unlock = (): void => void synthService.resume();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}
