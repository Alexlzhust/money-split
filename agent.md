# Agent Handoff Notes

## Project

Money Split is a mobile-first, single-page multi-party expense splitter.

- Production: https://multi-party-expense-splitter.vercel.app
- GitHub: https://github.com/Alexlzhust/money-split
- Primary audience: small groups traveling or sharing expenses in Taiwan

## Tech Stack

- React 18 loaded through the import map in `index.html`
- `htm` template literals instead of JSX
- Tailwind CSS compiled to `dist/styles.css`
- Vercel Functions under `api/`
- Neon Postgres via `@neondatabase/serverless`
- Node.js built-in test runner

There is no Vite build or JavaScript bundling step. Keep the current lightweight structure unless a migration is intentional.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
npx vercel deploy --prod --yes --logs
```

`npm run dev` starts a static server at `http://127.0.0.1:4173`. Because that server does not execute Vercel Functions, the frontend falls back to localStorage.

## Application Behavior

- The app starts without preset members.
- New transactions default to TWD.
- Existing transactions retain their saved currency when edited.
- Equal splits default to all current members.
- Custom split totals are derived from member inputs.
- TWD and HKD show fixed CNY reference conversions; CNY does not.
- Settlement calculations convert all transactions into the selected settlement currency.
- Settlement paths can open a prefilled internal repayment transaction.
- Internal repayments affect net balances but are excluded from spending totals.
- Transactions support add, edit, delete, and undo-latest behavior.
- The mobile form listens to `visualViewport` changes so focused amount fields remain above the keyboard and sticky action area.

## State And Persistence

`src/App.js` owns members, transactions, settlement currency, remembered payer, persistence mode, and screen state.

Persistence behavior:

1. Load `/api/state` on startup.
2. Use database mode when the API succeeds.
3. Fall back to localStorage when the API is unavailable.

Local storage keys are defined in `src/config/appState.js`.

## Database

The preferred environment variable is `DATABASE_URL`. Supported fallbacks:

- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `NEON_DATABASE_URL`

Never print or commit database credentials. `.env.local` and `.vercel/` are ignored.

Tables are created on first API access in `api/_database.js`:

- `members`
- `transactions`
- `splits`

Money is stored as integer cents. Schema creation uses a Postgres advisory lock to prevent concurrent Vercel cold starts from racing; preserve that lock.

## API Routes

- `GET /api/state`
- `POST /api/members`
- `POST /api/transactions`
- `PUT /api/transactions`
- `DELETE /api/transactions`
- `POST /api/reset`

Incoming transaction validation and database-row mapping live in `src/server/statePayload.js`.

## Frontend Structure

- `src/App.js`: application state, persistence, and view orchestration
- `src/components/MemberManagement.js`: member creation
- `src/components/TransactionForm.js`: expense and repayment entry
- `src/components/TransactionList.js`: cards and transaction actions
- `src/components/SettlementDashboard.js`: balances, currency selection, and repayment shortcuts
- `src/utils/settlements.js`: cents, equal splits, balances, and debt simplification
- `src/utils/transactionDraft.js`: form defaults, validation, and payload construction
- `src/utils/appView.js`: screen and overlay reducer
- `src/server/statePayload.js`: server-side transaction normalization

## Verification

Before committing or deploying, always run:

```bash
npm test
npm run build
git diff --check
```

For UI changes, verify at mobile and desktop widths. Mobile form changes should include a reduced-height viewport check that simulates the software keyboard.

## Deployment

- Vercel project: `multi-party-expense-splitter`
- Database resource: Neon Postgres
- `vercel.json` builds Tailwind and serves the repository root

After deploying, confirm the Vercel deployment status is `Ready` and verify `/api/state` without mutating production data.

## Known Constraints

- There is no authentication or ledger isolation.
- The reset endpoint is public.
- Member names are primary keys, so rename and delete require data migration work.
- Currency rates are fixed reference values rather than a live-rate feed.
- Local static development cannot exercise the database API.

## Design Rules

- Keep the first screen as the usable tool, not a marketing page.
- Optimize for repeated mobile use and minimal input.
- Use Lucide icons for action controls.
- Keep touch targets at least 44px for frequent mobile actions.
- Preserve safe-area handling and prevent input text from triggering iOS auto-zoom.
- Do not introduce a new build system without a deliberate migration plan.
