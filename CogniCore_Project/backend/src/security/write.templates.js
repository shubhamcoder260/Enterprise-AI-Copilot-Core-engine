// ============================================================================
// WRITE TEMPLATES REGISTRY (CAP v2.2 §233, §283 — PHASE D5)
//
// Invariants:
//   1. NO FREEFORM AI-GENERATED WRITES: Every write must match a hand-authored,
//      pre-registered, deepFrozen template.
//   2. STRICT PARAMETERIZATION: Templates use ONLY named placeholders (:param).
//      User values are bound via driver parameters; zero string concatenation.
//   3. IMMUTABILITY: Registry is deepFrozen at module load time.
//   4. EXPLICIT ALLOWLISTING: Every template strictly names its target table,
//      required role, and whether self-approval is permitted.
// ============================================================================

import { deepFreeze } from "../adapters/dialects/index.js";

const WRITE_TEMPLATES = {
  UPDATE_OWN_CONTACT: {
    id: "UPDATE_OWN_CONTACT",
    description: "Update own contact phone number and email address",
    allowedTable: "tabEmployee",
    targetTables: ["tabEmployee", "employees"],
    requiredRole: "Employee",
    selfApproveEligible: true,
    requiredParams: ["employeeId", "cellNumber", "personalEmail"],
    sql: "UPDATE `tabEmployee` SET `cell_number` = :cellNumber, `personal_email` = :personalEmail WHERE `name` = :employeeId",
    dialectSql: {
      mariadb: "UPDATE `tabEmployee` SET `cell_number` = :cellNumber, `personal_email` = :personalEmail WHERE `name` = :employeeId",
      sqlite: 'UPDATE "tabEmployee" SET "cell_number" = :cellNumber, "personal_email" = :personalEmail WHERE "name" = :employeeId',
      postgres: 'UPDATE "tabEmployee" SET "cell_number" = :cellNumber, "personal_email" = :personalEmail WHERE "name" = :employeeId'
    },
    estimatedRows: 1
  },

  CREATE_CUSTOMER: {
    id: "CREATE_CUSTOMER",
    description: "Create a new verified customer record",
    allowedTable: "tabCustomer",
    targetTables: ["tabCustomer", "customers"],
    requiredRole: "Sales User",
    selfApproveEligible: false,
    requiredParams: ["customerName", "customerType", "customerGroup", "territory"],
    sql: "INSERT INTO `tabCustomer` (`name`, `customer_name`, `customer_type`, `customer_group`, `territory`, `docstatus`) VALUES (:customerName, :customerName, :customerType, :customerGroup, :territory, 0)",
    dialectSql: {
      mariadb: "INSERT INTO `tabCustomer` (`name`, `customer_name`, `customer_type`, `customer_group`, `territory`, `docstatus`) VALUES (:customerName, :customerName, :customerType, :customerGroup, :territory, 0)",
      sqlite: 'INSERT INTO "tabCustomer" ("name", "customer_name", "customer_type", "customer_group", "territory", "docstatus") VALUES (:customerName, :customerName, :customerType, :customerGroup, :territory, 0)',
      postgres: 'INSERT INTO "customers" ("name", "customer_name", "customer_type", "customer_group", "territory") VALUES (:customerName, :customerName, :customerType, :customerGroup, :territory)'
    },
    estimatedRows: 1
  },

  UPDATE_ORDER_STATUS: {
    id: "UPDATE_ORDER_STATUS",
    description: "Update the workflow status of an existing Sales Order",
    allowedTable: "tabSales Order",
    targetTables: ["tabSales Order", "orders"],
    requiredRole: "Sales Manager",
    selfApproveEligible: false,
    requiredParams: ["orderId", "status"],
    sql: "UPDATE `tabSales Order` SET `status` = :status WHERE `name` = :orderId AND `docstatus` = 1",
    dialectSql: {
      mariadb: "UPDATE `tabSales Order` SET `status` = :status WHERE `name` = :orderId AND `docstatus` = 1",
      sqlite: 'UPDATE "tabSales Order" SET "status" = :status WHERE "name" = :orderId AND "docstatus" = 1',
      postgres: 'UPDATE "orders" SET "status" = :status WHERE "name" = :orderId'
    },
    estimatedRows: 1
  }
};

export const TEMPLATES = deepFreeze(WRITE_TEMPLATES);

/**
 * Returns a template definition by ID.
 * @param {string} templateId
 * @returns {object|null}
 */
export function getTemplate(templateId) {
  if (!templateId || typeof templateId !== "string") return null;
  return TEMPLATES[templateId] || null;
}

/**
 * Returns all registered templates as an array.
 * @returns {Array<object>}
 */
export function listTemplates() {
  return Object.values(TEMPLATES);
}

/**
 * Renders a parameterized template for execution.
 * Transforms named placeholders (:param) into driver-specific bind tokens (? or $1..$n).
 *
 * @param {object} template
 * @param {object} params
 * @param {string} dialect - "mariadb" | "sqlite" | "postgres"
 * @returns {{ sql: string, values: Array<any>, rawSql: string, estimatedRows: number }}
 */
export function renderTemplate(template, params = {}, dialect = "mariadb") {
  if (!template) throw new Error("Template is required");

  // Validate required params
  for (const p of template.requiredParams || []) {
    if (params[p] === undefined || params[p] === null || params[p] === "") {
      throw new Error(`Missing required parameter: '${p}' for template '${template.id}'`);
    }
  }

  const rawSql = template.dialectSql?.[dialect] || template.sql;
  const values = [];
  const d = String(dialect).toLowerCase();
  let paramIndex = 1;

  // Replace named placeholders with driver-appropriate parameter tokens
  const sql = rawSql.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
    if (!(paramName in params)) {
      throw new Error(`Parameter '${paramName}' not provided in input parameters`);
    }
    values.push(params[paramName]);
    if (d === "postgres" || d === "postgresql") {
      return `$${paramIndex++}`;
    }
    return "?";
  });

  return {
    sql,
    values,
    rawSql,
    estimatedRows: template.estimatedRows || 1
  };
}
