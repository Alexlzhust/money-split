import { neon } from '@neondatabase/serverless';
import { assertDatabaseIsolation } from '../src/server/databaseIsolation.js';
import { buildStateFromRows, normalizeTransactionInput } from '../src/server/statePayload.js';

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.NEON_DATABASE_URL;

let schemaReady = false;
let schemaPromise = null;

function getSql() {
  if (!connectionString) {
    const error = new Error('DATABASE_URL is not configured.');
    error.statusCode = 503;
    throw error;
  }
  assertDatabaseIsolation(connectionString, process.env.VERCEL_ENV);
  return neon(connectionString);
}

export function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

export async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}

export function handleApiError(response, error) {
  sendJson(response, error.statusCode || 500, {
    error: error.message || 'Unexpected server error.'
  });
}

export async function ensureSchema() {
  if (schemaReady) {
    return;
  }
  if (schemaPromise) {
    await schemaPromise;
    return;
  }

  schemaPromise = initializeSchema();
  await schemaPromise;
}

async function initializeSchema() {
  const sql = getSql();

  try {
    await sql`SELECT pg_advisory_lock(hashtext('multi-party-expense-splitter-schema'))`;
    await sql`
      CREATE TABLE IF NOT EXISTS members (
        name TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents > 0),
        currency TEXT NOT NULL DEFAULT 'TWD',
        expense_date DATE,
        category TEXT NOT NULL DEFAULT '其他',
        payer_name TEXT NOT NULL REFERENCES members(name),
        split_type TEXT NOT NULL CHECK (split_type IN ('EQUAL', 'CUSTOM')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'TWD'`;
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS expense_date DATE`;
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '其他'`;
    await sql`UPDATE transactions SET expense_date = created_at::date WHERE expense_date IS NULL`;
    await sql`ALTER TABLE transactions ALTER COLUMN expense_date SET DEFAULT CURRENT_DATE`;
    await sql`
      CREATE TABLE IF NOT EXISTS splits (
        transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        user_name TEXT NOT NULL REFERENCES members(name),
        amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
        PRIMARY KEY (transaction_id, user_name)
      )
    `;

    schemaReady = true;
  } finally {
    await sql`SELECT pg_advisory_unlock(hashtext('multi-party-expense-splitter-schema'))`;
    schemaPromise = null;
  }
}

export async function readState() {
  await ensureSchema();
  const sql = getSql();

  const [members, transactions, splits] = await Promise.all([
    sql`SELECT name FROM members ORDER BY created_at ASC, name ASC`,
    sql`
      SELECT id, title, total_amount_cents, currency, expense_date, category, payer_name, split_type
      FROM transactions
      ORDER BY expense_date DESC, created_at DESC, id DESC
    `,
    sql`
      SELECT transaction_id, user_name, amount_cents
      FROM splits
      ORDER BY transaction_id ASC, user_name ASC
    `
  ]);

  return buildStateFromRows(members, transactions, splits);
}

export async function addMember(rawName) {
  await ensureSchema();
  const name = String(rawName || '').trim();
  if (!name) {
    const error = new Error('Member name is required.');
    error.statusCode = 400;
    throw error;
  }

  const sql = getSql();
  await sql`INSERT INTO members (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`;
  return readState();
}

export async function addTransaction(transaction) {
  await ensureSchema();
  const normalized = normalizeTransactionInput(transaction);
  const sql = getSql();

  await sql.transaction([
    sql`
      INSERT INTO transactions (
        id,
        title,
        total_amount_cents,
        currency,
        expense_date,
        category,
        payer_name,
        split_type
      )
      VALUES (
        ${normalized.id},
        ${normalized.title},
        ${normalized.totalAmountCents},
        ${normalized.currency},
        ${normalized.expenseDate || null},
        ${normalized.category},
        ${normalized.payer},
        ${normalized.splitType}
      )
    `,
    ...normalized.splitRows.map(
      (split) => sql`
      INSERT INTO splits (transaction_id, user_name, amount_cents)
      VALUES (${normalized.id}, ${split.userName}, ${split.amountCents})
    `
    )
  ]);

  return readState();
}

export async function updateTransaction(transaction) {
  await ensureSchema();
  const normalized = normalizeTransactionInput(transaction);
  const sql = getSql();

  await sql.transaction([
    sql`
      UPDATE transactions
      SET
        title = ${normalized.title},
        total_amount_cents = ${normalized.totalAmountCents},
        currency = ${normalized.currency},
        expense_date = ${normalized.expenseDate || null},
        category = ${normalized.category},
        payer_name = ${normalized.payer},
        split_type = ${normalized.splitType}
      WHERE id = ${normalized.id}
    `,
    sql`DELETE FROM splits WHERE transaction_id = ${normalized.id}`,
    ...normalized.splitRows.map(
      (split) => sql`
        INSERT INTO splits (transaction_id, user_name, amount_cents)
        VALUES (${normalized.id}, ${split.userName}, ${split.amountCents})
      `
    )
  ]);

  return readState();
}

export async function deleteTransaction(transactionId) {
  await ensureSchema();
  const id = String(transactionId || '').trim();
  if (!id) {
    const error = new Error('Transaction id is required.');
    error.statusCode = 400;
    throw error;
  }

  const sql = getSql();
  await sql`DELETE FROM transactions WHERE id = ${id}`;
  return readState();
}

export async function resetState() {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM splits`;
  await sql`DELETE FROM transactions`;
  await sql`DELETE FROM members`;
  return readState();
}
