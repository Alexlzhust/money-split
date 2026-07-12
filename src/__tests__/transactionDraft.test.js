import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  buildTransactionPayload,
  buildRepaymentTransaction,
  createTransactionDraft,
  deriveCustomTotal,
  getDefaultPayer,
  getDraftCurrency,
  getEffectiveTransactionAmount,
  getCustomSplitInputs,
  getUnavailableTransactionMembers,
  isTransactionDraftValid,
  reconcileEqualParticipants,
  selectRepaymentRecipient
} from '../utils/transactionDraft.js';
import { calculateNetBalances } from '../utils/settlements.js';

const transactionFormSource = readFileSync(
  new URL('../components/TransactionForm.js', import.meta.url),
  'utf8'
);

describe('transaction form contracts', () => {
  it('marks the screen busy and locks the editable form controls while submitting', () => {
    assert.match(transactionFormSource, /aria-busy=\$\{isSubmitting\}/);
    assert.match(
      transactionFormSource,
      /<fieldset[^>]*disabled=\$\{isSubmitting\}[^>]*>/s
    );
  });

  it('caps every monetary input at the shared maximum amount', () => {
    assert.equal(
      [...transactionFormSource.matchAll(/max=\$\{MAX_MONEY_AMOUNT\}/g)].length,
      2
    );
  });

  it('shows a visible focus ring on split mode labels', () => {
    assert.match(transactionFormSource, /focus-within:ring-2/);
    assert.match(transactionFormSource, /focus-within:ring-teal-600/);
  });

  it('uses 16px controls on mobile to prevent browser auto-zoom', () => {
    assert.match(transactionFormSource, /text-base sm:text-sm/);
  });
});

