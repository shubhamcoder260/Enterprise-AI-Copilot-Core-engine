import { readDatabaseSchema } from "./src/core/schema.reader.js";

const schema = await readDatabaseSchema();

console.log(
  JSON.stringify(schema, null, 2)
);