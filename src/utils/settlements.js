import { DEFAULT_CURRENCY, convertMoney, getCurrencyMeta } from './currency.js';

export const SPLIT_TYPES = {
  EQUAL: 'EQUAL',
  CUSTOM: 'CUSTOM'
};

export function toCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.round(Number(`${amount}e2`));
}

export function fromCents(cents) {
  return Number((cents / 100).toFixed(2));
}

export function formatCurrency(value) {
  return `${fromCents(toCents(value)).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} 元`;
}

export function sumSplits(splits) {
  return fromCents(
    Object.values(splits).reduce((total, amount) => total + toCents(amount), 0)
  );
}

export function createEqualSplits(totalAmount, participants) {
  if (!participants.length) {
    return {};
  }

  const totalCents = toCents(totalAmount);
  const baseShare = Math.floor(totalCents / participants.length);
  let remainder = totalCents - baseShare * participants.length;

  return participants.reduce((splits, user) => {
    const extraCent = remainder > 0 ? 1 : 0;
    splits[user] = fromCents(baseShare + extraCent);
    remainder -= extraCent;
    return splits;
  }, {});
}

export function calculateNetBalances(users, transactions, settlementCurrency = DEFAULT_CURRENCY) {
  const targetCurrency = getCurrencyMeta(settlementCurrency).code;
  const balances = users.reduce((result, user) => {
    result[user] = 0;
    return result;
  }, {});

  transactions.forEach((transaction) => {
    const transactionCurrency = getCurrencyMeta(transaction.currency || DEFAULT_CURRENCY).code;
    if (transaction.payer in balances) {
      balances[transaction.payer] += convertMoney(
        transaction.totalAmount,
        transactionCurrency,
        targetCurrency,
        { round: false }
      );
    }

    Object.entries(transaction.splits || {}).forEach(([user, amount]) => {
      if (user in balances) {
        balances[user] -= convertMoney(amount, transactionCurrency, targetCurrency, {
          round: false
        });
      }
    });
  });

  return Object.fromEntries(
    Object.entries(balances).map(([user, amount]) => [user, fromCents(toCents(amount))])
  );
}

export function simplifyDebts(netBalances) {
  const creditors = [];
  const debtors = [];

  Object.entries(netBalances).forEach(([user, balance]) => {
    const cents = toCents(balance);
    if (cents > 0) {
      creditors.push({ user, cents });
    }
    if (cents < 0) {
      debtors.push({ user, cents: Math.abs(cents) });
    }
  });

  creditors.sort((a, b) => b.cents - a.cents || a.user.localeCompare(b.user, 'zh-CN'));
  debtors.sort((a, b) => b.cents - a.cents || a.user.localeCompare(b.user, 'zh-CN'));

  const transfers = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.cents, debtor.cents);

    if (amount > 0) {
      transfers.push({
        from: debtor.user,
        to: creditor.user,
        amount: fromCents(amount)
      });
    }

    creditor.cents -= amount;
    debtor.cents -= amount;

    if (creditor.cents === 0) {
      creditorIndex += 1;
    }
    if (debtor.cents === 0) {
      debtorIndex += 1;
    }
  }

  return transfers;
}
