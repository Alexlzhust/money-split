# Mobile Ledger Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long dashboard with a mobile-first ledger/settlement shell, add a focused transaction workflow with derived custom totals, and support internal repayments without counting them as spending.

**Architecture:** Keep persistence and the transaction schema unchanged. Add pure helpers for repayment mapping, form defaults, and view transitions so business behavior is covered by Node tests; React components consume those helpers and continue using HTM and Tailwind. `App` owns a small reducer-driven UI state while the existing localStorage/database state remains intact.

**Tech Stack:** React 18 via import map, HTM templates, Tailwind CSS 3, Lucide React, Node built-in test runner, Vercel Functions, Neon Postgres.

---

## File Structure

- Create `src/utils/transactionDraft.js`: pure defaults, derived totals, and repayment transaction mapping.
- Create `src/utils/appView.js`: reducer and constants for ledger, settlement, form, and member overlay states.
- Create `src/components/BottomNavigation.js`: fixed two-destination mobile navigation.
- Create `src/__tests__/transactionDraft.test.js`: custom-total, payer-default, and repayment mapping tests.
- Create `src/__tests__/appView.test.js`: navigation transition tests.
- Modify `src/config/expenseMeta.js`: add the reserved repayment category and predicate.
- Modify `src/config/appState.js`: add the versioned last-payer storage key.
- Modify `src/utils/expenseStats.js`: exclude repayments from amount-based spending summaries.
- Modify `src/__tests__/expenseStats.test.js`: cover repayment exclusion while retaining record count.
- Modify `src/__tests__/appState.test.js`: cover the last-payer key.
- Modify `src/App.js`: reducer-driven shell, ledger header, overlays, floating add action, and destination composition.
- Modify `src/components/TransactionForm.js`: reordered fields, dedicated repayment flow, custom-derived total, and sticky action area.
- Modify `src/components/MemberManagement.js`: overlay-friendly unframed content and explicit add-only member list.
- Modify `src/components/ExpenseSummary.js`: compact ledger summary and `记录数` copy.
- Modify `src/components/TransactionList.js`: unframed ledger list and repayment-specific metadata.
- Modify `src/components/SettlementDashboard.js`: unframed destination layout while preserving calculations.
- Modify `src/styles.css`: safe-area helpers and mobile page behavior that Tailwind utilities cannot express cleanly.

### Task 1: Repayment Category And Expense Statistics

**Files:**
- Modify: `src/config/expenseMeta.js`
- Modify: `src/utils/expenseStats.js`
- Modify: `src/__tests__/expenseStats.test.js`

- [ ] **Step 1: Write the failing repayment summary test**

Append this test to `src/__tests__/expenseStats.test.js`:

```js
it('keeps repayments in record count but excludes them from spending totals', () => {
  const summary = buildExpenseSummary(
    [
      { id: 'expense', totalAmount: 300, currency: 'TWD', category: '餐饮' },
      { id: 'repayment', totalAmount: 120, currency: 'TWD', category: '内部转账/还款' }
    ],
    'TWD'
  );

  assert.equal(summary.transactionCount, 2);
  assert.equal(summary.totalInSettlementCurrency, 300);
  assert.deepEqual(summary.totalsByCurrency, [{ currency: 'TWD', amount: 300 }]);
  assert.deepEqual(summary.categoryTotals, [{ category: '餐饮', amount: 300 }]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test src/__tests__/expenseStats.test.js`

Expected: FAIL because `内部转账/还款` is included in the 420 TWD spending total.

- [ ] **Step 3: Add reserved category helpers**

Update `src/config/expenseMeta.js`:

```js
export const DEFAULT_CATEGORY = '其他';
export const TRANSFER_CATEGORY = '内部转账/还款';

export const EXPENSE_CATEGORIES = [
  '餐饮',
  '交通',
  '住宿',
  '购物',
  '通讯',
  '门票',
  DEFAULT_CATEGORY,
  TRANSFER_CATEGORY
];

export function isTransferCategory(category) {
  return String(category || '').trim() === TRANSFER_CATEGORY;
}
```

Keep `normalizeCategory`, `formatExpenseDate`, and `getTodayDate` unchanged below these declarations.