describe('transaction draft helpers', () => {
  it('derives a cent-rounded total from custom splits', () => {
    assert.equal(deriveCustomTotal({ 阿宁: '10.10', 小林: 20.205, 小周: '' }), 30.31);
  });

  it('uses custom shares or the entered equal total as the effective amount', () => {
    assert.equal(
      getEffectiveTransactionAmount({
        splitType: 'CUSTOM',
        totalAmount: '999',
        customSplits: { 阿宁: '10.10', 小林: '20.21' }
      }),
      30.31
    );
    assert.equal(
      getEffectiveTransactionAmount({
        splitType: 'EQUAL',
        totalAmount: '90.005',
        customSplits: { 阿宁: '999' }
      }),
      90.01
    );
    assert.equal(
      getEffectiveTransactionAmount({ splitType: 'EQUAL', totalAmount: 'invalid' }),
      0
    );
  });

  it('uses a remembered payer only while that payer is a current member', () => {
    assert.equal(getDefaultPayer(['阿宁', '小林'], '小林'), '小林');
    assert.equal(getDefaultPayer(['阿宁', '小林'], '小周'), '阿宁');
    assert.equal(getDefaultPayer([], '小林'), '');
    assert.equal(getDefaultPayer(undefined, '阿宁'), '');
  });

  it('preserves a valid repayment recipient and falls back when the payer changes', () => {
    const users = ['A', 'B', 'C'];

    assert.equal(selectRepaymentRecipient(users, 'A', 'C'), 'C');
    assert.equal(selectRepaymentRecipient(users, 'C', 'C'), 'A');
    assert.equal(selectRepaymentRecipient(['B', 'A', 'C'], 'C', 'C'), 'B');
  });

  it('builds custom split inputs in current-member order', () => {
    assert.deepEqual(
      getCustomSplitInputs(['A', 'B'], { A: 12, C: 30 }),
      { A: 12, B: '' }
    );
  });

  it('preserves deselections while selecting genuinely new equal participants', () => {
    assert.deepEqual(
      reconcileEqualParticipants(
        ['阿宁'],
        ['阿宁', '小林'],
        ['阿宁', '小林', '小周']
      ),
      ['阿宁', '小周']
    );
  });

  it('drops equal participants who are no longer members', () => {
    assert.deepEqual(
      reconcileEqualParticipants(['阿宁', '小林'], ['阿宁', '小林'], ['小林']),
      ['小林']
    );
  });

  it('deduplicates equal participants in next-member order', () => {
    assert.deepEqual(
      reconcileEqualParticipants(
        ['小林', '阿宁', '小林'],
        ['阿宁', '小林'],
        ['小周', '阿宁', '小林', '阿宁', '小周']
      ),
      ['小周', '阿宁', '小林']
    );
  });

  it('treats malformed equal participant inputs as empty arrays', () => {
    assert.deepEqual(reconcileEqualParticipants(undefined, undefined, undefined), []);
    assert.deepEqual(
      reconcileEqualParticipants(null, ['阿宁'], ['阿宁', '小林']),
      ['小林']
    );
    assert.deepEqual(reconcileEqualParticipants(['阿宁'], null, ['阿宁', '小林']), [
      '阿宁',
      '小林'
    ]);
    assert.deepEqual(reconcileEqualParticipants(['阿宁'], ['阿宁'], null), []);
  });

  it('initializes a new transaction draft from current defaults', () => {
    assert.deepEqual(
      createTransactionDraft({
        users: ['阿宁', '小林'],
        editingTransaction: null,
        defaultCurrency: 'HKD',
        rememberedPayer: '小林',
        today: '2026-07-12'
      }),
      {
        title: '',
        totalAmount: '',
        currency: 'TWD',
        expenseDate: '2026-07-12',
        category: '其他',
        payer: '小林',
        recipient: '阿宁',
        splitType: 'EQUAL',
        participants: ['阿宁', '小林'],
        customSplits: { 阿宁: '', 小林: '' }
      }
    );
  });

  it('derives a custom edit total from saved splits instead of the saved total', () => {
    const draft = createTransactionDraft({
      users: ['阿宁', '小林'],
      editingTransaction: {
        title: '晚餐',
        totalAmount: 999,
        currency: 'TWD',
        expenseDate: '2026-07-01',
        category: '餐饮',
        payer: '阿宁',
        splitType: 'CUSTOM',
        splits: { 阿宁: 10.1, 小林: 20.21 }
      },
      defaultCurrency: 'HKD',
      rememberedPayer: '小林',
      today: '2026-07-12'
    });

    assert.equal(draft.totalAmount, '30.31');
    assert.deepEqual(draft.customSplits, { 阿宁: 10.1, 小林: 20.21 });
  });

  it('restores repayment sender, recipient, and cent-rounded amount', () => {
    const draft = createTransactionDraft({
      users: ['阿宁', '小林'],
      editingTransaction: {
        title: 'ignored',
        totalAmount: 50.005,
        currency: 'TWD',
        expenseDate: '2026-07-01',
        category: '内部转账/还款',
        payer: '小林',
        splitType: 'CUSTOM',
        splits: { 阿宁: 50.01 }
      },
      defaultCurrency: 'HKD',
      rememberedPayer: '阿宁',
      today: '2026-07-12'
    });

    assert.equal(draft.payer, '小林');
    assert.equal(draft.recipient, '阿宁');
    assert.equal(draft.totalAmount, '50.01');
  });

  it('finds unavailable payer and split references without duplicates', () => {
    assert.deepEqual(
      getUnavailableTransactionMembers(['阿宁'], {
        payer: '小林',
        splits: { 阿宁: 10, 小林: 10, 小周: 10 }
      }),
      ['小林', '小周']
    );
    assert.deepEqual(
      getUnavailableTransactionMembers(['阿宁', '小林'], {
        payer: '阿宁',
        splits: { 阿宁: 10, 小林: 10 }
      }),
      []
    );
  });

  it('retains unavailable custom split values for safe member restoration', () => {
    const draft = createTransactionDraft({
      users: ['阿宁'],
      editingTransaction: {
        title: '旧自定义',
        totalAmount: 20,
        currency: 'TWD',
        expenseDate: '2026-07-01',
        category: '其他',
        payer: '阿宁',
        splitType: 'CUSTOM',
        splits: { 阿宁: 10, 小林: 10 }
      },
      defaultCurrency: 'TWD',
      rememberedPayer: '阿宁',
      today: '2026-07-12'
    });

    assert.deepEqual(draft.customSplits, { 阿宁: 10, 小林: 10 });
  });

  it('accepts positive custom drafts and rejects zero custom drafts', () => {
    const users = ['阿宁', '小林'];
    const baseDraft = createTransactionDraft({
      users,
      defaultCurrency: 'TWD',
      rememberedPayer: '阿宁',
      today: '2026-07-12'
    });
    const positiveDraft = {
      ...baseDraft,
      title: '晚餐',
      splitType: 'CUSTOM',
      customSplits: { 阿宁: '10.10', 小林: '20.21' }
    };

    assert.equal(isTransactionDraftValid({ users, draft: positiveDraft }), true);
    assert.equal(
      isTransactionDraftValid({
        users,
        draft: { ...positiveDraft, customSplits: { 阿宁: '', 小林: '0' } }
      }),
      false
    );
  });

  it('builds a cent-normalized custom payload whose splits equal its total', () => {
    const users = ['阿宁', '小林'];
    const draft = {
      ...createTransactionDraft({
        users,
        defaultCurrency: 'TWD',
        rememberedPayer: '阿宁',
        today: '2026-07-12'
      }),
      title: '晚餐',
      splitType: 'CUSTOM',
      customSplits: { 阿宁: '10.105', 小林: '20.205' }
    };

    assert.deepEqual(buildTransactionPayload({ id: 'custom-1', users, draft }), {
      id: 'custom-1',
      title: '晚餐',
      totalAmount: 30.32,
      currency: 'TWD',
      expenseDate: '2026-07-12',
      category: '其他',
      payer: '阿宁',
      splitType: 'CUSTOM',
      splits: { 阿宁: 10.11, 小林: 20.21 }
    });
  });

  it('builds an equal payload with cent-safe shares and exact total', () => {
    const users = ['阿宁', '小林'];
    const draft = {
      ...createTransactionDraft({
        users,
        defaultCurrency: 'HKD',
        rememberedPayer: '小林',
        today: '2026-07-12'
      }),
      title: '午餐',
      totalAmount: '90.005'
    };

    assert.deepEqual(buildTransactionPayload({ id: 'equal-1', users, draft }), {
      id: 'equal-1',
      title: '午餐',
      totalAmount: 90.01,
      currency: 'TWD',
      expenseDate: '2026-07-12',
      category: '其他',
      payer: '小林',
      splitType: 'EQUAL',
      splits: { 阿宁: 45.01, 小林: 45 }
    });
  });

  it('accepts the PostgreSQL integer cents ceiling', () => {
    const users = ['A'];
    const draft = {
      ...createTransactionDraft({
        users,
        defaultCurrency: 'TWD',
        rememberedPayer: 'A',
        today: '2026-07-12'
      }),
      title: 'Boundary',
      totalAmount: '21474836.47'
    };

    assert.equal(isTransactionDraftValid({ users, draft }), true);
    assert.equal(
      buildTransactionPayload({ id: 'boundary', users, draft })?.totalAmount,
      21474836.47
    );
  });

  it('rejects totals above the PostgreSQL integer cents ceiling', () => {
    const users = ['A'];
    const draft = {
      ...createTransactionDraft({
        users,
        defaultCurrency: 'TWD',
        rememberedPayer: 'A',
        today: '2026-07-12'
      }),
      title: 'Overflow',
      totalAmount: '21474836.48'
    };

    assert.equal(isTransactionDraftValid({ users, draft }), false);
    assert.equal(buildTransactionPayload({ id: 'overflow', users, draft }), null);
  });

  it('rejects a negative custom split even when another split offsets it', () => {
    const users = ['A', 'B'];
    const draft = {
      ...createTransactionDraft({
        users,
        defaultCurrency: 'TWD',
        rememberedPayer: 'A',
        today: '2026-07-12'
      }),
      title: 'Offset',
      splitType: 'CUSTOM',
      customSplits: { A: '-1', B: '2' }
    };

    assert.equal(isTransactionDraftValid({ users, draft }), false);
    assert.equal(buildTransactionPayload({ id: 'negative-split', users, draft }), null);
  });

  it('rejects custom split totals above the PostgreSQL integer cents ceiling', () => {
    const users = ['A', 'B'];
    const draft = {
      ...createTransactionDraft({
        users,
        defaultCurrency: 'TWD',
        rememberedPayer: 'A',
        today: '2026-07-12'
      }),
      title: 'Custom overflow',
      splitType: 'CUSTOM',
      customSplits: { A: '21474836.47', B: '0.01' }
    };

    assert.equal(isTransactionDraftValid({ users, draft }), false);
    assert.equal(buildTransactionPayload({ id: 'custom-overflow', users, draft }), null);
  });

  it('builds a repayment payload with generated custom financial fields', () => {
    const users = ['阿宁', '小林'];
    const draft = {
      ...createTransactionDraft({
        users,
        defaultCurrency: 'TWD',
        rememberedPayer: '小林',
        today: '2026-07-12'
      }),
      category: '内部转账/还款',
      payer: '小林',
      recipient: '阿宁',
      totalAmount: '50.005'
    };

    assert.deepEqual(buildTransactionPayload({ id: 'repayment-1', users, draft }), {
      id: 'repayment-1',
      currency: 'TWD',
      expenseDate: '2026-07-12',
      category: '内部转账/还款',
      title: '小林 还款给 阿宁',
      payer: '小林',
      splitType: 'CUSTOM',
      totalAmount: 50.01,
      splits: { 阿宁: 50.01 }
    });
  });

  it('blocks custom and equal legacy records with unavailable references', () => {
    const users = ['阿宁'];
    const records = [
      {
        id: 'legacy-custom',
        title: '旧自定义',
        totalAmount: 20,
        currency: 'TWD',
        expenseDate: '2026-07-01',
        category: '其他',
        payer: '小林',
        splitType: 'CUSTOM',
        splits: { 阿宁: 10, 小林: 10 }
      },
      {
        id: 'legacy-equal',
        title: '旧均分',
        totalAmount: 20,
        currency: 'TWD',
        expenseDate: '2026-07-01',
        category: '其他',
        payer: '阿宁',
        splitType: 'EQUAL',
        splits: { 阿宁: 10, 小林: 10 }
      }
    ];

    records.forEach((editingTransaction) => {
      const draft = createTransactionDraft({
        users,
        editingTransaction,
        defaultCurrency: 'TWD',
        rememberedPayer: '阿宁',
        today: '2026-07-12'
      });
      assert.equal(
        isTransactionDraftValid({ users, draft, editingTransaction }),
        false
      );
      assert.equal(
        buildTransactionPayload({
          id: editingTransaction.id,
          users,
          draft,
          editingTransaction
        }),
        null
      );
    });
  });

  it('defaults new transactions to TWD and preserves saved currency when editing', () => {
    assert.equal(getDraftCurrency(null, 'HKD'), 'TWD');
    assert.equal(getDraftCurrency({ currency: 'CNY' }, 'HKD'), 'CNY');
  });

  it('maps a repayment to custom transaction financial fields', () => {
    assert.deepEqual(
      buildRepaymentTransaction({ sender: '小林', recipient: '阿宁', amount: '50.005' }),
      {
        title: '小林 还款给 阿宁',
        payer: '小林',
        splitType: 'CUSTOM',
        totalAmount: 50.01,
        splits: { 阿宁: 50.01 }
      }
    );
  });

  it('trims member names when mapping a valid repayment', () => {
    assert.deepEqual(
      buildRepaymentTransaction({ sender: ' 小林 ', recipient: ' 阿宁 ', amount: 50 }),
      {
        title: '小林 还款给 阿宁',
        payer: '小林',
        splitType: 'CUSTOM',
        totalAmount: 50,
        splits: { 阿宁: 50 }
      }
    );
  });

  it('rejects repayments without distinct members or a positive amount', () => {
    assert.equal(buildRepaymentTransaction({ sender: '', recipient: '阿宁', amount: 50 }), null);
    assert.equal(buildRepaymentTransaction({ sender: '小林', recipient: '', amount: 50 }), null);
    assert.equal(
      buildRepaymentTransaction({ sender: '阿宁', recipient: '阿宁', amount: 50 }),
      null
    );
    assert.equal(
      buildRepaymentTransaction({ sender: '小林', recipient: '阿宁', amount: 0 }),
      null
    );
    assert.equal(
      buildRepaymentTransaction({ sender: '小林', recipient: '阿宁', amount: 'invalid' }),
      null
    );
  });

  it('rejects a positive amount too small to produce one cent', () => {
    assert.equal(
      buildRepaymentTransaction({ sender: '小林', recipient: '阿宁', amount: '1e-7' }),
      null
    );
  });

  it('rejects an amount that cannot produce safe integer cents', () => {
    assert.equal(
      buildRepaymentTransaction({ sender: '小林', recipient: '阿宁', amount: '1e20' }),
      null
    );
  });

  it('rejects a repayment above the PostgreSQL integer cents ceiling', () => {
    assert.equal(
      buildRepaymentTransaction({
        sender: '小林',
        recipient: '阿宁',
        amount: 21474836.48
      }),
      null
    );
  });

  it('rejects an undefined payload', () => {
    assert.equal(buildRepaymentTransaction(), null);
  });

  it('rejects a null payload', () => {
    assert.equal(buildRepaymentTransaction(null), null);
  });

  it('rejects a whitespace-only sender', () => {
    assert.equal(
      buildRepaymentTransaction({ sender: '   ', recipient: '阿宁', amount: 50 }),
      null
    );
  });

  it('rejects a whitespace-only recipient', () => {
    assert.equal(
      buildRepaymentTransaction({ sender: '小林', recipient: '\t', amount: 50 }),
      null
    );
  });

  it('settles an existing two-member TWD balance', () => {
    const expense = {
      currency: 'TWD',
      payer: '阿宁',
      totalAmount: 100,
      splits: { 阿宁: 50, 小林: 50 }
    };
    const repayment = buildRepaymentTransaction({
      sender: '小林',
      recipient: '阿宁',
      amount: 50
    });

    assert.deepEqual(
      calculateNetBalances(['阿宁', '小林'], [expense, repayment], 'TWD'),
      { 阿宁: 0, 小林: 0 }
    );
  });
});
