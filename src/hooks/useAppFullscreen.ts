import { useCallback, useEffect, useState } from 'react';

/**
 * Modo tela cheia do app (teclado e pads).
 *
 * O modo "visual" (esconde cabeçalho, menu e barras do app) sempre funciona. Além disso tentamos a
 * Fullscreen API do navegador para esconder também a barra do sistema; no WebView do Android ela pode
 * não estar disponível, e nesse caso o app continua em tela cheia visual sem erro.
 */
export function useAppFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enter = useCallback(() => {
    setIsFullscreen(true);
    try {
      const root = document.documentElement;
      if (!document.fullscreenElement && root.requestFullscreen) {
        void root.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
      }
    } catch {
      /* sem suporte: fica só a tela cheia visual */
    }
  }, []);

  const exit = useCallback(() => {
    setIsFullscreen(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) void document.exitFullscreen().catch(() => undefined);
    } catch {
      /* ignora */
    }
  }, []);

  const toggle = useCallback(() => (isFullscreen ? exit() : enter()), [isFullscreen, enter, exit]);

  // Se o usuário sair da tela cheia nativa (gesto do sistema), o app acompanha.
  useEffect(() => {
    const onChange = (): void => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  return { isFullscreen, enter, exit, toggle };
}