- [ ] **Step 4: Exclude repayments from amount aggregations**

In `src/utils/expenseStats.js`, import `isTransferCategory`. Preserve `transactionCount: transactions.length`, but return early inside `transactions.forEach` before currency conversion and aggregation:

```js
const category = normalizeCategory(transaction.category || DEFAULT_CATEGORY);
if (isTransferCategory(category)) {
  return;
}
```

- [ ] **Step 5: Verify GREEN and run the category/server regression tests**

Run: `node --test src/__tests__/expenseStats.test.js src/__tests__/serverState.test.js`

Expected: all tests PASS, including normalization of the newly recognized category.

- [ ] **Step 6: Commit**

```bash
git add src/config/expenseMeta.js src/utils/expenseStats.js src/__tests__/expenseStats.test.js
git commit -m "feat: exclude repayments from expense totals"
```

### Task 2: Transaction Draft Defaults And Repayment Mapping

**Files:**
- Create: `src/utils/transactionDraft.js`
- Create: `src/__tests__/transactionDraft.test.js`
- Modify: `src/config/appState.js`
- Modify: `src/__tests__/appState.test.js`

- [ ] **Step 1: Write failing tests for derived totals, payer defaults, and repayments**

Create `src/__tests__/transactionDraft.test.js`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateNetBalances } from '../utils/settlements.js';
import {
  buildRepaymentTransaction,
  deriveCustomTotal,
  getDraftCurrency,
  getDefaultPayer
} from '../utils/transactionDraft.js';

