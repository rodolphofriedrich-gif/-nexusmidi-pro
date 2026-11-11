/**
 * Constantes de domínio do MIDI.
 *
 * Ficam num módulo próprio para que `midiCore`, `midiSendQueue` (Fase 2) e,
 * futuramente, `midiConnectionManager` (Fase 4) possam importá-las sem criar
 * dependência circular entre si. O `midiCore` reexporta para preservar a API
 * pública existente (`import { VIRTUAL_ID } from './midiCore'` continua válido).
 */
export const VIRTUAL_ID = 'virtual-main';
export const BLE_SERVER_ID = 'ble-server';
