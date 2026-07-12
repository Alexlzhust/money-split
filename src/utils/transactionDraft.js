import { DEFAULT_CURRENCY, getCurrencyMeta } from './currency.js';
import { SPLIT_TYPES, fromCents, sumSplits, toCents } from './settlements.js';

export function deriveCustomTotal(customSplits) {
  return sumSplits(customSplits || {});
}

export function getEffectiveTransactionAmount({ splitType, totalAmount, customSplits } = {}) {
  if (splitType === SPLIT_TYPES.CUSTOM) {
    return deriveCustomTotal(customSplits);
  }

  return fromCents(toCents(totalAmount));
}

export function reconcileEqualParticipants(currentParticipants, previousUsers, nextUsers) {
  const selectedUsers = new Set(Array.isArray(currentParticipants) ? currentParticipants : []);
  const existingUsers = new Set(Array.isArray(previousUsers) ? previousUsers : []);
  const currentUsers = Array.isArray(nextUsers) ? nextUsers : [];

  return [...new Set(currentUsers)].filter(
    (user) => selectedUsers.has(user) || !existingUsers.has(user)
  );
}

export function getDefaultPayer(users, rememberedPayer) {
  const currentUsers = Array.isArray(users) ? users : [];
  if (currentUsers.includes(rememberedPayer)) {
    return rememberedPayer;
  }

  return currentUsers[0] || '';
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

export function buildRepaymentTransaction(payload) {
  const { sender: rawSender, recipient: rawRecipient, amount } = payload || {};
  const sender = typeof rawSender === 'string' ? rawSender.trim() : '';
  const recipient = typeof rawRecipient === 'string' ? rawRecipient.trim() : '';
  const amountCents = toCents(amount);
  if (
    !sender ||
    !recipient ||
    sender === recipient ||
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0
  ) {
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
