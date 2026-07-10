import { DEFAULT_CATEGORY, normalizeCategory } from '../config/expenseMeta.js';
import { DEFAULT_CURRENCY, convertMoney, getCurrencyMeta } from './currency.js';

function roundAmount(value) {
  return Number(Number(value).toFixed(2));
}

function sortByAmountThenName(left, right) {
  return right.amount - left.amount || left.category?.localeCompare(right.category, 'zh-CN') || 0;
}

export function buildExpenseSummary(transactions, settlementCurrency = 'CNY') {
  const targetCurrency = getCurrencyMeta(settlementCurrency).code;
  const totalsByCurrency = new Map();
  const categoryTotals = new Map();
  let totalInSettlementCurrency = 0;

  transactions.forEach((transaction) => {
    const currency = getCurrencyMeta(transaction.currency || DEFAULT_CURRENCY).code;
    const amount = Number(transaction.totalAmount) || 0;
    const category = normalizeCategory(transaction.category || DEFAULT_CATEGORY);
    const convertedAmount = convertMoney(amount, currency, targetCurrency, { round: false });

    totalsByCurrency.set(currency, (totalsByCurrency.get(currency) || 0) + amount);
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + convertedAmount);
    totalInSettlementCurrency += convertedAmount;
  });

  return {
    transactionCount: transactions.length,
    settlementCurrency: targetCurrency,
    totalInSettlementCurrency: roundAmount(totalInSettlementCurrency),
    totalsByCurrency: Array.from(totalsByCurrency.entries())
      .map(([currency, amount]) => ({ currency, amount: roundAmount(amount) }))
      .sort((left, right) => left.currency.localeCompare(right.currency)),
    categoryTotals: Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({ category, amount: roundAmount(amount) }))
      .sort(sortByAmountThenName)
  };
}
