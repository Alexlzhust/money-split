import { Plus, Trash2, UserRoundPlus, X } from 'lucide-react';
import { useEffect, useReducer, useRef, useState } from 'react';
import { html } from './lib/html.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { BottomNavigation } from './components/BottomNavigation.js';
import { ExpenseSummary } from './components/ExpenseSummary.js';
import { MemberManagement } from './components/MemberManagement.js';
import { SettlementDashboard } from './components/SettlementDashboard.js';
import { TransactionForm } from './components/TransactionForm.js';
import { TransactionList } from './components/TransactionList.js';
import { DEFAULT_CURRENCY, DEFAULT_USERS, STORAGE_KEYS } from './config/appState.js';
import {
  createRemoteMember,
  createRemoteTransaction,
  deleteRemoteTransaction,
  fetchRemoteState,
  resetRemoteState,
  updateRemoteTransaction
} from './services/apiClient.js';
import {
  deleteTransactionFromState,
  getLatestTransaction,
  upsertTransactionInState
} from './utils/transactionState.js';
import { APP_SCREENS, appViewReducer, createInitialAppView } from './utils/appView.js';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getVisibleFocusableElements(container) {
  return Array.from(container?.querySelectorAll(FOCUSABLE_SELECTOR) || []).filter(
    (element) => element.offsetParent !== null
  );
}

