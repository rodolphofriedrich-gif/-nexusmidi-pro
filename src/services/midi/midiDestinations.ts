import type { MidiDestination } from '../../types/midi';
import { BLE_SERVER_ID } from './midiConstants';

/**
 * Destino virtual que representa o servidor BLE MIDI visível. Usado para
 * enviar mensagens do app para clientes BLE conectados ao servidor.
 *
 * Não é uma conexão real — o `sendQueue` trata o `BLE_SERVER_ID` como um
 * alvo especial no `resolveTarget`. Antes era um método privado do
 * `MidiService`; extraído para módulo próprio na Fase 4 para que tanto o
 * core (`routeMessage`, `sendPanic`, `broadcastRealtime`) quanto o
 * `MidiConnectionManager` possam usá-lo.
 */
export function bleServerDestination(): MidiDestination {
  return { id: BLE_SERVER_ID, name: 'BLE MIDI (visível)', displayName: 'BLE MIDI (visível)', type: 'ble' };
}
