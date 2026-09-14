const path = require('path');

// DB-backed tests wipe ALL tables in the target database (see tests/helpers/seed.js).
// To make that safe, they are forced to run against a dedicated test database:
//
//   1. Copy backend/.env.test.example to backend/.env.test and set TEST_DATABASE_URL
//      to a DISPOSABLE postgres database (NEVER the live/production DB).
//   2. Push the schema on the test DB:
//        DATABASE_URL="$TEST_DATABASE_URL" npm run db:push
//   3. Run the suites:
//        npm run test:db
//
// This module loads backend/.env.test (if present) and then:
//   - sets process.env.DATABASE_URL = TEST_DATABASE_URL (test override, never live),
//   - throws with clear instructions if TEST_DATABASE_URL is not set, so a missing
//     test-DB setup can never silently fall back to the production database.

require('dotenv').config({
  path: path.resolve(__dirname, '..', '..', '.env.test'),
});

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    [
      'Refusing to run DB-backed tests: TEST_DATABASE_URL is not set.',
      'The test seed deletes EVERY row in the target database, so you must point it at a disposable test DB.',
      'Setup:',
      `  1. cp ${path.resolve(__dirname, '..', '..', '.env.test.example')} ${path.resolve(__dirname, '..', '..', '.env.test')}`,
      '  2. Edit .env.test to set TEST_DATABASE_URL=<postgresql://...> for a dedicated test database',
      '  3. Push the schema:  DATABASE_URL="$TEST_DATABASE_URL" npm run db:push',
      '  4. Run:  npm run test:db',
    ].join('\n')
  );
}

// Test override happens AFTER dotenv load so a shell/.env DATABASE_URL can never win.
process.env.DATABASE_URL = testDatabaseUrl;

module.exports = testDatabaseUrl;