import assert from "assert";
import { getRegisteredSources, getSourceById } from "../src/config/sources.js";
import { resolveCredentials } from "../src/config/credentials.js";
import { getActiveSource, switchTo, resetOrchestratorState } from "../src/kernel/switch.orchestrator.js";

console.log("==================================================");
console.log("   VERIFYING LAYER 1 SOURCE REGISTRY & SWITCH API ");
console.log("==================================================");

async function testSourceRegistry() {
  // 1. Registry Inspection
  console.log("\n[1] Verifying source registry catalog...");
  const sources = getRegisteredSources();
  assert.ok(Array.isArray(sources), "Registered sources must be an array");
  assert.ok(sources.length >= 2, "Must contain at least 2 default sources (SQLite & MariaDB)");

  const sqliteSrc = sources.find(s => s.dialect === "sqlite");
  const mariaSrc = sources.find(s => s.dialect === "mariadb");
  assert.ok(sqliteSrc, "SQLite source descriptor must exist");
  assert.ok(mariaSrc, "MariaDB source descriptor must exist");

  // Invariant: Descriptors NEVER contain raw passwords or API keys
  assert.strictEqual(mariaSrc.password, undefined, "Source descriptor must NOT expose raw password");
  assert.strictEqual(mariaSrc.apiKey, undefined, "Source descriptor must NOT expose raw apiKey");
  console.log("  ✅ Descriptors exist and contain zero raw secrets (L1 Law confirmed)");

  // 2. Credential Provider Inspection
  console.log("\n[2] Verifying credentials provider...");
  const creds = resolveCredentials(mariaSrc.credentialRef);
  assert.strictEqual(creds.user, "cognicore_ro");
  assert.strictEqual(creds.port, 3306);
  assert.ok(creds.password, "Credential provider must resolve password from env");
  console.log("  ✅ Credentials provider safely resolves env secrets on-demand");

  // 3. HTTP Endpoints
  console.log("\n[3] Testing HTTP /api/database/sources endpoints...");
  const baseUrl = "http://localhost:5000";

  // 3a. GET /api/database/sources
  const listRes = await fetch(`${baseUrl}/api/database/sources`);
  assert.strictEqual(listRes.status, 200, "GET /api/database/sources must return 200");
  const listData = await listRes.json();
  assert.strictEqual(listData.success, true);
  assert.ok(Array.isArray(listData.sources));
  // Check no password in HTTP payload
  const httpMaria = listData.sources.find(s => s.id === "erpnext_prod");
  assert.strictEqual(httpMaria.password, undefined, "HTTP response must NEVER expose password");
  console.log("  ✅ GET /api/database/sources returns sanitized source list");

  // 3b. POST /api/database/sources/switch -> MariaDB
  const switchRes = await fetch(`${baseUrl}/api/database/sources/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId: "erpnext_prod" })
  });
  assert.strictEqual(switchRes.status, 200, "POST /api/database/sources/switch must return 200");
  const switchData = await switchRes.json();
  assert.strictEqual(switchData.success, true);
  assert.strictEqual(switchData.activeSource.dialect, "mariadb");
  assert.strictEqual(switchData.activeSource.password, undefined, "activeSource must NOT contain password");
  console.log("  ✅ Switched active source to MariaDB via orchestrator HTTP endpoint");

  // 3c. Verify Server Orchestrator State via GET /api/database/sources
  const verifyRes = await fetch(`${baseUrl}/api/database/sources`);
  const verifyData = await verifyRes.json();
  assert.strictEqual(verifyData.activeSource.id, "erpnext_prod");
  console.log("  ✅ Orchestrator state synchronized with switch endpoint");

  // 3d. Switch back to SQLite
  const revertRes = await fetch(`${baseUrl}/api/database/sources/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId: "sqlite_default" })
  });
  assert.strictEqual(revertRes.status, 200);
  const revertData = await revertRes.json();
  assert.strictEqual(revertData.activeSource.dialect, "sqlite");
  console.log("  ✅ Reverted active source to SQLite cleanly");

  // 3e. Test 404 on unknown source
  const badRes = await fetch(`${baseUrl}/api/database/sources/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId: "nonexistent_source_404" })
  });
  assert.strictEqual(badRes.status, 404, "Unknown sourceId must return 404");
  console.log("  ✅ Rejects nonexistent sourceId with 404");

  // 4. Hygiene Teardown
  resetOrchestratorState();
  console.log("\n==================================================");
  console.log("🏆 ALL SOURCE REGISTRY & API TESTS PASSED CLEANLY!");
  console.log("==================================================");
}

testSourceRegistry().catch(err => {
  console.error("❌ Source registry test failed:", err);
  process.exit(1);
});
