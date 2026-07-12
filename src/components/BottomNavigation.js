import { ArrowRightLeft, NotebookTabs } from 'lucide-react';
import { html } from '../lib/html.js';
import { APP_SCREENS } from '../utils/appView.js';

export function BottomNavigation({ activeScreen, onNavigate }) {
  const destinations = [
    {
      screen: APP_SCREENS.LEDGER,
      label: '账本',
      icon: NotebookTabs,
      testId: 'bottom-nav-ledger'
    },
    {
      screen: APP_SCREENS.SETTLEMENT,
      label: '结算',
      icon: ArrowRightLeft,
      testId: 'bottom-nav-settlement'
    }
  ];

  return html`
    <nav
      aria-label="主要导航"
      className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur"
    >
      <div className="mx-auto grid h-16 max-w-3xl grid-cols-2 px-4">
        ${destinations.map(({ screen, label, icon: Icon, testId }) => {
          const isActive = activeScreen === screen;

          return html`
            <button
              key=${screen}
              data-testid=${testId}
              type="button"
              aria-current=${isActive ? 'page' : undefined}
              onClick=${() => onNavigate(screen)}
              className=${`flex min-w-0 flex-col items-center justify-center gap-1 text-xs font-semibold transition ${
                isActive ? 'text-teal-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <${Icon} className="h-5 w-5" aria-hidden="true" />
              <span>${label}</span>
            </button>
          `;
        })}
      </div>
    </nav>
  `;
}