describe('transaction draft helpers', () => {
  it('derives a cent-safe total from custom shares', () => {
    assert.equal(deriveCustomTotal({ 阿宁: '10.10', 小林: 20.205, 小周: '' }), 30.31);
  });

  it('uses a valid remembered payer and falls back to the first member', () => {
    assert.equal(getDefaultPayer(['阿宁', '小林'], '小林'), '小林');
    assert.equal(getDefaultPayer(['阿宁', '小林'], '已离开'), '阿宁');
    assert.equal(getDefaultPayer([], '阿宁'), '');
  });

  it('uses the settlement currency for new records and saved currency for edits', () => {
    assert.equal(getDraftCurrency(null, 'HKD'), 'HKD');
    assert.equal(getDraftCurrency({ currency: 'CNY' }, 'HKD'), 'CNY');
  });

  it('maps a repayment to the existing custom transaction shape', () => {
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

  it('rejects a repayment to the sender or with no positive amount', () => {
    assert.equal(buildRepaymentTransaction({ sender: '阿宁', recipient: '阿宁', amount: 10 }), null);
    assert.equal(buildRepaymentTransaction({ sender: '阿宁', recipient: '小林', amount: 0 }), null);
  });

  it('uses repayment mapping to reduce existing net balances', () => {
    const repayment = buildRepaymentTransaction({ sender: '小林', recipient: '阿宁', amount: 50 });
    assert.deepEqual(
      calculateNetBalances(
        ['阿宁', '小林'],
        [
          {
            totalAmount: 100,
            currency: 'TWD',
            payer: '阿宁',
            splits: { 阿宁: 50, 小林: 50 }
          },
          { ...repayment, currency: 'TWD' }
        ],
        'TWD'
      ),
      { 阿宁: 0, 小林: 0 }
    );
  });
});
```

Append to `src/__tests__/appState.test.js`:

```js
it('stores the last payer as a versioned device preference', () => {
  assert.equal(STORAGE_KEYS.lastPayer, 'splitter.v2.lastPayer');
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test src/__tests__/transactionDraft.test.js src/__tests__/appState.test.js`

Expected: FAIL because `transactionDraft.js` and `STORAGE_KEYS.lastPayer` do not exist.

- [ ] **Step 3: Implement the pure helpers**

Create `src/utils/transactionDraft.js`:

```js
import { DEFAULT_CURRENCY, getCurrencyMeta } from './currency.js';
import { SPLIT_TYPES, fromCents, sumSplits, toCents } from './settlements.js';

export function deriveCustomTotal(customSplits) {
  return sumSplits(customSplits || {});
}

export function getDefaultPayer(users, rememberedPayer) {
  return users.includes(rememberedPayer) ? rememberedPayer : users[0] || '';
}

export function getDraftCurrency(editingTransaction, settlementCurrency) {
  return getCurrencyMeta(
    editingTransaction?.currency || settlementCurrency || DEFAULT_CURRENCY
  ).code;
}

export function buildRepaymentTransaction({ sender, recipient, amount }) {
  const totalAmount = fromCents(toCents(amount));
  if (!sender || !recipient || sender === recipient || totalAmount <= 0) {
    return null;
  }

  return {
    title: `${sender} 还款给 ${recipient}`,
    payer: sender,
    splitType: SPLIT_TYPES.CUSTOM,
    totalAmount,
    splits: { [recipient]: totalAmount }
  };
}
```

Add this key to `STORAGE_KEYS` in `src/config/appState.js`:

```js
lastPayer: 'splitter.v2.lastPayer'
```

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/__tests__/transactionDraft.test.js src/__tests__/appState.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/transactionDraft.js src/__tests__/transactionDraft.test.js src/config/appState.js src/__tests__/appState.test.js
git commit -m "feat: add transaction draft helpers"
```

### Task 3: Reducer-Driven App Navigation

**Files:**
- Create: `src/utils/appView.js`
- Create: `src/__tests__/appView.test.js`

- [ ] **Step 1: Write the failing navigation tests**

Create `src/__tests__/appView.test.js`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APP_SCREENS, appViewReducer, createInitialAppView } from '../utils/appView.js';

describe('app view reducer', () => {
  it('opens ledger by default and switches between bottom destinations', () => {
    const initial = createInitialAppView();
    assert.equal(initial.screen, APP_SCREENS.LEDGER);
    assert.equal(appViewReducer(initial, { type: 'OPEN_SETTLEMENT' }).screen, APP_SCREENS.SETTLEMENT);
    assert.equal(appViewReducer(initial, { type: 'OPEN_LEDGER' }).screen, APP_SCREENS.LEDGER);
  });

  it('opens new and edit forms then returns to the ledger', () => {
    const transaction = { id: 'bill-1', title: '晚餐' };
    const addView = appViewReducer(createInitialAppView(), { type: 'OPEN_NEW_TRANSACTION' });
    assert.deepEqual(addView, { screen: APP_SCREENS.TRANSACTION, editingTransaction: null, memberOpen: false });

    const editView = appViewReducer(createInitialAppView(), { type: 'OPEN_EDIT_TRANSACTION', transaction });
    assert.equal(editView.editingTransaction, transaction);
    assert.equal(appViewReducer(editView, { type: 'CLOSE_TRANSACTION' }).screen, APP_SCREENS.LEDGER);
  });

  it('opens and closes member management without changing destination', () => {
    const opened = appViewReducer(createInitialAppView(), { type: 'OPEN_MEMBERS' });
    assert.equal(opened.memberOpen, true);
    assert.equal(appViewReducer(opened, { type: 'CLOSE_MEMBERS' }).memberOpen, false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test src/__tests__/appView.test.js`

Expected: FAIL because `appView.js` does not exist.

- [ ] **Step 3: Implement the reducer**

Create `src/utils/appView.js`:

```js
export const APP_SCREENS = {
  LEDGER: 'ledger',
  SETTLEMENT: 'settlement',
  TRANSACTION: 'transaction'
};

export function createInitialAppView() {
  return { screen: APP_SCREENS.LEDGER, editingTransaction: null, memberOpen: false };
}

export function appViewReducer(state, action) {
  switch (action.type) {
    case 'OPEN_LEDGER':
      return { ...state, screen: APP_SCREENS.LEDGER, editingTransaction: null };
    case 'OPEN_SETTLEMENT':
      return { ...state, screen: APP_SCREENS.SETTLEMENT, editingTransaction: null };
    case 'OPEN_NEW_TRANSACTION':
      return { screen: APP_SCREENS.TRANSACTION, editingTransaction: null, memberOpen: false };
    case 'OPEN_EDIT_TRANSACTION':
      return { screen: APP_SCREENS.TRANSACTION, editingTransaction: action.transaction, memberOpen: false };
    case 'CLOSE_TRANSACTION':
      return { ...state, screen: APP_SCREENS.LEDGER, editingTransaction: null };
    case 'OPEN_MEMBERS':
      return { ...state, memberOpen: true };
    case 'CLOSE_MEMBERS':
      return { ...state, memberOpen: false };
    default:
      return state;
  }
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/__tests__/appView.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/appView.js src/__tests__/appView.test.js
git commit -m "feat: add app navigation state"
```

### Task 4: Mobile Ledger And Settlement Shell

**Files:**
- Create: `src/components/BottomNavigation.js`
- Modify: `src/App.js`
- Modify: `src/components/MemberManagement.js`
- Modify: `src/components/ExpenseSummary.js`
- Modify: `src/components/TransactionList.js`
- Modify: `src/components/SettlementDashboard.js`
- Modify: `src/styles.css`

- [ ] **Step 1: Run all tests before the UI restructuring**

Run: `npm test`

Expected: all tests PASS before changing components.

- [ ] **Step 2: Create the two-item bottom navigation**

Create `src/components/BottomNavigation.js`:

```js
import { ArrowRightLeft, NotebookTabs } from 'lucide-react';
import { html } from '../lib/html.js';
import { APP_SCREENS } from '../utils/appView.js';

export function BottomNavigation({ activeScreen, onNavigate }) {
  const items = [
    { screen: APP_SCREENS.LEDGER, label: '账本', icon: NotebookTabs },
    { screen: APP_SCREENS.SETTLEMENT, label: '结算', icon: ArrowRightLeft }
  ];

  return html`
    <nav className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid h-16 max-w-xl grid-cols-2">
        ${items.map(({ screen, label, icon: Icon }) => html`
          <button
            key=${screen}
            data-testid=${`bottom-nav-${screen}`}
            type="button"
            onClick=${() => onNavigate(screen)}
            className=${`flex min-w-0 flex-col items-center justify-center gap-1 text-xs font-medium ${
              activeScreen === screen ? 'text-teal-700' : 'text-slate-500'
            }`}
          >
            <${Icon} className="h-5 w-5" aria-hidden="true" />
            ${label}
          </button>
        `)}
      </div>
    </nav>
  `;
}
```

- [ ] **Step 3: Restructure `App` around the reducer**

Replace the separate `editingTransaction` state with:

```js
const [view, dispatchView] = useReducer(appViewReducer, undefined, createInitialAppView);
const [lastPayer, setLastPayer] = useLocalStorage(STORAGE_KEYS.lastPayer, '');
```

Keep all existing persistence functions. After a successful transaction save, set the remembered payer and dispatch `CLOSE_TRANSACTION`. Route edit actions through `OPEN_EDIT_TRANSACTION`. Render:

```js
const isTransactionScreen = view.screen === APP_SCREENS.TRANSACTION;

${isTransactionScreen
  ? html`<${TransactionForm}
      users=${users}
      editingTransaction=${view.editingTransaction}
      defaultCurrency=${settlementCurrency}
      rememberedPayer=${lastPayer}
      onCancelEdit=${() => dispatchView({ type: 'CLOSE_TRANSACTION' })}
      onSaveTransaction=${saveTransaction}
    />`
  : html`
      ${view.screen === APP_SCREENS.LEDGER
        ? html`<section data-testid="ledger-screen">...</section>`
        : html`<section data-testid="settlement-screen"><${SettlementDashboard} ... /></section>`}
      <${BottomNavigation}
        activeScreen=${view.screen}
        onNavigate=${(screen) => dispatchView({
          type: screen === APP_SCREENS.LEDGER ? 'OPEN_LEDGER' : 'OPEN_SETTLEMENT'
        })}
      />
    `}
```

The ledger section must contain the Money header, persistence status, member icon, reset menu/action, `ExpenseSummary`, `TransactionList`, and a circular `Plus` button with `data-testid="open-transaction-form"`. Render member management in a fixed backdrop dialog controlled by `view.memberOpen`.

- [ ] **Step 4: Make destination components unframed and mobile-dense**

Remove outer card styling (`rounded-lg border ... shadow-sm`) from `ExpenseSummary`, `TransactionList`, and `SettlementDashboard`; use full-width sections separated by `border-b` or vertical spacing. Change `账单数` to `记录数`. In `TransactionList`, render repayment metadata as `${payer} → ${recipient}` and avoid the misleading `垫付` copy for the reserved category.

Change `MemberManagement` to render a heading, add form, and member chips without its own outer card so it fits the dialog. Keep it add-only and show `成员仅可添加，以保护历史账单` as secondary dialog copy only when members exist.

- [ ] **Step 5: Add safe-area CSS**

Append to `src/styles.css`:

```css
@layer utilities {
  .safe-area-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }

  .safe-area-action {
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }
}
```

- [ ] **Step 6: Build CSS and run all tests**

Run: `npm run build && npm test`

Expected: CSS build succeeds and all tests PASS with no component import errors.

- [ ] **Step 7: Commit**

```bash
git add src/App.js src/components/BottomNavigation.js src/components/MemberManagement.js src/components/ExpenseSummary.js src/components/TransactionList.js src/components/SettlementDashboard.js src/styles.css dist/styles.css
git commit -m "feat: add mobile ledger navigation"
```

### Task 5: Focused Transaction Form And Sticky Derived Total

**Files:**
- Modify: `src/components/TransactionForm.js`
- Modify: `src/App.js`

- [ ] **Step 1: Add a failing effective-amount test**

Add `getEffectiveTransactionAmount` to the import in `src/__tests__/transactionDraft.test.js`, then append:

```js
it('uses shares as the only custom total and the amount field for equal splits', () => {
  assert.equal(
    getEffectiveTransactionAmount({
      splitType: 'CUSTOM',
      totalAmount: '999',
      customSplits: { 阿宁: '10.10', 小林: '20.21' }
    }),
    30.31
  );
  assert.equal(
    getEffectiveTransactionAmount({
      splitType: 'EQUAL',
      totalAmount: '90.005',
      customSplits: { 阿宁: 1 }
    }),
    90.01
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test src/__tests__/transactionDraft.test.js`

Expected: FAIL because `getEffectiveTransactionAmount` is not exported.

- [ ] **Step 3: Implement the effective-amount helper**

Append to `src/utils/transactionDraft.js`:

```js
export function getEffectiveTransactionAmount({ splitType, totalAmount, customSplits }) {
  return splitType === SPLIT_TYPES.CUSTOM
    ? deriveCustomTotal(customSplits)
    : fromCents(toCents(totalAmount));
}
```

Run: `node --test src/__tests__/transactionDraft.test.js`

Expected: all tests PASS.

- [ ] **Step 4: Reorder and specialize form state**

Update `TransactionForm` props to include `defaultCurrency` and `rememberedPayer`. Initialize new records with:

```js
const [currency, setCurrency] = useState(getDraftCurrency(editingTransaction, defaultCurrency));
const [payer, setPayer] = useState(getDefaultPayer(users, rememberedPayer));
const [recipient, setRecipient] = useState('');
```

Derive these values:

```js
const isTransfer = isTransferCategory(category);
const customTotal = deriveCustomTotal(customSplits);
const effectiveAmount = getEffectiveTransactionAmount({ splitType, totalAmount, customSplits });
const repayment = isTransfer
  ? buildRepaymentTransaction({ sender: payer, recipient, amount: totalAmount })
  : null;
const canSubmit = isTransfer
  ? Boolean(expenseDate && repayment)
  : Boolean(hasUsers && title.trim() && expenseDate && users.includes(payer) && effectiveAmount > 0 && !equalInvalid);
```

When editing a repayment, derive `recipient` from the sole split key. Keep the transaction's saved currency. When resetting a new form, restore `defaultCurrency`, remembered payer, all equal participants, and empty custom shares.

- [ ] **Step 5: Build the submission payload from one source of truth**

In `handleSubmit`, create the transaction-specific fields first:

```js
const financialFields = isTransfer
  ? repayment
  : {
      title: title.trim(),
      payer,
      splitType,
      totalAmount: effectiveAmount,
      splits: splitType === SPLIT_TYPES.EQUAL
        ? equalSplits
        : Object.fromEntries(
            users.map((user) => [user, fromCents(toCents(customSplits[user]))])
          )
    };

const didSave = await onSaveTransaction({
  id: editingTransaction?.id || crypto.randomUUID(),
  currency,
  expenseDate,
  category,
  ...financialFields
});
```

- [ ] **Step 6: Rebuild the visible field order**

Render the form in this order:

1. Header with back button and `新增记录`/`编辑记录`.
2. Category as a horizontally wrapping set of compact choice buttons, with the reserved transfer option visually separated.
3. Date and title for expenses; date only for repayments because the title is generated.
4. Payer and split controls for expenses; sender and recipient selectors for repayments.
5. Equal participant checkboxes or custom member amount inputs.
6. Currency segmented/select control defaulted from settlement currency.
7. Equal/repayment total amount input at the end. Custom mode has no total input.
8. Sticky action area showing `总额` and `MoneyAmount`, followed by the submit button.

Use existing test IDs where semantics are unchanged. Add `data-testid="repayment-recipient-select"`, `data-testid="derived-total"`, and `data-testid="transaction-form-screen"`. Remove `custom-validation-warning` and all custom mismatch calculations.

- [ ] **Step 7: Verify form compilation and regression suite**

Run: `npm run build && npm test`

Expected: CSS build and all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/TransactionForm.js src/App.js src/__tests__/transactionDraft.test.js dist/styles.css
git commit -m "feat: streamline mobile transaction entry"
```

### Task 6: Full Verification And Production Deployment

**Files:**
- Modify only if verification exposes a scoped defect.

- [ ] **Step 1: Run the complete automated suite from a clean command invocation**

Run: `npm test`

Expected: every test passes, including new repayment, defaults, and app-view tests.

- [ ] **Step 2: Build production CSS**

Run: `npm run build`

Expected: Tailwind completes successfully and writes `dist/styles.css` without warnings that indicate missing classes.

- [ ] **Step 3: Start the local app and verify 390 px mobile behavior**

Run: `npm run dev`

Using browser automation with a 390 x 844 viewport, verify:

1. Empty state has no preset names and bottom navigation does not overlap content.
2. Member overlay adds three members and closes without losing data.
3. New custom expense defaults to settlement currency and all users are available.
4. Entering member shares updates the sticky derived total and enables submit.
5. Saved expense appears on the ledger; edit and delete still work.
6. Repayment form requires distinct sender/recipient, saves, changes settlement balances, and does not change total spending.
7. Bottom navigation switches between ledger and settlement.
8. Settlement currency change becomes the default for the next new transaction.
9. Undo latest removes the latest record.

- [ ] **Step 4: Verify desktop behavior**

At 1280 x 800, verify the content remains constrained, form fields do not overflow, member modal is centered, and bottom navigation/floating add controls do not overlap.

- [ ] **Step 5: Inspect final diff and worktree**

Run:

```bash
git diff --check
git status --short
git log --oneline -8
```

Expected: no whitespace errors; only intentional generated CSS or scoped fixes are uncommitted.

- [ ] **Step 6: Commit any verification-only fixes**

If scoped fixes were required:

```bash
git add src/App.js src/components/BottomNavigation.js src/components/MemberManagement.js src/components/ExpenseSummary.js src/components/TransactionForm.js src/components/TransactionList.js src/components/SettlementDashboard.js src/styles.css dist/styles.css src/utils/appView.js src/utils/transactionDraft.js src/utils/expenseStats.js src/config/appState.js src/config/expenseMeta.js src/__tests__
git commit -m "fix: polish mobile ledger workflow"
```

If no fixes were required, do not create an empty commit.

- [ ] **Step 7: Deploy the verified commit to Vercel**

Run: `npx vercel deploy --prod --yes --logs`

Expected: deployment reaches `Ready` and production alias remains `https://multi-party-expense-splitter.vercel.app`.

- [ ] **Step 8: Inspect production deployment**

Run:

```bash
npx vercel inspect multi-party-expense-splitter.vercel.app
curl --http1.1 -sS -I https://multi-party-expense-splitter.vercel.app/
curl --http1.1 -sS https://multi-party-expense-splitter.vercel.app/api/state
```

Expected: Vercel reports `Ready`, the app returns HTTP 200, and `/api/state` returns valid JSON without modifying production data.
