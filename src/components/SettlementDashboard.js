import { ArrowRightLeft, ChevronRight, Coins, Scale } from 'lucide-react';
import { html } from '../lib/html.js';
import { MoneyAmount } from './MoneyAmount.js';
import { calculateNetBalances, simplifyDebts } from '../utils/settlements.js';
import { CURRENCIES, getCurrencyRateLabel } from '../utils/currency.js';

export function SettlementDashboard({
  users,
  transactions,
  settlementCurrency,
  onSettlementCurrencyChange,
  onRecordRepayment
}) {
  const balances = calculateNetBalances(users, transactions, settlementCurrency);
  const transfers = simplifyDebts(balances);
  const rateLabel = getCurrencyRateLabel(settlementCurrency);

  return html`
    <section>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <${Scale} className="h-5 w-5 text-teal-600" aria-hidden="true" />
          <h2 className="text-base font-semibold">清算看板</h2>
        </div>
        <label className="block w-40 shrink-0 text-sm font-medium text-slate-700 sm:w-44">
          <span className="flex items-center gap-2">
            <${Coins} className="h-4 w-4 text-amber-600" aria-hidden="true" />
            结算币种
          </span>
          <select
            data-testid="settlement-currency-select"
            value=${settlementCurrency}
            onChange=${(event) => onSettlementCurrencyChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          >
            ${Object.values(CURRENCIES).map(
              (item) => html`<option key=${item.code} value=${item.code}>${item.label}</option>`
            )}
          </select>
          ${rateLabel &&
          html`<span className="mt-1 block text-xs font-normal text-slate-500">${rateLabel}</span>`}
        </label>
      </div>

      ${users.length === 0
        ? html`
            <p className="rounded-lg bg-slate-100 px-3 py-4 text-center text-sm text-slate-500">
              添加成员后会显示净头寸。
            </p>
          `
        : html`
            <div className="grid gap-3 sm:grid-cols-2">
              ${users.map((user) => {
                const balance = balances[user] || 0;
                const tone =
                  balance > 0
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : balance < 0
                      ? 'border-rose-200 bg-rose-50 text-rose-800'
                      : 'border-slate-200 bg-slate-100 text-slate-600';

                return html`
                  <div key=${user} className=${`min-w-0 rounded-lg border px-3 py-2 ${tone}`}>
                    <div className="break-all text-sm">${user}</div>
                    <div className="mt-1 text-lg">
                      <${MoneyAmount}
                        value=${balance}
                        currency=${settlementCurrency}
                        align="left"
                        primaryClassName="font-semibold"
                        convertedClassName="mt-0.5 text-xs opacity-80"
                      />
                    </div>
                  </div>
                `;
              })}
            </div>
          `}

      <div className="mt-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <${ArrowRightLeft} className="h-4 w-4 text-amber-600" aria-hidden="true" />
          最简转账路径
        </div>

        ${transfers.length === 0
          ? html`<p className="rounded-lg bg-slate-100 px-3 py-4 text-center text-sm text-slate-500">
              当前无需转账
            </p>`
          : html`
              <div className="space-y-2">
                ${transfers.map(
                  (transfer) => html`
                    <button
                      key=${`${transfer.from}-${transfer.to}-${transfer.amount}`}
                      data-testid=${`record-repayment-${transfer.from}-${transfer.to}`}
                      type="button"
                      onClick=${() => onRecordRepayment(transfer)}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm transition hover:border-amber-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-medium text-amber-950">
                          ${transfer.from} 需转账给 ${transfer.to}
                        </span>
                        <span className="mt-1 block text-xs text-amber-700">记录还款</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <${MoneyAmount}
                          value=${transfer.amount}
                          currency=${settlementCurrency}
                          primaryClassName="font-semibold text-amber-800"
                          convertedClassName="mt-0.5 text-xs text-amber-700"
                        />
                        <${ChevronRight} className="h-4 w-4 text-amber-700" aria-hidden="true" />
                      </span>
                    </button>
                  `
                )}
              </div>
            `}
      </div>
    </section>
  `;
}
