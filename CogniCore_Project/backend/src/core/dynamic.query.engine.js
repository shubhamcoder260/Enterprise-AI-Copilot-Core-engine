console.log("🔥 DYNAMIC QUERY ENGINE LOADED 🔥");

import { connectDatabase } from "../config/database.js";
import { readDatabaseSchema } from "./schema.reader.js";


// ==========================================
// SAFE SQL IDENTIFIER
// ==========================================

function quoteIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}


// ==========================================
// NORMALIZE WORD
// ==========================================

function normalizeWord(word) {
  const w = String(word)
    .toLowerCase()
    .trim();

  if (w.endsWith("ies") && w.length > 4) {
    return w.slice(0, -3) + "y";
  }

  if (
    w.endsWith("ses") &&
    w.length > 4
  ) {
    return w.slice(0, -2);
  }

  if (
    w.endsWith("s") &&
    w.length > 3
  ) {
    return w.slice(0, -1);
  }

  return w;
}


// ==========================================
// GET WORDS
// ==========================================

function getWords(query) {
  return (
    String(query)
      .toLowerCase()
      .match(/[a-z0-9_]+/g) || []
  );
}


// ==========================================
// CHECK NUMERIC COLUMN
// ==========================================

function isNumericColumn(column) {
  const type =
    String(column?.type || "")
      .toLowerCase();

  return (
    type.includes("int") ||
    type.includes("real") ||
    type.includes("numeric") ||
    type.includes("decimal") ||
    type.includes("double") ||
    type.includes("float")
  );
}


// ==========================================
// FIND MATCHING TABLE
// ==========================================

function findMatchingTable(
  query,
  schema
) {

  const words =
    getWords(query).map(normalizeWord);


  for (
    const tableName of Object.keys(schema)
  ) {

    const normalizedTable =
      normalizeWord(tableName);


    if (
      words.includes(normalizedTable)
    ) {

      console.log(
        "✅ MATCHED TABLE:",
        tableName
      );

      return tableName;
    }
  }


  return null;
}


// ==========================================
// FIND MATCHING COLUMN
// ==========================================

function findMatchingColumn(
  query,
  columns
) {

  const words =
    getWords(query).map(normalizeWord);


  for (
    const column of columns
  ) {

    const normalizedColumn =
      normalizeWord(column.name);


    if (
      words.includes(normalizedColumn)
    ) {

      console.log(
        "✅ MATCHED COLUMN:",
        column.name
      );

      return column.name;
    }
  }


  return null;
}


// ==========================================
// FIND TABLE FROM COLUMN
// ==========================================

function findTableFromColumn(
  query,
  schema
) {

  const words =
    getWords(query).map(normalizeWord);


  const matches = [];


  for (
    const [tableName, columns]
    of Object.entries(schema)
  ) {

    for (
      const column of columns
    ) {

      const normalizedColumn =
        normalizeWord(column.name);


      if (
        words.includes(
          normalizedColumn
        )
      ) {

        matches.push({
          tableName,
          columnName:
            column.name
        });
      }
    }
  }


  if (matches.length > 0) {

    console.log(
      "✅ TABLE FOUND FROM COLUMN:",
      matches[0]
    );

    return matches[0];
  }


  return null;
}


// ==========================================
// RESOLVE TABLE + COLUMN
// ==========================================

function resolveTableAndColumn(
  query,
  schema
) {

  const tableName =
    findMatchingTable(
      query,
      schema
    );


  if (tableName) {

    return {
      tableName,

      columnName:
        findMatchingColumn(
          query,
          schema[tableName]
        )
    };
  }


  const columnMatch =
    findTableFromColumn(
      query,
      schema
    );


  if (columnMatch) {

    return {
      tableName:
        columnMatch.tableName,

      columnName:
        columnMatch.columnName
    };
  }


  return {
    tableName: null,
    columnName: null
  };
}


