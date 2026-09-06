// ==========================================
// E-COMMERCE BENCHMARK DATABASE GENERATOR
// Deterministic generator with fixed PRNG seed
// ==========================================

import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "ecommerce_test.db");

// Deterministic PRNG (Linear Congruential Generator)
let seed = 123456789;
function rand() {
  seed = (1103515245 * seed + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

async function buildEcommerceDb() {
  try {
    await fs.unlink(DB_PATH);
  } catch {}

  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  console.log(`[Generator] Creating schema at ${DB_PATH}...`);

  await db.exec(`
    CREATE TABLE suppliers (
      supplier_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      country TEXT NOT NULL
    );

    CREATE TABLE customers (
      customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      phone TEXT,
      signup_date TEXT NOT NULL
    );

    CREATE TABLE products (
      product_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL,
      supplier_id INTEGER NOT NULL,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
    );

    CREATE TABLE orders (
      order_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      order_date TEXT NOT NULL,
      status TEXT NOT NULL,
      total_amount REAL NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );

    CREATE TABLE order_items (
      order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(order_id),
      FOREIGN KEY (product_id) REFERENCES products(product_id)
    );

    CREATE TABLE reviews (
      review_id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      rating INTEGER CHECK(rating >= 1 AND rating <= 5),
      review_date TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(product_id),
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );
  `);

  const countries = ["USA", "Germany", "UK", "Canada", "France", "Japan", "Australia"];
  const categories = ["Electronics", "Apparel", "Home & Kitchen", "Books", "Beauty", "Sports"];
  const statuses = ["completed", "shipped", "pending", "cancelled"];

  // 1. Suppliers (20)
  for (let i = 1; i <= 20; i++) {
    await db.run(
      "INSERT INTO suppliers (name, country) VALUES (?, ?)",
      [`Supplier_${i}`, pick(countries)]
    );
  }

  // 2. Customers (200)
  for (let i = 1; i <= 200; i++) {
    const country = pick(countries);
    const y = randInt(2022, 2024);
    const m = String(randInt(1, 12)).padStart(2, "0");
    const d = String(randInt(1, 28)).padStart(2, "0");
    await db.run(
      "INSERT INTO customers (name, email, city, country, phone, signup_date) VALUES (?, ?, ?, ?, ?, ?)",
      [
        `Customer_${i}`,
        `customer_${i}@example.com`,
        `City_${randInt(1, 30)}`,
        country,
        `+1-555-${String(randInt(1000, 9999))}`,
        `${y}-${m}-${d}`
      ]
    );
  }

  // 3. Products (150)
  for (let i = 1; i <= 150; i++) {
    const category = pick(categories);
    const price = parseFloat((rand() * 150 + 5).toFixed(2));
    const stock = randInt(10, 500);
    const supplier_id = randInt(1, 20);
    await db.run(
      "INSERT INTO products (name, category, price, stock, supplier_id) VALUES (?, ?, ?, ?, ?)",
      [`Product_${i}`, category, price, stock, supplier_id]
    );
  }

  // 4. Orders (800) & Order Items
  // Statuses weighted: completed 60%, shipped 15%, pending 10%, cancelled 15%
  for (let o = 1; o <= 800; o++) {
    const customer_id = randInt(1, 200);
    const year = pick([2024, 2025]);
    const m = String(randInt(1, 12)).padStart(2, "0");
    const d = String(randInt(1, 28)).padStart(2, "0");
    const order_date = `${year}-${m}-${d}`;

    const r = rand();
    let status = "completed";
    if (r >= 0.60 && r < 0.75) status = "shipped";
    else if (r >= 0.75 && r < 0.85) status = "pending";
    else if (r >= 0.85) status = "cancelled";

    const numItems = randInt(1, 5);
    const items = [];
    let computedTotal = 0;

    for (let k = 0; k < numItems; k++) {
      const product_id = randInt(1, 150);
      const prod = await db.get("SELECT price FROM products WHERE product_id = ?", [product_id]);
      const quantity = randInt(1, 4);
      const unit_price = prod.price;
      computedTotal += quantity * unit_price;
      items.push({ product_id, quantity, unit_price });
    }

    computedTotal = parseFloat(computedTotal.toFixed(2));

    const orderRes = await db.run(
      "INSERT INTO orders (customer_id, order_date, status, total_amount) VALUES (?, ?, ?, ?)",
      [customer_id, order_date, status, computedTotal]
    );
    const order_id = orderRes.lastID;

    for (const item of items) {
      await db.run(
        "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
        [order_id, item.product_id, item.quantity, item.unit_price]
      );
    }
  }

  // 5. Reviews (1000)
  for (let r = 1; r <= 1000; r++) {
    const product_id = randInt(1, 150);
    const customer_id = randInt(1, 200);
    const rating = randInt(1, 5);
    const y = pick([2024, 2025]);
    const m = String(randInt(1, 12)).padStart(2, "0");
    const d = String(randInt(1, 28)).padStart(2, "0");
    await db.run(
      "INSERT INTO reviews (product_id, customer_id, rating, review_date) VALUES (?, ?, ?, ?)",
      [product_id, customer_id, rating, `${y}-${m}-${d}`]
    );
  }

  console.log("✅ Successfully generated ecommerce_test.db:");
  const counts = await Promise.all([
    db.get("SELECT count(*) as c FROM suppliers"),
    db.get("SELECT count(*) as c FROM customers"),
    db.get("SELECT count(*) as c FROM products"),
    db.get("SELECT count(*) as c FROM orders"),
    db.get("SELECT count(*) as c FROM order_items"),
    db.get("SELECT count(*) as c FROM reviews")
  ]);

  console.log(`- suppliers: ${counts[0].c}`);
  console.log(`- customers: ${counts[1].c}`);
  console.log(`- products: ${counts[2].c}`);
  console.log(`- orders: ${counts[3].c}`);
  console.log(`- order_items: ${counts[4].c}`);
  console.log(`- reviews: ${counts[5].c}`);

  await db.close();
}

buildEcommerceDb().catch(console.error);
