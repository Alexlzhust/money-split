# Mobile Ledger Navigation Design

## Goal

Refocus Money around its primary mobile workflow: quickly review the shared ledger, add a bill, and settle balances. Replace the current long dashboard with two bottom-navigation destinations while preserving all existing transactions, currencies, edit/delete/undo behavior, and database compatibility.

## Product Structure

The app has two persistent top-level destinations:

1. **账本** is the default destination. It contains a compact spending summary, the transaction list, a member-management action in the top-right corner, and a floating add button.
2. **结算** contains the settlement currency selector, net balances, and simplified transfer paths.

The bottom navigation is fixed on mobile and contains only these two destinations. On wider screens it remains a compact two-item navigation so the information architecture stays consistent across devices.

Adding or editing a bill opens a focused full-screen form state. The bottom navigation and floating add button are hidden while the form is open. A back action returns to the ledger without changing saved data. After a successful save, the app returns to the ledger and the saved bill appears in the existing transaction order.

## Ledger Destination

The ledger header uses the Money product name as the primary title. A member icon opens member management in a compact modal or sheet so member setup remains available without occupying permanent screen space. Member management remains add-only in this release. Names are current database primary keys, so rename and delete controls are intentionally excluded to avoid rewriting or invalidating historical payer and split references.

The existing expense summary is condensed for mobile. Total spending and record count are first; original-currency and category summaries remain available below without becoming separate top-level pages. The transaction list retains undo-latest, edit, and delete actions. The floating add button is available only on the ledger destination.

## Transaction Form

The form follows the user's decision-making order rather than the existing data-model order:

1. Category
2. Date and bill title
3. Payer
4. Split mode and participating members
5. Currency
6. Amount confirmation

For **EQUAL** splits, the user selects participants and enters the total amount at the end. The app calculates each participant's share with the existing cent-safe equal-split utility.

For **CUSTOM** splits, the user enters each member's share and never enters a separate total amount. The app continuously sums the shares with cent-safe rounding and presents that value as the read-only bill total. This computed total becomes `transaction.totalAmount` at submit time. A custom bill requires at least one positive share.

Editing uses the same form. Existing custom transactions initialize member inputs from `transaction.splits`; their displayed and submitted total is recomputed from those splits. Existing equal transactions initialize the total from `transaction.totalAmount`.

The submit button includes the resulting amount, stays disabled when required fields are missing, and does not show the former custom-sum-versus-total mismatch warning because there is no second source of truth.

The form reduces repeat input with these defaults:

- Currency starts with the currently selected settlement currency. Editing a transaction keeps that transaction's saved currency.
- Equal splitting starts with every current member selected, preserving the existing subtractive workflow.
- The app stores the last successfully used payer on the current device and preselects that member for the next new transaction. If the remembered member no longer exists, it falls back to the first current member. This is a device preference, not a user account or shared database field.

## Internal Transfers And Repayments

`内部转账/还款` is a reserved category in the existing category list. Selecting it changes the form to a focused transfer flow with three financial inputs: payer, recipient, and amount. Payer and recipient must be different current members, and amount must be positive. The transaction title is generated as `${sender} 还款给 ${recipient}` so the user does not need to enter a redundant description.

The transfer reuses the existing transaction structure without a migration:

```js
{
  title: `${sender} 还款给 ${recipient}`,
  category: '内部转账/还款',
  payer: sender,
  splitType: 'CUSTOM',
  totalAmount: amount,
  splits: { [recipient]: amount }
}
```

Under the existing net-balance formula, the sender receives a positive paid amount and the recipient receives an equal negative allocated amount, reducing the outstanding debt between them. The transaction remains visible and editable in the ledger. Transfer amounts are excluded from total spending, original-currency totals, and expense category totals. The compact summary labels its count as `记录数` and includes transfers because they remain ledger records.

The transfer category is reserved for the dedicated form behavior; it is not offered as a normal equal/custom expense category path.

## State And Data Flow

`App` owns a small view state with `ledger`, `settlement`, and `transaction-form` states. Opening a new bill clears edit state; opening an existing bill sets edit state and enters the form. Saving or cancelling returns to `ledger`. `App` passes the selected settlement currency into the transaction form as the default currency for new records.

No database migration is required. Transactions retain the existing shape:

```js
{
  id,
  title,
  totalAmount,
  currency,
  expenseDate,
  category,
  payer,
  splitType,
  splits
}
```

The custom total is derived in the form before calling the existing save handler. The last payer preference uses a new versioned localStorage key and is updated only after a successful save. Remote API payloads, localStorage fallback, settlement calculations, currency conversion, and legacy default normalization remain unchanged.

## Component Boundaries

- `App` controls destination/form navigation and existing persistence actions.
- `BottomNavigation` renders the two stable destinations and their active state.
- `TransactionForm` becomes a focused full-screen workflow, derives custom totals, and maps the dedicated transfer flow into the existing transaction shape.
- `MemberManagement` is hosted in an overlay controlled from the ledger header.
- `ExpenseSummary` and `TransactionList` compose the ledger destination.
- `SettlementDashboard` remains the settlement destination.

The implementation should follow the existing HTM component style and Tailwind utility classes. It should not introduce a router, a global state library, authentication, filters, or database fields.

## Error Handling And Compatibility

Remote persistence errors stay near the affected action through the existing sync message. If the API is unavailable, the existing localStorage mode continues to work. Closing the member overlay or cancelling a transaction form must not mutate saved state.

Historical transactions remain readable without transformation. Per-transaction currencies and the independently selected settlement currency continue to behave exactly as before. Delete, edit, undo-latest, and reset remain available. Existing transactions with an unknown category continue to normalize to `其他`; `内部转账/还款` becomes a recognized category when this release is deployed.

## Responsive Behavior

The primary target is a 390 px mobile viewport. Bottom navigation accounts for device safe-area spacing and page content receives enough bottom padding to avoid overlap. The floating add button stays clear of both the navigation and transaction action controls. Form fields use one column on mobile and may use paired rows where appropriate on wider screens. Text and monetary values must not overflow. In custom mode, the derived total and submit action use a sticky bottom action area so the total remains visible while member shares are edited.

## Verification

Automated tests must cover:

- custom split values deriving the transaction total with currency rounding;
- custom form validity requiring a positive derived total;
- transfers mapping sender, recipient, and amount into a custom transaction;
- transfer records affecting net balances while being excluded from expense totals;
- new-transaction defaults using settlement currency and a valid remembered payer;
- navigation state transitions for ledger, settlement, add, edit, cancel, and save;
- preservation of existing settlement, currency, server-payload, and transaction-state tests.

Browser verification at a 390 px viewport must cover adding members, creating a custom transaction, observing the sticky automatic total, recording a repayment, confirming it changes settlement without increasing total spending, editing and deleting a transaction, switching to settlement, and changing settlement currency. A desktop-width pass verifies the same information architecture remains coherent and controls do not overlap.

## Out Of Scope

- Authentication or private ledgers
- New database columns or migrations
- Transaction filters and search
- Manual exchange-rate editing
- Settlement completion state machines or per-transfer completion flags
- Member rename and deletion