export function App() {
  const [users, setUsers] = useLocalStorage(STORAGE_KEYS.users, DEFAULT_USERS);
  const [transactions, setTransactions] = useLocalStorage(STORAGE_KEYS.transactions, []);
  const [settlementCurrency, setSettlementCurrency] = useLocalStorage(
    STORAGE_KEYS.currency,
    DEFAULT_CURRENCY
  );
  const [lastPayer, setLastPayer] = useLocalStorage(STORAGE_KEYS.lastPayer, '');
  const [persistenceMode, setPersistenceMode] = useState('loading');
  const [syncMessage, setSyncMessage] = useState('');
  const [mutationPending, setMutationPending] = useState(false);
  const [view, dispatch] = useReducer(appViewReducer, undefined, createInitialAppView);
  const memberTriggerRef = useRef(null);
  const memberDialogRef = useRef(null);
  const mutationPendingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    fetchRemoteState()
      .then((state) => {
        if (!isMounted) {
          return;
        }
        setUsers(state.users || []);
        setTransactions(state.transactions || []);
        setPersistenceMode('database');
        setSyncMessage('');
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setPersistenceMode('local');
      });

    return () => {
      isMounted = false;
    };
  }, [setTransactions, setUsers]);

  useEffect(() => {
    if (!view.memberOpen) {
      return undefined;
    }

    const trigger = memberTriggerRef.current;
    const dialog = memberDialogRef.current;
    const focusableElements = getVisibleFocusableElements(dialog);
    const initialFocus =
      dialog?.querySelector('[data-testid="member-name-input"]:not([disabled])') ||
      focusableElements[0] ||
      dialog;

    initialFocus?.focus();

    function handleDocumentKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        dispatch({ type: 'CLOSE_MEMBERS' });
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const currentDialog = memberDialogRef.current;
      const currentFocusableElements = getVisibleFocusableElements(currentDialog);

      if (currentFocusableElements.length === 0) {
        event.preventDefault();
        currentDialog?.focus();
        return;
      }

      const firstElement = currentFocusableElements[0];
      const lastElement = currentFocusableElements[currentFocusableElements.length - 1];
      const focusIsOutside = !currentDialog?.contains(document.activeElement);

      if (focusIsOutside) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
      } else if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    function handleDocumentFocusIn(event) {
      const currentDialog = memberDialogRef.current;
      if (currentDialog && !currentDialog.contains(event.target)) {
        const [firstElement] = getVisibleFocusableElements(currentDialog);
        (firstElement || currentDialog).focus();
      }
    }

    document.addEventListener('keydown', handleDocumentKeyDown, true);
    document.addEventListener('focusin', handleDocumentFocusIn, true);

    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown, true);
      document.removeEventListener('focusin', handleDocumentFocusIn, true);
      if (trigger?.isConnected) {
        trigger.focus();
      }
    };
  }, [view.memberOpen]);

  function applyRemoteState(state) {
    setUsers(state.users || []);
    setTransactions(state.transactions || []);
    setSyncMessage('');
  }

  function setRemoteMutationPending(isPending) {
    mutationPendingRef.current = isPending;
    setMutationPending(isPending);
  }

  async function addMember(name) {
    if (persistenceMode === 'loading' || mutationPendingRef.current) {
      return false;
    }

    if (persistenceMode === 'database') {
      setRemoteMutationPending(true);
      try {
        applyRemoteState(await createRemoteMember(name));
        return true;
      } catch (error) {
        setSyncMessage(error.message);
        return false;
      } finally {
        setRemoteMutationPending(false);
      }
    }

    setUsers((current) => (current.includes(name) ? current : [...current, name]));
    return true;
  }

  async function saveTransaction(transaction) {
    if (persistenceMode === 'loading' || mutationPendingRef.current) {
      return false;
    }

    const isEditing = transactions.some((item) => item.id === transaction.id);
    if (persistenceMode === 'database') {
      setRemoteMutationPending(true);
      try {
        applyRemoteState(
          isEditing
            ? await updateRemoteTransaction(transaction)
            : await createRemoteTransaction(transaction)
        );
        setLastPayer(transaction.payer);
        setSyncMessage('');
        dispatch({ type: 'CLOSE_TRANSACTION' });
        return true;
      } catch (error) {
        setSyncMessage(error.message);
        return false;
      } finally {
        setRemoteMutationPending(false);
      }
    }

    setTransactions((current) => upsertTransactionInState(current, transaction));
    setLastPayer(transaction.payer);
    setSyncMessage('');
    dispatch({ type: 'CLOSE_TRANSACTION' });
    return true;
  }

  async function deleteTransaction(id) {
    if (persistenceMode === 'loading' || mutationPendingRef.current) {
      return false;
    }

    if (persistenceMode === 'database') {
      setRemoteMutationPending(true);
      try {
        applyRemoteState(await deleteRemoteTransaction(id));
        return true;
      } catch (error) {
        setSyncMessage(error.message);
        return false;
      } finally {
        setRemoteMutationPending(false);
      }
    }

    setTransactions((current) => deleteTransactionFromState(current, id));
    setSyncMessage('');
    return true;
  }

  function undoLatestTransaction() {
    if (persistenceMode === 'loading' || mutationPendingRef.current) {
      return false;
    }

    const latest = getLatestTransaction(transactions);
    if (latest) {
      return deleteTransaction(latest.id);
    }

    return false;
  }

  async function resetData() {
    if (persistenceMode === 'loading' || mutationPendingRef.current) {
      return false;
    }

    if (!window.confirm('确定清空所有成员和账单吗？')) {
      return false;
    }

    if (persistenceMode === 'database') {
      setRemoteMutationPending(true);
      try {
        applyRemoteState(await resetRemoteState());
        dispatch({ type: 'CLOSE_TRANSACTION' });
        return true;
      } catch (error) {
        setSyncMessage(error.message);
        return false;
      } finally {
        setRemoteMutationPending(false);
      }
    }

    setUsers(DEFAULT_USERS);
    setTransactions([]);
    setSyncMessage('');
    dispatch({ type: 'CLOSE_TRANSACTION' });
    return true;
  }

  function navigate(screen) {
    dispatch({
      type: screen === APP_SCREENS.SETTLEMENT ? 'OPEN_SETTLEMENT' : 'OPEN_LEDGER'
    });
  }

  const statusLabel =
    persistenceMode === 'database'
      ? '数据库已连接'
      : persistenceMode === 'loading'
        ? '正在连接数据库'
        : '本地模式';
  const controlsDisabled = persistenceMode === 'loading' || mutationPending;

  const syncError =
    syncMessage &&
    html`
      <p
        role="alert"
        className="mb-4 break-words rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
      >
        ${syncMessage}
      </p>
    `;

  if (view.screen === APP_SCREENS.TRANSACTION) {
    return html`
      <main className="min-h-screen bg-slate-50 px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-3xl">
          ${syncError}
          <${TransactionForm}
            users=${users}
            editingTransaction=${view.editingTransaction}
            defaultCurrency=${settlementCurrency}
            rememberedPayer=${lastPayer}
            onCancelEdit=${() => dispatch({ type: 'CLOSE_TRANSACTION' })}
            onSaveTransaction=${saveTransaction}
          />
        </div>
      </main>
    `;
  }

  return html`
    <main className="min-h-screen bg-slate-50 px-4 pb-40 pt-4 sm:px-6 sm:pt-6">
      <div className="mx-auto max-w-3xl">
        ${view.screen === APP_SCREENS.LEDGER
          ? html`
              <header className="mb-5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-bold text-slate-950">Money</h1>
                  <p className="mt-0.5 text-xs text-slate-500">${statusLabel}</p>
                </div>
                <button
                  ref=${memberTriggerRef}
                  type="button"
                  onClick=${() => dispatch({ type: 'OPEN_MEMBERS' })}
                  title="管理成员"
                  aria-label="管理成员"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                >
                  <${UserRoundPlus} className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick=${resetData}
                  disabled=${controlsDisabled}
                  title="清空成员和账单"
                  aria-label="清空成员和账单"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                >
                  <${Trash2} className="h-5 w-5" aria-hidden="true" />
                </button>
              </header>

              ${!view.memberOpen && syncError}

              <div className="space-y-7">
                <${ExpenseSummary}
                  transactions=${transactions}
                  settlementCurrency=${settlementCurrency}
                />
                <${TransactionList}
                  transactions=${transactions}
                  editingTransactionId=""
                  onDeleteTransaction=${deleteTransaction}
                  onEditTransaction=${(transaction) => {
                    if (!controlsDisabled) {
                      dispatch({ type: 'OPEN_EDIT_TRANSACTION', transaction });
                    }
                  }}
                  onUndoLatest=${undoLatestTransaction}
                  disabled=${controlsDisabled}
                />
              </div>

              <button
                data-testid="open-transaction-form"
                type="button"
                onClick=${() => dispatch({ type: 'OPEN_NEW_TRANSACTION' })}
                disabled=${controlsDisabled}
                title="新增账单"
                aria-label="新增账单"
                className="safe-area-fab fixed right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:right-[max(1.5rem,calc((100vw-48rem)/2+1.5rem))]"
              >
                <${Plus} className="h-6 w-6" aria-hidden="true" />
              </button>
            `
          : html`
              <header className="mb-5">
                <h1 className="text-2xl font-bold text-slate-950">结算</h1>
                <p className="mt-0.5 text-xs text-slate-500">${statusLabel}</p>
              </header>

              ${syncError}

              <${SettlementDashboard}
                users=${users}
                transactions=${transactions}
                settlementCurrency=${settlementCurrency}
                onSettlementCurrencyChange=${setSettlementCurrency}
              />
          `}
      </div>

      ${view.screen === APP_SCREENS.LEDGER &&
      view.memberOpen &&
      html`
        <div
          className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center"
          onMouseDown=${(event) => {
            if (event.target === event.currentTarget) {
              dispatch({ type: 'CLOSE_MEMBERS' });
            }
          }}
        >
          <div
            ref=${memberDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-dialog-title"
            tabIndex="-1"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-lg bg-white p-4 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="member-dialog-title" className="text-base font-semibold text-slate-950">
                成员管理
              </h2>
              <button
                type="button"
                onClick=${() => dispatch({ type: 'CLOSE_MEMBERS' })}
                title="关闭成员管理"
                aria-label="关闭成员管理"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <${X} className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            ${syncMessage &&
            html`
              <p
                role="alert"
                className="mb-3 break-words rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
              >
                ${syncMessage}
              </p>
            `}
            <${MemberManagement}
              users=${users}
              onAddMember=${addMember}
              disabled=${controlsDisabled}
            />
          </div>
        </div>
      `}

      <${BottomNavigation} activeScreen=${view.screen} onNavigate=${navigate} />
    </main>
  `;
}
