const cleanToken = (value) => String(value || '').trim().toUpperCase();

const uniqueJoin = (parts) => parts.filter(Boolean).join(' ');

export function parseBlockMeta(blockCode) {
  const raw = String(blockCode || '').trim();
  const normalized = raw.replace(/\s+/g, ' ').toUpperCase();

  if (!normalized) {
    return {
      rawCode: '',
      programcode: '',
      major: '',
      yearlevel: '',
      block: '',
      label: '',
    };
  }

  let prefix = normalized;
  let yearlevel = '';
  let block = '';

  const yearBlockMatch = normalized.match(/^(.*?)[\s-]+(\d+)\s*[- ]\s*([A-Z0-9]+)$/i);
  const compactYearBlockMatch = normalized.match(/^(.*?)-(\d+)([A-Z])$/i);
  const looseYearMatch = normalized.match(/^(.*?)[\s-]+(\d+)$/i);

  if (yearBlockMatch) {
    prefix = yearBlockMatch[1] || '';
    yearlevel = yearBlockMatch[2] || '';
    block = yearBlockMatch[3] || '';
  } else if (compactYearBlockMatch) {
    prefix = compactYearBlockMatch[1] || '';
    yearlevel = compactYearBlockMatch[2] || '';
    block = compactYearBlockMatch[3] || '';
  } else if (looseYearMatch) {
    prefix = looseYearMatch[1] || '';
    yearlevel = looseYearMatch[2] || '';
  }

  prefix = prefix.replace(/[-\s]+$/, '').trim();
  const prefixParts = prefix.split('-').map((part) => cleanToken(part)).filter(Boolean);
  const programcode = prefixParts[0] || cleanToken(prefix);
  const major = prefixParts.slice(1).join('-');

  return {
    rawCode: normalized,
    programcode,
    major,
    yearlevel: String(yearlevel || '').replace(/\D/g, ''),
    block: cleanToken(block),
    label: uniqueJoin([programcode, major ? `(${major})` : '', yearlevel ? `Year ${yearlevel}` : '', block ? `Block ${block}` : '']).trim(),
  };
}

export function getBlockSearchText(block) {
  const meta = parseBlockMeta(block?.blockCode || block?.block_code || '');
  return [
    block?.blockCode,
    block?.block_code,
    block?.programcode,
    block?.program,
    meta.programcode,
    meta.major,
    meta.yearlevel,
    meta.block,
    block?.room,
    block?.session,
    block?.f2fSched,
    block?.examDay,
    block?.examSession,
    block?.examRoom,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}
