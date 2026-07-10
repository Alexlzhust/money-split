import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildStateFromRows, normalizeTransactionInput } from '../server/statePayload.js';

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
  });

  it('normalizes incoming transaction amounts to cents', () => {
    assert.deepEqual(
      normalizeTransactionInput({
        id: 'tx-2',
        title: '晚餐',
        totalAmount: 90,
        currency: 'HKD',
        payer: '阿宁',
        splitType: 'EQUAL',
        splits: { '阿宁': 45, '小周': 45 }
      }),
      {
        id: 'tx-2',
        title: '晚餐',
        totalAmountCents: 9000,
        currency: 'HKD',
        payer: '阿宁',
        splitType: 'EQUAL',
        splitRows: [
          { userName: '阿宁', amountCents: 4500 },
          { userName: '小周', amountCents: 4500 }
        ]
      }
    );
  });
});
