import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  convertMoney,
  formatMoney,
  getCurrencyRateLabel,
  shouldShowCnyConversion
} from '../utils/currency.js';

describe('currency utilities', () => {
  it('uses TWD as the default currency for Taiwan-centered trips', () => {
    assert.equal(DEFAULT_CURRENCY, 'TWD');
    assert.equal(CURRENCIES.TWD.label, '新台币 TWD');
  });

  it('formats CNY without a converted amount', () => {
    assert.deepEqual(formatMoney(100, 'CNY'), {
      primary: '¥100.00',
      converted: '',
      rateLabel: ''
    });
    assert.equal(shouldShowCnyConversion('CNY'), false);
  });

  it('formats TWD with a CNY reference conversion', () => {
    assert.deepEqual(formatMoney(100, 'TWD'), {
      primary: 'NT$100.00',
      converted: '≈ ¥21.21',
      rateLabel: '参考汇率 1 TWD ≈ ¥0.2121'
    });
    assert.equal(getCurrencyRateLabel('TWD'), '参考汇率 1 TWD ≈ ¥0.2121');
  });

  it('formats HKD with a CNY reference conversion', () => {
    assert.deepEqual(formatMoney(100, 'HKD'), {
      primary: 'HK$100.00',
      converted: '≈ ¥86.77',
      rateLabel: '参考汇率 1 HKD ≈ ¥0.8677'
    });
    assert.equal(shouldShowCnyConversion('HKD'), true);
  });

  it('formats negative converted amounts symmetrically', () => {
    assert.deepEqual(formatMoney(-50, 'TWD'), {
      primary: '-NT$50.00',
      converted: '≈ -¥10.61',
      rateLabel: '参考汇率 1 TWD ≈ ¥0.2121'
    });
  });

  it('converts amounts between supported currencies', () => {
    assert.equal(convertMoney(100, 'TWD', 'CNY'), 21.21);
    assert.equal(convertMoney(100, 'HKD', 'CNY'), 86.77);
    assert.equal(convertMoney(100, 'CNY', 'TWD'), 471.48);
  });
});
