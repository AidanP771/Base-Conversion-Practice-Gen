export function normalizeInput(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s_]/g, '').replace(/^(0x|0b|0o)/, '');
}

export function padLeft(value, width, char = '0') {
  return String(value).padStart(width, char);
}

export function groupRight(value, size, fill = '0') {
  const text = String(value);
  const padded = text.padStart(Math.ceil(text.length / size) * size, fill);
  return padded.match(new RegExp(`.{${size}}`, 'g')) || [];
}

export function groupBits(value, size = 4) {
  return groupRight(value, size).join(' ');
}

export function binaryToHex(bits) {
  return BigInt(`0b${bits || '0'}`).toString(16).toUpperCase();
}

export function hexToBits(hex, width) {
  return BigInt(`0x${hex || '0'}`).toString(2).padStart(width, '0');
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}
