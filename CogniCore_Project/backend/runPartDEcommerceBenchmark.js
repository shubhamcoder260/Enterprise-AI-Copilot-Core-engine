// ==========================================
// PART D: CROSS-DOMAIN E-COMMERCE BENCHMARK
// ==========================================

import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "ecommerce_test.db");

async function runPartDBenchmark() {
  console.log("==========================================");
  console.log("PART D: E-COMMERCE 9-QUESTION BENCHMARK + REFUSAL TRAPS");
  console.log("==========================================\n");

  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  // Ensure active DB is ecommerce_test.db
  await fetch("http://localhost:5000/api/database/switch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ databasePath: DB_PATH })
  });

  const benchmarkCases = [
    {
      id: 1,
      question: "How many customers are there?",
      gtSql: "SELECT COUNT(*) AS val FROM customers;",
      verify: (res, gt) => {
        const expected = gt[0].val;
        const got = res.data?.records?.[0] ? Object.values(res.data.records[0])[0] : null;
        return got === expected || res.answer?.includes(String(expected));
      }
    },
    {
      id: 2,
      question: "How many orders were placed in 2025?",
      gtSql: "SELECT COUNT(*) AS val FROM orders WHERE strftime('%Y', order_date) = '2025';",
      verify: (res, gt) => {
        const expected = gt[0].val;
        const got = res.data?.records?.[0] ? Object.values(res.data.records[0])[0] : null;
        return got === expected || res.answer?.includes(String(expected));
      }
    },
    {
      id: 3,
      question: "How many orders were cancelled?",
      gtSql: "SELECT COUNT(*) AS val FROM orders WHERE status = 'cancelled';",
      verify: (res, gt) => {
        const expected = gt[0].val;
        const got = res.data?.records?.[0] ? Object.values(res.data.records[0])[0] : null;
        return got === expected || res.answer?.includes(String(expected));
      }
    },
    {
      id: 4,
      question: "Average product price per category, highest first",
      gtSql: "SELECT category, ROUND(AVG(price), 2) AS avg_price FROM products GROUP BY category ORDER BY avg_price DESC;",
      verify: (res, gt) => {
        const firstGt = gt[0].category;
        const records = res.data?.records || [];
        return records.length > 0 && Object.values(records[0]).some(v => String(v).toLowerCase().includes(firstGt.toLowerCase()));
      }
    },
    {
      id: 5,
      question: "Top 5 suppliers by number of products supplied",
      gtSql: `
        SELECT suppliers.name, COUNT(products.product_id) AS prod_count
        FROM suppliers
        JOIN products ON suppliers.supplier_id = products.supplier_id
        GROUP BY suppliers.supplier_id
        ORDER BY prod_count DESC
        LIMIT 5;
      `,
      verify: (res, gt) => {
        const topSupplier = gt[0].name;
        const records = res.data?.records || [];
        return records.length === 5 && Object.values(records[0]).some(v => String(v).toLowerCase().includes(topSupplier.toLowerCase()));
      }
    },
    {
      id: 6,
      question: "Which supplier sold the most items by quantity?",
      gtSql: `
        SELECT suppliers.name, SUM(order_items.quantity) AS total_qty
        FROM suppliers
        JOIN products ON suppliers.supplier_id = products.supplier_id
        JOIN order_items ON products.product_id = order_items.product_id
        GROUP BY suppliers.supplier_id
        ORDER BY total_qty DESC
        LIMIT 1;
      `,
      verify: (res, gt) => {
        const topSupplier = gt[0].name;
        const records = res.data?.records || [];
        return records.length > 0 && Object.values(records[0]).some(v => String(v).toLowerCase().includes(topSupplier.toLowerCase()));
      }
    },
    {
      id: 7,
      question: "Which customer placed the most orders?",
      gtSql: `
        SELECT customers.name, COUNT(orders.order_id) AS order_count
        FROM customers
        JOIN orders ON customers.customer_id = orders.customer_id
        GROUP BY customers.customer_id
        ORDER BY order_count DESC
        LIMIT 1;
      `,
      verify: (res, gt) => {
        const topCust = gt[0].name;
        const records = res.data?.records || [];
        return records.length > 0 && Object.values(records[0]).some(v => String(v).toLowerCase().includes(topCust.toLowerCase()));
      }
    },
    {
      id: 8,
      question: "Average review rating per category",
      gtSql: `
        SELECT products.category, ROUND(AVG(reviews.rating), 2) AS avg_rating
        FROM reviews
        JOIN products ON reviews.product_id = products.product_id
        GROUP BY products.category;
      `,
      verify: (res, gt) => {
        const records = res.data?.records || [];
        return records.length === 6 && records.every(r => Object.values(r).some(v => typeof v === "number"));
      }
    },
    {
      id: 9,
      question: "Total revenue from completed orders",
      gtSql: "SELECT ROUND(SUM(total_amount), 2) AS total_revenue FROM orders WHERE status = 'completed';",
      verify: (res, gt) => {
        const expected = Math.round(gt[0].total_revenue);
        const records = res.data?.records || [];
        return records.length > 0 && Object.values(records[0]).some(v => Math.round(Number(v)) === expected);
      }
    }
  ];

  const results = [];

  for (const c of benchmarkCases) {
    console.log(`\n--------------------------------------------------`);
    console.log(`[Q${c.id}] Question: "${c.question}"`);

    const gt = await db.all(c.gtSql);
    console.log(`Ground-Truth SQL: ${c.gtSql.replace(/\s+/g, " ").trim()}`);
    console.log(`Ground-Truth Result:`, gt.slice(0, 3));

    const start = Date.now();
    const res = await fetch("http://localhost:5000/api/ai/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: c.question,
        organization: "ecommerce",
        sessionId: `part-d-q${c.id}`
      })
    });
    const data = await res.json();
    const duration = data.meta?.processingMs || (Date.now() - start);

    console.log(`Engine Output: source=${data.source} | duration=${duration}ms`);
    console.log(`SQL Generated: ${data.data?.sql || "N/A"}`);
    console.log(`Answer: ${data.answer}`);
    if (data.data?.records?.[0]) {
      console.log(`First Record:`, data.data.records[0]);
    }

    const passed = c.verify(data, gt);
    console.log(passed ? "✅ PASS" : "❌ FAIL / CASCADE");

    results.push({
      ID: c.id,
      Question: c.question,
      Source: data.source,
      Passed: passed ? "YES" : "NO",
      DurationMs: duration,
      SQL: data.data?.sql || "N/A"
    });
  }

  // Refusal Traps
  console.log(`\n==================================================`);
  console.log(`REFUSAL TRAPS TESTING`);
  console.log(`==================================================`);

  // Trap 1: "How many students are there?" (no students table)
  console.log(`\n[Trap 1] "How many students are there?"`);
  const trap1Res = await fetch("http://localhost:5000/api/ai/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "How many students are there?", organization: "ecommerce", sessionId: "trap-1" })
  });
  const trap1Data = await trap1Res.json();
  console.log(`Source: ${trap1Data.source} | Answer: ${trap1Data.answer}`);
  console.log(`SQL: ${trap1Data.data?.sql || "none"}`);

  // Trap 2: "How many orders were placed in September 2026?" (data is 2024-2025)
  console.log(`\n[Trap 2] "How many orders were placed in September 2026?"`);
  const trap2Res = await fetch("http://localhost:5000/api/ai/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "How many orders were placed in September 2026?", organization: "ecommerce", sessionId: "trap-2" })
  });
  const trap2Data = await trap2Res.json();
  console.log(`Source: ${trap2Data.source} | Answer: ${trap2Data.answer}`);
  console.log(`SQL: ${trap2Data.data?.sql || "none"}`);
  console.log(`Records:`, trap2Data.data?.records);

  console.log("\n==========================================");
  console.log("PART D 9-QUESTION BENCHMARK TABLE");
  console.log("==========================================");
  console.table(results);

  await db.close();
}

runPartDBenchmark().catch(err => {
  console.error("FATAL in Part D:", err);
  process.exit(1);
});
