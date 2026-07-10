import { html } from '../lib/html.js';
import { formatMoney } from '../utils/currency.js';

export function MoneyAmount({
  value,
  currency,
  align = 'right',
  primaryClassName = 'font-semibold',
  convertedClassName = 'mt-0.5 text-xs text-slate-500'
}) {
  const money = formatMoney(value, currency);
  const alignment = align === 'left' ? 'items-start text-left' : 'items-end text-right';

  return html`
    <span className=${`inline-flex min-w-0 flex-col ${alignment}`}>
      <span className=${primaryClassName}>${money.primary}</span>
      ${money.converted &&
      html`<span className=${convertedClassName}>${money.converted}</span>`}
    </span>
  `;
}
