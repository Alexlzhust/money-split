import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deleteTransactionFromState,
  getLatestTransaction,
  upsertTransactionInState
} from '../utils/transactionState.js';

describe('transaction state helpers', () => {
  const first = { id: '1', title: '早餐', totalAmount: 10, splits: {} };
  const second = { id: '2', title: '晚餐', totalAmount: 20, splits: {} };

  it('adds new transactions to the top of the list', () => {
    assert.deepEqual(upsertTransactionInState([first], second), [second, first]);
  });

  it('updates an existing transaction without changing its position', () => {
    const updated = { ...first, title: '早午餐', totalAmount: 18 };
    assert.deepEqual(upsertTransactionInState([second, first], updated), [second, updated]);
  });

  it('deletes a transaction by id', () => {
    assert.deepEqual(deleteTransactionFromState([second, first], '2'), [first]);
  });

  it('returns the latest transaction from the top of the list', () => {
    assert.deepEqual(getLatestTransaction([second, first]), second);
    assert.equal(getLatestTransaction([]), null);
  });
});
