import { fromCents, toCents } from '../utils/settlements.js';
import { DEFAULT_CURRENCY, getCurrencyMeta } from '../utils/currency.js';
import {
  DEFAULT_CATEGORY,
  formatExpenseDate,
  getTodayDate,
  normalizeCategory
} from '../config/expenseMeta.js';

export function buildStateFromRows(memberRows, transactionRows, splitRows) {
  const splitsByTransaction = splitRows.reduce((result, row) => {
    if (!result[row.transaction_id]) {
      result[row.transaction_id] = {};
    }
    result[row.transaction_id][row.user_name] = fromCents(row.amount_cents);
    return result;
  }, {});

  return {
    users: memberRows.map((row) => row.name),
    transactions: transactionRows.map((row) => ({
      id: row.id,
      title: row.title,
      totalAmount: fromCents(row.total_amount_cents),
      currency: getCurrencyMeta(row.currency || DEFAULT_CURRENCY).code,
      expenseDate: formatExpenseDate(row.expense_date),
      category: normalizeCategory(row.category || DEFAULT_CATEGORY),
      payer: row.payer_name,
      splitType: row.split_type,
      splits: splitsByTransaction[row.id] || {}
    }))
  };
}

export function normalizeTransactionInput(transaction) {
  if (!transaction || typeof transaction !== 'object') {
    throw new Error('Invalid transaction payload.');
  }

  const id = String(transaction.id || '').trim();
  const title = String(transaction.title || '').trim();
  const payer = String(transaction.payer || '').trim();
  const currency = getCurrencyMeta(transaction.currency || DEFAULT_CURRENCY).code;
  const expenseDate = formatExpenseDate(transaction.expenseDate) || getTodayDate();
  const category = normalizeCategory(transaction.category || DEFAULT_CATEGORY);
  const splitType = String(transaction.splitType || '').trim();
  const totalAmountCents = toCents(transaction.totalAmount);
  const splits = transaction.splits || {};

  if (!id || !title || !payer || !['EQUAL', 'CUSTOM'].includes(splitType) || totalAmountCents <= 0) {
    throw new Error('Transaction fields are incomplete.');
  }

  const splitRows = Object.entries(splits).map(([userName, amount]) => ({
    userName: String(userName).trim(),
    amountCents: toCents(amount)
  }));

  const splitTotalCents = splitRows.reduce((total, row) => total + row.amountCents, 0);
  if (!splitRows.length || splitRows.some((row) => !row.userName) || splitTotalCents !== totalAmountCents) {
    throw new Error('Transaction splits must add up to total amount.');
  }

  return {
    id,
    title,
    totalAmountCents,
    currency,
    expenseDate,
    category,
    payer,
    splitType,
    splitRows
  };
}
