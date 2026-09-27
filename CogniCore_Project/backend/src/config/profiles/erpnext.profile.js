// ============================================================
// ERPNEXT SEMANTIC PROFILE FRAGMENT
// Phase D2: erpnext.profile.js across Accounting, Selling, Buying, Stock, HR
// Invariant: Preserves verbatim tab* identifiers and declares docstatus doctrine
// ============================================================

import { deepFreeze } from '../../adapters/dialects/index.js';

export const ERPNEXT_PROFILE = deepFreeze({
  dialect: 'mariadb',
  namingPrefix: 'tab',
  identifierQuoting: '`',

  // 1. Docstatus Doctrine
  docstatus: {
    values: {
      draft: 0,
      submitted: 1,
      cancelled: 2
    },
    // Submittable DocTypes REQUIRE docstatus = 1 predicate for analytical reporting
    submittableTables: [
      'tabSales Invoice',
      'tabGL Entry',
      'tabJournal Entry',
      'tabPayment Entry',
      'tabSales Order',
      'tabQuotation',
      'tabPurchase Order',
      'tabPurchase Invoice',
      'tabStock Ledger Entry',
      'tabDelivery Note',
      'tabSalary Slip'
    ],
    // Master / Non-submittable DocTypes where active records use disabled = 0 or status = 'Active'
    masterTables: [
      'tabCustomer',
      'tabSupplier',
      'tabItem',
      'tabEmployee',
      'tabDepartment'
    ]
  },

  // S17: Explicit docstatusKind per DocType
  docstatusKind: {
    // Submittable DocTypes (analytical queries REQUIRE docstatus = 1 filter)
    'Sales Invoice': 'submittable',
    'Purchase Invoice': 'submittable',
    'Salary Slip': 'submittable',
    'Stock Entry': 'submittable',
    'Purchase Order': 'submittable',
    'Sales Order': 'submittable',
    'GL Entry': 'submittable',
    'Payment Entry': 'submittable',
    'tabSales Invoice': 'submittable',
    'tabPurchase Invoice': 'submittable',
    'tabSalary Slip': 'submittable',
    'tabStock Entry': 'submittable',
    'tabPurchase Order': 'submittable',
    'tabSales Order': 'submittable',
    'tabGL Entry': 'submittable',
    'tabPayment Entry': 'submittable',

    // Master DocTypes (unfiltered by docstatus; active records use disabled = 0 or status = 'Active')
    'Customer': 'master',
    'Supplier': 'master',
    'Item': 'master',
    'Employee': 'master',
    'Warehouse': 'master',
    'tabCustomer': 'master',
    'tabSupplier': 'master',
    'tabItem': 'master',
    'tabEmployee': 'master',
    'tabWarehouse': 'master'
  },

  // S17: Master "active" convention: Customer/Supplier/Item -> disabled = 0; Employee -> status = 'Active'
  activeConvention: {
    'Customer': { column: 'disabled', value: 0 },
    'Supplier': { column: 'disabled', value: 0 },
    'Item': { column: 'disabled', value: 0 },
    'Employee': { column: 'status', value: 'Active' },
    'Warehouse': { column: 'disabled', value: 0 },
    'tabCustomer': { column: 'disabled', value: 0 },
    'tabSupplier': { column: 'disabled', value: 0 },
    'tabItem': { column: 'disabled', value: 0 },
    'tabEmployee': { column: 'status', value: 'Active' },
    'tabWarehouse': { column: 'disabled', value: 0 }
  },

  // 2. Module Vocabulary across all 5 Modules
  modules: {
    accounting: {
      label: 'Accounting & Finance',
      tables: ['tabSales Invoice', 'tabGL Entry', 'tabJournal Entry', 'tabPayment Entry'],
      primaryTable: 'tabSales Invoice',
      primaryDateCol: 'posting_date',
      primaryAmountCol: 'grand_total'
    },
    selling: {
      label: 'CRM & Selling',
      tables: ['tabCustomer', 'tabSales Order', 'tabQuotation'],
      primaryTable: 'tabSales Order',
      primaryDateCol: 'transaction_date',
      primaryAmountCol: 'grand_total'
    },
    buying: {
      label: 'Procurement & Buying',
      tables: ['tabSupplier', 'tabPurchase Order', 'tabPurchase Invoice'],
      primaryTable: 'tabPurchase Invoice',
      primaryDateCol: 'posting_date',
      primaryAmountCol: 'grand_total'
    },
    stock: {
      label: 'Inventory & Stock',
      tables: ['tabItem', 'tabStock Ledger Entry', 'tabDelivery Note'],
      primaryTable: 'tabStock Ledger Entry',
      primaryDateCol: 'posting_date',
      primaryAmountCol: 'stock_value_difference'
    },
    hr: {
      label: 'Human Resources & Payroll',
      tables: ['tabEmployee', 'tabSalary Slip', 'tabDepartment'],
      primaryTable: 'tabSalary Slip',
      primaryDateCol: 'start_date',
      primaryAmountCol: 'gross_pay'
    }
  },

  // 3. Schema Aliases mapping natural language tokens to exact tab* tables
  schemaAliases: {
    // Accounting
    sales: 'tabSales Invoice',
    invoices: 'tabSales Invoice',
    revenue: 'tabSales Invoice',
    gl: 'tabGL Entry',
    ledger: 'tabGL Entry',
    journal: 'tabJournal Entry',
    payments: 'tabPayment Entry',

    // Selling
    customers: 'tabCustomer',
    clients: 'tabCustomer',
    orders: 'tabSales Order',
    sales_orders: 'tabSales Order',
    quotations: 'tabQuotation',

    // Buying
    suppliers: 'tabSupplier',
    vendors: 'tabSupplier',
    purchase_orders: 'tabPurchase Order',
    purchases: 'tabPurchase Invoice',
    purchase_invoices: 'tabPurchase Invoice',

    // Stock
    items: 'tabItem',
    products: 'tabItem',
    inventory: 'tabItem',
    stock: 'tabStock Ledger Entry',
    stock_ledger: 'tabStock Ledger Entry',
    deliveries: 'tabDelivery Note',

    // HR
    employees: 'tabEmployee',
    staff: 'tabEmployee',
    workers: 'tabEmployee',
    salary: 'tabSalary Slip',
    salaries: 'tabSalary Slip',
    payroll: 'tabSalary Slip',
    departments: 'tabDepartment'
  }
});

