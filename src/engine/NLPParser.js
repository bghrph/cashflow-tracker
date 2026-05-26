// On-device pattern-matching parser. Fast, free, offline. The "fast path" in
// the hybrid orchestrator. Logic is lifted verbatim from the legacy build.

import { flattenCategories } from '../lib/categories.js';
import { dateString } from '../lib/dates.js';

const INCOME_SIGNALS = [
  'salary', 'wage', 'paycheck', 'freelance', 'consulting', 'gig', 'rental income', 'tenant',
  'rent received', 'refund', 'reimbursement', 'cashback', 'dividend', 'interest', 'investment',
  'bonus', 'tip', 'commission', 'sold', 'sale', 'received', 'got paid', 'earned', 'income',
  'deposit', 'collected', 'profit', 'revenue',
];

const EXPENSE_SIGNALS = [
  'spent', 'paid', 'bought', 'purchased', 'cost', 'bill', 'rent', 'groceries', 'uber', 'lyft',
  'subscription', 'fee', 'charged', 'food', 'gas', 'electric', 'water', 'insurance', 'mortgage',
  'loan', 'tax', 'repair', 'maintenance', 'dining', 'restaurant', 'coffee', 'gym', 'phone',
  'internet',
];

const KEYWORD_MAP = {
  income: {
    salary: 'Salary', wage: 'Salary', paycheck: 'Salary',
    freelance: 'Freelance', consulting: 'Freelance', gig: 'Freelance',
    'rental income': 'Rental Income', tenant: 'Rental Income', 'rent received': 'Rental Income',
    refund: 'Refunds', reimbursement: 'Refunds', cashback: 'Refunds',
    dividend: 'Investments', interest: 'Investments', investment: 'Investments',
    bonus: 'Bonus', tip: 'Bonus', commission: 'Bonus',
    sold: 'Sales', sale: 'Sales',
  },
  expense: {
    rent: 'Rent/Mortgage', mortgage: 'Rent/Mortgage', housing: 'Rent/Mortgage',
    groceries: 'Groceries', food: 'Groceries', supermarket: 'Groceries', walmart: 'Groceries', costco: 'Groceries',
    restaurant: 'Dining Out', dining: 'Dining Out', takeout: 'Dining Out',
    doordash: 'Dining Out', ubereats: 'Dining Out', lunch: 'Dining Out', dinner: 'Dining Out',
    uber: 'Transport', lyft: 'Transport', taxi: 'Transport', gas: 'Transport', fuel: 'Transport',
    parking: 'Transport', transit: 'Transport', bus: 'Transport', train: 'Transport',
    electric: 'Utilities', electricity: 'Utilities', water: 'Utilities', 'gas bill': 'Utilities', utility: 'Utilities',
    phone: 'Phone/Internet', mobile: 'Phone/Internet', internet: 'Phone/Internet', wifi: 'Phone/Internet',
    netflix: 'Subscriptions', spotify: 'Subscriptions', hulu: 'Subscriptions',
    subscription: 'Subscriptions', membership: 'Subscriptions',
    gym: 'Fitness', fitness: 'Fitness',
    doctor: 'Medical', medical: 'Medical', pharmacy: 'Medical', hospital: 'Medical', dental: 'Medical',
    insurance: 'Insurance',
    coffee: 'Coffee', starbucks: 'Coffee', cafe: 'Coffee',
    clothes: 'Clothing', clothing: 'Clothing', shoes: 'Clothing', fashion: 'Clothing',
    amazon: 'Shopping', shopping: 'Shopping', online: 'Shopping',
    repair: 'Maintenance', maintenance: 'Maintenance', fix: 'Maintenance',
    education: 'Education', tuition: 'Education', course: 'Education', book: 'Education',
    gift: 'Gifts/Donations', donation: 'Gifts/Donations', charity: 'Gifts/Donations',
    travel: 'Travel', hotel: 'Travel', flight: 'Travel', airbnb: 'Travel',
    childcare: 'Childcare', daycare: 'Childcare',
    pet: 'Pet Care', vet: 'Pet Care',
    loan: 'Loan Payment', debt: 'Loan Payment',
  },
};

const WORD_NUMS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000, grand: 1000, k: 1000,
};

const DAY_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_SHORT_LOWER = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function resolveDate(seg) {
  const s = seg.toLowerCase().trim();
  const today = new Date();
  const fmt = (d) => dateString(d.getFullYear(), d.getMonth(), d.getDate());
  if (!s || s === 'today') return fmt(today);
  if (s === 'yesterday') {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return fmt(d);
  }

  const agoMatch = s.match(/(\d+)\s*days?\s*ago/);
  if (agoMatch) {
    const d = new Date(today);
    d.setDate(d.getDate() - parseInt(agoMatch[1]));
    return fmt(d);
  }
  if (s.match(/a\s*week\s*ago/)) {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    return fmt(d);
  }

  const lastDayMatch = s.match(/last\s+(sun|mon|tue|wed|thu|fri|sat)\w*/i);
  if (lastDayMatch) {
    const target = DAY_SHORT.indexOf(lastDayMatch[1].toLowerCase().slice(0, 3));
    if (target >= 0) {
      const d = new Date(today);
      let diff = d.getDay() - target;
      if (diff <= 0) diff += 7;
      d.setDate(d.getDate() - diff);
      return fmt(d);
    }
  }

  for (let mi = 0; mi < 12; mi++) {
    const re = new RegExp(`(?:${MONTH_NAMES[mi]}|${MONTH_SHORT_LOWER[mi]})\\s*(\\d{1,2})`, 'i');
    const mm = s.match(re);
    if (mm) {
      const day = parseInt(mm[1]);
      let yr = today.getFullYear();
      const candidate = new Date(yr, mi, day);
      if (candidate > today) yr--;
      return dateString(yr, mi, day);
    }
  }

  const slashDate = s.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
  if (slashDate) {
    const m2 = parseInt(slashDate[1]) - 1;
    const d2 = parseInt(slashDate[2]);
    let y2 = slashDate[3] ? parseInt(slashDate[3]) : today.getFullYear();
    if (y2 < 100) y2 += 2000;
    return dateString(y2, m2, d2);
  }

  return fmt(today);
}

