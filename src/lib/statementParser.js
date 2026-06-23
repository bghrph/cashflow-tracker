const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
const pad2 = (n) => String(n).padStart(2, '0');

export function stripBom(text) {
  return typeof text === 'string' && text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function detectDelimiter(line) {
  const counts = {
    ',': (line.match(/,/g) || []).length,
    '\t': (line.match(/\t/g) || []).length,
    ';': (line.match(/;/g) || []).length,
  };
  let best = ',', max = counts[','];
  for (const d of ['\t', ';']) if (counts[d] > max) { max = counts[d]; best = d; }
  return max > 0 ? best : ',';
}

export function parseDelimitedLine(line, delim) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

export function normalizeAmount(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.includes('-')) neg = true;
  s = s.replace(/[^0-9.]/g, '');
  if (s === '' || s === '.') return null;
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}

export function normalizeDate(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  let m;
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/))) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/))) {
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yr}-${pad2(m[1])}-${pad2(m[2])}`;
  }
  if ((m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s](\d{2,4})$/))) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (!mo) return null;
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yr}-${pad2(mo)}-${pad2(m[1])}`;
  }
  return null;
}

const RE = {
  date: /date|posted|trans/i,
  desc: /desc|name|memo|payee|detail|narrative|transaction/i,
  amount: /^amount$|amt|^value$/i,
  debit: /debit|withdrawal|charge/i,
  credit: /credit|deposit|payment/i,
};

export function mapColumns(header) {
  const find = (re, exclude = []) => header.findIndex((h, i) => !exclude.includes(i) && re.test(h));
  const date = find(RE.date);
  const amount = find(RE.amount);
  const debit = find(RE.debit);
  const credit = find(RE.credit);
  const description = find(RE.desc, [date].filter((i) => i >= 0));
  return { date, description, amount, debit, credit };
}

function hasRequired(c) {
  return c.date >= 0 && c.description >= 0 && (c.amount >= 0 || c.debit >= 0 || c.credit >= 0);
}

function buildRow(fields, c) {
  const date = normalizeDate(fields[c.date]);
  if (!date) return null;
  const description = (fields[c.description] || '').trim();
  let amount = null, type = 'Expense';
  if (c.debit >= 0 || c.credit >= 0) {
    const deb = c.debit >= 0 ? normalizeAmount(fields[c.debit]) : null;
    const cred = c.credit >= 0 ? normalizeAmount(fields[c.credit]) : null;
    if (deb && Math.abs(deb) > 0) { amount = Math.abs(deb); type = 'Expense'; }
    else if (cred && Math.abs(cred) > 0) { amount = Math.abs(cred); type = 'Income'; }
    else return null;
  } else {
    const a = normalizeAmount(fields[c.amount]);
    if (a == null || a === 0) return null;
    amount = Math.abs(a);
    type = a < 0 ? 'Expense' : 'Income';
  }
  return { date, description, amount: Number(amount.toFixed(2)), type };
}

function detectPositional(rows) {
  const sample = rows.slice(0, Math.min(rows.length, 15));
  const n = Math.max(...sample.map((r) => r.length));
  let dateCol = -1, amtCol = -1;
  for (let col = 0; col < n; col++) {
    let dOk = 0, aOk = 0, cells = 0;
    for (const r of sample) {
      if (col < r.length) {
        cells++;
        if (normalizeDate(r[col])) dOk++;
        const a = normalizeAmount(r[col]);
        if (a != null && a !== 0) aOk++;
      }
    }
    if (cells > 0) {
      if (dateCol < 0 && dOk / cells >= 0.6) dateCol = col;
      else if (amtCol < 0 && col !== dateCol && aOk / cells >= 0.6) amtCol = col;
    }
  }
  if (dateCol < 0 || amtCol < 0) return null;
  let descCol = -1, bestLen = -1;
  for (let col = 0; col < n; col++) {
    if (col === dateCol || col === amtCol) continue;
    let total = 0, cells = 0;
    for (const r of sample) {
      if (col < r.length) { cells++; total += (r[col] || '').replace(/[0-9.,$()\-]/g, '').length; }
    }
    const avg = cells ? total / cells : 0;
    if (avg > bestLen) { bestLen = avg; descCol = col; }
  }
  return { date: dateCol, description: descCol, amount: amtCol, debit: -1, credit: -1 };
}

export function parseStatement(text) {
  const clean = stripBom(typeof text === 'string' ? text : '').replace(/\r\n?/g, '\n').trim();
  if (!clean) return { ok: false, error: 'empty' };
  const lines = clean.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return { ok: false, error: 'empty' };
  const delim = detectDelimiter(lines[0]);
  const parsed = lines.map((l) => parseDelimitedLine(l, delim));

  let columns = null, dataRows = null;
  for (let i = 0; i < Math.min(parsed.length, 10); i++) {
    const c = mapColumns(parsed[i]);
    if (hasRequired(c)) { columns = c; dataRows = parsed.slice(i + 1); break; }
  }
  if (!columns) {
    const pos = detectPositional(parsed);
    if (pos) { columns = pos; dataRows = parsed; }
    else return { ok: true, needsManualMap: true, sampleColumns: parsed.slice(0, 5), delim, rawRows: parsed };
  }

  const rows = [];
  for (const f of dataRows) { const r = buildRow(f, columns); if (r) rows.push(r); }
  if (rows.length === 0) return { ok: false, error: 'no-transactions' };
  return { ok: true, rows, columns, delim };
}
