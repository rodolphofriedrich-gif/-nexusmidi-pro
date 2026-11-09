# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não lançado]

### Adicionado
- **Várias bibliotecas SoundFont ao mesmo tempo**: cada SF2 da aba Biblioteca tem um interruptor liga/desliga e uma prioridade (▲▼). Se dois SoundFonts tiverem o mesmo instrumento, vale o de maior prioridade.
- **Baterias**: kits do banco 128 do SF2 aparecem no filtro "Baterias" e tocam em qualquer canal (sem transposição).
- Cor por canal MIDI (como em uma DAW) nos canais e na lista de instrumentos.

### Alterado
- **Estúdio:** o contêiner das abas agora é flex, então as telas ocupam a altura disponível e rolam (antes o Mixer, a Biblioteca e a lista de instrumentos eram cortados). No celular na horizontal, o painel da direita do Mixer mostra um cartão por vez (Performance, Pitch Bend, Presets). O cabeçalho vai até a borda e só o conteúdo respeita o recorte da câmera.
- **Layout em tablets e telas largas:** o cabeçalho acompanha a área segura (o botão deixava de caber com a barra de status), as abas ficam centralizadas em telas grandes, o teclado virtual preenche a largura e mantém a proporção das teclas, a grade de pads não estica demais, a matriz de roteamento e o Mixer ficam centralizados e limitados em largura, o menu do filtro do Monitor abre junto do botão e os diálogos usam `dvh` em vez de `vh`.
- **Cada canal MIDI tem seus próprios ajustes** (volume, reverb, chorus, transposição, envelope, filtro, vibrato, afinação e pitch bend), sem interferir nos outros. Delay, EQ, compressor e polifonia continuam globais (o motor de áudio tem uma única cadeia de efeitos). As cenas também guardam os ajustes de cada canal.
- **A lista de instrumentos vem do SoundFont importado** (nomes, bancos e programas lidos do arquivo), e não mais de uma lista fixa de 128 sons. Sem SF2 ligado, a lista fica vazia com instruções.
- Seleção de instrumento guarda banco + programa por canal (`channelsStore.banks`).
- Barras de rolagem mais grossas e em ciano (`02-scrollbars.css`).

### Corrigido
- **Notas presas** ao trocar de canal MIDI entre Note On e Note Off (agora guarda o canal original por tecla).
- **Notas presas** quando a mesma nota é tocada em dois canais simultaneamente.
- **Sustain** não é mais restaurado do `localStorage` — a UI sempre começa desligada, evitando inconsistência com o sintetizador.
- **`padsStore`** com sanitização profunda: dados corrompidos no `localStorage` não quebram mais o render.
- **BLE desconectado** durante a performance: a UI mostra "Reconectando…" em vez de "Desconectado" repetidamente.
- **Fila MIDI** não trava mais quando o dispositivo USB é removido no meio de um envio.
- **Tema claro** com contraste adequado nos botões índigo (letras brancas).
- O contador "128 sons" aparecia mesmo sem nenhuma biblioteca importada.
- A lista de presets não rolava (altura do container não estava definida).
- Carregar uma cena não reaplicava os instrumentos dos canais ao sintetizador.
- Ao importar um SoundFont, as atribuições de canal eram apagadas.

## [1.0.0]

### Corrigido
- **Falhas que derrubavam o app**: `sendPanic` e `sendChannelPressure` (tela de Controles: MIDI Panic e aplicar preset) eram chamados mas não existiam.
- **"Ficar visível" (BLE) não funcionava**: o JS chamava `startBleServer`/`stopBleServer`/`isBleServerRunning`, que não existiam no plugin Java. Agora há um servidor BLE MIDI completo (`BleMidiServer`).
- **Teclados USB não conectavam**: o app só abria a porta de saída (um teclado controlador não tem). Agora conecta entrada e/ou saída conforme as portas do dispositivo.
- Sem rota, o teclado virtual não chegava aos dispositivos externos: uma rota padrão é criada ao conectar.
- O SoundFont salvo só era restaurado ao abrir a aba "Sintetizador" — agora é restaurado na abertura do app.
- O sintetizador era recriado a cada carregamento (vazamento de nós de áudio e de memória). Agora o grafo é criado uma vez.
- Sliders de Attack/Release/Cutoff/Resonance/Vibrato saturavam em ~79% (escala de CC multiplicada por 1,27 indevidamente).
- Os sliders do painel de configuração eram remontados a cada movimento (componente definido dentro de outro componente).
- Notas presas ao mudar a transposição entre note-on e note-off; polifonia cheia ignorava a nota nova (agora encerra a mais antiga); a percussão (canal 10) era transposta.
- Pitch Bend, Channel Pressure e Poly Aftertouch agora chegam ao sintetizador.
- Pacotes MIDI com várias mensagens / running status eram lidos pela metade.
- O monitor MIDI perdia o histórico ao trocar de aba e não mostrava as mensagens enviadas (TX).
- Erros de envio eram silenciados: agora 3 falhas seguidas desconectam o destino e avisam o usuário.
- `allNotesOff` enviava os 16 canais em sequência; agora em paralelo.
- `AudioContext` não força mais 44,1 kHz (menos reamostragem/latência).
- Escaneamento BLE no Android ≤ 11 exigia permissão de localização que nunca era pedida; conexão BLE direta não é mais limitada ao Android 13+.
- Callback de permissão rodava sempre a busca, mesmo quando a chamada original era "conectar".
- Ícone `icon-192.png` referenciado no `index.html` não existia; PWA com ícones PNG (192/512/maskable).
- O nome "NEXUSMIDI Pro" no cabeçalho nunca aparecia: as classes `xs:` não tinham breakpoint definido (agora `--breakpoint-xs: 30rem`).
- Importação circular `MidiKeyboard` ↔ `App` removida; VU não usa mais valores aleatórios.
- IndexedDB: transação do SoundFont não depende mais de `FileReader` dentro da transação.