export function extractDateFromSeg(seg) {
  const s = seg.toLowerCase();
  const patterns = [
    /\b(today)\b/,
    /\b(yesterday)\b/,
    /\b(\d+\s*days?\s*ago)\b/,
    /\b(a\s*week\s*ago)\b/,
    /\b(last\s+(?:sun|mon|tue|wed|thu|fri|sat)\w*)\b/i,
    /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2})\b/i,
    /\b(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return { date: resolveDate(m[1]), matched: m[0] };
  }
  return { date: resolveDate('today'), matched: '' };
}

export function extractAmount(seg) {
  const s = seg.replace(/,(\d{3})/g, '$1');
  const patterns = [
    /\$\s*([\d]+\.?\d*)\s*k\b/i,
    /\$\s*([\d]+\.?\d*)/,
    /([\d]+\.?\d*)\s*k\b/i,
    /([\d]+\.?\d*)\s*(?:dollars?|bucks?|usd)/i,
    /(?:^|\s)([\d]+\.?\d*)(?:\s|$)/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) {
      let v = parseFloat(m[1]);
      if (p.source.includes('k\\b')) v *= 1000;
      if (v > 0) return v;
    }
  }
  const words = s.split(/\s+/);
  let total = 0;
  let current = 0;
  for (const w of words) {
    const wl = w.toLowerCase().replace(/[^a-z]/g, '');
    if (WORD_NUMS[wl] !== undefined) {
      const n = WORD_NUMS[wl];
      if (n === 1000) current = current === 0 ? 1000 : current * 1000;
      else if (n === 100) current = current === 0 ? 100 : current * 100;
      else current += n;
    } else if (current > 0) {
      total += current;
      current = 0;
    }
  }
  total += current;
  return total > 0 ? total : 0;
}

export function classifyType(seg) {
  const s = seg.toLowerCase();
  for (const w of INCOME_SIGNALS) if (s.includes(w)) return 'Income';
  for (const w of EXPENSE_SIGNALS) if (s.includes(w)) return 'Expense';
  return 'Expense';
}

export function matchCategory(seg, type, data) {
  const s = seg.toLowerCase().replace(/[^a-z\s/]/g, '').trim();
  const groups = type === 'Income' ? data.incomeGroups : data.expenseGroups;
  const existing = flattenCategories(groups);
  for (const cat of existing) {
    if (s.includes(cat.toLowerCase())) return { category: cat, isNew: false };
  }
  const map = type === 'Income' ? KEYWORD_MAP.income : KEYWORD_MAP.expense;
  const allKeys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const kw of allKeys) {
    if (s.includes(kw)) {
      const mapped = map[kw];
      return { category: mapped, isNew: !existing.includes(mapped) };
    }
  }
  const stripped = s
    .replace(/\b(today|yesterday|last|ago|days?|week|spent|paid|bought|got|received|earned|for|the|a|an|my|on|at|in|from|to|of)\b/g, '')
    .replace(/\d+/g, '')
    .trim();
  const word = stripped.split(/\s+/).filter((w) => w.length > 2)[0];
  if (word) {
    const cap = word.charAt(0).toUpperCase() + word.slice(1);
    return { category: cap, isNew: true };
  }
  return { category: type === 'Income' ? 'Other Income' : 'Other Expense', isNew: true };
}

export function splitInput(text) {
  // Protect commas inside numeric literals (1,500 → 1·500), split, then restore.
  const safe = text.replace(/(\d),(\d{3})/g, '$1·$2');
  return safe
    .split(/[,;\n]+|(?:\band\b|\balso\b|\bplus\b)/i)
    .map((s) => s.replace(/·/g, ',').trim())
    .filter((s) => s.length > 0);
}

export function parseTransactions(text, data) {
  const segments = splitInput(text);
  const results = [];
  const warnings = [];
  segments.forEach((seg, i) => {
    const amount = extractAmount(seg);
    if (amount <= 0) {
      warnings.push(`No amount found in: "${seg}"`);
      return;
    }
    const { date } = extractDateFromSeg(seg);
    const type = classifyType(seg);
    const { category, isNew } = matchCategory(seg, type, data);
    results.push({
      _idx: i,
      type,
      category,
      amount: parseFloat(amount.toFixed(2)),
      date,
      description: seg.trim(),
      isNew,
      original: seg,
      currencyCode: data.primaryCurrency,
    });
  });
  return { results, warnings };
}

export const __testHooks = { INCOME_SIGNALS, EXPENSE_SIGNALS, KEYWORD_MAP, WORD_NUMS };
