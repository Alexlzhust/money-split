export function upsertTransactionInState(transactions, transaction) {
  const existingIndex = transactions.findIndex((item) => item.id === transaction.id);
  if (existingIndex === -1) {
    return [transaction, ...transactions];
  }

  return transactions.map((item) => (item.id === transaction.id ? transaction : item));
}

export function deleteTransactionFromState(transactions, transactionId) {
  return transactions.filter((transaction) => transaction.id !== transactionId);
}

export function getLatestTransaction(transactions) {
  return transactions[0] || null;
}
