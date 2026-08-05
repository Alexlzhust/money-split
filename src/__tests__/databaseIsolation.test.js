import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TEST_DATABASE_NAME,
  assertDatabaseIsolation,
  getDatabaseName
} from '../server/databaseIsolation.js';

const productionUrl = 'postgresql://user:password@example.com/neondb?sslmode=require';
const testUrl = `postgresql://user:password@example.com/${TEST_DATABASE_NAME}?sslmode=require`;

describe('database environment isolation', () => {
  it('extracts the database name without exposing connection details', () => {
    assert.equal(getDatabaseName(productionUrl), 'neondb');
    assert.equal(getDatabaseName(testUrl), TEST_DATABASE_NAME);
  });

  it('allows production to use the production database', () => {
    assert.doesNotThrow(() => assertDatabaseIsolation(productionUrl, 'production'));
  });

  it('blocks production from using the test database', () => {
    assert.throws(
      () => assertDatabaseIsolation(testUrl, 'production'),
      /Production cannot use the test database/
    );
  });

  for (const environment of ['preview', 'development']) {
    it(`allows ${environment} to use only the test database`, () => {
      assert.doesNotThrow(() => assertDatabaseIsolation(testUrl, environment));
      assert.throws(
        () => assertDatabaseIsolation(productionUrl, environment),
        new RegExp(`${environment} must use ${TEST_DATABASE_NAME}`)
      );
    });
  }

  it('does not enforce a Vercel policy outside Vercel', () => {
    assert.doesNotThrow(() => assertDatabaseIsolation(testUrl));
  });
});
