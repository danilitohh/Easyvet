import { describe, expect, it } from 'vitest';
import {
  calculateTotals,
  formatMoney,
  lineSubtotal,
  moneyUnits,
  quantityUnits,
  unitsToDecimal,
} from './commercialUtils';

describe('commercial exact decimal helpers', () => {
  it('parses and serializes quantity and money without floating point', () => {
    expect(quantityUnits('123.456789')).toBe(123456789n);
    expect(moneyUnits('900719925474099.1234')).toBe(9007199254740991234n);
    expect(unitsToDecimal(9007199254740991234n, 4n, false)).toBe('900719925474099.1234');
  });

  it('rounds quantity-price products once to four-place money precision', () => {
    expect(lineSubtotal('2.000001', '10')).toBe(200000n);
    expect(lineSubtotal('1.000001', '0.0001')).toBe(1n);
  });

  it('calculates subtotal, discount and payable total with fixed-point values', () => {
    expect(
      calculateTotals([
        { quantity: '2', unitPrice: '10.25', discountAmount: '1.25' },
        { quantity: '1.5', unitPrice: '4', discountAmount: '0' },
      ]),
    ).toEqual({ subtotal: 265000n, discountTotal: 12500n, grandTotal: 252500n });
  });

  it('formats large and negative balances with locale separators', () => {
    expect(formatMoney('1234.50', 'COP')).toContain('1.234,50');
    expect(formatMoney('-12.5', 'COP')).toContain('-');
  });
});