// ==========================================
// FIND NUMERIC COLUMN AUTOMATICALLY
// ==========================================

function findBestNumericColumn(
  columns
) {

  // Do not automatically choose ID columns
  const numericColumns =
    columns.filter(
      column =>
        isNumericColumn(column) &&
        !column.name
          .toLowerCase()
          .endsWith("id")
    );


  if (
    numericColumns.length === 1
  ) {
    return numericColumns[0].name;
  }


  return null;
}


// ==========================================
// MAIN QUERY ENGINE
// ==========================================

export async function runDynamicQuery(
  query
) {

  console.log(
    "\n🔥 DYNAMIC ENGINE RECEIVED:",
    query
  );


  let db;


  try {

    // ==========================================
    // CONNECT TO CURRENT ACTIVE DATABASE
    // ==========================================

    db =
      await connectDatabase();


    // ==========================================
    // READ CURRENT DATABASE SCHEMA
    // ==========================================

    const schema =
      await readDatabaseSchema();


    const q =
      String(query)
        .toLowerCase()
        .trim();


    const tables =
      Object.keys(schema);


    console.log(
      "📊 AVAILABLE TABLES:",
      tables
    );


    // ==========================================
    // NO TABLES
    // ==========================================

    if (
      tables.length === 0
    ) {

      return {
        success: false,

        answer:
          "The active database does not contain any readable tables.",

        data: {
          availableTables: []
        }
      };
    }


    // ==========================================
    // DATABASE TABLE QUESTIONS
    // ==========================================

    if (

      q.includes("what tables") ||

      q.includes("show tables") ||

      q.includes("list tables") ||

      q.includes("available tables") ||

      q.includes("which tables") ||

      q.includes("tables are available")

    ) {

      return {
        success: true,

        answer:
          `The database contains ${tables.length} table(s): ${tables.join(", ")}.`,

        data: {
          type:
            "database_tables",

          tables,

          value:
            tables.length
        }
      };
    }


    // ==========================================
    // RESOLVE TABLE + COLUMN
    // ==========================================

    const resolved =
      resolveTableAndColumn(
        query,
        schema
      );


    let tableName =
      resolved.tableName;


    let detectedColumn =
      resolved.columnName;


    // ==========================================
    // COLUMN QUESTIONS
    // ==========================================

    const isColumnsQuestion =

      q.includes("what columns") ||

      q.includes("show columns") ||

      q.includes("list columns") ||

      q.includes("which columns") ||

      q.includes("columns are in") ||

      q.includes("columns in") ||

      q.includes("fields in") ||

      q.includes("what fields");


    if (
      isColumnsQuestion
    ) {

      if (
        !tableName
      ) {

        return {
          success: false,

          answer:
            `Please specify a table name. Available tables are: ${tables.join(", ")}.`,

          data: {
            availableTables:
              tables
          }
        };
      }


      const tableColumns =
        schema[tableName];


      const columnNames =
        tableColumns
          .map(
            column =>
              column.name
          )
          .join(", ");


      return {
        success: true,

        answer:
          `The ${tableName} table has ${tableColumns.length} column(s): ${columnNames}.`,

        data: {
          type:
            "table_columns",

          table:
            tableName,

          columns:
            tableColumns,

          value:
            tableColumns.length
        }
      };
    }


    // ==========================================
    // NO TABLE FOUND
    // ==========================================

    if (
      !tableName
    ) {

      return {
        success: false,

        answer:
          `I found the active database, but I could not determine which table this question refers to. Available tables are: ${tables.join(", ")}.`,

        data: {
          availableTables:
            tables
        }
      };
    }


    console.log(
      "🎯 USING TABLE:",
      tableName
    );


    const columns =
      schema[tableName];


    // ==========================================
    // QUESTION TYPE DETECTION
    // ==========================================

    const isCountQuestion =

      q.includes("how many") ||

      q.includes("count") ||

      q.includes("number of");


    const isShowQuestion =

      q.startsWith("show") ||

      q.startsWith("list") ||

      q.includes("show me") ||

      q.includes("display");


    const isAverageQuestion =

      q.includes("average") ||

      q.includes("mean");


    const isSumQuestion =

      q.includes("total") ||

      q.includes("sum");


    const isHighestQuestion =

      q.includes("highest") ||

      q.includes("maximum") ||

      q.includes("largest") ||

      q.includes("max");


    const isLowestQuestion =

      q.includes("lowest") ||

      q.includes("minimum") ||

      q.includes("smallest") ||

      q.includes("min");


    // ==========================================
    // GENERIC COUNT
    // ==========================================

    if (
      isCountQuestion
    ) {

      const result =
        await db.get(
          `
          SELECT COUNT(*) AS count
          FROM ${quoteIdentifier(tableName)}
          `
        );


      return {
        success: true,

        answer:
          `There are ${result.count} record(s) in the ${tableName} table.`,

        data: {
          type:
            "count",

          table:
            tableName,

          value:
            result.count
        }
      };
    }


    // ==========================================
    // GENERIC SHOW
    // ==========================================

    if (
      isShowQuestion
    ) {

      const records =
        await db.all(
          `
          SELECT *
          FROM ${quoteIdentifier(tableName)}
          LIMIT 50
          `
        );


      return {
        success: true,

        answer:
          `Showing ${records.length} record(s) from the ${tableName} table. The display is limited to the first 50 records.`,

        data: {
          type:
            "records",

          table:
            tableName,

          value:
            records.length,

          records
        }
      };
    }


    // ==========================================
    // FIND COLUMN FOR CALCULATIONS
    // ==========================================

    if (
      !detectedColumn
    ) {

      detectedColumn =
        findMatchingColumn(
          query,
          columns
        );
    }


    // ==========================================
    // AUTO-DETECT NUMERIC COLUMN
    // Only when exactly one obvious choice exists
    // ==========================================

    const needsNumericColumn =

      isAverageQuestion ||

      isSumQuestion ||

      isHighestQuestion ||

      isLowestQuestion;


    if (
      needsNumericColumn &&
      !detectedColumn
    ) {

      detectedColumn =
        findBestNumericColumn(
          columns
        );
    }


    const detectedColumnInfo =
      columns.find(
        column =>
          column.name ===
          detectedColumn
      );


    // ==========================================
    // NUMERIC COLUMN NOT FOUND
    // ==========================================

    if (
      needsNumericColumn &&
      !detectedColumn
    ) {

      const numericColumns =
        columns
          .filter(
            isNumericColumn
          )
          .map(
            column =>
              column.name
          );


      return {
        success: false,

        answer:
          `I found the ${tableName} table, but I could not determine which numeric column you want to calculate. Available numeric columns are: ${numericColumns.join(", ") || "none"}.`,

        data: {
          table:
            tableName,

          columns:
            columns.map(
              column =>
                column.name
            ),

          numericColumns
        }
      };
    }


    // ==========================================
    // CHECK NUMERIC COLUMN
    // ==========================================

    if (
      needsNumericColumn &&
      detectedColumnInfo &&
      !isNumericColumn(
        detectedColumnInfo
      )
    ) {

      return {
        success: false,

        answer:
          `${detectedColumn} is not a numeric column, so I cannot perform this calculation.`,

        data: {
          table:
            tableName,

          column:
            detectedColumn
        }
      };
    }


    // ==========================================
    // AVERAGE
    // ==========================================

    if (
      isAverageQuestion
    ) {

      const result =
        await db.get(
          `
          SELECT AVG(
            ${quoteIdentifier(detectedColumn)}
          ) AS average

          FROM ${quoteIdentifier(tableName)}

          WHERE ${quoteIdentifier(
            detectedColumn
          )} IS NOT NULL
          `
        );


      if (
        result.average === null ||
        result.average === undefined
      ) {

        return {
          success: false,

          answer:
            `There is no numeric data available in ${detectedColumn}.`
        };
      }


      const value =
        Number(
          Number(
            result.average
          ).toFixed(2)
        );


      return {
        success: true,

        answer:
          `The average ${detectedColumn} in the ${tableName} table is ${value}.`,

        data: {
          type:
            "average",

          table:
            tableName,

          column:
            detectedColumn,

          value
        }
      };
    }


    // ==========================================
    // SUM / TOTAL
    // ==========================================

    if (
      isSumQuestion
    ) {

      const result =
        await db.get(
          `
          SELECT SUM(
            ${quoteIdentifier(detectedColumn)}
          ) AS total

          FROM ${quoteIdentifier(tableName)}

          WHERE ${quoteIdentifier(
            detectedColumn
          )} IS NOT NULL
          `
        );


      if (
        result.total === null ||
        result.total === undefined
      ) {

        return {
          success: false,

          answer:
            `There is no numeric data available in ${detectedColumn}.`
        };
      }


      const value =
        Number(
          Number(
            result.total
          ).toFixed(2)
        );


      return {
        success: true,

        answer:
          `The total ${detectedColumn} in the ${tableName} table is ${value}.`,

        data: {
          type:
            "sum",

          table:
            tableName,

          column:
            detectedColumn,

          value
        }
      };
    }


    // ==========================================
    // HIGHEST
    // ==========================================

    if (
      isHighestQuestion
    ) {

      const record =
        await db.get(
          `
          SELECT *
          FROM ${quoteIdentifier(tableName)}

          WHERE ${quoteIdentifier(
            detectedColumn
          )} IS NOT NULL

          ORDER BY ${quoteIdentifier(
            detectedColumn
          )} DESC

          LIMIT 1
          `
        );


      if (
        !record
      ) {

        return {
          success: false,

          answer:
            `No data was found for ${detectedColumn}.`
        };
      }


      return {
        success: true,

        answer:
          `The highest ${detectedColumn} in the ${tableName} table is ${record[detectedColumn]}.`,

        data: {
          type:
            "highest",

          table:
            tableName,

          column:
            detectedColumn,

          value:
            record[
              detectedColumn
            ],

          record
        }
      };
    }


    // ==========================================
    // LOWEST
    // ==========================================

    if (
      isLowestQuestion
    ) {

      const record =
        await db.get(
          `
          SELECT *
          FROM ${quoteIdentifier(tableName)}

          WHERE ${quoteIdentifier(
            detectedColumn
          )} IS NOT NULL

          ORDER BY ${quoteIdentifier(
            detectedColumn
          )} ASC

          LIMIT 1
          `
        );


      if (
        !record
      ) {

        return {
          success: false,

          answer:
            `No data was found for ${detectedColumn}.`
        };
      }


      return {
        success: true,

        answer:
          `The lowest ${detectedColumn} in the ${tableName} table is ${record[detectedColumn]}.`,

        data: {
          type:
            "lowest",

          table:
            tableName,

          column:
            detectedColumn,

          value:
            record[
              detectedColumn
            ],

          record
        }
      };
    }


    // ==========================================
    // FALLBACK
    // ==========================================

    return {
      success: false,

      answer:
        `I found the ${tableName} table, but I could not understand the operation you want to perform. You can ask to count records, show records, list columns, calculate an average, total, highest value, or lowest value.`,

      data: {
        table:
          tableName,

        columns:
          columns.map(
            column =>
              column.name
          )
      }
    };

  } catch (
    error
  ) {

    console.error(
      "❌ DYNAMIC QUERY ERROR:",
      error
    );


    return {
      success: false,

      answer:
        `An error occurred while querying the active database: ${error.message}`,

      data: {
        error:
          error.message
      }
    };

  } finally {

    if (
      db
    ) {

      await db.close();

    }

  }

}