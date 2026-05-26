export function formatMoney(symbol, amount) {
  const n = Number(amount) || 0;
  const body = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `−${symbol}${body}` : `${symbol}${body}`;
}

export function formatCompactMoney(symbol, amount) {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${symbol}${abs.toFixed(2)}`;
}
