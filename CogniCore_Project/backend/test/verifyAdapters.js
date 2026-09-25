import assert from 'assert';
import { sqliteAdapter } from '../src/adapters/sqlite.adapter.js';
import { mariadbAdapter, createMariaDbAdapter } from '../src/adapters/mariadb.adapter.js';

console.log("==================================================");
console.log("       STEP 3 — VERIFYING PROTOCOL ADAPTERS       ");
console.log("==================================================");

async function runAdapterTests() {
  // 1. Contract Shape and Immutability
  console.log("\n[1] Verifying uniform adapter contract shapes...");
  for (const [name, adapter] of Object.entries({ sqliteAdapter, mariadbAdapter })) {
    assert.strictEqual(typeof adapter.connect, 'function', `${name} must have connect()`);
    assert.strictEqual(typeof adapter.queryReadOnly, 'function', `${name} must have queryReadOnly()`);
    assert.strictEqual(typeof adapter.executeReadOnlySql, 'function', `${name} must have executeReadOnlySql()`);
    assert.strictEqual(typeof adapter.close, 'function', `${name} must have close()`);
    assert.strictEqual(typeof adapter.meta, 'function', `${name} must have meta()`);
    assert(Object.isFrozen(adapter), `${name} must be frozen with deepFreeze`);
    assert.throws(() => { adapter.mutation = true; }, /Cannot add property|TypeError/);
    console.log(`  ✅ ${name} conforms to frozen adapter contract`);
  }

  // 2. SQLite Adapter Passthrough
  console.log("\n[2] Testing SQLite adapter execution...");
  await sqliteAdapter.connect();
  const sqliteRows = await sqliteAdapter.queryReadOnly("SELECT 1 AS alive");
  assert.strictEqual(sqliteRows[0].alive, 1);
  const sqliteRows2 = await sqliteAdapter.executeReadOnlySql("SELECT 2 AS alive2");
  assert.strictEqual(sqliteRows2[0].alive2, 2);
  console.log("  ✅ SQLite adapter queryReadOnly & executeReadOnlySql verified");

  // 3. MariaDB Adapter Connection & Query Execution
  console.log("\n[3] Testing MariaDB adapter connection...");
  await mariadbAdapter.connect();
  const mariaRows = await mariadbAdapter.executeReadOnlySql("SELECT COUNT(*) AS total FROM `tabCustomer`");
  assert(Number(mariaRows[0].total) >= 5, "Customer count must be >= 5");
  console.log(`  ✅ MariaDB query executed cleanly: ${mariaRows[0].total} customers found`);

  // 4. Invariant A1: ANSI_QUOTES active & double-quote identifier sampling works
  console.log("\n[4] Verifying Invariant A1: ANSI_QUOTES hook on connection pool...");
  const modeRows = await mariadbAdapter.executeReadOnlySql("SELECT @@session.sql_mode AS sql_mode");
  const sqlMode = modeRows[0].sql_mode;
  assert(sqlMode.includes('ANSI_QUOTES'), `sql_mode must include ANSI_QUOTES, got: "${sqlMode}"`);
  console.log(`  ✅ Confirmed @@session.sql_mode contains ANSI_QUOTES: ${sqlMode}`);

  // Critical check: with ANSI_QUOTES, "customer_name" is an identifier, NOT a string literal!
  // If ANSI_QUOTES failed, this query would return the literal text string "customer_name" for every row.
  const sampleRows = await mariadbAdapter.executeReadOnlySql('SELECT "customer_name" FROM `tabCustomer` WHERE "disabled" = 0 LIMIT 1');
  assert.notStrictEqual(sampleRows[0].customer_name, "customer_name", "Must return actual column value, not literal string!");
  console.log(`  ✅ Double-quoted identifier sampling succeeded: value="${sampleRows[0].customer_name}" (result.sanity.js compatibility verified)`);

  // 5. Mutation Refusal
  console.log("\n[5] Verifying mutation refusal on MariaDB adapter...");
  try {
    await mariadbAdapter.executeReadOnlySql("INSERT INTO `tabCustomer` (`name`, `customer_name`) VALUES ('HACK', 'Evil')");
    assert.fail("INSERT query must be refused by MariaDB permissions");
  } catch (err) {
    assert(err.code === 'ER_TABLEACCESS_DENIED_ERROR' || err.message.includes('denied'));
    console.log(`  ✅ Mutation query refused as expected: [${err.code}]`);
  }

  // 6. Secret Redaction
  console.log("\n[6] Verifying credential redaction in connection errors...");
  const badAdapter = createMariaDbAdapter();
  try {
    await badAdapter.connect({
      host: '127.0.0.1',
      port: 3306,
      user: 'fake_user_secret',
      password: 'SUPER_SECRET_PASSWORD_123',
      database: '_nonexistent'
    });
    assert.fail("Bad connection should have thrown");
  } catch (err) {
    assert(!err.message.includes('SUPER_SECRET_PASSWORD_123'), "Password must be redacted from error message");
    console.log(`  ✅ Credentials redacted in error message: "${err.message}"`);
  }

  await mariadbAdapter.close();
  await sqliteAdapter.close();

  console.log("\n==================================================");
  console.log("🏆 ALL PROTOCOL ADAPTER TESTS PASSED CLEANLY!");
  console.log("==================================================");
}

runAdapterTests().catch(err => {
  console.error("❌ Adapter test failed:", err);
  process.exit(1);
});
