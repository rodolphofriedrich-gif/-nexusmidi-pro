export const KEYBOARD_PALETTES = [
  { id: 'default', name: 'Padrão', white: '#ffffff', black: '#23262d' },
  { id: 'custom-blue', name: 'Azul', white: '#D6E6F7', black: '#0F3D73' },
  { id: 'silver-sapphire', name: 'Prata/Safira', white: '#D8DDE3', black: '#0F3D73' },
  { id: 'silver-burgundy-deep', name: 'Prata/Bordo', white: '#BFC5CA', black: '#5C0A1D' },
  { id: 'whitegold-navy', name: 'Ouro/Marinho', white: '#E5E4E2', black: '#1C2C5B' },
  { id: 'champagne-burgundy', name: 'Champagne', white: '#E8D6A7', black: '#6D071A' },
  { id: 'platinum-amethyst', name: 'Ametista', white: '#E5E1DA', black: '#6A0DAD' },
  { id: 'ivory-emerald', name: 'Esmeralda', white: '#F4EBD0', black: '#008C69' },
  { id: 'wood-vintage', name: 'Vintage', white: '#fef3c7', black: '#451a03' },
] as const;

export const VELOCITY_OPTIONS = [
  { id: 30, name: 'Suave' },
  { id: 64, name: 'Médio' },
  { id: 100, name: 'Forte' },
  { id: 127, name: 'Máximo' },
] as const;
