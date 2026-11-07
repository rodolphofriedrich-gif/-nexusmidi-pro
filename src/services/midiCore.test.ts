import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MidiLearn } from '../lib/midiLearn';
import { createMemoryStorage } from '../lib/storeCore';
import type { MidiDestination } from '../types/midi';
import { BLE_SERVER_ID, MidiService, VIRTUAL_ID, type NativeMidiPort, type SynthPort } from './midiCore';
import type { NativeMidiDevice } from './nativeMidi';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function makeNative(devices: NativeMidiDevice[] = []) {
  const handlers: Record<string, (payload: never) => void> = {};
  const sent: Array<{ id: string; data: number[] }> = [];
  const calls: string[] = [];
  let failSend = false;
  const native = {
    initialize: async () => undefined,
    getDevices: async () => ({ devices }),
    connectOutput: async (o: { id: string }) => {
      calls.push(`connectOutput:${o.id}`);
      return { id: o.id, name: o.id };
    },
    connectInput: async (o: { id: string }) => {
      calls.push(`connectInput:${o.id}`);
      return { id: o.id, name: o.id };
    },
    disconnectOutput: async (o?: { id?: string }) => void calls.push(`disconnectOutput:${o?.id}`),
    disconnectInput: async (o?: { id?: string }) => void calls.push(`disconnectInput:${o?.id}`),
    sendTo: async (o: { id: string; data: number[] }) => {
      if (failSend) throw new Error('offline');
      sent.push(o);
    },
    scanBleDevices: async () => ({ devices: [{ address: 'AA:BB', name: 'Piano BLE' }] }),
    connectBleMidi: async (o: { address: string }) => {
      calls.push(`connectBle:${o.address}`);
      return { address: o.address, name: 'x', outputConnected: true, inputConnected: true };
    },
    startBleServer: async () => ({ active: true }),
    stopBleServer: async () => ({ active: false }),
    isBleServerRunning: async () => ({ active: false }),
    addListener: async (name: string, cb: (payload: never) => void) => {
      handlers[name] = cb;
      return { remove: async () => undefined };
    },
  } as unknown as NativeMidiPort;
  return {
    native,
    sent,
    calls,
    handlers,
    setFailSend: (v: boolean) => (failSend = v),
    setDevices: (d: NativeMidiDevice[]) => (devices = d),
  };
}

function makeSynth(ready = true) {
  const calls: string[] = [];
  const synth: SynthPort = {
    getIsReady: () => ready,
    noteOn: (n, v, c) => void calls.push(`on:${c}:${n}:${v}`),
    noteOff: (n, c) => void calls.push(`off:${c}:${n}`),
    controlChange: (cc, v, c) => void calls.push(`cc:${c}:${cc}:${v}`),
    programChange: (p, c) => void calls.push(`pc:${c}:${p}`),
    pitchBend: (v, c) => void calls.push(`pb:${c}:${v}`),
    channelPressure: (v, c) => void calls.push(`cp:${c}:${v}`),
    polyPressure: (n, v, c) => void calls.push(`pp:${c}:${n}:${v}`),
    allNotesOff: () => void calls.push('panic'),
  };
  return { synth, calls };
}

const usbModule: MidiDestination = { id: '7', name: 'Módulo', displayName: 'Módulo', type: 'usb', inputPortCount: 1, outputPortCount: 0 };
const usbKeyboard: MidiDestination = { id: '8', name: 'Teclado', displayName: 'Teclado', type: 'usb', inputPortCount: 0, outputPortCount: 1 };
const usbBoth: MidiDestination = { id: '9', name: 'Ambos', displayName: 'Ambos', type: 'usb', inputPortCount: 1, outputPortCount: 1 };
const bleDevice: MidiDestination = { id: 'ble-AA:BB', name: 'Piano BLE', displayName: 'Piano BLE (BLE)', type: 'ble', bleAddress: 'AA:BB' };

