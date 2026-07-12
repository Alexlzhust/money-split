import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildRepaymentTransaction,
  deriveCustomTotal,
  getDefaultPayer,
  getDraftCurrency
} from '../utils/transactionDraft.js';
import { calculateNetBalances } from '../utils/settlements.js';

describe('transaction draft helpers', () => {
  it('derives a cent-rounded total from custom splits', () => {
    assert.equal(deriveCustomTotal({ 阿宁: '10.10', 小林: 20.205, 小周: '' }), 30.31);
  });

  it('uses a remembered payer only while that payer is a current member', () => {
    assert.equal(getDefaultPayer(['阿宁', '小林'], '小林'), '小林');
    assert.equal(getDefaultPayer(['阿宁', '小林'], '小周'), '阿宁');
    assert.equal(getDefaultPayer([], '小林'), '');
    assert.equal(getDefaultPayer(undefined, '阿宁'), '');
  });

  it('prefers a saved transaction currency over the settlement currency', () => {
    assert.equal(getDraftCurrency(null, 'HKD'), 'HKD');
    assert.equal(getDraftCurrency({ currency: 'CNY' }, 'HKD'), 'CNY');
  });

  it('maps a repayment to custom transaction financial fields', () => {
    assert.deepEqual(
      buildRepaymentTransaction({ sender: '小林', recipient: '阿宁', amount: '50.005' }),
      {
        title: '小林 还款给 阿宁',
        payer: '小林',
        splitType: 'CUSTOM',
        totalAmount: 50.01,
        splits: { 阿宁: 50.01 }
      }
    );
  });

  it('trims member names when mapping a valid repayment', () => {
    assert.deepEqual(
      buildRepaymentTransaction({ sender: ' 小林 ', recipient: ' 阿宁 ', amount: 50 }),
      {
        title: '小林 还款给 阿宁',
        payer: '小林',
        splitType: 'CUSTOM',
        totalAmount: 50,
        splits: { 阿宁: 50 }
      }
    );
  });

  it('rejects repayments without distinct members or a positive amount', () => {
    assert.equal(buildRepaymentTransaction({ sender: '', recipient: '阿宁', amount: 50 }), null);
    assert.equal(buildRepaymentTransaction({ sender: '小林', recipient: '', amount: 50 }), null);
    assert.equal(
      buildRepaymentTransaction({ sender: '阿宁', recipient: '阿宁', amount: 50 }),
      null
    );
    assert.equal(
      buildRepaymentTransaction({ sender: '小林', recipient: '阿宁', amount: 0 }),
      null
    );
    assert.equal(
      buildRepaymentTransaction({ sender: '小林', recipient: '阿宁', amount: 'invalid' }),
      null
    );
  });

  it('rejects a positive amount too small to produce one cent', () => {
    assert.equal(
      buildRepaymentTransaction({ sender: '小林', recipient: '阿宁', amount: '1e-7' }),
      null
    );
  });

  it('rejects an amount that cannot produce safe integer cents', () => {
    assert.equal(
      buildRepaymentTransaction({ sender: '小林', recipient: '阿宁', amount: '1e20' }),
      null
    );
  });

  it('rejects an undefined payload', () => {
    assert.equal(buildRepaymentTransaction(), null);
  });

  it('rejects a null payload', () => {
    assert.equal(buildRepaymentTransaction(null), null);
  });

  it('rejects a whitespace-only sender', () => {
    assert.equal(
      buildRepaymentTransaction({ sender: '   ', recipient: '阿宁', amount: 50 }),
      null
    );
  });

  it('rejects a whitespace-only recipient', () => {
    assert.equal(
      buildRepaymentTransaction({ sender: '小林', recipient: '\t', amount: 50 }),
      null
    );
  });

  it('settles an existing two-member TWD balance', () => {
    const expense = {
      currency: 'TWD',
      payer: '阿宁',
      totalAmount: 100,
      splits: { 阿宁: 50, 小林: 50 }
    };
    const repayment = buildRepaymentTransaction({
      sender: '小林',
      recipient: '阿宁',
      amount: 50
    });

    assert.deepEqual(
      calculateNetBalances(['阿宁', '小林'], [expense, repayment], 'TWD'),
      { 阿宁: 0, 小林: 0 }
    );
  });
});
