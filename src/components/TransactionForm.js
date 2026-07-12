import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Calculator,
  Coins,
  Tags,
  UserRound,
  UsersRound
} from 'lucide-react';
import { html } from '../lib/html.js';
import { MoneyAmount } from './MoneyAmount.js';
import {
  DEFAULT_CATEGORY,
  EXPENSE_CATEGORIES,
  getTodayDate,
  isTransferCategory,
  normalizeCategory
} from '../config/expenseMeta.js';
import { CURRENCIES, formatMoney, getCurrencyRateLabel } from '../utils/currency.js';
import {
  buildRepaymentTransaction,
  deriveCustomTotal,
  getDefaultPayer,
  getDraftCurrency,
  getEffectiveTransactionAmount
} from '../utils/transactionDraft.js';
import { SPLIT_TYPES, createEqualSplits, fromCents, toCents } from '../utils/settlements.js';

function getFirstOtherUser(users, payer) {
  return users.find((user) => user !== payer) || '';
}

function getCustomSplitInputs(users, splits = {}) {
  return users.reduce((result, user) => {
    result[user] = splits[user] ?? '';
    return result;
  }, {});
}

function createDraft(users, editingTransaction, defaultCurrency, rememberedPayer) {
  const isEditing = Boolean(editingTransaction);
  const category = normalizeCategory(editingTransaction?.category || DEFAULT_CATEGORY);
  const payer = users.includes(editingTransaction?.payer)
    ? editingTransaction.payer
    : getDefaultPayer(users, rememberedPayer);
  const savedSplits = editingTransaction?.splits || {};
  const splitUsers = Object.keys(savedSplits).filter((user) => users.includes(user));
  const splitType = Object.values(SPLIT_TYPES).includes(editingTransaction?.splitType)
    ? editingTransaction.splitType
    : SPLIT_TYPES.EQUAL;
  const customSplits = getCustomSplitInputs(users, savedSplits);
  const recipient =
    splitUsers.find((user) => user !== payer) || getFirstOtherUser(users, payer);
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
    expenseDate: editingTransaction?.expenseDate || getTodayDate(),
    category,
    payer,
    recipient,
    splitType,
    participants: isEditing && splitUsers.length ? splitUsers : [...users],
    customSplits
  };
}

const fieldClassName =
  'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-400';

