export const TEST_DATABASE_NAME = 'money_split_test';

export function getDatabaseName(connectionString) {
  const databaseName = new URL(connectionString).pathname.replace(/^\/+/, '');
  return decodeURIComponent(databaseName);
}

export function assertDatabaseIsolation(connectionString, vercelEnvironment) {
  if (!vercelEnvironment) {
    return;
  }

  const environment = String(vercelEnvironment).toLowerCase();
  const databaseName = getDatabaseName(connectionString);

  if (environment === 'production' && databaseName === TEST_DATABASE_NAME) {
    throw new Error('Production cannot use the test database.');
  }

  if (
    (environment === 'preview' || environment === 'development') &&
    databaseName !== TEST_DATABASE_NAME
  ) {
    throw new Error(`${environment} must use ${TEST_DATABASE_NAME}.`);
  }
}
