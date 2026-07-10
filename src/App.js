import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { html } from './lib/html.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
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

export function App() {
  const [users, setUsers] = useLocalStorage(STORAGE_KEYS.users, DEFAULT_USERS);
  const [transactions, setTransactions] = useLocalStorage(STORAGE_KEYS.transactions, []);
  const [settlementCurrency, setSettlementCurrency] = useLocalStorage(
    STORAGE_KEYS.currency,
    DEFAULT_CURRENCY
  );
  const [persistenceMode, setPersistenceMode] = useState('loading');
  const [syncMessage, setSyncMessage] = useState('');
  const [editingTransaction, setEditingTransaction] = useState(null);

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

  function applyRemoteState(state) {
    setUsers(state.users || []);
    setTransactions(state.transactions || []);
    setEditingTransaction(null);
    setSyncMessage('');
  }

  async function addMember(name) {
    if (persistenceMode === 'database') {
      try {
        applyRemoteState(await createRemoteMember(name));
        return true;
      } catch (error) {
        setSyncMessage(error.message);
        return false;
      }
    }

    setUsers((current) => (current.includes(name) ? current : [...current, name]));
    return true;
  }

  async function saveTransaction(transaction) {
    const isEditing = transactions.some((item) => item.id === transaction.id);
    if (persistenceMode === 'database') {
      try {
        applyRemoteState(
          isEditing
            ? await updateRemoteTransaction(transaction)
            : await createRemoteTransaction(transaction)
        );
        return true;
      } catch (error) {
        setSyncMessage(error.message);
        return false;
      }
    }

    setTransactions((current) => upsertTransactionInState(current, transaction));
    setEditingTransaction(null);
    setSyncMessage('');
    return true;
  }

  async function deleteTransaction(id) {
    if (persistenceMode === 'database') {
      try {
        applyRemoteState(await deleteRemoteTransaction(id));
        return true;
      } catch (error) {
        setSyncMessage(error.message);
        return false;
      }
    }

    setTransactions((current) => deleteTransactionFromState(current, id));
    setEditingTransaction((current) => (current?.id === id ? null : current));
    setSyncMessage('');
    return true;
  }

  function undoLatestTransaction() {
    const latest = getLatestTransaction(transactions);
    if (latest) {
      deleteTransaction(latest.id);
    }
  }

  async function resetData() {
    if (persistenceMode === 'database') {
      try {
        applyRemoteState(await resetRemoteState());
      } catch (error) {
        setSyncMessage(error.message);
      }
      return;
    }

    setUsers(DEFAULT_USERS);
    setTransactions([]);
    setEditingTransaction(null);
    setSyncMessage('');
  }

  return html`
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              Multi-party Expense Splitter
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">多人分账应用</h1>
            <p className="mt-2 text-sm text-slate-500">
              ${persistenceMode === 'database'
                ? '数据库已连接'
                : persistenceMode === 'loading'
                  ? '正在连接数据库'
              : '本地模式'}
            </p>
          </div>
          <button
            type="button"
            onClick=${resetData}
            title="清空成员和账单"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-700"
          >
            <${Trash2} className="h-4 w-4" aria-hidden="true" />
            重置
          </button>
        </header>

        ${syncMessage &&
        html`
          <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            ${syncMessage}
          </p>
        `}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
          <div className="space-y-4">
            <${MemberManagement} users=${users} onAddMember=${addMember} />
            <${TransactionForm}
              users=${users}
              editingTransaction=${editingTransaction}
              onCancelEdit=${() => setEditingTransaction(null)}
              onSaveTransaction=${saveTransaction}
            />
          </div>
          <div className="space-y-4">
            <${SettlementDashboard}
              users=${users}
              transactions=${transactions}
              settlementCurrency=${settlementCurrency}
              onSettlementCurrencyChange=${setSettlementCurrency}
            />
            <${TransactionList}
              transactions=${transactions}
              editingTransactionId=${editingTransaction?.id || ''}
              onDeleteTransaction=${deleteTransaction}
              onEditTransaction=${setEditingTransaction}
              onUndoLatest=${undoLatestTransaction}
            />
          </div>
        </div>
      </div>
    </main>
  `;
}
