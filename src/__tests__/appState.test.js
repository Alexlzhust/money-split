import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_CURRENCY, DEFAULT_USERS, STORAGE_KEYS } from '../config/appState.js';

describe('app state defaults', () => {
  it('starts without any preset member names', () => {
    assert.deepEqual(DEFAULT_USERS, []);
  });

  it('uses v2 storage keys so old demo names do not reappear', () => {
    assert.equal(STORAGE_KEYS.users, 'splitter.v2.users');
    assert.equal(STORAGE_KEYS.transactions, 'splitter.v2.transactions');
    assert.equal(STORAGE_KEYS.currency, 'splitter.v2.currency');
    assert.equal(STORAGE_KEYS.lastPayer, 'splitter.v2.lastPayer');
  });

  it('defaults the app currency to TWD', () => {
    assert.equal(DEFAULT_CURRENCY, 'TWD');
  });
});
