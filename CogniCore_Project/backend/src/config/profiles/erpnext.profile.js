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
