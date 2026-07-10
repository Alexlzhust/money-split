import { useState } from 'react';
import { Plus, UserRound } from 'lucide-react';
import { html } from '../lib/html.js';

export function MemberManagement({ users, onAddMember }) {
  const [name, setName] = useState('');
  const normalizedName = name.trim();
  const isDuplicate = users.includes(normalizedName);
  const canSubmit = normalizedName.length > 0 && !isDuplicate;

  function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    onAddMember(normalizedName);
    setName('');
  }

  return html`
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <${UserRound} className="h-5 w-5 text-teal-600" aria-hidden="true" />
        <h2 className="text-base font-semibold">成员管理</h2>
      </div>

      <form onSubmit=${handleSubmit} className="flex gap-2">
        <input
          data-testid="member-name-input"
          value=${name}
          onChange=${(event) => setName(event.target.value)}
          placeholder="输入成员姓名"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
        <button
          data-testid="add-member-button"
          type="submit"
          disabled=${!canSubmit}
          title="添加成员"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <${Plus} className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      ${isDuplicate &&
      html`<p className="mt-2 text-sm text-amber-700">该成员已存在。</p>`}

      ${users.length === 0
        ? html`
            <p
              data-testid="empty-members-message"
              className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500"
            >
              暂无成员，请先添加自定义人名。
            </p>
          `
        : html`
            <div className="mt-4 flex flex-wrap gap-2">
              ${users.map(
                (user) => html`
                  <span
                    key=${user}
                    className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800"
                  >
                    ${user}
                  </span>
                `
              )}
            </div>
          `}
    </section>
  `;
}
