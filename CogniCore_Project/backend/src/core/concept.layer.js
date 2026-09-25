// ============================================================
// CANONICAL CONCEPT LAYER (LAYER 5)
// Phase D2: concept.layer.js per CAP v2.2 Section 125
// Canonical concepts: customer, order, invoice, item, vendor, employee, payment
// Mapped per source/dialect to physical tables, metrics, and docstatus doctrine.
// ============================================================

import { deepFreeze } from '../adapters/dialects/index.js';
import { ERPNEXT_PROFILE } from '../config/profiles/erpnext.profile.js';

export const CANONICAL_CONCEPTS = deepFreeze([
  'customer',
  'order',
  'invoice',
  'item',
  'vendor',
  'employee',
  'payment'
]);

const CONCEPT_SYNONYMS = deepFreeze({
  customer: ['customer', 'customers', 'client', 'clients', 'buyer', 'buyers', 'patron'],
  order: ['order', 'orders', 'sales order', 'purchase order', 'booking', 'bookings'],
  invoice: ['invoice', 'invoices', 'bill', 'bills', 'billing', 'sales invoice', 'purchase invoice'],
  item: ['item', 'items', 'product', 'products', 'good', 'goods', 'sku', 'part', 'inventory item'],
  vendor: ['vendor', 'vendors', 'supplier', 'suppliers', 'provider', 'providers', 'seller'],
  employee: ['employee', 'employees', 'staff', 'worker', 'workers', 'personnel', 'headcount'],
  payment: ['payment', 'payments', 'disbursement', 'receipt', 'payroll', 'salary', 'salaries']
});

const MARIADB_CONCEPT_MAPPINGS = deepFreeze({
  customer: {
    canonical: 'customer',
    table: 'tabCustomer',
    idCol: 'name',
    displayCol: 'customer_name',
    activeFilter: '`disabled` = 0',
    submittable: false,
    requiresDocstatus: false,
    description: 'Master record of registered customers and corporate clients'
  },
  order: {
    canonical: 'order',
    table: 'tabSales Order',
    idCol: 'name',
    dateCol: 'transaction_date',
    amountCol: 'grand_total',
    partyCol: 'customer',
    activeFilter: '`docstatus` = 1',
    submittable: true,
    requiresDocstatus: true,
    description: 'Confirmed sales orders committed for delivery'
  },
  invoice: {
    canonical: 'invoice',
    table: 'tabSales Invoice',
    idCol: 'name',
    dateCol: 'posting_date',
    amountCol: 'grand_total',
    partyCol: 'customer',
    activeFilter: '`docstatus` = 1',
    submittable: true,
    requiresDocstatus: true,
    description: 'Billed sales invoices reflecting realized revenue'
  },
  item: {
    canonical: 'item',
    table: 'tabItem',
    idCol: 'name',
    codeCol: 'item_code',
    displayCol: 'item_name',
    activeFilter: '`disabled` = 0',
    submittable: false,
    requiresDocstatus: false,
    description: 'Master catalogue of inventoriable items and services'
  },
  vendor: {
    canonical: 'vendor',
    table: 'tabSupplier',
    idCol: 'name',
    displayCol: 'supplier_name',
    activeFilter: '`disabled` = 0',
    submittable: false,
    requiresDocstatus: false,
    description: 'Master record of approved vendors and suppliers'
  },
  employee: {
    canonical: 'employee',
    table: 'tabEmployee',
    idCol: 'name',
    displayCol: 'employee_name',
    deptCol: 'department',
    activeFilter: "`status` = 'Active'",
    submittable: false,
    requiresDocstatus: false,
    description: 'Master record of company staff and employees'
  },
  payment: {
    canonical: 'payment',
    table: 'tabPayment Entry',
    idCol: 'name',
    dateCol: 'posting_date',
    amountCol: 'paid_amount',
    activeFilter: '`docstatus` = 1',
    submittable: true,
    requiresDocstatus: true,
    description: 'Official financial disbursements and receipts'
  }
});

const SQLITE_CONCEPT_MAPPINGS = deepFreeze({
  customer: {
    canonical: 'customer',
    tableCandidates: ['customers', 'Customer', 'students'],
    activeFilter: null,
    submittable: false,
    requiresDocstatus: false
  },
  order: {
    canonical: 'order',
    tableCandidates: ['orders', 'Invoices', 'Invoice'],
    activeFilter: null,
    submittable: false,
    requiresDocstatus: false
  },
  invoice: {
    canonical: 'invoice',
    tableCandidates: ['invoices', 'Invoice'],
    activeFilter: null,
    submittable: false,
    requiresDocstatus: false
  },
  item: {
    canonical: 'item',
    tableCandidates: ['products', 'Track', 'Film', 'items'],
    activeFilter: null,
    submittable: false,
    requiresDocstatus: false
  },
  vendor: {
    canonical: 'vendor',
    tableCandidates: ['suppliers', 'Artist'],
    activeFilter: null,
    submittable: false,
    requiresDocstatus: false
  },
  employee: {
    canonical: 'employee',
    tableCandidates: ['employees', 'Employee', 'staff', 'instructors'],
    activeFilter: null,
    submittable: false,
    requiresDocstatus: false
  },
  payment: {
    canonical: 'payment',
    tableCandidates: ['payments', 'transactions', 'InvoiceLine'],
    activeFilter: null,
    submittable: false,
    requiresDocstatus: false
  }
});

/**
 * Resolves a canonical concept name for a given dialect or source descriptor.
 *
 * @param {string} concept
 * @param {string|object} dialectOrSource
 * @returns {object|null}
 */
export function resolveConcept(concept, dialectOrSource = 'sqlite') {
  if (!concept) return null;
  const canonical = String(concept).toLowerCase().trim();
  const dialect = typeof dialectOrSource === 'object'
    ? dialectOrSource?.dialect || 'sqlite'
    : String(dialectOrSource).toLowerCase();

  if (dialect === 'mariadb') {
    return MARIADB_CONCEPT_MAPPINGS[canonical] || null;
  }
  return SQLITE_CONCEPT_MAPPINGS[canonical] || null;
}

/**
 * Identifies canonical concepts referenced in user query text.
 *
 * @param {string} query
 * @returns {string[]} matched canonical concept names
 */
export function detectConceptsInQuery(query = '') {
  const text = String(query).toLowerCase();
  const matches = [];

  for (const [canonical, synonyms] of Object.entries(CONCEPT_SYNONYMS)) {
    for (const syn of synonyms) {
      const regex = new RegExp(`\\b${syn}\\b`, 'i');
      if (regex.test(text)) {
        matches.push(canonical);
        break;
      }
    }
  }

  return matches;
}

/**
 * Returns docstatus doctrine rule for a physical table in a given dialect.
 *
 * @param {string} tableName
 * @param {string} dialect
 * @returns {{ isSubmittable: boolean, requiredFilter: string|null }}
 */
export function getDocstatusDoctrine(tableName = '', dialect = 'mariadb') {
  if (String(dialect).toLowerCase() !== 'mariadb') {
    return { isSubmittable: false, requiredFilter: null };
  }

  const cleanName = tableName.replace(/[`"]/g, '');
  const isSubmittable = ERPNEXT_PROFILE.docstatus.submittableTables.includes(cleanName);

  return {
    isSubmittable,
    requiredFilter: isSubmittable ? '`docstatus` = 1' : null
  };
}

/**
 * Returns canonical concepts list.
 */
export function getCanonicalConcepts() {
  return CANONICAL_CONCEPTS;
}
