import { DEFAULT_CURRENCY, getCurrencyMeta } from './currency.js';
import { SPLIT_TYPES, fromCents, sumSplits, toCents } from './settlements.js';

export function deriveCustomTotal(customSplits) {
  return sumSplits(customSplits || {});
}

export function getDefaultPayer(users, rememberedPayer) {
  if (users.includes(rememberedPayer)) {
    return rememberedPayer;
  }

  return users[0] || '';
}

export function getDraftCurrency(editingTransaction, settlementCurrency) {
  if (editingTransaction?.currency) {
    return getCurrencyMeta(editingTransaction.currency).code;
  }
  if (settlementCurrency) {
    return getCurrencyMeta(settlementCurrency).code;
  }

  return DEFAULT_CURRENCY;
}

export function buildRepaymentTransaction({ sender, recipient, amount }) {
  const amountCents = toCents(amount);
  if (!sender || !recipient || sender === recipient || amountCents <= 0) {
    return null;
  }

  const totalAmount = fromCents(amountCents);
  return {
    title: `${sender} 还款给 ${recipient}`,
    payer: sender,
    splitType: SPLIT_TYPES.CUSTOM,
    totalAmount,
    splits: { [recipient]: totalAmount }
  };
}
