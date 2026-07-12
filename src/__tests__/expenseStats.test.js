import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildExpenseSummary } from '../utils/expenseStats.js';

describe('expense summary utilities', () => {
  it('summarizes totals by original currency and selected reference currency', () => {
    const summary = buildExpenseSummary(
      [
        {
          id: '1',
          title: '早餐',
          totalAmount: 100,
          currency: 'TWD',
          category: '餐饮'
        },
        {
          id: '2',
          title: '打车',
          totalAmount: 100,
          currency: 'HKD',
          category: '交通'
        }
      ],
      'CNY'
    );

    assert.equal(summary.transactionCount, 2);
    assert.equal(summary.totalInSettlementCurrency, 107.98);
    assert.deepEqual(summary.totalsByCurrency, [
      { currency: 'HKD', amount: 100 },
      { currency: 'TWD', amount: 100 }
    ]);
    assert.deepEqual(summary.categoryTotals, [
      { category: '交通', amount: 86.77 },
      { category: '餐饮', amount: 21.21 }
    ]);
  });

  it('defaults legacy transactions to the uncategorized bucket', () => {
    const summary = buildExpenseSummary([{ id: 'old', totalAmount: 30, currency: 'TWD' }], 'CNY');

    assert.deepEqual(summary.categoryTotals, [{ category: '其他', amount: 6.36 }]);
  });

  it('excludes repayment records from expense totals while preserving transaction count', () => {
    const summary = buildExpenseSummary(
      [
        {
          id: 'expense',
          totalAmount: 300,
          currency: 'TWD',
          category: '餐饮'
        },
        {
          id: 'repayment',
          totalAmount: 120,
          currency: 'TWD',
          category: '内部转账/还款'
        }
      ],
      'TWD'
    );

    assert.equal(summary.transactionCount, 2);
    assert.equal(summary.totalInSettlementCurrency, 300);
    assert.deepEqual(summary.totalsByCurrency, [{ currency: 'TWD', amount: 300 }]);
    assert.deepEqual(summary.categoryTotals, [{ category: '餐饮', amount: 300 }]);
  });
});
