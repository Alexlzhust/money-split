import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APP_SCREENS, appViewReducer, createInitialAppView } from '../utils/appView.js';

describe('app view reducer', () => {
  it('starts on the ledger and switches between bottom destinations', () => {
    const initial = createInitialAppView();
    assert.deepEqual(initial, {
      screen: APP_SCREENS.LEDGER,
      editingTransaction: null,
      repaymentPreset: null,
      memberOpen: false
    });

    const settlement = appViewReducer(initial, { type: 'OPEN_SETTLEMENT' });
    assert.equal(settlement.screen, APP_SCREENS.SETTLEMENT);

    const ledger = appViewReducer(settlement, { type: 'OPEN_LEDGER' });
    assert.equal(ledger.screen, APP_SCREENS.LEDGER);
  });

  it('closes the member overlay when opening settlement', () => {
    const state = {
      screen: APP_SCREENS.LEDGER,
      editingTransaction: null,
      memberOpen: true
    };

    assert.deepEqual(appViewReducer(state, { type: 'OPEN_SETTLEMENT' }), {
      screen: APP_SCREENS.SETTLEMENT,
      editingTransaction: null,
      repaymentPreset: null,
      memberOpen: false
    });
  });

  it('closes the member overlay when opening a new transaction', () => {
    const state = {
      screen: APP_SCREENS.SETTLEMENT,
      editingTransaction: { id: 'old' },
      memberOpen: true
    };

    assert.deepEqual(appViewReducer(state, { type: 'OPEN_NEW_TRANSACTION' }), {
      screen: APP_SCREENS.TRANSACTION,
      editingTransaction: null,
      repaymentPreset: null,
      memberOpen: false
    });
  });

  it('opens a new transaction with a settlement repayment preset', () => {
    const repaymentPreset = {
      from: 'Alex',
      to: 'Tony',
      amount: 343.52,
      currency: 'TWD'
    };

    assert.deepEqual(
      appViewReducer(createInitialAppView(), {
        type: 'OPEN_REPAYMENT_TRANSACTION',
        repaymentPreset
      }),
      {
        screen: APP_SCREENS.TRANSACTION,
        editingTransaction: null,
        repaymentPreset,
        memberOpen: false
      }
    );
  });

  it('closes the member overlay when opening an existing transaction', () => {
    const transaction = { id: 'bill-1', title: '晚餐' };
    const state = {
      screen: APP_SCREENS.SETTLEMENT,
      editingTransaction: null,
      memberOpen: true
    };
    const editView = appViewReducer(state, {
      type: 'OPEN_EDIT_TRANSACTION',
      transaction
    });

    assert.deepEqual(editView, {
      screen: APP_SCREENS.TRANSACTION,
      editingTransaction: transaction,
      repaymentPreset: null,
      memberOpen: false
    });
    assert.equal(editView.editingTransaction, transaction);
  });

  it('closes a transaction by returning to the ledger and clearing edit state', () => {
    const transaction = { id: 'bill-1' };
    const editView = {
      screen: APP_SCREENS.TRANSACTION,
      editingTransaction: transaction,
      memberOpen: true
    };

    assert.deepEqual(appViewReducer(editView, { type: 'CLOSE_TRANSACTION' }), {
      screen: APP_SCREENS.LEDGER,
      editingTransaction: null,
      repaymentPreset: null,
      memberOpen: false
    });
  });

  it('clears edit state when opening ledger or settlement', () => {
    const editingTransaction = { id: 'bill-1' };
    const state = {
      screen: APP_SCREENS.TRANSACTION,
      editingTransaction,
      memberOpen: true
    };

    assert.deepEqual(appViewReducer(state, { type: 'OPEN_LEDGER' }), {
      screen: APP_SCREENS.LEDGER,
      editingTransaction: null,
      repaymentPreset: null,
      memberOpen: true
    });
    assert.deepEqual(appViewReducer(state, { type: 'OPEN_SETTLEMENT' }), {
      screen: APP_SCREENS.SETTLEMENT,
      editingTransaction: null,
      repaymentPreset: null,
      memberOpen: false
    });
  });

  it('opens and closes members on the ledger without changing other state', () => {
    const state = {
      screen: APP_SCREENS.LEDGER,
      editingTransaction: null,
      memberOpen: false
    };

    const opened = appViewReducer(state, { type: 'OPEN_MEMBERS' });
    assert.deepEqual(opened, {
      screen: APP_SCREENS.LEDGER,
      editingTransaction: null,
      memberOpen: true
    });

    assert.deepEqual(appViewReducer(opened, { type: 'CLOSE_MEMBERS' }), state);
  });

  it('ignores member-open actions on settlement', () => {
    const settlement = {
      screen: APP_SCREENS.SETTLEMENT,
      editingTransaction: null,
      memberOpen: false
    };

    assert.equal(appViewReducer(settlement, { type: 'OPEN_MEMBERS' }), settlement);
  });

  it('ignores member-open actions on transaction forms', () => {
    const transaction = {
      screen: APP_SCREENS.TRANSACTION,
      editingTransaction: { id: 'bill-1' },
      memberOpen: false
    };

    assert.equal(appViewReducer(transaction, { type: 'OPEN_MEMBERS' }), transaction);
  });

  it('returns the same state object for unknown actions', () => {
    const state = createInitialAppView();

    assert.equal(appViewReducer(state, { type: 'UNKNOWN' }), state);
  });
});
