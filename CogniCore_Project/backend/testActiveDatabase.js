import {
  connectDatabase,
  getActiveDatabasePath
} from "./src/config/database.js";

import {
  readDatabaseSchema
} from "./src/core/schema.reader.js";


console.log("\n📂 ACTIVE DATABASE:");
console.log(getActiveDatabasePath());


const db = await connectDatabase();

const schema = await readDatabaseSchema();


console.log("\n📊 TABLES:");
console.log(Object.keys(schema));


console.log("\n📋 FULL SCHEMA:");
console.log(
  JSON.stringify(schema, null, 2)
);


// Don't close here because your database module
// may keep the shared connection in memory.
console.log("\n✅ TEST COMPLETED");