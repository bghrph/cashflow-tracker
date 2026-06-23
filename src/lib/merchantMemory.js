export function normalizeMerchant(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/\d+$/, '').slice(0, 25);
}

export function lookup(memory, description) {
  const k = normalizeMerchant(description);
  return k && memory && memory[k] ? memory[k] : null;
}

export function remember(memory, description, category) {
  const k = normalizeMerchant(description);
  if (!k) return memory || {};
  return { ...(memory || {}), [k]: category };
}
