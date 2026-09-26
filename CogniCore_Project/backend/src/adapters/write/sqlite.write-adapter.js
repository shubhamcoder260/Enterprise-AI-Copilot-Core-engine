// ============================================================
// SQLITE WRITE ADAPTER (PHASE D5 ACTION GATEWAY)
// Opens SQLite connection strictly for template-based write execution.
// Exposes ONLY executeWrite(template, params, dryRun).
// Accepts ZERO freeform SQL — strictly executes hand-authored templates.
// Does NOT touch Tier-1 frozen config/database.js.
// ============================================================

import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { deepFreeze } from "../dialects/index.js";
import { renderTemplate } from "../../security/write.templates.js";
import { getActiveDatabasePath } from "../../config/database.js";

export function createSqliteWriteAdapter(config = {}) {
  let db = null;
  let activeDescriptor = null;

  const adapter = {
    dialect: "sqlite",
    role: "write",

    async connect(sourceDescriptor = {}) {
      activeDescriptor = sourceDescriptor;
      const dbPath = sourceDescriptor.path || getActiveDatabasePath();

      if (db) {
        await db.close();
      }

      db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
      });

      return this;
    },

    async executeWrite(template, params = {}, dryRun = false) {
      if (!template || !template.id) {
        throw new Error("Invalid template passed to executeWrite: template object is required.");
      }

      const rendered = renderTemplate(template, params, "sqlite");

      if (dryRun) {
        return {
          dryRun: true,
          sql: rendered.sql,
          params: rendered.values,
          estimatedRows: rendered.estimatedRows || 1
        };
      }

      if (!db) {
        await this.connect(activeDescriptor || {});
      }

      const startTime = Date.now();
      const result = await db.run(rendered.sql, rendered.values);
      const durationMs = Date.now() - startTime;

      return {
        dryRun: false,
        sql: rendered.sql,
        params: rendered.values,
        affectedRows: result?.changes || 0,
        insertId: result?.lastID || null,
        durationMs
      };
    },

    async close() {
      if (db) {
        await db.close();
        db = null;
      }
    },

    meta() {
      return {
        dialect: "sqlite",
        mode: "write",
        activePath: activeDescriptor?.path || getActiveDatabasePath(),
        connected: db !== null
      };
    }
  };

  return deepFreeze(adapter);
}
