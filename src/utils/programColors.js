export function getProgramColor(programCode) {
  const code = String(programCode || '').toUpperCase();
  // Mapping per request: ProgramColor
  // BSAB -> Green, BSBA -> Yellow, CRIM -> Red, BSED/BTLED -> Blue, BSTM -> Purple, ENTREP -> Orange
  if (code.includes('BSAB')) return { bar: 'green.500', scheme: 'green' };
  if (code.includes('BSBA')) return { bar: 'yellow.500', scheme: 'yellow' };
  if (code.includes('CRIM')) return { bar: 'red.500', scheme: 'red' };
  if (code.includes('BSED') || code.includes('BTLED')) return { bar: 'blue.500', scheme: 'blue' };
  if (code.includes('BSTM') || code.includes('STM') || code.includes('BST')) return { bar: 'purple.500', scheme: 'purple' };
  if (code.includes('ENTREP')) return { bar: 'orange.500', scheme: 'orange' };
  return { bar: 'brand.500', scheme: 'blue' };
}

