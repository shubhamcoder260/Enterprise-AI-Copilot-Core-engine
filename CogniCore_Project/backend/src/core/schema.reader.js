import { connectDatabase } from "../config/database.js";

export async function readDatabaseSchema() {

  const db = await connectDatabase();

  const tables = await db.all(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);

  const schema = {};

  for (const table of tables) {

    const tableName = table.name;

    const columns = await db.all(
      `PRAGMA table_info("${tableName.replace(/"/g, '""')}")`
    );

    schema[tableName] = columns.map((column) => ({
      name: column.name,
      type: column.type,
      primaryKey: column.pk === 1,
      notNull: column.notnull === 1
    }));
  }

  console.log(
    "📊 Current active database schema:"
  );

  console.log(
    Object.keys(schema).map((tableName) => ({
      table: tableName,
      columns: schema[tableName].map(
        (column) => column.name
      )
    }))
  );

  return schema;
}