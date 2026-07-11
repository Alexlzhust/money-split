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

The ledger header uses the Money product name as the primary title. A member icon opens member management in a compact modal or sheet so member setup remains available without occupying permanent screen space.

The existing expense summary is condensed for mobile. Total spending and bill count are first; original-currency and category summaries remain available below without becoming separate top-level pages. The transaction list retains undo-latest, edit, and delete actions. The floating add button is available only on the ledger destination.

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

## State And Data Flow

`App` owns a small view state with `ledger`, `settlement`, and `transaction-form` states. Opening a new bill clears edit state; opening an existing bill sets edit state and enters the form. Saving or cancelling returns to `ledger`.

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

The custom total is derived in the form before calling the existing save handler. Remote API payloads, localStorage fallback, settlement calculations, currency conversion, and legacy default normalization remain unchanged.

## Component Boundaries

- `App` controls destination/form navigation and existing persistence actions.
- `BottomNavigation` renders the two stable destinations and their active state.
- `TransactionForm` becomes a focused full-screen workflow and derives custom totals.
- `MemberManagement` is hosted in an overlay controlled from the ledger header.
- `ExpenseSummary` and `TransactionList` compose the ledger destination.
- `SettlementDashboard` remains the settlement destination.

The implementation should follow the existing HTM component style and Tailwind utility classes. It should not introduce a router, a global state library, authentication, filters, or database fields.

## Error Handling And Compatibility

Remote persistence errors stay near the affected action through the existing sync message. If the API is unavailable, the existing localStorage mode continues to work. Closing the member overlay or cancelling a transaction form must not mutate saved state.

Historical transactions remain readable without transformation. Per-transaction currencies and the independently selected settlement currency continue to behave exactly as before. Delete, edit, undo-latest, and reset remain available.

## Responsive Behavior

The primary target is a 390 px mobile viewport. Bottom navigation accounts for device safe-area spacing and page content receives enough bottom padding to avoid overlap. The floating add button stays clear of both the navigation and transaction action controls. Form fields use one column on mobile and may use paired rows where appropriate on wider screens. Text and monetary values must not overflow.

## Verification

Automated tests must cover:

- custom split values deriving the transaction total with currency rounding;
- custom form validity requiring a positive derived total;
- navigation state transitions for ledger, settlement, add, edit, cancel, and save;
- preservation of existing settlement, currency, server-payload, and transaction-state tests.

Browser verification at a 390 px viewport must cover adding members, creating a custom transaction, observing the automatic total, editing and deleting the transaction, switching to settlement, and changing settlement currency. A desktop-width pass verifies the same information architecture remains coherent and controls do not overlap.

## Out Of Scope

- Authentication or private ledgers
- New database columns or migrations
- Transaction filters and search
- Manual exchange-rate editing
- Settlement completion tracking
