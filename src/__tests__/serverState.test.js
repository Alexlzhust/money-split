import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildStateFromRows, normalizeTransactionInput } from '../server/statePayload.js';
import { MAX_MONEY_CENTS } from '../utils/settlements.js';

describe('server state payload helpers', () => {
  it('builds app state from database rows', () => {
    const state = buildStateFromRows(
      [{ name: '阿宁' }, { name: '小周' }],
      [
        {
          id: 'tx-1',
          title: '咖啡',
          total_amount_cents: 3600,
          currency: 'HKD',
          expense_date: '2026-07-10',
          category: '餐饮',
          payer_name: '阿宁',
          split_type: 'CUSTOM'
        }
      ],
      [
        { transaction_id: 'tx-1', user_name: '阿宁', amount_cents: 1200 },
        { transaction_id: 'tx-1', user_name: '小周', amount_cents: 2400 }
      ]
    );

    assert.deepEqual(state, {
      users: ['阿宁', '小周'],
      transactions: [
        {
          id: 'tx-1',
          title: '咖啡',
          totalAmount: 36,
          currency: 'HKD',
          expenseDate: '2026-07-10',
          category: '餐饮',
          payer: '阿宁',
          splitType: 'CUSTOM',
          splits: {
            '阿宁': 12,
            '小周': 24
          }
        }
      ]
    });
  });

  it('defaults stored transactions without a currency to TWD', () => {
    const state = buildStateFromRows(
      [{ name: '阿宁' }, { name: '小周' }],
      [
        {
          id: 'tx-legacy',
          title: '夜市',
          total_amount_cents: 10000,
          payer_name: '阿宁',
          split_type: 'EQUAL'
        }
      ],
      [
        { transaction_id: 'tx-legacy', user_name: '阿宁', amount_cents: 5000 },
        { transaction_id: 'tx-legacy', user_name: '小周', amount_cents: 5000 }
      ]
    );

    assert.equal(state.transactions[0].currency, 'TWD');
    assert.equal(state.transactions[0].expenseDate, '');
    assert.equal(state.transactions[0].category, '其他');
  });

  it('normalizes incoming transaction amounts to cents', () => {
    assert.deepEqual(
      normalizeTransactionInput({
        id: 'tx-2',
        title: '晚餐',
        totalAmount: 90,
        currency: 'HKD',
        expenseDate: '2026-07-10',
        category: '交通',
        payer: '阿宁',
        splitType: 'EQUAL',
        splits: { '阿宁': 45, '小周': 45 }
      }),
      {
        id: 'tx-2',
        title: '晚餐',
        totalAmountCents: 9000,
        currency: 'HKD',
        expenseDate: '2026-07-10',
        category: '交通',
        payer: '阿宁',
        splitType: 'EQUAL',
        splitRows: [
          { userName: '阿宁', amountCents: 4500 },
          { userName: '小周', amountCents: 4500 }
        ]
      }
    );
  });

  it('accepts the PostgreSQL integer cents ceiling', () => {
    const normalized = normalizeTransactionInput({
      id: 'tx-max',
      title: 'Boundary',
      totalAmount: 21474836.47,
      payer: 'A',
      splitType: 'CUSTOM',
      splits: { A: 21474836.47 }
    });

    assert.equal(normalized.totalAmountCents, MAX_MONEY_CENTS);
    assert.equal(normalized.splitRows[0].amountCents, MAX_MONEY_CENTS);
  });

  it('rejects total and split cents above the PostgreSQL integer ceiling', () => {
    assert.throws(
      () =>
        normalizeTransactionInput({
          id: 'tx-total-overflow',
          title: 'Overflow',
          totalAmount: 21474836.48,
          payer: 'A',
          splitType: 'CUSTOM',
          splits: { A: 21474836.48 }
        }),
      /amount/i
    );
    assert.throws(
      () =>
        normalizeTransactionInput({
          id: 'tx-split-overflow',
          title: 'Overflow split',
          totalAmount: 1,
          payer: 'A',
          splitType: 'CUSTOM',
          splits: { A: 21474836.48, B: -21474835.48 }
        }),
      /split/i
    );
  });

  it('rejects negative split cents even when the exact total is preserved', () => {
    assert.throws(
      () =>
        normalizeTransactionInput({
          id: 'tx-negative-split',
          title: 'Offset',
          totalAmount: 1,
          payer: 'A',
          splitType: 'CUSTOM',
          splits: { A: -1, B: 2 }
        }),
      /split/i
    );
  });
});
