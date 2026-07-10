import { useEffect, useMemo, useState } from 'react';
import { Calculator, CalendarDays, Coins, ReceiptText, Tags, X } from 'lucide-react';
import { html } from '../lib/html.js';
import { MoneyAmount } from './MoneyAmount.js';
import {
  DEFAULT_CATEGORY,
  EXPENSE_CATEGORIES,
  getTodayDate,
  normalizeCategory
} from '../config/expenseMeta.js';
import { CURRENCIES, DEFAULT_CURRENCY, formatMoney, getCurrencyRateLabel } from '../utils/currency.js';
import {
  SPLIT_TYPES,
  createEqualSplits,
  fromCents,
  sumSplits,
  toCents
} from '../utils/settlements.js';

export function TransactionForm({ users, editingTransaction, onCancelEdit, onSaveTransaction }) {
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [expenseDate, setExpenseDate] = useState(getTodayDate());
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [payer, setPayer] = useState(users[0] || '');
  const [splitType, setSplitType] = useState(SPLIT_TYPES.EQUAL);
  const [participants, setParticipants] = useState(users);
  const [customSplits, setCustomSplits] = useState({});
  const isEditing = Boolean(editingTransaction);

  useEffect(() => {
    if (editingTransaction) {
      const splitUsers = Object.keys(editingTransaction.splits || {}).filter((user) =>
        users.includes(user)
      );
      setTitle(editingTransaction.title);
      setTotalAmount(String(editingTransaction.totalAmount));
      setCurrency(editingTransaction.currency || DEFAULT_CURRENCY);
      setExpenseDate(editingTransaction.expenseDate || getTodayDate());
      setCategory(normalizeCategory(editingTransaction.category || DEFAULT_CATEGORY));
      setPayer(users.includes(editingTransaction.payer) ? editingTransaction.payer : users[0] || '');
      setSplitType(editingTransaction.splitType);
      setParticipants(splitUsers.length ? splitUsers : users);
      setCustomSplits(
        users.reduce((result, user) => {
          result[user] = editingTransaction.splits?.[user] ?? '';
          return result;
        }, {})
      );
      return;
    }

    setPayer((current) => (users.includes(current) ? current : users[0] || ''));
    setParticipants((current) => {
      const existing = current.filter((user) => users.includes(user));
      const nextUsers = users.filter((user) => !existing.includes(user));
      return [...existing, ...nextUsers];
    });
    setCustomSplits((current) =>
      users.reduce((result, user) => {
        result[user] = current[user] ?? '';
        return result;
      }, {})
    );
  }, [editingTransaction, users]);

  const amountCents = toCents(totalAmount);
  const amountValue = fromCents(amountCents);
  const equalSplits = useMemo(
    () => createEqualSplits(amountValue, participants),
    [amountValue, participants]
  );
  const customTotal = sumSplits(customSplits);
  const customDifference = fromCents(amountCents - toCents(customTotal));
  const hasUsers = users.length > 0;
  const hasBaseFields = title.trim() && amountCents > 0 && expenseDate && users.includes(payer);
  const customInvalid =
    splitType === SPLIT_TYPES.CUSTOM && amountCents > 0 && toCents(customTotal) !== amountCents;
  const equalInvalid = splitType === SPLIT_TYPES.EQUAL && participants.length === 0;
  const canSubmit = Boolean(hasUsers && hasBaseFields && !customInvalid && !equalInvalid);
  const customDifferenceMoney = formatMoney(Math.abs(customDifference), currency);
  const rateLabel = getCurrencyRateLabel(currency);

  function toggleParticipant(user) {
    setParticipants((current) =>
      current.includes(user)
        ? current.filter((participant) => participant !== user)
        : [...current, user]
    );
  }

  function resetForm() {
    setTitle('');
    setTotalAmount('');
    setCurrency(DEFAULT_CURRENCY);
    setExpenseDate(getTodayDate());
    setCategory(DEFAULT_CATEGORY);
    setSplitType(SPLIT_TYPES.EQUAL);
    setParticipants(users);
    setCustomSplits(users.reduce((result, user) => ({ ...result, [user]: '' }), {}));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    const didSave = await onSaveTransaction({
      id: editingTransaction?.id || crypto.randomUUID(),
      title: title.trim(),
      totalAmount: amountValue,
      currency,
      expenseDate,
      category,
      payer,
      splitType,
      splits:
        splitType === SPLIT_TYPES.EQUAL
          ? equalSplits
          : users.reduce((result, user) => {
              result[user] = fromCents(toCents(customSplits[user]));
              return result;
            }, {})
    });
    if (didSave) {
      resetForm();
    }
  }

  return html`
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <${ReceiptText} className="h-5 w-5 text-teal-600" aria-hidden="true" />
        <h2 className="text-base font-semibold">${isEditing ? '编辑账单' : '账单录入'}</h2>
        ${isEditing &&
        html`
          <button
            type="button"
            onClick=${() => {
              resetForm();
              onCancelEdit();
            }}
            title="取消编辑"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
          >
            <${X} className="h-4 w-4" aria-hidden="true" />
          </button>
        `}
      </div>

      <form onSubmit=${handleSubmit} className="space-y-4">
        ${!hasUsers &&
        html`
          <p
            data-testid="transaction-empty-members-message"
            className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-500"
          >
            添加成员后即可录入账单。
          </p>
        `}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            账单名称
            <input
              data-testid="transaction-title-input"
              value=${title}
              onChange=${(event) => setTitle(event.target.value)}
              placeholder="例如：周末聚餐"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            总金额
            <input
              data-testid="transaction-amount-input"
              value=${totalAmount}
              onChange=${(event) => setTotalAmount(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          <span className="flex items-center gap-2">
            <${Coins} className="h-4 w-4 text-amber-600" aria-hidden="true" />
            账单币种
          </span>
          <select
            data-testid="transaction-currency-select"
            value=${currency}
            onChange=${(event) => setCurrency(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          >
            ${Object.values(CURRENCIES).map(
              (item) => html`<option key=${item.code} value=${item.code}>${item.label}</option>`
            )}
          </select>
          ${rateLabel &&
          html`<span className="mt-1 block text-xs font-normal text-slate-500">${rateLabel}</span>`}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            <span className="flex items-center gap-2">
              <${CalendarDays} className="h-4 w-4 text-teal-600" aria-hidden="true" />
              日期
            </span>
            <input
              data-testid="transaction-date-input"
              type="date"
              value=${expenseDate}
              onInput=${(event) => setExpenseDate(event.target.value)}
              onChange=${(event) => setExpenseDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="flex items-center gap-2">
              <${Tags} className="h-4 w-4 text-teal-600" aria-hidden="true" />
              分类
            </span>
            <select
              data-testid="transaction-category-select"
              value=${category}
              onChange=${(event) => setCategory(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            >
              ${EXPENSE_CATEGORIES.map(
                (item) => html`<option key=${item} value=${item}>${item}</option>`
              )}
            </select>
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          付款人
          <select
            data-testid="payer-select"
            value=${payer}
            onChange=${(event) => setPayer(event.target.value)}
            disabled=${!hasUsers}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
          >
            ${users.map((user) => html`<option key=${user} value=${user}>${user}</option>`)}
          </select>
        </label>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-slate-700">分账模式</legend>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
            ${[
              [SPLIT_TYPES.EQUAL, '均分'],
              [SPLIT_TYPES.CUSTOM, '自定义']
            ].map(
              ([value, label]) => html`
                <label
                  key=${value}
                  data-testid=${`split-type-option-${value}`}
                  className=${`flex cursor-pointer items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition ${
                    splitType === value
                      ? 'bg-white text-teal-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <input
                    data-testid=${`split-type-${value}`}
                    type="radio"
                    name="splitType"
                    value=${value}
                    checked=${splitType === value}
                    onChange=${() => setSplitType(value)}
                    className="sr-only"
                  />
                  ${label}
                </label>
              `
            )}
          </div>
        </fieldset>

        ${splitType === SPLIT_TYPES.EQUAL
          ? html`
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <${Calculator} className="h-4 w-4 text-amber-600" aria-hidden="true" />
                  参与成员
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  ${users.map(
                    (user) => html`
                      <label
                        key=${user}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <span>${user}</span>
                        <input
                          type="checkbox"
                          data-testid=${`equal-participant-${user}`}
                          checked=${participants.includes(user)}
                          onChange=${() => toggleParticipant(user)}
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      </label>
                    `
                  )}
                </div>
                ${participants.length > 0 &&
                html`
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    ${participants.map(
                      (user) => html`
                        <div key=${user} className="flex justify-between gap-3">
                          <span>${user}</span>
                          <${MoneyAmount}
                            value=${equalSplits[user] || 0}
                            currency=${currency}
                            primaryClassName="font-semibold"
                            convertedClassName="mt-0.5 text-xs text-amber-700"
                          />
                        </div>
                      `
                    )}
                  </div>
                `}
              </div>
            `
          : html`
              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-700">自定义分摊金额</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  ${users.map(
                    (user) => html`
                      <label key=${user} className="block text-sm text-slate-700">
                        ${user}
                        <input
                          type="number"
                          data-testid=${`custom-split-${user}`}
                          min="0"
                          step="0.01"
                          value=${customSplits[user] ?? ''}
                          onChange=${(event) =>
                            setCustomSplits((current) => ({
                              ...current,
                              [user]: event.target.value
                            }))}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                        />
                      </label>
                    `
                  )}
                </div>
                <div className="flex justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm">
                  <span>当前合计</span>
                  <${MoneyAmount} value=${customTotal} currency=${currency} />
                </div>
              </div>
            `}

        ${customInvalid &&
        html`
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            <span data-testid="custom-validation-warning">
              自定义分摊合计需等于总金额，目前差额为 ${customDifferenceMoney.primary}。
              ${customDifferenceMoney.converted &&
              html`<span className="block text-xs text-rose-600">${customDifferenceMoney.converted}</span>`}
            </span>
          </p>
        `}

        <button
          data-testid="add-transaction-button"
          type="submit"
          disabled=${!canSubmit}
          className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          ${isEditing ? '保存修改' : '添加账单'}
        </button>
      </form>
    </section>
  `;
}