/**
 * Resolves the docstatus kind ('submittable' | 'master' | null) for a table or DocType.
 * Unknown doctypes default to null / no filter (fail-honest direction: never zero out a master).
 */
export function getDocstatusKind(tableNameOrDoctype) {
  if (!tableNameOrDoctype) return null;
  const raw = String(tableNameOrDoctype).replace(/[`"]/g, '').trim();
  const clean = raw.startsWith('tab') ? raw.slice(3) : raw;
  const lowerClean = clean.toLowerCase();

  for (const [key, kind] of Object.entries(ERPNEXT_PROFILE.docstatusKind || {})) {
    const keyClean = key.startsWith('tab') ? key.slice(3) : key;
    if (keyClean.toLowerCase() === lowerClean) {
      return kind;
    }
  }
  return null;
}

export function isSubmittable(tableNameOrDoctype) {
  return getDocstatusKind(tableNameOrDoctype) === 'submittable';
}

export function isMaster(tableNameOrDoctype) {
  return getDocstatusKind(tableNameOrDoctype) === 'master';
}

export function getActiveConvention(tableNameOrDoctype) {
  if (!tableNameOrDoctype) return null;
  const raw = String(tableNameOrDoctype).replace(/[`"]/g, '').trim();
  const clean = raw.startsWith('tab') ? raw.slice(3) : raw;
  const lowerClean = clean.toLowerCase();

  for (const [key, conv] of Object.entries(ERPNEXT_PROFILE.activeConvention || {})) {
    const keyClean = key.startsWith('tab') ? key.slice(3) : key;
    if (keyClean.toLowerCase() === lowerClean) {
      return conv;
    }
  }
  return null;
}
