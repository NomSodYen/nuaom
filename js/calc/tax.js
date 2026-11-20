import { num } from './_util.js';

/** Thai personal income tax brackets on NET income: [upper limit, rate %]. */
export const PIT_BRACKETS = [
  [150000, 0], [300000, 5], [500000, 10], [750000, 15],
  [1000000, 20], [2000000, 25], [5000000, 30], [Infinity, 35],
];

export function pit(netIncome) {
  const x = num(netIncome);
  if (x <= 0) return 0;
  let tax = 0, lower = 0;
  for (const [upper, rate] of PIT_BRACKETS) {
    if (x > lower) tax += (Math.min(x, upper) - lower) * (rate / 100);
    if (x <= upper) break;
    lower = upper;
  }
  return tax;
}

/** Dividend tax credit = gross * t/(1-t), t = corporate tax rate. grossUp = gross + credit. */
export function dividendCredit({ gross, corpRatePct = 20 } = {}) {
  const g = num(gross);
  const t = num(corpRatePct, 20) / 100;
  const credit = t >= 1 ? 0 : (g * t) / (1 - t);
  return { credit, grossUp: g + credit };
}

/**
 * Compare the two ways of handling dividends already taxed 10% at source.
 * - finalTax10: total tax if you leave it as final 10% withholding (= 10% of gross)
 * - includeTax: EXTRA tax payable on top of the 10% already withheld if you include the
 *   dividend (grossed up) in income: pit(other+gross+credit) - pit(other) - credit - 10%*gross.
 *   Negative = refund.
 * - better: 'include' only when includeTax < 0 (you would get money back), else 'final'
 * - diff: how much cheaper the better option is (always >= 0) = |includeTax|
 */
export function compareDividend({ gross, otherNetIncome, corpRatePct = 20 } = {}) {
  const g = Math.max(0, num(gross));
  const other = Math.max(0, num(otherNetIncome));
  const { credit } = dividendCredit({ gross: g, corpRatePct });
  const finalTax10 = g * 0.1;
  const includeTax = pit(other + g + credit) - pit(other) - credit - finalTax10;
  return {
    finalTax10,
    includeTax,
    better: includeTax < 0 ? 'include' : 'final',
    diff: Math.abs(includeTax),
  };
}