export function TransactionForm({
  users,
  editingTransaction,
  defaultCurrency,
  rememberedPayer,
  onCancelEdit,
  onSaveTransaction
}) {
  const [draft, setDraft] = useState(() =>
    createDraft(users, editingTransaction, defaultCurrency, rememberedPayer)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = Boolean(editingTransaction);
  const isTransfer = isTransferCategory(draft.category);

  useEffect(() => {
    setDraft(createDraft(users, editingTransaction, defaultCurrency, rememberedPayer));
    setIsSubmitting(false);
  }, [editingTransaction]);

  useEffect(() => {
    setDraft((current) => {
      const payer = users.includes(current.payer)
        ? current.payer
        : getDefaultPayer(users, rememberedPayer);
      const validParticipants = current.participants.filter((user) => users.includes(user));
      const participants = editingTransaction
        ? validParticipants
        : [...validParticipants, ...users.filter((user) => !validParticipants.includes(user))];
      const recipient =
        users.includes(current.recipient) && current.recipient !== payer
          ? current.recipient
          : getFirstOtherUser(users, payer);

      return {
        ...current,
        payer,
        recipient,
        participants,
        customSplits: getCustomSplitInputs(users, current.customSplits)
      };
    });
  }, [users, editingTransaction, rememberedPayer]);

  useEffect(() => {
    if (!editingTransaction) {
      setDraft((current) => ({
        ...current,
        currency: getDraftCurrency(null, defaultCurrency)
      }));
    }
  }, [defaultCurrency, editingTransaction]);

  const customTotal = deriveCustomTotal(draft.customSplits);
  const effectiveAmount = getEffectiveTransactionAmount({
    splitType: isTransfer ? SPLIT_TYPES.EQUAL : draft.splitType,
    totalAmount: draft.totalAmount,
    customSplits: draft.customSplits
  });
  const equalSplits = useMemo(
    () => createEqualSplits(effectiveAmount, draft.participants),
    [effectiveAmount, draft.participants]
  );
  const repayment = isTransfer
    ? buildRepaymentTransaction({
        sender: draft.payer,
        recipient: draft.recipient,
        amount: draft.totalAmount
      })
    : null;
  const hasBaseFields = Boolean(
    draft.expenseDate && users.includes(draft.payer) && draft.currency
  );
  const canSubmit = isTransfer
    ? Boolean(hasBaseFields && users.length >= 2 && repayment)
    : Boolean(
        hasBaseFields &&
          draft.title.trim() &&
          (draft.splitType === SPLIT_TYPES.CUSTOM ? customTotal > 0 : effectiveAmount > 0) &&
          (draft.splitType !== SPLIT_TYPES.EQUAL || draft.participants.length > 0)
      );
  const rateLabel = getCurrencyRateLabel(draft.currency);
  const formattedEffectiveAmount = formatMoney(effectiveAmount, draft.currency).primary;

  function updateDraft(values) {
    setDraft((current) => ({ ...current, ...values }));
  }

  function handlePayerChange(nextPayer) {
    setDraft((current) => ({
      ...current,
      payer: nextPayer,
      recipient:
        current.recipient && current.recipient !== nextPayer && users.includes(current.recipient)
          ? current.recipient
          : getFirstOtherUser(users, nextPayer)
    }));
  }

  function handleCategoryChange(nextCategory) {
    setDraft((current) => ({
      ...current,
      category: nextCategory,
      recipient: isTransferCategory(nextCategory)
        ? getFirstOtherUser(users, current.payer)
        : current.recipient
    }));
  }

  function toggleParticipant(user) {
    setDraft((current) => ({
      ...current,
      participants: current.participants.includes(user)
        ? current.participants.filter((participant) => participant !== user)
        : [...current.participants, user]
    }));
  }

  function keepFocusedFieldVisible(event) {
    const field = event.target;
    const action = event.currentTarget.querySelector('.safe-area-action');
    if (!field.matches('input, select') || !action) {
      return;
    }

    const fieldBounds = field.getBoundingClientRect();
    const actionBounds = action.getBoundingClientRect();
    if (fieldBounds.bottom > actionBounds.top - 12) {
      field.scrollIntoView({ block: 'center' });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) {
      return;
    }

    const id = editingTransaction?.id || crypto.randomUUID();
    const transaction = isTransfer
      ? {
          id,
          currency: draft.currency,
          expenseDate: draft.expenseDate,
          category: draft.category,
          ...repayment
        }
      : {
          id,
          title: draft.title.trim(),
          totalAmount: effectiveAmount,
          currency: draft.currency,
          expenseDate: draft.expenseDate,
          category: draft.category,
          payer: draft.payer,
          splitType: draft.splitType,
          splits:
            draft.splitType === SPLIT_TYPES.EQUAL
              ? equalSplits
              : users.reduce((result, user) => {
                  result[user] = fromCents(toCents(draft.customSplits[user]));
                  return result;
                }, {})
        };

    setIsSubmitting(true);
    try {
      await onSaveTransaction(transaction);
    } finally {
      setIsSubmitting(false);
    }
  }

  return html`
    <section data-testid="transaction-form-screen" className="mx-auto w-full max-w-2xl">
      <header className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick=${onCancelEdit}
          title="返回账本"
          aria-label="返回账本"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
        >
          <${ArrowLeft} className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-xl font-semibold text-slate-950">
          ${isEditing ? '编辑记录' : '新增记录'}
        </h1>
      </header>

      <form onSubmit=${handleSubmit} onFocus=${keepFocusedFieldVisible} className="space-y-5">
        ${users.length === 0 &&
        html`
          <p
            data-testid="transaction-empty-members-message"
            className="border-y border-slate-200 bg-white px-3 py-3 text-sm text-slate-500"
          >
            暂无成员
          </p>
        `}

        <label className="block text-sm font-medium text-slate-700">
          <span className="flex items-center gap-2">
            <${Tags} className="h-4 w-4 text-teal-700" aria-hidden="true" />
            分类
          </span>
          <select
            data-testid="transaction-category-select"
            value=${draft.category}
            onChange=${(event) => handleCategoryChange(event.target.value)}
            className=${fieldClassName}
          >
            ${EXPENSE_CATEGORIES.map(
              (item) => html`<option key=${item} value=${item}>${item}</option>`
            )}
          </select>
        </label>

        <div className=${isTransfer ? 'grid gap-4' : 'grid gap-4 sm:grid-cols-2'}>
          <label className="block text-sm font-medium text-slate-700">
            <span className="flex items-center gap-2">
              <${CalendarDays} className="h-4 w-4 text-teal-700" aria-hidden="true" />
              日期
            </span>
            <input
              data-testid="transaction-date-input"
              type="date"
              value=${draft.expenseDate}
              onInput=${(event) => updateDraft({ expenseDate: event.target.value })}
              onChange=${(event) => updateDraft({ expenseDate: event.target.value })}
              className=${fieldClassName}
            />
          </label>

          ${!isTransfer &&
          html`
            <label className="block text-sm font-medium text-slate-700">
              记录名称
              <input
                data-testid="transaction-title-input"
                value=${draft.title}
                onChange=${(event) => updateDraft({ title: event.target.value })}
                placeholder="例如：周末聚餐"
                className=${fieldClassName}
              />
            </label>
          `}
        </div>

        ${isTransfer
          ? html`
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  <span className="flex items-center gap-2">
                    <${UserRound} className="h-4 w-4 text-teal-700" aria-hidden="true" />
                    转出人
                  </span>
                  <select
                    data-testid="payer-select"
                    value=${draft.payer}
                    onChange=${(event) => handlePayerChange(event.target.value)}
                    disabled=${users.length === 0}
                    className=${fieldClassName}
                  >
                    ${users.map(
                      (user) => html`<option key=${user} value=${user}>${user}</option>`
                    )}
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  <span className="flex items-center gap-2">
                    <${UserRound} className="h-4 w-4 text-amber-700" aria-hidden="true" />
                    收款人
                  </span>
                  <select
                    data-testid="repayment-recipient-select"
                    value=${draft.recipient}
                    onChange=${(event) => updateDraft({ recipient: event.target.value })}
                    disabled=${users.length < 2}
                    className=${fieldClassName}
                  >
                    ${users
                      .filter((user) => user !== draft.payer)
                      .map((user) => html`<option key=${user} value=${user}>${user}</option>`)}
                  </select>
                </label>
              </div>
              ${users.length > 0 && users.length < 2 &&
              html`<p className="text-sm text-rose-700">至少需要两名成员</p>`}
            `
          : html`
              <label className="block text-sm font-medium text-slate-700">
                <span className="flex items-center gap-2">
                  <${UserRound} className="h-4 w-4 text-teal-700" aria-hidden="true" />
                  付款人
                </span>
                <select
                  data-testid="payer-select"
                  value=${draft.payer}
                  onChange=${(event) => handlePayerChange(event.target.value)}
                  disabled=${users.length === 0}
                  className=${fieldClassName}
                >
                  ${users.map((user) => html`<option key=${user} value=${user}>${user}</option>`)}
                </select>
              </label>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-700">分账方式</legend>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200 p-1">
                  ${[
                    [SPLIT_TYPES.EQUAL, '均分'],
                    [SPLIT_TYPES.CUSTOM, '自定义']
                  ].map(
                    ([value, label]) => html`
                      <label
                        key=${value}
                        data-testid=${`split-type-option-${value}`}
                        className=${`flex min-h-10 cursor-pointer items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition ${
                          draft.splitType === value
                            ? 'bg-white text-teal-800 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <input
                          data-testid=${`split-type-${value}`}
                          type="radio"
                          name="splitType"
                          value=${value}
                          checked=${draft.splitType === value}
                          onChange=${() => updateDraft({ splitType: value })}
                          className="sr-only"
                        />
                        ${label}
                      </label>
                    `
                  )}
                </div>
              </fieldset>

              ${draft.splitType === SPLIT_TYPES.EQUAL
                ? html`
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <${UsersRound} className="h-4 w-4 text-amber-700" aria-hidden="true" />
                        参与成员
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        ${users.map(
                          (user) => html`
                            <label
                              key=${user}
                              className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                            >
                              <span className="min-w-0 break-words">${user}</span>
                              <input
                                type="checkbox"
                                data-testid=${`equal-participant-${user}`}
                                checked=${draft.participants.includes(user)}
                                onChange=${() => toggleParticipant(user)}
                                className="h-4 w-4 shrink-0 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                              />
                            </label>
                          `
                        )}
                      </div>
                      ${draft.participants.length > 0 && effectiveAmount > 0 &&
                      html`
                        <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
                          ${draft.participants.map(
                            (user) => html`
                              <div key=${user} className="flex items-center justify-between gap-3 py-2 text-sm">
                                <span className="min-w-0 break-words text-slate-700">${user}</span>
                                <${MoneyAmount}
                                  value=${equalSplits[user] || 0}
                                  currency=${draft.currency}
                                  primaryClassName="font-semibold text-slate-900"
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
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <${Calculator} className="h-4 w-4 text-amber-700" aria-hidden="true" />
                        分摊金额
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        ${users.map(
                          (user) => html`
                            <label key=${user} className="block text-sm text-slate-700">
                              <span className="break-words">${user}</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                data-testid=${`custom-split-${user}`}
                                min="0"
                                step="0.01"
                                value=${draft.customSplits[user] ?? ''}
                                onChange=${(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    customSplits: {
                                      ...current.customSplits,
                                      [user]: event.target.value
                                    }
                                  }))}
                                placeholder="0.00"
                                className=${fieldClassName}
                              />
                            </label>
                          `
                        )}
                      </div>
                    </div>
                  `}
            `}

        <label className="block text-sm font-medium text-slate-700">
          <span className="flex items-center gap-2">
            <${Coins} className="h-4 w-4 text-amber-700" aria-hidden="true" />
            币种
          </span>
          <select
            data-testid="transaction-currency-select"
            value=${draft.currency}
            onChange=${(event) => updateDraft({ currency: event.target.value })}
            className=${fieldClassName}
          >
            ${Object.values(CURRENCIES).map(
              (item) => html`<option key=${item.code} value=${item.code}>${item.label}</option>`
            )}
          </select>
          ${rateLabel &&
          html`<span className="mt-1.5 block text-xs font-normal text-slate-500">${rateLabel}</span>`}
        </label>

        ${(isTransfer || draft.splitType === SPLIT_TYPES.EQUAL) &&
        html`
          <label className="block text-sm font-medium text-slate-700">
            ${isTransfer ? '转账金额' : '总金额'}
            <input
              data-testid="transaction-amount-input"
              value=${draft.totalAmount}
              onChange=${(event) => updateDraft({ totalAmount: event.target.value })}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              className=${fieldClassName}
            />
          </label>
        `}

        <div className="safe-area-action sticky bottom-0 z-20 -mx-4 border-t border-slate-200 bg-white/95 px-4 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:mx-0 sm:rounded-t-lg sm:border-x">
          <div className="mb-3 flex min-h-11 items-center justify-between gap-4">
            <span className="text-sm font-medium text-slate-600">总额</span>
            <span data-testid="derived-total" className="min-w-0 text-lg text-slate-950">
              <${MoneyAmount}
                value=${effectiveAmount}
                currency=${draft.currency}
                primaryClassName="font-semibold"
              />
            </span>
          </div>
          <button
            data-testid="add-transaction-button"
            type="submit"
            disabled=${!canSubmit || isSubmitting}
            className="min-h-12 w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            ${isSubmitting
              ? '保存中'
              : `${isEditing ? '保存修改' : '添加记录'} · ${formattedEffectiveAmount}`}
          </button>
        </div>
      </form>
    </section>
  `;
}
