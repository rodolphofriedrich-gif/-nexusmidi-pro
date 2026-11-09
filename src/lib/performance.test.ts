import { beforeEach, describe, expect, it } from 'vitest';
import { Arpeggiator } from './arpeggiator';
import { PerformanceEngine, type PerformanceSettings } from './performance';

const base: PerformanceSettings = {
  velocityCurve: 'linear',
  fixedVelocity: 100,
  scale: 'chromatic',
  scaleRoot: 0,
  chord: 'off',
  chordInversion: 0,
};

describe('PerformanceEngine', () => {
  let sent: string[];
  let settings: PerformanceSettings;
  let arp: Arpeggiator;
  let engine: PerformanceEngine;

  beforeEach(() => {
    sent = [];
    settings = { ...base };
    arp = new Arpeggiator({ emitOn: () => undefined, emitOff: () => undefined });
    engine = new PerformanceEngine({
      send: (ch, note, vel, on) => sent.push(`${on ? 'on' : 'off'}:${ch}:${note}:${vel}`),
      getSettings: () => settings,
      arp,
    });
  });

  it('sem efeitos, repassa a nota como veio', () => {
    engine.noteOn(1, 60, 100);
    engine.noteOff(1, 60);
    expect(sent).toEqual(['on:1:60:100', 'off:1:60:0']);
  });

  it('aplica a curva de velocity', () => {
    settings.velocityCurve = 'fixed';
    settings.fixedVelocity = 55;
    engine.noteOn(1, 60, 127);
    expect(sent).toEqual(['on:1:60:55']);
  });

  it('expande acordes e desliga todas as notas ao soltar', () => {
    settings.chord = 'major';
    engine.noteOn(1, 60, 100);
    expect(sent).toEqual(['on:1:60:100', 'on:1:64:100', 'on:1:67:100']);
    sent.length = 0;
    engine.noteOff(1, 60);
    expect(sent).toEqual(['off:1:60:0', 'off:1:64:0', 'off:1:67:0']);
  });

  it('mudar o acorde com a tecla pressionada não deixa notas presas', () => {
    settings.chord = 'major';
    engine.noteOn(1, 60, 100);
    settings.chord = 'minor'; // muda no meio
    sent.length = 0;
    engine.noteOff(1, 60);
    expect(sent).toEqual(['off:1:60:0', 'off:1:64:0', 'off:1:67:0']); // desliga o que LIGOU (maior)
  });

  it('mudar de canal com a tecla pressionada não deixa notas presas', () => {
    engine.noteOn(1, 60, 100);
    sent.length = 0;
    // A UI simula a mudança de canal passando o canal 2 no NoteOff
    engine.noteOff(2, 60);
    expect(sent).toEqual(['off:1:60:0']); // Deve desligar no canal 1
  });

  it('mesma nota em canais diferentes: solta só a do canal tocado', () => {
    // Toca C4 no canal 1 e no canal 2
    engine.noteOn(1, 60, 100);
    engine.noteOn(2, 60, 100);
    sent.length = 0;

    // Solta só a do canal 1
    engine.noteOff(1, 60);
    expect(sent).toEqual(['off:1:60:0']);

    // A do canal 2 ainda deve estar ativa
    sent.length = 0;
    engine.noteOff(2, 60);
    expect(sent).toEqual(['off:2:60:0']);
  });

  it('quantiza para a escala', () => {
    settings.scale = 'major';
    engine.noteOn(1, 61, 100);
    expect(sent).toEqual(['on:1:60:100']);
  });

  it('percussão (canal 10) ignora escala, acorde e arpejo', () => {
    settings.scale = 'major';
    settings.chord = 'major';
    arp.configure({ enabled: true });
    engine.noteOn(10, 61, 100);
    expect(sent).toEqual(['on:10:61:100']);
  });

  it('com arpejo ligado, não envia notas diretas', () => {
    arp.configure({ enabled: true });
    engine.noteOn(3, 60, 100);
    expect(sent).toEqual([]);
    expect(engine.getArpChannel()).toBe(3);
    arp.stop();
  });

  it('tecla pressionada antes de ligar o arpejo ainda é solta corretamente', () => {
    engine.noteOn(1, 60, 100); // direta
    arp.configure({ enabled: true });
    sent.length = 0;
    engine.noteOff(1, 60);
    expect(sent).toEqual(['off:1:60:0']);
  });

  it('releaseAll solta tudo', () => {
    engine.noteOn(1, 60, 100);
    engine.noteOn(1, 62, 100);
    sent.length = 0;
    engine.releaseAll();
    expect(sent.sort()).toEqual(['off:1:60:0', 'off:1:62:0']);
  });

  it('retocar a mesma tecla desliga a anterior antes', () => {
    engine.noteOn(1, 60, 100);
    sent.length = 0;
    engine.noteOn(1, 60, 100);
    expect(sent).toEqual(['off:1:60:0', 'on:1:60:100']);
  });
});
