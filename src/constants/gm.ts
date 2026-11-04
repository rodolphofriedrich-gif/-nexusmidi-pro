/** Categorias da lista de instrumentos (o filtro usa estes nomes; "Todos" mostra tudo). */
export const PRESET_CATEGORIES = ['Todos', 'Piano', 'Órgão', 'Guitarra', 'Baixo', 'Cordas', 'Metais', 'Madeiras', 'Synth', 'Baterias'] as const;

/** Categoria de um programa melódico, pela família General MIDI (de 8 em 8 programas). */
export function categoryOfProgram(program: number): string {
  if (program <= 7) return 'Piano';
  if (program >= 16 && program <= 23) return 'Órgão';
  if (program >= 24 && program <= 31) return 'Guitarra';
  if (program >= 32 && program <= 39) return 'Baixo';
  if (program >= 40 && program <= 55) return 'Cordas';
  if (program >= 56 && program <= 63) return 'Metais';
  if (program >= 64 && program <= 79) return 'Madeiras';
  if (program >= 80 && program <= 103) return 'Synth';
  return 'Outros';
}
