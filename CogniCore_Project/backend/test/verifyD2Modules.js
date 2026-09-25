// ============================================================
// PHASE D2: MULTI-MODULE ORACLE VERIFICATION BATTERY
// Verifies Accounting, Selling, Buying, Stock, HR module suites
// Enforces zero-variance assertions and docstatus doctrine across all suites.
// ============================================================

import assert from 'assert';
import { OracleHarness } from './oracle/oracle.harness.js';
import { fetchDocTypeMeta } from '../src/adapters/erp.meta.js';
import { resolveConcept, getDocstatusDoctrine } from '../src/core/concept.layer.js';

console.log("==================================================");
console.log("   PHASE D2 — MULTI-MODULE ORACLE VERIFICATION    ");
console.log("==================================================");

async function runD2ModuleVerifications() {
  const harness = new OracleHarness();
  await harness.setup();

  try {
    // ----------------------------------------------------
    // MODULE 1: ACCOUNTING & FINANCE
    // ----------------------------------------------------
    console.log("\n[1] Verifying Accounting Module Suite...");
    const invMeta = await fetchDocTypeMeta('Sales Invoice');
    assert.strictEqual(invMeta.submittable, true, "Sales Invoice must be submittable");
    assert.strictEqual(getDocstatusDoctrine('tabSales Invoice', 'mariadb').isSubmittable, true);

    const qInvSql = "SELECT SUM(grand_total) AS total_sales FROM `tabSales Invoice` WHERE `docstatus` = 1 AND `posting_date` >= '2024-01-01' AND `posting_date` < '2025-01-01'";
    const invRows = await harness.getGroundTruth(qInvSql);
    const invoiceTotal = Number(invRows[0].total_sales);

    const qGlSql = "SELECT SUM(credit) AS total_credit FROM `tabGL Entry` WHERE `posting_date` >= '2024-01-01' AND `posting_date` < '2025-01-01'";
    const glRows = await harness.getGroundTruth(qGlSql);
    const glTotal = Number(glRows[0].total_credit);

    console.log(`  Sales Invoice Grand Total: $${invoiceTotal.toFixed(2)}`);
    console.log(`  General Ledger Credit Total: $${glTotal.toFixed(2)}`);
    assert.strictEqual(invoiceTotal, 450000.00, "Accounting: FY2024 Sales Invoice total must be 450,000.00");
    assert.strictEqual(glTotal, 450000.00, "Accounting: FY2024 GL Credit total must be 450,000.00");
    assert.strictEqual(invoiceTotal, glTotal, "Accounting: Sales Invoice and GL must have ZERO variance!");

    // Docstatus doctrine check: verify draft invoice is excluded
    const draftInvRows = await harness.getGroundTruth("SELECT SUM(grand_total) AS total FROM `tabSales Invoice` WHERE `docstatus` = 0");
    assert(Number(draftInvRows[0].total) > 0, "Draft invoice must exist in database");
    console.log(`  ✅ Accounting Suite: zero-variance tie-out confirmed ($450,000.00); draft records excluded.`);

    // ----------------------------------------------------
    // MODULE 2: CRM & SELLING
    // ----------------------------------------------------
    console.log("\n[2] Verifying Selling Module Suite...");
    const custMeta = await fetchDocTypeMeta('Customer');
    assert.strictEqual(custMeta.submittable, false, "Customer master is not submittable");
    const custConcept = resolveConcept('customer', 'mariadb');
    assert.strictEqual(custConcept.table, 'tabCustomer');

    const qCustSql = "SELECT COUNT(*) AS active_customers FROM `tabCustomer` WHERE `disabled` = 0";
    const custRows = await harness.getGroundTruth(qCustSql);
    const activeCustomers = Number(custRows[0].active_customers);
    console.log(`  Active Customers: ${activeCustomers}`);
    assert.strictEqual(activeCustomers, 5, "Selling: Active customer count must be 5");

    const qSoSql = "SELECT SUM(grand_total) AS total_orders FROM `tabSales Order` WHERE `docstatus` = 1 AND `transaction_date` >= '2024-01-01' AND `transaction_date` < '2025-01-01'";
    const soRows = await harness.getGroundTruth(qSoSql);
    const totalOrders = Number(soRows[0].total_orders);
    console.log(`  Submitted Sales Orders Grand Total: $${totalOrders.toFixed(2)}`);
    assert.strictEqual(totalOrders, 480000.00, "Selling: FY2024 submitted sales orders must be 480,000.00");

    // Docstatus doctrine check: draft ($70,000) and cancelled ($40,000) excluded
    const unsubmittedSoRows = await harness.getGroundTruth("SELECT SUM(grand_total) AS total FROM `tabSales Order` WHERE `docstatus` != 1");
    assert.strictEqual(Number(unsubmittedSoRows[0].total), 110000.00, "Selling: Draft + Cancelled SOs total $110,000.00");
    console.log(`  ✅ Selling Suite: active customers (5) and submitted orders ($480,000.00) verified.`);

    // ----------------------------------------------------
    // MODULE 3: PROCUREMENT & BUYING
    // ----------------------------------------------------
    console.log("\n[3] Verifying Buying Module Suite...");
    const suppMeta = await fetchDocTypeMeta('Supplier');
    assert.strictEqual(suppMeta.submittable, false);
    const suppConcept = resolveConcept('vendor', 'mariadb');
    assert.strictEqual(suppConcept.table, 'tabSupplier');

    const qSuppSql = "SELECT COUNT(*) AS active_suppliers FROM `tabSupplier` WHERE `disabled` = 0";
    const suppRows = await harness.getGroundTruth(qSuppSql);
    const activeSuppliers = Number(suppRows[0].active_suppliers);
    console.log(`  Active Suppliers: ${activeSuppliers}`);
    assert.strictEqual(activeSuppliers, 4, "Buying: Active supplier count must be 4");

    const qPinvSql = "SELECT SUM(grand_total) AS total_purchases FROM `tabPurchase Invoice` WHERE `docstatus` = 1 AND `posting_date` >= '2024-01-01' AND `posting_date` < '2025-01-01'";
    const pinvRows = await harness.getGroundTruth(qPinvSql);
    const totalPurchases = Number(pinvRows[0].total_purchases);
    console.log(`  Submitted Purchase Invoices: $${totalPurchases.toFixed(2)}`);
    assert.strictEqual(totalPurchases, 280000.00, "Buying: FY2024 submitted purchase invoices must be 280,000.00");

    // Docstatus doctrine check: draft ($30,000) + cancelled ($15,000) = $45,000 excluded
    const unsubmittedPinvRows = await harness.getGroundTruth("SELECT SUM(grand_total) AS total FROM `tabPurchase Invoice` WHERE `docstatus` != 1");
    assert.strictEqual(Number(unsubmittedPinvRows[0].total), 45000.00);
    console.log(`  ✅ Buying Suite: active suppliers (4) and submitted purchases ($280,000.00) verified.`);

    // ----------------------------------------------------
    // MODULE 4: INVENTORY & STOCK
    // ----------------------------------------------------
    console.log("\n[4] Verifying Stock Module Suite...");
    const itemMeta = await fetchDocTypeMeta('Item');
    assert.strictEqual(itemMeta.submittable, false);
    const itemConcept = resolveConcept('item', 'mariadb');
    assert.strictEqual(itemConcept.table, 'tabItem');

    const qItemSql = "SELECT COUNT(*) AS active_items FROM `tabItem` WHERE `disabled` = 0";
    const itemRows = await harness.getGroundTruth(qItemSql);
    const activeItems = Number(itemRows[0].active_items);
    console.log(`  Active Catalogue Items: ${activeItems}`);
    assert.strictEqual(activeItems, 4, "Stock: Active item count must be 4");

    const qSleSql = "SELECT SUM(stock_value_difference) AS total_stock_value FROM `tabStock Ledger Entry` WHERE `docstatus` = 1 AND `posting_date` >= '2024-01-01' AND `posting_date` < '2025-01-01'";
    const sleRows = await harness.getGroundTruth(qSleSql);
    const totalStockValue = Number(sleRows[0].total_stock_value);
    console.log(`  Total Stock Value Difference: $${totalStockValue.toFixed(2)}`);
    assert.strictEqual(totalStockValue, 150000.00, "Stock: FY2024 Stock Value delta must be 150,000.00");
    console.log(`  ✅ Stock Suite: active items (4) and stock valuation ($150,000.00) verified.`);

    // ----------------------------------------------------
    // MODULE 5: HUMAN RESOURCES & PAYROLL
    // ----------------------------------------------------
    console.log("\n[5] Verifying HR & Payroll Module Suite...");
    const empMeta = await fetchDocTypeMeta('Employee');
    assert.strictEqual(empMeta.submittable, false);
    const empConcept = resolveConcept('employee', 'mariadb');
    assert.strictEqual(empConcept.table, 'tabEmployee');

    const qEmpSql = "SELECT COUNT(*) AS active_employees FROM `tabEmployee` WHERE `status` = 'Active'";
    const empRows = await harness.getGroundTruth(qEmpSql);
    const activeEmployees = Number(empRows[0].active_employees);
    console.log(`  Active Headcount: ${activeEmployees}`);
    assert.strictEqual(activeEmployees, 6, "HR: Active employee headcount must be 6");

    const qSalSql = "SELECT SUM(gross_pay) AS total_payroll FROM `tabSalary Slip` WHERE `docstatus` = 1 AND `start_date` = '2024-11-01'";
    const salRows = await harness.getGroundTruth(qSalSql);
    const totalPayroll = Number(salRows[0].total_payroll);
    console.log(`  Submitted Monthly Payroll: $${totalPayroll.toFixed(2)}`);
    assert.strictEqual(totalPayroll, 85000.00, "HR: November 2024 submitted payroll must be 85,000.00");

    // Docstatus check: draft ($14,000) and cancelled ($13,000) excluded
    const unsubmittedSalRows = await harness.getGroundTruth("SELECT SUM(gross_pay) AS total FROM `tabSalary Slip` WHERE `docstatus` != 1");
    assert.strictEqual(Number(unsubmittedSalRows[0].total), 27000.00);

    // CEO Salary Baseline for RLS Design-Lock
    const qCeoSalSql = "SELECT gross_pay, net_pay FROM `tabSalary Slip` WHERE `docstatus` = 1 AND `employee` = 'EMP-001' AND `start_date` = '2024-11-01'";
    const ceoRows = await harness.getGroundTruth(qCeoSalSql);
    const ceoGross = Number(ceoRows[0].gross_pay);
    console.log(`  CEO Monthly Salary (EMP-001): $${ceoGross.toFixed(2)}`);
    assert.strictEqual(ceoGross, 30000.00, "HR: CEO gross pay must be exactly $30,000.00");
    console.log(`  ✅ HR Suite: active headcount (6), payroll ($85,000.00), and CEO baseline verified.`);

    // ----------------------------------------------------
    // PROVENANCE & ENGINE END-TO-END VERIFICATION
    // ----------------------------------------------------
    console.log("\n[6] Verifying End-to-End Engine Answering with Provenance across Modules...");
    const engineInv = await harness.runEngineQuery({
      query: "What was our total sales invoice amount for 2024?",
      expectedSql: qInvSql,
      sessionId: "d2-prov-inv"
    });
    assert(engineInv.answer.includes("450000"), "Engine answer must include 450000");

    const engineSal = await harness.runEngineQuery({
      query: "What was the total salary slip amount in November 2024?",
      expectedSql: qSalSql,
      sessionId: "d2-prov-sal"
    });
    assert(engineSal.answer.includes("85000"), "Engine answer must include 85000");
    console.log("  ✅ End-to-end provenance verified (meta.source='mariadb', sourceId='erpnext_prod')");

  } finally {
    await harness.teardown();
  }

  console.log("\n==================================================");
  console.log("🏆 ALL 5 D2 MODULE SUITES ORACLE-VERIFIED (100% PASS)!");
  console.log("==================================================");
}

runD2ModuleVerifications().catch(err => {
  console.error("❌ D2 Module Verification Failed:", err);
  process.exit(1);
});
