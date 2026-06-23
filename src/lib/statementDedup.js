export function hashTx({ date, amount, description }) {
  const amt = Math.abs(Number(amount) || 0).toFixed(2);
  const desc = String(description || '').slice(0, 30).toLowerCase();
  return `${date}|${amt}|${desc}`;
}

export function dedupeAgainstLog(rows, existing) {
  const seen = new Set((existing || []).map(hashTx));
  const within = new Set();
  const fresh = [];
  const skipped = [];
  for (const r of rows) {
    const h = hashTx(r);
    if (seen.has(h)) { skipped.push(r); continue; }
    const row = within.has(h) ? { ...r, _intraDup: true } : r;
    within.add(h);
    fresh.push(row);
  }
  return { fresh, skipped };
}
