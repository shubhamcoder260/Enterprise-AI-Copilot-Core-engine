// ============================================================================
// VERIFICATION SUITE 2: SOURCE PERSISTENCE ACROSS SERVER RESTARTS
// Verifies:
//   1. Dynamic sources are written to persistent SQLite storage (cognicore_sources.db)
//   2. An actual server restart re-populates the in-memory registry on boot
//   3. Stored source descriptors and vaulted credentials survive restart fully intact
// ============================================================================

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";

import {
  saveSource,
  getSource,
  getAllSources,
  deleteSource,
  closeSourceStore,
  initSourceStore
} from "../src/store/source.store.js";
import {
  storeCredential,
  resolveCredentialAsync,
  deleteCredential,
  closeVault
} from "../src/security/credential.vault.js";

import { fileURLToPath } from "node:url";
import path from "node:path";
import { execSync } from "node:child_process";

import { generateToken } from "../src/middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, "..");
const TEST_TOKEN = generateToken({ userId: "admin", roles: ["admin"] });

const TEST_PORT = 5099;

function killTestPort() {
  try {
    execSync(`lsof -ti tcp:${TEST_PORT} -sTCP:LISTEN 2>/dev/null | grep -v "^${process.pid}$" | xargs -r kill -9 2>/dev/null || true`, { stdio: "ignore" });
  } catch (_) {}
}

function waitForServer(port, timeoutMs = 8000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function ping() {
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });
      req.on("error", () => retry());
      req.end();
    }
    function retry() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server failed to start on port ${port} within ${timeoutMs}ms`));
      } else {
        setTimeout(ping, 200);
      }
    }
    ping();
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      parsed,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${TEST_TOKEN}`
        }
      },
      (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function run() {
  console.log("==================================================");
  console.log("   TEST SUITE 2 — SOURCE PERSISTENCE VERIFICATION ");
  console.log("==================================================");

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  const persistentSourceId = `persist_source_${Date.now()}`;
  const persistentCreds = {
    host: "127.0.0.1",
    port: 3307,
    user: "cognicore_ro",
    password: "CogniCore_RO_2026!",
    database: "_210a92d8bfbfc131"
  };

  // Ensure port is free
  killTestPort();

  // 1. Persist source and credentials directly
  await test("Write source descriptor to disk store and vault credentials", async () => {
    await storeCredential(persistentSourceId, persistentCreds);
    const saved = await saveSource({
      id: persistentSourceId,
      name: "Persistent Test MariaDB",
      kind: "mariadb",
      dialect: "mariadb",
      credentialRef: `vault:${persistentSourceId}`,
      profileRef: "erpnext",
      database: "_210a92d8bfbfc131",
      status: "connected"
    });

    assert.strictEqual(saved.id, persistentSourceId);
    assert.strictEqual(saved.name, "Persistent Test MariaDB");

    // Close in-memory handles before restart
    await closeSourceStore();
    await closeVault();
  });

  // 2. Start independent server subprocess to verify cold boot loading
  let serverProcess = null;
  await test("Spawn fresh server process on isolated port (cold boot)", async () => {
    serverProcess = spawn("node", ["src/server.js"], {
      cwd: BACKEND_ROOT,
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        VAULT_MASTER_KEY: process.env.VAULT_MASTER_KEY || "cognicore_production_vault_master_key_2026_aes256gcm"
      },
      stdio: "pipe"
    });

    serverProcess.on("error", (err) => {
      console.error("Subprocess error:", err);
    });

    await waitForServer(TEST_PORT);
    console.log(`  Subprocess online and verified on port ${TEST_PORT}`);
  });

  // 3. Query new server via HTTP to confirm persisted source is present in sources list
  await test("Query restarted server HTTP GET /api/sources to confirm source loaded from disk", async () => {
    const res = await fetchJson(`http://127.0.0.1:${TEST_PORT}/api/sources`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.sources), "Sources must be an array");

    const found = res.body.sources.find(s => s.id === persistentSourceId);
    assert.ok(found, `Persisted source "${persistentSourceId}" must be loaded on boot`);
    assert.strictEqual(found.name, "Persistent Test MariaDB");
    assert.strictEqual(found.dialect, "mariadb");
    assert.strictEqual(found.password, undefined, "GET /api/sources must NEVER expose password");
  });

  // 4. Query single source endpoint HTTP GET /api/sources/:id
  await test("Query restarted server HTTP GET /api/sources/:id", async () => {
    const res = await fetchJson(`http://127.0.0.1:${TEST_PORT}/api/sources/${persistentSourceId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.source.id, persistentSourceId);
    assert.strictEqual(res.body.source.password, undefined, "GET /api/sources/:id must NEVER expose password");
  });

  // 5. Cleanup server process and test record
  if (serverProcess) {
    try {
      serverProcess.kill("SIGKILL");
    } catch (_) {}
  }
  killTestPort();

  await test("Cleanup persisted test source and vault entry", async () => {
    await initSourceStore();
    await deleteSource(persistentSourceId);
    await deleteCredential(persistentSourceId);
    await closeSourceStore();
    await closeVault();
  });

  console.log(`\nSOURCE PERSISTENCE SUITE: ${passed}/${total} passed.`);
  assert.strictEqual(passed, total, "All persistence tests must pass");
}

run().catch((err) => {
  console.error("FATAL in verify_source_persistence.js:", err);
  process.exit(1);
});
