import { Edit3, ListChecks, RotateCcw, Trash2 } from 'lucide-react';
import { html } from '../lib/html.js';
import { MoneyAmount } from './MoneyAmount.js';
import {
  DEFAULT_CATEGORY,
  isTransferCategory,
  normalizeCategory
} from '../config/expenseMeta.js';
import { DEFAULT_CURRENCY, getCurrencyMeta } from '../utils/currency.js';

export function TransactionList({
  transactions,
  editingTransactionId,
  onDeleteTransaction,
  onEditTransaction,
  onUndoLatest,
  disabled = false
}) {
  return html`
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <${ListChecks} className="h-5 w-5 text-teal-600" aria-hidden="true" />
          <h2 className="text-base font-semibold">账单明细</h2>
        </div>
        <button
          data-testid="undo-latest-transaction-button"
          type="button"
          onClick=${onUndoLatest}
          disabled=${disabled || transactions.length === 0}
          title="撤回上一笔账单"
          className="ml-auto inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:text-amber-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        >
          <${RotateCcw} className="h-4 w-4" aria-hidden="true" />
          撤回上一笔
        </button>
      </div>

      ${transactions.length === 0
        ? html`<p className="rounded-lg bg-slate-100 px-3 py-4 text-center text-sm text-slate-500">
            暂无账单
          </p>`
        : html`
            <div className="space-y-3">
              ${transactions.map(
                (transaction) => {
                  const transactionCurrency = getCurrencyMeta(
                    transaction.currency || DEFAULT_CURRENCY
                  ).code;
                  const category = normalizeCategory(transaction.category || DEFAULT_CATEGORY);
                  const expenseDate = transaction.expenseDate || '';
                  const isTransfer = isTransferCategory(category);
                  const recipient = Object.keys(transaction.splits || {})[0] || '';
                  const metadata = isTransfer
                    ? `${transaction.payer} → ${recipient} · ${category} · ${transactionCurrency}`
                    : [
                        expenseDate,
                        category,
                        transaction.payer,
                        transaction.splitType === 'EQUAL' ? '均分' : '自定义',
                        transactionCurrency
                      ]
                        .filter(Boolean)
                        .join(' · ');

                  return html`
                  <article
                    key=${transaction.id}
                    className=${`min-w-0 overflow-hidden rounded-lg border p-3 ${
                      editingTransactionId === transaction.id
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 basis-40">
                        <h3 className="break-words font-semibold">${transaction.title}</h3>
                        <p className="mt-1 break-words text-sm text-slate-500">${metadata}</p>
                      </div>
                      <span className="rounded-lg bg-teal-50 px-3 py-1 text-sm text-teal-700">
                        <${MoneyAmount}
                          value=${transaction.totalAmount}
                          currency=${transactionCurrency}
                          primaryClassName="font-semibold"
                          convertedClassName="mt-0.5 text-xs text-teal-600"
                        />
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          data-testid=${`edit-transaction-${transaction.id}`}
                          type="button"
                          onClick=${() => onEditTransaction(transaction)}
                          disabled=${disabled}
                          title="编辑账单"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          <${Edit3} className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          data-testid=${`delete-transaction-${transaction.id}`}
                          type="button"
                          onClick=${() => onDeleteTransaction(transaction.id)}
                          disabled=${disabled}
                          title="删除账单"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          <${Trash2} className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      ${Object.entries(transaction.splits).map(
                        ([user, amount]) => html`
                          <div
                            key=${`${transaction.id}-${user}`}
                            className="flex min-w-0 justify-between gap-3 rounded-md bg-slate-100 px-3 py-2 text-sm"
                          >
                            <span className="min-w-0 break-all">${user}</span>
                            <${MoneyAmount}
                              value=${amount}
                              currency=${transactionCurrency}
                              primaryClassName="font-medium"
                            />
                          </div>
                        `
                      )}
                    </div>
                  </article>
                `;
                }
              )}
            </div>
          `}
    </section>
  `;
}
