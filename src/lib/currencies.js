// 16-currency support with cross-conversion. Rates are approximate, intended for
// display estimates only — flag this clearly in the UI if you ever localize prod.

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'KRW', symbol: '₩', name: 'Korean Won' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'ZAR', symbol: 'R', name: 'S.African Rand' },
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
];

// Rate to USD. e.g. 1 EUR = 1.08 USD
const RATES_TO_USD = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  JPY: 0.0067,
  CAD: 0.74,
  AUD: 0.65,
  CHF: 1.13,
  INR: 0.012,
  MXN: 0.058,
  BRL: 0.2,
  KRW: 0.00075,
  NGN: 0.00065,
  ZAR: 0.055,
  GHS: 0.063,
  AED: 0.27,
  CNY: 0.14,
};

export function convert(amount, fromCode, toCode) {
  if (fromCode === toCode) return amount;
  const from = RATES_TO_USD[fromCode] || 1;
  const to = RATES_TO_USD[toCode] || 1;
  return (amount * from) / to;
}

export function getCurrency(code) {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
}
