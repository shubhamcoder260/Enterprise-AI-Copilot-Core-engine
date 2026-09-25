// ============================================================
// SQLITE PROTOCOL ADAPTER
// Composes config/database.js without modifying the Tier-1 frozen file.
// Conforms to the uniform deepFreeze adapter contract:
// { connect(desc), queryReadOnly(sql, params), executeReadOnlySql(sql, params), close(), meta() }
// ============================================================

import * as databaseModule from "../config/database.js";
import { deepFreeze } from "./dialects/index.js";

export function createSqliteAdapter() {
  const adapter = {
    dialect: "sqlite",

    async connect(sourceDescriptor = {}) {
      if (sourceDescriptor.path) {
        return await databaseModule.connectDatabase(sourceDescriptor.path);
      }
      return await databaseModule.ensureInitialized();
    },

    async queryReadOnly(sql, params = []) {
      return await databaseModule.executeReadOnlySql(sql, params);
    },

    async executeReadOnlySql(sql, params = []) {
      return await databaseModule.executeReadOnlySql(sql, params);
    },

    async close() {
      return await databaseModule.closeDatabase();
    },

    meta() {
      return {
        dialect: "sqlite",
        activePath: databaseModule.getActiveDatabasePath(),
        readOnlyMechanism: "OPEN_READONLY"
      };
    }
  };

  return deepFreeze(adapter);
}

export const sqliteAdapter = createSqliteAdapter();
