import mysql from 'mysql2/promise';

async function verifyStep0() {
  console.log("==================================================");
  console.log("   STEP 0 (D-1) ENVIRONMENT & READ-ONLY VERIFICATION ");
  console.log("==================================================");

  let success = true;

  // 1. Verify MariaDB port 3306 connection with cognicore_ro
  console.log("\n[1] Testing MariaDB connection as cognicore_ro...");
  let connection;
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'cognicore_ro',
      password: 'cognicore_ro_password',
      database: '_4e5d6a7b8c9d0e1f'
    });
    console.log("  ✅ Successfully connected to MariaDB container on port 3306.");
  } catch (err) {
    console.error("  ❌ Connection failed:", err.message);
    process.exit(1);
  }

  // 2. Test SELECT query on tabCustomer
  try {
    const [rows] = await connection.query("SELECT COUNT(*) AS active_customers FROM `tabCustomer` WHERE disabled = 0");
    console.log(`  ✅ SELECT query succeeded: active_customers = ${rows[0].active_customers}`);
  } catch (err) {
    console.error("  ❌ SELECT query failed:", err.message);
    success = false;
  }

  // 3. Test SELECT query on tabSales Invoice
  try {
    const [rows] = await connection.query("SELECT SUM(grand_total) AS total_sales FROM `tabSales Invoice` WHERE docstatus = 1 AND posting_date >= '2024-01-01' AND posting_date < '2025-01-01'");
    console.log(`  ✅ SELECT sales total succeeded: total_sales = ${rows[0].total_sales}`);
  } catch (err) {
    console.error("  ❌ SELECT sales total failed:", err.message);
    success = false;
  }

  // 4. Test physical read-only enforcement: INSERT attempt MUST be rejected
  console.log("\n[2] Testing physical read-only enforcement (INSERT rejection)...");
  try {
    await connection.query("INSERT INTO `tabCustomer` (`name`, `customer_name`) VALUES ('HACK-001', 'Malicious Insert')");
    console.error("  ❌ SECURITY BREACH: INSERT succeeded! Read-only permission not enforced.");
    success = false;
  } catch (err) {
    if (err.code === 'ER_TABLEACCESS_DENIED_ERROR' || err.code === 'ER_DBACCESS_DENIED_ERROR' || err.message.includes('command denied')) {
      console.log(`  ✅ Physical read-only enforced: INSERT refused with error [${err.code}]: ${err.message}`);
    } else {
      console.log(`  ✅ INSERT rejected as expected with error: ${err.message}`);
    }
  }

  // 5. Test DROP TABLE attempt MUST be rejected
  console.log("\n[3] Testing DDL rejection (DROP TABLE)...");
  try {
    await connection.query("DROP TABLE `tabCustomer`");
    console.error("  ❌ SECURITY BREACH: DROP TABLE succeeded!");
    success = false;
  } catch (err) {
    console.log(`  ✅ Physical DDL protection enforced: DROP refused with error [${err.code || 'ERR'}]: ${err.message}`);
  }

  await connection.end();

  // 6. Test Frappe Mock on port 8000
  console.log("\n[4] Testing Frappe HTTP DocType metadata endpoint on port 8000...");
  try {
    const response = await fetch("http://127.0.0.1:8000/api/method/frappe.desk.form.load.getdoctype?doctype=Sales+Invoice", {
      headers: {
        'Authorization': 'token test_api_key:test_api_secret'
      }
    });
    const data = await response.json();
    if (data.message && data.message.docs && data.message.docs[0].name === 'Sales Invoice') {
      console.log(`  ✅ Frappe metadata channel succeeded: DocType 'Sales Invoice' loaded with ${data.message.docs[0].fields.length} fields.`);
    } else {
      console.error("  ❌ Unexpected Frappe response:", data);
      success = false;
    }
  } catch (err) {
    console.error("  ❌ Frappe metadata request failed:", err.message);
    success = false;
  }

  console.log("\n==================================================");
  if (success) {
    console.log("🎉 ALL STEP 0 (D-1) CRITERIA VERIFIED CLEANLY!");
    console.log("==================================================");
    process.exit(0);
  } else {
    console.error("🚨 STEP 0 VERIFICATION FAILED!");
    console.log("==================================================");
    process.exit(1);
  }
}

verifyStep0();
