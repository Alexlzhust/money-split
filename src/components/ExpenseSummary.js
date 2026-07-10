import { BarChart3 } from 'lucide-react';
import { html } from '../lib/html.js';
import { MoneyAmount } from './MoneyAmount.js';
import { buildExpenseSummary } from '../utils/expenseStats.js';

export function ExpenseSummary({ transactions, settlementCurrency }) {
  const summary = buildExpenseSummary(transactions, settlementCurrency);

  return html`
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <${BarChart3} className="h-5 w-5 text-teal-600" aria-hidden="true" />
        <h2 className="text-base font-semibold">统计总览</h2>
      </div>

      ${transactions.length === 0
        ? html`<p className="rounded-lg bg-slate-100 px-3 py-4 text-center text-sm text-slate-500">
            暂无统计
          </p>`
        : html`
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-100 px-3 py-3">
                <div className="text-xs font-medium text-slate-500">总支出</div>
                <div className="mt-1 text-lg">
                  <${MoneyAmount}
                    value=${summary.totalInSettlementCurrency}
                    currency=${summary.settlementCurrency}
                    align="left"
                    primaryClassName="font-semibold text-slate-950"
                  />
                </div>
              </div>
              <div className="rounded-lg bg-slate-100 px-3 py-3">
                <div className="text-xs font-medium text-slate-500">账单数</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">
                  ${summary.transactionCount}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-sm font-semibold text-slate-700">原币种合计</div>
              <div className="flex flex-wrap gap-2">
                ${summary.totalsByCurrency.map(
                  (item) => html`
                    <span
                      key=${item.currency}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-500">${item.currency}</span>
                      <${MoneyAmount}
                        value=${item.amount}
                        currency=${item.currency}
                        primaryClassName="font-semibold text-slate-800"
                        convertedClassName="hidden"
                      />
                    </span>
                  `
                )}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-sm font-semibold text-slate-700">分类</div>
              ${summary.categoryTotals.map((item) => {
                const ratio =
                  summary.totalInSettlementCurrency > 0
                    ? Math.max(4, (item.amount / summary.totalInSettlementCurrency) * 100)
                    : 0;

                return html`
                  <div key=${item.category} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600">${item.category}</span>
                      <${MoneyAmount}
                        value=${item.amount}
                        currency=${summary.settlementCurrency}
                        primaryClassName="font-medium text-slate-800"
                        convertedClassName="hidden"
                      />
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-teal-500"
                        style=${{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                `;
              })}
            </div>
          `}
    </section>
  `;
}