describe('MidiService', () => {
  let n: ReturnType<typeof makeNative>;
  let s: ReturnType<typeof makeSynth>;
  let storage: ReturnType<typeof createMemoryStorage>;
  let service: MidiService;

  beforeEach(async () => {
    n = makeNative();
    s = makeSynth();
    storage = createMemoryStorage();
    service = new MidiService({ native: n.native, synth: s.synth, storage });
    await service.initWebMidi();
  });

  describe('sintetizador local', () => {
    it('recebe notas, CC, program, pressão e pitch bend de 14 bits', () => {
      service.routeMessage(0x91, 60, 100, VIRTUAL_ID);
      service.routeMessage(0x81, 60, 0, VIRTUAL_ID);
      service.routeMessage(0x90, 62, 0, VIRTUAL_ID); // note-on vel 0 = note-off
      service.routeMessage(0xb0, 7, 90, VIRTUAL_ID);
      service.routeMessage(0xc2, 5, 0, VIRTUAL_ID);
      service.routeMessage(0xd0, 33, 0, VIRTUAL_ID);
      service.routeMessage(0xa0, 60, 20, VIRTUAL_ID);
      service.routeMessage(0xe0, 0x00, 0x40, VIRTUAL_ID);
      expect(s.calls).toEqual([
        'on:2:60:100',
        'off:2:60',
        'off:1:62',
        'cc:1:7:90',
        'pc:3:5',
        'cp:1:33',
        'pp:1:60:20',
        'pb:1:8192',
      ]);
    });

    it('não toca quando o sintetizador não está pronto', () => {
      const cold = makeSynth(false);
      const svc = new MidiService({ native: n.native, synth: cold.synth, storage: createMemoryStorage() });
      svc.routeMessage(0x90, 60, 100, VIRTUAL_ID);
      expect(cold.calls).toEqual([]);
    });
  });

  describe('conexão', () => {
    it('módulo de som (só recebe): conecta a saída e cria a rota padrão', async () => {
      await service.connectOutput(usbModule);
      expect(n.calls).toEqual(['connectOutput:7']);
      expect(service.getRoutes()).toMatchObject([{ sourceId: VIRTUAL_ID, destinationId: '7', enabled: true }]);
    });

    it('teclado controlador (só envia): conecta a ENTRADA, sem rota de saída', async () => {
      await service.connectOutput(usbKeyboard);
      expect(n.calls).toEqual(['connectInput:8']);
      expect(service.getRoutes()).toEqual([]);
      expect(service.getConnectedDestinations()).toHaveLength(1);
    });

    it('dispositivo com as duas portas conecta nas duas direções', async () => {
      await service.connectOutput(usbBoth);
      expect(n.calls).toEqual(['connectOutput:9', 'connectInput:9']);
    });

    it('BLE usa a conexão direta pelo endereço', async () => {
      await service.connectOutput(bleDevice);
      expect(n.calls).toEqual(['connectBle:AA:BB']);
      expect(service.getRoutes()).toHaveLength(1);
    });

    it('não duplica a rota padrão ao reconectar', async () => {
      await service.connectOutput(usbModule);
      await service.disconnectOutput('7');
      await service.connectOutput(usbModule);
      expect(service.getRoutes()).toHaveLength(1);
    });

    it('falha em todas as portas propaga o erro e não marca como conectado', async () => {
      const failing = makeNative();
      failing.native.connectOutput = async () => {
        throw new Error('porta ocupada');
      };
      const svc = new MidiService({ native: failing.native, synth: s.synth, storage: createMemoryStorage() });
      await expect(svc.connectOutput(usbModule)).rejects.toThrow('porta ocupada');
      expect(svc.getConnectedDestinations()).toEqual([]);
    });

    it('desconectar envia a tríade de emergência (Sustain Off + All Sound Off + All Notes Off) e fecha as portas', async () => {
      await service.connectOutput(usbBoth);
      n.sent.length = 0;
      await service.disconnectOutput('9');

      // NOVO COMPORTAMENTO: 16 canais × 3 mensagens de emergência = 48
      expect(n.sent).toHaveLength(48);

      // Ordem por canal: 64 (Sustain Off), 120 (All Sound Off), 123 (All Notes Off)
      expect(n.sent[0].data).toEqual([0xb0, 64, 0]);
      expect(n.sent[1].data).toEqual([0xb0, 120, 0]);
      expect(n.sent[2].data).toEqual([0xb0, 123, 0]);

      // Valida que todos os 16 canais receberam a tríade
      for (let ch = 0; ch < 16; ch++) {
        expect(n.sent[ch * 3].data).toEqual([0xb0 + ch, 64, 0]);
        expect(n.sent[ch * 3 + 1].data).toEqual([0xb0 + ch, 120, 0]);
        expect(n.sent[ch * 3 + 2].data).toEqual([0xb0 + ch, 123, 0]);
      }

      expect(n.calls).toContain('disconnectOutput:9');
      expect(n.calls).toContain('disconnectInput:9');
      expect(service.getConnectedDestinations()).toEqual([]);
    });
  });

  describe('rotas', () => {
    beforeEach(async () => {
      await service.connectOutput(usbModule);
      n.sent.length = 0;
    });

    it('o teclado virtual chega ao destino pela rota padrão', async () => {
      service.routeMessage(0x90, 60, 100, VIRTUAL_ID);
      await flush();
      expect(n.sent).toEqual([{ id: '7', data: [0x90, 60, 100] }]);
    });

    it('transposição, canal de saída e filtro de canal de entrada', async () => {
      const [route] = service.getRoutes();
      service.updateRoute(route.id, { transpose: 12, outputChannel: 5, inputChannel: 2 });
      service.routeMessage(0x90, 60, 100, VIRTUAL_ID); // canal 1: filtrado
      service.routeMessage(0x91, 60, 100, VIRTUAL_ID); // canal 2: passa
      await flush();
      expect(n.sent).toEqual([{ id: '7', data: [0x94, 72, 100] }]);
    });

    it('transposição não altera CC e limita em 0–127', async () => {
      const [route] = service.getRoutes();
      service.updateRoute(route.id, { transpose: 24 });
      service.routeMessage(0xb0, 64, 127, VIRTUAL_ID);
      service.routeMessage(0x90, 120, 100, VIRTUAL_ID);
      await flush();
      expect(n.sent.map((m) => m.data)).toEqual([[0xb0, 64, 127], [0x90, 127, 100]]);
    });

    it('program change e pressure saem com 2 bytes', async () => {
      service.routeMessage(0xc0, 12, 0, VIRTUAL_ID);
      service.routeMessage(0xd0, 40, 0, VIRTUAL_ID);
      await flush();
      expect(n.sent.map((m) => m.data)).toEqual([[0xc0, 12], [0xd0, 40]]);
    });

    it('rota desativada ou de outra origem não envia', async () => {
      const [route] = service.getRoutes();
      service.updateRoute(route.id, { enabled: false });
      service.routeMessage(0x90, 60, 100, VIRTUAL_ID);
      service.updateRoute(route.id, { enabled: true, sourceId: 'outro' });
      service.routeMessage(0x90, 60, 100, VIRTUAL_ID);
      await flush();
      expect(n.sent).toEqual([]);
    });

    it('sourceId nulo aceita qualquer entrada', async () => {
      const [route] = service.getRoutes();
      service.updateRoute(route.id, { sourceId: null });
      service.routeMessage(0x90, 60, 100, 'qualquer');
      await flush();
      expect(n.sent).toHaveLength(1);
    });

    it('as rotas sobrevivem a reiniciar o app', () => {
      const again = new MidiService({ native: n.native, synth: s.synth, storage });
      expect(again.getRoutes()).toHaveLength(1);
      expect(again.getRoutes()[0].destinationId).toBe('7');
    });
  });

  describe('entrada', () => {
    it('interpreta várias mensagens e running status em um pacote', () => {
      service.handleIncomingBytes([0x90, 60, 100, 62, 100, 0x80, 60, 0], 'x');
      expect(s.calls).toEqual(['on:1:60:100', 'on:1:62:100', 'off:1:60']);
    });

    it('pacote de BLE: o endereço vira o id usado nas rotas', async () => {
      await service.connectOutput(bleDevice);
      n.sent.length = 0;
      const [route] = service.getRoutes();
      service.updateRoute(route.id, { sourceId: 'ble-AA:BB', destinationId: 'ble-AA:BB' });
      service.handleIncomingBytes([0x90, 60, 100], 'AA:BB');
      await flush();
      expect(n.sent).toEqual([{ id: 'AA:BB', data: [0x90, 60, 100] }]);
    });

    it('listeners de mensagem e atividade (VU) são chamados', () => {
      const messages: number[] = [];
      const activity: number[] = [];
      service.addMessageListener((m) => messages.push(m.data1));
      service.addActivityListener((v) => activity.push(v));
      service.handleIncomingBytes([0x90, 60, 99], 'x');
      expect(messages).toEqual([60]);
      expect(activity).toEqual([99]);
    });

    it('tap recebe tudo (usado pelo gravador)', () => {
      const tap = vi.fn();
      service.addTap(tap);
      service.handleIncomingBytes([0x90, 60, 99], 'x');
      service.routeMessage(0x80, 60, 0, VIRTUAL_ID);
      expect(tap).toHaveBeenCalledTimes(2);
    });

    it('mensagens de tempo real vão às rotas e não poluem o monitor com Clock', async () => {
      await service.connectOutput(usbModule);
      n.sent.length = 0;
      const [route] = service.getRoutes();
      service.updateRoute(route.id, { sourceId: null });
      service.handleIncomingBytes([0xf8], 'x'); // clock
      service.handleIncomingBytes([0xfa], 'x'); // start
      service.handleIncomingBytes([0xfe], 'x'); // active sensing: nunca repassa
      await flush();
      expect(n.sent.map((m) => m.data)).toEqual([[0xf8], [0xfa]]);
      const types = service.getLog().map((e) => e.bytesHex);
      expect(types).toEqual(['fa']);
    });

    it('MIDI Learn consome o CC mapeado e não o repassa ao sintetizador', () => {
      const apply = vi.fn();
      const learn = new MidiLearn([{ id: 'vol', label: 'Vol', apply }], [{ cc: 21, channel: 0, targetId: 'vol' }]);
      service.setLearn(learn);
      service.handleIncomingBytes([0xb0, 21, 77], 'x');
      expect(apply).toHaveBeenCalledWith(77);
      expect(s.calls).toEqual([]);
      service.handleIncomingBytes([0xb0, 22, 77], 'x'); // CC não mapeado segue normalmente
      expect(s.calls).toEqual(['cc:1:22:77']);
    });
  });

  describe('monitor', () => {
    it('separa TX (teclado do app) de RX (dispositivos)', () => {
      service.routeMessage(0x90, 60, 100, VIRTUAL_ID);
      service.handleIncomingBytes([0x90, 62, 90], 'dev');
      const log = service.getLog();
      expect(log.map((e) => e.direction)).toEqual(['RX', 'TX']); // mais recente primeiro
      expect(log[1]).toMatchObject({ type: 'Note On', channel: 1, noteName: 'C4', velocity: 100, bytesHex: '90 3c 64' });
    });

    it('guarda no máximo 300 mensagens e permite limpar', () => {
      for (let i = 0; i < 350; i++) service.routeMessage(0x90, i % 128, 100, VIRTUAL_ID);
      expect(service.getLog()).toHaveLength(300);
      const listener = vi.fn();
      service.subscribeLog(listener);
      service.clearLog();
      expect(service.getLog()).toEqual([]);
      expect(listener).toHaveBeenCalled();
    });

    it('a referência do log muda a cada mensagem (necessário para a interface)', () => {
      const before = service.getLog();
      service.routeMessage(0x90, 60, 100, VIRTUAL_ID);
      expect(service.getLog()).not.toBe(before);
    });
  });

  describe('falhas e hot-plug', () => {
    it('3 falhas seguidas de envio desconectam o destino e avisam a interface', async () => {
      await service.connectOutput(usbModule);
      const lost = vi.fn();
      service.setCallbacks(() => undefined, lost);
      n.setFailSend(true);
      for (let i = 0; i < 3; i++) {
        service.routeMessage(0x90, 60 + i, 100, VIRTUAL_ID);
        await flush();
      }
      expect(lost).toHaveBeenCalledTimes(1);
      expect(service.getConnectedDestinations()).toEqual([]);
    });

    it('um envio bem-sucedido zera o contador de falhas', async () => {
      await service.connectOutput(usbModule);
      const lost = vi.fn();
      service.setCallbacks(() => undefined, lost);
      for (const fail of [true, true, false, true, true]) {
        n.setFailSend(fail);
        service.routeMessage(0x90, 60, 100, VIRTUAL_ID);
        await flush();
      }
      expect(lost).not.toHaveBeenCalled();
    });

    it('USB removido (devicesChanged) é desconectado automaticamente', async () => {
      const dev: NativeMidiDevice = { id: '7', name: 'Módulo', type: 'usb', inputPortCount: 1, outputPortCount: 0 };
      n.setDevices([dev]);
      await service.refreshDevices();
      await service.connectOutput(usbModule);
      const lost = vi.fn();
      service.setCallbacks(() => undefined, lost);
      n.setDevices([]); // cabo removido
      n.handlers['devicesChanged'](undefined as never);
      await flush();
      expect(lost).toHaveBeenCalledTimes(1);
      expect(service.getConnectedDestinations()).toEqual([]);
    });
  });

  describe('panic e clock', () => {
    it('sendPanic silencia o synth e todos os destinos (CC 64, 120 e 123 em 16 canais)', async () => {
      await service.connectOutput(usbModule);
      n.sent.length = 0;
      await service.sendPanic();
      expect(s.calls).toContain('panic');
      expect(n.sent).toHaveLength(16 * 3);
      expect(n.sent.filter((m) => m.data[1] === 123)).toHaveLength(16);
      expect(n.sent.filter((m) => m.data[1] === 120)).toHaveLength(16);
      expect(n.sent.filter((m) => m.data[1] === 64 && m.data[2] === 0)).toHaveLength(16);
    });

    it('sendPanic em um canal só', async () => {
      await service.connectOutput(usbModule);
      n.sent.length = 0;
      await service.sendPanic([3]);
      expect(n.sent).toHaveLength(3);
      expect(n.sent.every((m) => m.data[0] === 0xb2)).toBe(true);
    });

    it('broadcastRealtime envia 1 byte aos destinos e rejeita status inválidos', async () => {
      await service.connectOutput(usbModule);
      n.sent.length = 0;
      await service.broadcastRealtime(0xf8);
      await service.broadcastRealtime(0x90);
      expect(n.sent).toEqual([{ id: '7', data: [0xf8] }]);
    });
  });

  describe('BLE visível (servidor)', () => {
    it('com o servidor ativo, o que o app toca também é enviado ao servidor', async () => {
      expect(await service.startBleServer()).toBe(true);
      service.routeMessage(0x90, 60, 100, VIRTUAL_ID);
      service.handleIncomingBytes([0x90, 61, 100], 'dev'); // entrada externa não vai ao servidor
      await flush();
      expect(n.sent).toEqual([{ id: BLE_SERVER_ID, data: [0x90, 60, 100] }]);
    });

    it('stop desliga o envio', async () => {
      await service.startBleServer();
      await service.stopBleServer();
      service.routeMessage(0x90, 60, 100, VIRTUAL_ID);
      await flush();
      expect(n.sent).toEqual([]);
    });
  });

  describe('API de envio', () => {
    it('sendKeyboardNote, CC, program, pitch bend e pressure retornam o hex enviado', async () => {
      expect((await service.sendKeyboardNote(1, 60, 100, true)).hex).toBe('90 3c 64');
      expect((await service.sendKeyboardNote(1, 60, 100, false)).hex).toBe('80 3c 64');
      expect((await service.sendKeyboardNote(1, 60, 0, true)).hex).toBe('80 3c 00');
      expect((await service.sendControlChange(2, 7, 100)).hex).toBe('b1 07 64');
      expect((await service.sendProgramChange(3, 5)).hex).toBe('c2 05');
      expect((await service.sendPitchBend(1, 8192)).hex).toBe('e0 00 40');
      expect((await service.sendChannelPressure(1, 50)).hex).toBe('d0 32');
    });

    it('valores fora da faixa são limitados', async () => {
      expect((await service.sendKeyboardNote(99, 300, 999, true)).hex).toBe('9f 7f 7f');
    });
  });
});
