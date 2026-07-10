import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateNetBalances,
  createEqualSplits,
  simplifyDebts,
  sumSplits
} from '../utils/settlements.js';

describe('settlement utilities', () => {
  it('creates equal splits only for selected participants', () => {
    assert.deepEqual(createEqualSplits(90, ['小明', '小红', '小刚']), {
      '小明': 30,
      '小红': 30,
      '小刚': 30
    });
  });

  it('sums custom split values with currency rounding', () => {
    assert.equal(sumSplits({ '小明': '10.10', '小红': 20.205, '小刚': '' }), 30.31);
  });

  it('calculates net balances as paid minus owed', () => {
    const transactions = [
      {
        id: '1',
        title: '晚餐',
        totalAmount: 90,
        payer: '小明',
        splitType: 'EQUAL',
        splits: { '小明': 30, '小红': 30, '小刚': 30 }
      },
      {
        id: '2',
        title: '打车',
        totalAmount: 30,
        payer: '小红',
        splitType: 'CUSTOM',
        splits: { '小明': 10, '小红': 20, '小刚': 0 }
      }
    ];

    assert.deepEqual(calculateNetBalances(['小明', '小红', '小刚'], transactions), {
      '小明': 50,
      '小红': -20,
      '小刚': -30
    });
  });

  it('calculates multi-currency net balances in the selected settlement currency', () => {
    const transactions = [
      {
        id: '1',
        title: '台湾早餐',
        totalAmount: 100,
        currency: 'TWD',
        payer: '小明',
        splitType: 'EQUAL',
        splits: { '小明': 50, '小红': 50 }
      },
      {
        id: '2',
        title: '香港打车',
        totalAmount: 100,
        currency: 'HKD',
        payer: '小红',
        splitType: 'EQUAL',
        splits: { '小明': 50, '小红': 50 }
      }
    ];

    assert.deepEqual(calculateNetBalances(['小明', '小红'], transactions, 'CNY'), {
      '小明': -32.78,
      '小红': 32.78
    });
    assert.deepEqual(simplifyDebts(calculateNetBalances(['小明', '小红'], transactions, 'TWD')), [
      { from: '小明', to: '小红', amount: 154.55 }
    ]);
  });

  it('simplifies net balances into minimal transfer paths', () => {
    assert.deepEqual(simplifyDebts({ '小明': 50, '小红': -20, '小刚': -30 }), [
      { from: '小刚', to: '小明', amount: 30 },
      { from: '小红', to: '小明', amount: 20 }
    ]);
  });
});
