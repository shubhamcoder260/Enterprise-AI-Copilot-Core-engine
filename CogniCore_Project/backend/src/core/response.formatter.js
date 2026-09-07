// ==========================================
// RESPONSE FORMATTER (FORMAT)
// Transforms raw query execution results into natural language sentences and structured data
// ==========================================

export function formatExecutionResponse({ plan, execution, schema = {} }) {
  const tables = Object.keys(schema);
  const { tableName, columnName, operation } = plan;

  // 1. Errors from plan construction
  if (plan.errorType) {
    if (plan.errorType === "no_tables") {
      return {
        success: false,
        answer: "The active database does not contain any readable tables.",
        data: { availableTables: [] }
      };
    }

    if (plan.errorType === "table_missing") {
      return {
        success: false,
        answer: `I found the active database, but I could not determine which table this question refers to. Available tables are: ${tables.join(", ")}.`,
        data: { availableTables: tables }
      };
    }

    if (plan.errorType === "numeric_column_missing") {
      const tableData = schema[tableName];
      const columns = tableData?.columns || [];
      return {
        success: false,
        answer: `I found the ${tableName} table, but I could not determine which numeric column you want to calculate. Available numeric columns are: ${plan.availableNumericColumns?.join(", ") || "none"}.`,
        data: {
          table: tableName,
          columns: columns.map((c) => c.name),
          numericColumns: plan.availableNumericColumns || []
        }
      };
    }

    if (plan.errorType === "column_not_numeric") {
      return {
        success: false,
        answer: `${columnName} is not a numeric column, so I cannot perform this calculation.`,
        data: { table: tableName, column: columnName }
      };
    }

    if (plan.errorType === "unknown_operation") {
      const tableData = schema[tableName];
      const columns = tableData?.columns || [];
      return {
        success: false,
        answer: `I found the ${tableName} table, but I could not understand the operation you want to perform. You can ask to count records, show records, list columns, calculate an average, total, highest value, or lowest value.`,
        data: {
          table: tableName,
          columns: columns.map((c) => c.name)
        }
      };
    }
  }

  // 2. Execution failure
  if (!execution.success) {
    return {
      success: false,
      answer: `An error occurred while querying the active database: ${execution.error}`,
      data: { error: execution.error }
    };
  }

  // 3. Database tables query
  if (operation === "database_tables") {
    return {
      success: true,
      answer: `The database contains ${tables.length} table(s): ${tables.join(", ")}.`,
      data: {
        type: "database_tables",
        tables,
        value: tables.length
      }
    };
  }

  // 4. Table columns query
  if (operation === "table_columns") {
    const tableData = schema[tableName];
    const tableColumns = tableData?.columns || [];
    const columnNames = tableColumns.map((c) => c.name).join(", ");
    return {
      success: true,
      answer: `The ${tableName} table has ${tableColumns.length} column(s): ${columnNames}.`,
      data: {
        type: "table_columns",
        table: tableName,
        columns: tableColumns,
        value: tableColumns.length
      }
    };
  }

  const raw = execution.rawResult;

  // 5. Count operation
  if (operation === "count") {
    const count = raw?.count ?? raw?.result ?? 0;
    return {
      success: true,
      answer: `There are ${count} record(s) in the ${tableName} table.`,
      data: {
        type: "count",
        table: tableName,
        value: count
      }
    };
  }

  // 6. Show / Records / List operation
  if (operation === "records" || operation === "list") {
    const records = Array.isArray(raw) ? raw : [];
    return {
      success: true,
      answer: `Showing ${records.length} record(s) from the ${tableName} table. The display is limited to the first 50 records.`,
      data: {
        type: "records",
        table: tableName,
        value: records.length,
        records
      }
    };
  }

  // 7. Average operation
  if (operation === "average") {
    if (raw?.average === null || raw?.average === undefined) {
      return {
        success: false,
        answer: `There is no numeric data available in ${columnName}.`,
        data: { table: tableName, column: columnName }
      };
    }
    const value = Number(Number(raw.average).toFixed(2));
    return {
      success: true,
      answer: `The average ${columnName} in the ${tableName} table is ${value}.`,
      data: {
        type: "average",
        table: tableName,
        column: columnName,
        value
      }
    };
  }

  // 8. Sum / Total operation
  if (operation === "sum") {
    if (raw?.total === null || raw?.total === undefined) {
      return {
        success: false,
        answer: `There is no numeric data available in ${columnName}.`,
        data: { table: tableName, column: columnName }
      };
    }
    const value = Number(Number(raw.total).toFixed(2));
    return {
      success: true,
      answer: `The total ${columnName} in the ${tableName} table is ${value}.`,
      data: {
        type: "sum",
        table: tableName,
        column: columnName,
        value
      }
    };
  }

  // 9. Highest operation
  if (operation === "highest") {
    if (!raw) {
      return {
        success: false,
        answer: `No data was found for ${columnName}.`,
        data: { table: tableName, column: columnName }
      };
    }
    return {
      success: true,
      answer: `The highest ${columnName} in the ${tableName} table is ${raw[columnName]}.`,
      data: {
        type: "highest",
        table: tableName,
        column: columnName,
        value: raw[columnName],
        record: raw
      }
    };
  }

  // 10. Lowest operation
  if (operation === "lowest") {
    if (!raw) {
      return {
        success: false,
        answer: `No data was found for ${columnName}.`,
        data: { table: tableName, column: columnName }
      };
    }
    return {
      success: true,
      answer: `The lowest ${columnName} in the ${tableName} table is ${raw[columnName]}.`,
      data: {
        type: "lowest",
        table: tableName,
        column: columnName,
        value: raw[columnName],
        record: raw
      }
    };
  }

  // 11. Top N / Bottom N
  if (operation === "topN" || operation === "bottomN") {
    const records = Array.isArray(raw) ? raw : [];
    const direction = operation === "topN" ? "top" : "bottom";
    return {
      success: true,
      answer: `Showing the ${direction} ${records.length} record(s) from the ${tableName} table by ${columnName}.`,
      data: {
        type: operation,
        table: tableName,
        column: columnName,
        value: records.length,
        records
      }
    };
  }

  // 12. Threshold filter
  if (operation === "threshold_filter") {
    const records = Array.isArray(raw) ? raw : [];
    return {
      success: true,
      answer: `Found ${records.length} record(s) in the ${tableName} table matching the ${columnName} filter.`,
      data: {
        type: "threshold_filter",
        table: tableName,
        column: columnName,
        value: records.length,
        records
      }
    };
  }

  // 13. ID lookup
  if (operation === "id_lookup") {
    if (!raw) {
      return {
        success: false,
        answer: `No record found in ${tableName} for the given identifier.`,
        data: { table: tableName, column: columnName }
      };
    }
    return {
      success: true,
      answer: `Found a record in the ${tableName} table.`,
      data: {
        type: "id_lookup",
        table: tableName,
        column: columnName,
        value: 1,
        record: raw
      }
    };
  }

  // 14. Value-match filter
  if (operation === "value_match_filter") {
    const records = Array.isArray(raw) ? raw : [];
    return {
      success: true,
      answer: `Found ${records.length} record(s) in the ${tableName} table matching the filter on ${columnName}.`,
      data: {
        type: "value_match_filter",
        table: tableName,
        column: columnName,
        value: records.length,
        records
      }
    };
  }

  // 15. FastIntent Aggregate (AVG, SUM, etc.)
  if (operation === "aggregate") {
    const val = raw?.result ?? raw?.average ?? raw?.total;
    const num = val !== null && val !== undefined ? Number(Number(val).toFixed(2)) : null;
    return {
      success: true,
      answer: `The calculated value for ${columnName || tableName} is ${num}.`,
      data: {
        type: "aggregate",
        table: tableName,
        column: columnName,
        value: num
      }
    };
  }

  return {
    success: false,
    answer: `Could not format response for operation: ${operation}`,
    data: { table: tableName, operation }
  };
}

