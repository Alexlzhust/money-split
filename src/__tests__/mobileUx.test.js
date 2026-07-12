import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const appSource = readFileSync(new URL('../App.js', import.meta.url), 'utf8');
const settlementSource = readFileSync(
  new URL('../components/SettlementDashboard.js', import.meta.url),
  'utf8'
);
const transactionListSource = readFileSync(
  new URL('../components/TransactionList.js', import.meta.url),
  'utf8'
);

describe('mobile interaction contracts', () => {
  it('opens member management without focusing the name input', () => {
    assert.doesNotMatch(appSource, /member-name-input[^\n]+initialFocus/);
    assert.match(appSource, /const initialFocus = dialog/);
  });

  it('uses 44px touch targets for transaction edit and delete actions', () => {
    assert.equal([...transactionListSource.matchAll(/h-11 w-11/g)].length, 2);
  });

  it('provides a repayment action for each settlement transfer', () => {
    assert.match(settlementSource, /onRecordRepayment/);
    assert.match(settlementSource, /data-testid=\$\{`record-repayment-/);
    assert.match(settlementSource, /记录还款/);
  });
});
