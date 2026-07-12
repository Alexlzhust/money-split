import { DEFAULT_CURRENCY, getCurrencyMeta } from './currency.js';
import {
  DEFAULT_CATEGORY,
  getTodayDate,
  isTransferCategory,
  normalizeCategory
} from '../config/expenseMeta.js';
import {
  MAX_MONEY_CENTS,
  SPLIT_TYPES,
  createEqualSplits,
  fromCents,
  getValidMoneyCents,
  sumSplits,
  toCents
} from './settlements.js';

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

export function selectRepaymentRecipient(rawUsers, payer, currentRecipient = '') {
  const users = Array.isArray(rawUsers) ? rawUsers : [];
  if (users.includes(currentRecipient) && currentRecipient !== payer) {
    return currentRecipient;
  }

  return users.find((user) => user !== payer) || '';
}

export function getCustomSplitInputs(users, splits = {}) {
  return users.reduce((result, user) => {
    result[user] = splits[user] ?? '';
    return result;
  }, {});
}

export function createTransactionDraft({
  users: rawUsers,
  editingTransaction,
  defaultCurrency,
  rememberedPayer,
  today = getTodayDate()
} = {}) {
  const users = Array.isArray(rawUsers) ? rawUsers : [];
  const isEditing = Boolean(editingTransaction);
  const category = normalizeCategory(editingTransaction?.category || DEFAULT_CATEGORY);
  const savedPayer =
    typeof editingTransaction?.payer === 'string' ? editingTransaction.payer : '';
  const payer = isEditing && savedPayer ? savedPayer : getDefaultPayer(users, rememberedPayer);
  const savedSplits = editingTransaction?.splits || {};
  const savedSplitUsers = Object.keys(savedSplits);
  const visibleSplitUsers = savedSplitUsers.filter((user) => users.includes(user));
  const splitType = Object.values(SPLIT_TYPES).includes(editingTransaction?.splitType)
    ? editingTransaction.splitType
    : SPLIT_TYPES.EQUAL;
  const visibleCustomSplits = getCustomSplitInputs(users, savedSplits);
  const customSplits = isEditing
    ? { ...savedSplits, ...visibleCustomSplits }
    : visibleCustomSplits;
  const recipient = selectRepaymentRecipient(
    users,
    payer,
    savedSplitUsers.find((user) => user !== payer)
  );
  const savedAmount = fromCents(toCents(editingTransaction?.totalAmount));

  return {
    title: editingTransaction?.title || '',
    totalAmount:
      isEditing && splitType === SPLIT_TYPES.CUSTOM && !isTransferCategory(category)
        ? String(deriveCustomTotal(customSplits))
        : isEditing
          ? String(savedAmount)
          : '',
    currency: getDraftCurrency(editingTransaction, defaultCurrency),
    expenseDate: editingTransaction?.expenseDate || today,
    category,
    payer,
    recipient,
    splitType,
    participants: isEditing ? visibleSplitUsers : [...users],
    customSplits
  };
}

export function getUnavailableTransactionMembers(rawUsers, transaction) {
  const users = new Set(Array.isArray(rawUsers) ? rawUsers : []);
  const references = [transaction?.payer, ...Object.keys(transaction?.splits || {})];

  return [...new Set(references)].filter(
    (member) => typeof member === 'string' && member && !users.has(member)
  );
}

function getCustomSplitFinancials(users, draft) {
  let totalCents = 0;
  const splits = {};

  for (const user of users) {
    const cents = getValidMoneyCents(draft.customSplits?.[user], { allowEmpty: true });
    if (cents === null) {
      return { isValid: false, totalCents: 0, splits: {} };
    }

    totalCents += cents;
    if (!Number.isSafeInteger(totalCents) || totalCents > MAX_MONEY_CENTS) {
      return { isValid: false, totalCents: 0, splits: {} };
    }
    splits[user] = fromCents(cents);
  }

  return { isValid: true, totalCents, splits };
}

function getDraftFinancials(users, draft) {
  const isTransfer = isTransferCategory(draft.category);
  const custom = getCustomSplitFinancials(users, draft);
  const totalAmountCents = getValidMoneyCents(draft.totalAmount, { minimumCents: 1 });
  const usesCustomSplits = !isTransfer && draft.splitType === SPLIT_TYPES.CUSTOM;
  const effectiveAmountCents = usesCustomSplits ? custom.totalCents : totalAmountCents;
  const effectiveAmount = effectiveAmountCents === null ? 0 : fromCents(effectiveAmountCents);

  return {
    isTransfer,
    customSplits: custom.splits,
    customSplitsValid: custom.isValid,
    customTotal: fromCents(custom.totalCents),
    totalAmountCents,
    effectiveAmount,
    equalSplits: createEqualSplits(effectiveAmount, draft.participants || []),
    repayment: isTransfer
      ? buildRepaymentTransaction({
          sender: draft.payer,
          recipient: draft.recipient,
          amount: draft.totalAmount
        })
      : null
  };
}

export function isTransactionDraftValid({ users: rawUsers, draft, editingTransaction } = {}) {
  const users = Array.isArray(rawUsers) ? rawUsers : [];
  if (
    !draft ||
    getUnavailableTransactionMembers(users, editingTransaction).length > 0 ||
    !draft.expenseDate ||
    !draft.currency ||
    !users.includes(draft.payer)
  ) {
    return false;
  }

  const financials = getDraftFinancials(users, draft);
  if (financials.isTransfer) {
    return Boolean(
      users.length >= 2 && users.includes(draft.recipient) && financials.repayment
    );
  }

  if (!draft.title.trim()) {
    return false;
  }
  if (draft.splitType === SPLIT_TYPES.CUSTOM) {
    return financials.customSplitsValid && financials.customTotal > 0;
  }

  return Boolean(
    financials.totalAmountCents !== null &&
      draft.participants?.length > 0 &&
      draft.participants.every((user) => users.includes(user))
  );
}

export function buildTransactionPayload({ id, users: rawUsers, draft, editingTransaction } = {}) {
  const users = Array.isArray(rawUsers) ? rawUsers : [];
  if (!id || !isTransactionDraftValid({ users, draft, editingTransaction })) {
    return null;
  }

  const financials = getDraftFinancials(users, draft);
  if (financials.isTransfer) {
    return {
      id,
      currency: draft.currency,
      expenseDate: draft.expenseDate,
      category: draft.category,
      ...financials.repayment
    };
  }

  return {
    id,
    title: draft.title.trim(),
    totalAmount: financials.effectiveAmount,
    currency: draft.currency,
    expenseDate: draft.expenseDate,
    category: draft.category,
    payer: draft.payer,
    splitType: draft.splitType,
    splits:
      draft.splitType === SPLIT_TYPES.EQUAL
        ? financials.equalSplits
        : financials.customSplits
  };
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
  const amountCents = getValidMoneyCents(amount, { minimumCents: 1 });
  if (
    !sender ||
    !recipient ||
    sender === recipient ||
    amountCents === null
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
