import assert from 'assert';
import { mariadbAdapter } from '../src/adapters/mariadb.adapter.js';
import { getMariaDbEnrichedSchema } from '../src/core/mariadb.schema.reader.js';
import { buildSqlPrompt } from '../src/llm/sql.prompt.js';

console.log("==================================================");
console.log("   STEP 5 — VERIFYING MARIADB INTROSPECTION & PROMPT ");
console.log("==================================================");

async function runIntrospectionTests() {
  await mariadbAdapter.connect();

  console.log("\n[1] Pulling schema from live MariaDB container...");
  const t0 = performance.now();
  const schema = await getMariaDbEnrichedSchema(mariadbAdapter, { forceRefresh: true });
  const durationMs = performance.now() - t0;
  console.log(`  ✅ Schema introspected in ${durationMs.toFixed(2)}ms`);

  // 1. Table Existence & Verbatim Identifier check
  console.log("\n[2] Checking tables and verbatim identifiers...");
  assert(schema['tabCustomer'], "tabCustomer table must exist in schema");
  assert(schema['tabSales Invoice'], "tabSales Invoice (verbatim with space) must exist in schema");
  assert(schema['tabGL Entry'], "tabGL Entry must exist in schema");
  console.log("  ✅ Verbatim table name 'tabSales Invoice' preserved without normalization");

  // 2. Uniform Contract Shape Check
  console.log("\n[3] Checking uniform schema contract shape...");
  for (const [tableName, tableData] of Object.entries(schema)) {
    assert(Array.isArray(tableData.columns), `${tableName} must have columns array`);
    assert(Array.isArray(tableData.foreignKeys), `${tableName} must have foreignKeys array`);
    assert(typeof tableData.rowCount === 'number', `${tableName} must have numeric rowCount`);
    assert(typeof tableData.isSampled === 'boolean', `${tableName} must have boolean isSampled`);

    for (const col of tableData.columns) {
      assert(typeof col.name === 'string', `${tableName}.${col.name} must have name string`);
      assert(typeof col.type === 'string', `${tableName}.${col.name} must have type string`);
      assert(typeof col.pk === 'boolean', `${tableName}.${col.name} must have boolean pk`);
      assert(typeof col.primaryKey === 'boolean', `${tableName}.${col.name} must have boolean primaryKey`);
      assert(typeof col.notNull === 'boolean', `${tableName}.${col.name} must have boolean notNull`);
      assert(typeof col.sampleStatus === 'string', `${tableName}.${col.name} must have sampleStatus string`);
    }
  }
  console.log("  ✅ Universal schema contract shape verified across all MariaDB tables");

  // 3. Primary Key & Sampling verification
  console.log("\n[4] Checking primary keys and sampled distinct values...");
  const customerNameCol = schema['tabCustomer'].columns.find(c => c.name === 'name');
  assert.strictEqual(customerNameCol.primaryKey, true, "tabCustomer.name must be PK");

  const customerNameField = schema['tabCustomer'].columns.find(c => c.name === 'customer_name');
  assert(customerNameField.sampleValues.length > 0, "tabCustomer.customer_name must have sample values");
  assert(customerNameField.sampleValues.includes('Acme Corp'), "Sample values must contain 'Acme Corp'");
  console.log(`  ✅ PK correctly identified; sample values captured: ${JSON.stringify(customerNameField.sampleValues)}`);

  // 4. ERP Annotations
  console.log("\n[5] Checking ERP annotations...");
  assert.strictEqual(schema['tabSales Invoice'].isDocType, true);
  assert.strictEqual(schema['tabSales Invoice'].hasDocstatus, true);
  console.log("  ✅ ERP annotations isDocType=true and hasDocstatus=true confirmed");

  // 5. Prompt Token Budget Verification (A3: Dialect pack overhead <= 300 tokens)
  console.log("\n[6] Measuring prompt overhead for MariaDB dialect pack...");
  const sqlitePrompt = buildSqlPrompt({
    query: "Show total sales for 2024",
    schema,
    dialect: "sqlite"
  });

  const mariaPrompt = buildSqlPrompt({
    query: "Show total sales for 2024",
    schema,
    dialect: "mariadb"
  });

  // Approximate tokens by word count / 0.75
  const sqliteWordCount = sqlitePrompt.trim().split(/\s+/).length;
  const mariaWordCount = mariaPrompt.trim().split(/\s+/).length;
  const wordDiff = Math.abs(mariaWordCount - sqliteWordCount);
  const estimatedTokenDiff = Math.ceil(wordDiff / 0.75);

  console.log(`  SQLite prompt word count: ${sqliteWordCount}`);
  console.log(`  MariaDB prompt word count: ${mariaWordCount}`);
  console.log(`  Word count difference: ${wordDiff} words (est. ~${estimatedTokenDiff} tokens)`);

  assert(estimatedTokenDiff <= 300, `Dialect pack overhead (${estimatedTokenDiff} tokens) must be <= 300 tokens`);
  assert(mariaPrompt.includes("You are a strict MariaDB SQL generator."), "MariaDB header must be present");
  assert(mariaPrompt.includes("docstatus"), "Docstatus guidance must be present");
  assert(mariaPrompt.includes("posting_date"), "Date range guidance must be present");
  console.log("  ✅ MariaDB dialect pack overhead is well within the 300-token budget");

  await mariadbAdapter.close();
  console.log("\n==================================================");
  console.log("🏆 ALL INTROSPECTION & PROMPT TESTS PASSED CLEANLY!");
  console.log("==================================================");
}

runIntrospectionTests().catch(err => {
  console.error("❌ Introspection test failed:", err);
  process.exit(1);
});