### Adicionado
- **Chord Pads**: cada pad pode tocar uma nota única, um acorde pré-definido (maior, menor, 7ª, sus…) ou intervalos customizados, com badge visual do tipo de acorde.
- **Wake Lock**: mantém a tela acesa durante a performance (configurável em Configurações).
- **Aba "Tocar"** unificada com sub-abas Teclado e Pads.
- **Aba "MIDI"** unificada com sub-abas Roteador e Monitor.
- **Aba "Configurações"** separada, com Aparência (tema), Idioma, Preferências Gerais e Sobre.
- **Sub-aba "Gravador"** em Ferramentas, separada do Arranjo.
- **Tema "Midnight Studio"**: Dark (azul-marinho quase preto, grafite azulado), Light (cinza claro, alumínio), System. Índigo para seleção, ciano para atividade MIDI.
- **Reconexão BLE automática** com backoff exponencial (2s, 4s, 8s) e notificação "Reconectando…".
- **Fila MIDI por destino** com limite de profundidade: em saturação, mensagens de baixa prioridade (clocks) são descartadas antes das notas.
- **Cor por canal MIDI** (como em uma DAW) nos canais e na lista de instrumentos.
- Biblioteca com vários SoundFonts. Rotas, configurações do sintetizador, canais, ferramentas e MIDI Learn são salvos.
- Tela **Ferramentas**: curva de velocity, escalas, acordes, arpejador, metrônomo/tap tempo/MIDI Clock, gravador com exportação `.mid`, MIDI Learn e idioma.
- Plug/unplug USB detectado (`devicesChanged`); roteamento de Clock/Start/Stop.
- Interface em Português e Inglês; `ErrorBoundary`.
- Testes (Vitest), Oxlint, Prettier, CI com cache, build de release assinado e GitHub Release por tag.

### Alterado
- `index.css` (24 KB) dividido em `src/styles/*.css`, um arquivo por área.
- `App.tsx` dividido em hooks e componentes; `services/` reorganizado com injeção de dependências.
- Build Android sem Service Worker (`vite build --mode android`).
- Release com R8/shrinkResources; `allowBackup` desativado; depuração de WebView só em builds debug.
- Nome padronizado para **NexusMIDI Pro**.
- - Menu principal reduzido a 4 áreas: **Tocar, MIDI, Estúdio, Configurações**.
- Sub-abas no cabeçalho (Tocar → Teclado/Pads; MIDI → Roteador/Monitor; Estúdio → Sintetizador/Mixer/Ferramentas).
- Botão **Voltar** do Android usa `useRef` para ler o estado atualizado — sem vazar listeners.
- Botões de tema e idioma movidos para Configurações (removidos do menu lateral).
- CI usa `npm ci` em vez de `npm install` (build reproduzível a partir do lockfile).

### Removido
- Componentes sem uso, workflow duplicado (`Yaml`), arquivos do AI Studio e dependências não utilizadas (`@google/genai`, `express`, `dotenv`, `motion`, `tsx`, `esbuild`, `autoprefixer`).
- Arquivos gerados (`android/app/src/main/assets/public`) que estavam versionados.
- - **Tela cheia nos pads** (removida para evitar bugs de interface).
- **Tema "DAW" antigo** (grafite + ciano único) — substituído por "Midnight Studio".
- Botão de ligar/desligar o teclado virtual (redundante com a detecção de conexão).
- Seletor de paleta de cores do teclado.
