# 🎹 NexusMIDI Pro

**Hub MIDI e sintetizador SoundFont para Android e Web.**

O NexusMIDI Pro transforma o celular ou tablet em controlador MIDI, roteador (patchbay), sintetizador SoundFont, gravador e ferramenta de performance — tudo em uma interface com o tema "Midnight Studio" (Dark/Light). Funciona offline.

[![Build](https://github.com/SEU-USUARIO/SEU-REPOSITORIO/actions/workflows/build.yml/badge.svg)](https://github.com/SEU-USUARIO/SEU-REPOSITORIO/actions/workflows/build.yml)

---

## ✨ Funcionalidades

**Tocar**
- **🎹 Teclado virtual** multi-touch com *glissando*, zoom e rolagem livre.
- **🥁 Pads de bateria**: 16 pads General MIDI em 4 bancos (64 pads no total).
- **🎶 Chord Pads**: cada pad pode tocar uma nota única, um acorde pré-definido (maior, menor, 7ª, etc.) ou intervalos customizados.
- **📈 VU meters** que reagem à velocity real (tocada ou recebida).
- **☀️ Wake Lock**: mantém a tela acesa durante a performance.

**Sintetizador SoundFont**
- Importe arquivos `.sf2`; o app mantém uma **biblioteca** com vários SoundFonts e restaura o último usado ao abrir.
- **Multitimbral**: um som diferente em cada um dos 16 canais, com mute/solo.
- Efeitos: delay, EQ de 3 bandas, compressor, reverb/chorus do SoundFont, envelope, filtro, vibrato, afinação e polifonia ajustável (com *voice stealing*).

**Conectar e rotear**
- **🔗 USB (OTG) e Bluetooth LE MIDI**, com detecção de plug/unplug e reconexão automática de BLE.
- **📡 "Ficar visível"**: o aparelho aparece como instrumento BLE MIDI para DAWs e outros dispositivos.
- **🔀 Roteador matriz**: várias entradas → várias saídas, com filtro de canal, transposição e ativar/desativar por rota. As rotas são salvas.
- **🔍 Monitor MIDI** de mensagens enviadas (TX) e recebidas (RX), com histórico mantido entre as abas.

**Ferramentas de performance**
- **Curva de velocity** (linear, suave, forte, fixa).
- **Escalas** (maior, menor, pentatônicas, blues, modos…) com correção automática das notas.
- **Acorde de um toque** (maior, menor, 7ª, sus…) com inversões.
- **Arpejador** (sobe, desce, sobe/desce, aleatório, como tocado; 1–4 oitavas; gate; latch).
- **Metrônomo**, **tap tempo** e **MIDI Clock** de saída (Start/Stop + 24 ppqn).
- **Gravador MIDI** com reprodução e **exportação `.mid`** (compartilhar no Android).
- **MIDI Learn**: associe knobs/faders físicos aos parâmetros do app.
- **Presets de controles CC**, **MIDI Panic** e roda de Pitch Bend.

**Geral**: interface em **Português (Brasil)** e **English**, temas Dark/Light/System.

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Interface | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Áudio | [SpessaSynth](https://github.com/spessasus/SpessaSynth) (Web Audio + AudioWorklet) |
| Nativo | Capacitor 8 + plugin Java próprio (`NativeMidi`: Android MIDI API, BLE central e periférico) |
| Qualidade | Vitest, Oxlint, Prettier, GitHub Actions |

---

## 🚀 Começando

### Pré-requisitos
- [Node.js](https://nodejs.org/) **22.0 ou superior** (exigido pelo Capacitor CLI)
- Para o app Android: [Android Studio](https://developer.android.com/studio) (ou apenas JDK 21 + Android SDK)

### Rodar na web (desenvolvimento)
```bash
git clone https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
cd SEU-REPOSITORIO
npm ci
npm run dev          # http://localhost:3000
```

USB/BLE nativos só existem no app Android. No navegador você tem teclado, sintetizador, gravador e ferramentas.

Gerar o app Android

```bash
npm ci
npm run cap:sync     # build do bundle + npx cap sync android
npx cap open android # abre no Android Studio e rode no aparelho
```

Ou, direto pela linha de comando (gera android/app/build/outputs/apk/debug/app-debug.apk):

```bash
npm run android:debug
```

Scripts úteis

Comando O que faz
npm run dev Servidor de desenvolvimento
npm run build Build web
npm run build:android Build do bundle embutido no APK (sem Service Worker)
npm run typecheck Verificação de tipos (tsc --noEmit)
npm run lint Lint (Oxlint)
npm test Testes (Vitest)
npm run check typecheck + lint + testes
npm run format Formata o código (Prettier)

---

🚢 Publicar uma versão (CI/CD)

O workflow .github/workflows/build.yml roda typecheck, lint, testes e build em todo PR/push e gera o APK debug como artefato.

Para publicar um Release assinado no GitHub:

1. Crie um keystore (uma única vez) e guarde-o em lugar seguro:
   ```bash
   keytool -genkeypair -v -keystore nexusmidi.jks -alias nexusmidi -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 nexusmidi.jks   # copie a saída
   ```
2. Em Settings → Secrets and variables → Actions, crie: ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD.
3. Crie e envie uma tag:
   ```bash
   git tag v1.1.0 && git push origin v1.1.0
   ```
   O CI compila assembleRelease + bundleRelease e anexa o APK e o AAB ao Release. Sem os segredos, o Release leva apenas o APK de debug.

---

🗂️ Estrutura

```
src/
├── components/        Telas e componentes (teclado, pads, roteador, sintetizador, ferramentas…)
├── constants/         Tabelas de acordes, GM, cores de canais
├── hooks/             useMidiDevices, useStore, useToast
├── i18n/              tr() + dicionário en (pt-BR é o texto-fonte)
├── lib/               Lógica pura e testada (arpejador, escalas, .mid, gravador, MIDI Learn…)
├── services/          midiCore/midiService, synthService, bibliotecas, stores, áudio
└── bootstrap.ts       Serviços que vivem durante todo o app
android/               Projeto Android (plugin NativeMidi + BleMidiServer em Java)
```

Decisões de arquitetura:

· Lógica pura em lib/ (sem React, sem Web Audio, sem Capacitor), com injeção de dependências — por isso é testável sem hardware.
· Stores reativos (createStore + useSyncExternalStore) com persistência segura em localStorage.
· O SpessaSynth é carregado sob demanda (somente ao abrir o primeiro SoundFont), reduzindo o tempo de abertura.

---

🧪 Testes

```bash
npm test
```

Cobrem matemática MIDI, curvas de velocity, escalas/acordes, arpejador, arquivo .mid (ida e volta), gravador/player, MIDI Learn, parser de bytes, roteamento, conexões USB/BLE, falhas de envio, hot-plug, biblioteca de SoundFonts e i18n (todo texto tem tradução).

---

🤝 Contribuindo

Veja o CONTRIBUTING.md. Histórico de mudanças em CHANGELOG.md.

📄 Licença

MIT. Bibliotecas de terceiros em THIRD_PARTY_LICENSES.md.
