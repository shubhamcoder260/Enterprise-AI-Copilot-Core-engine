// ============================================================
// FOOD DELIVERY REALM GENERATOR — 3 sizes
// F1_quickbite.db    SMALL  abbreviated, denormalized, YYYYMMDD
// F2_citygrub.db     MEDIUM hybrid, ISO dates
// F3_national.db     LARGE  verbose, normalized FKs, ISO datetimes
// Deterministic. Run: node database/gen_fooddelivery.js
// ============================================================
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(__dirname, "..", "test", "fixtures", "realms", "fooddelivery");
mkdirSync(OUT_DIR, { recursive: true });

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const int = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;
const esc = (s) => String(s).replace(/'/g, "''");

const CUISINES = ["North Indian", "South Indian", "Chinese", "Mughlai", "Continental", "Fast Food", "Desserts"];
const DISHES = ["Butter Chicken","Paneer Tikka","Masala Dosa","Hyderabadi Biryani","Chole Bhature","Dal Makhani","Tandoori Chicken","Samosa","Pav Bhaji","Rogan Josh","Idli Sambar","Vada Pav","Rogan Josh","Malai Kofta","Fish Curry","Rabri"];
const ITEM_CATS = ["Main Course", "Starters", "Breads", "Rice", "Desserts", "Beverages"];
const FIRST = ["Aarav", "Maya", "Kiran", "Tariq", "Ingrid", "Raj", "Zara", "Omar", "Lena", "Viktor", "Priya", "Hana", "Diego", "Nadia", "Felix"];
const LAST = ["Patel", "Khan", "Weber", "Silva", "Okafor", "Rossi", "Kim", "Haddad", "Novak", "Tanaka"];
const CITIES = ["Mumbai", "Delhi", "Pune", "Bangalore", "Hyderabad"];
const VEHICLES = ["Bike", "Scooter", "Bike", "Scooter", "Cycle", "Bike"];
const REST_NAMES = ["Spice Junction","Tandoor House","Dosa Point","Biryani Blues","Curry Leaf","Wok Express","Kebab Factory","Sweet Truth","Punjabi Rasoi","Madras Cafe"];
const ORDER_STATUS = ["Delivered","Delivered","Delivered","Delivered","Delivered","Delivered","Preparing","Out for Delivery","Cancelled"];

function generateFoodDelivery(opts) {
  const { name, seed, restaurants: nRestaurants, customers: nCustomers, orders: nOrders, terse } = opts;
  const rng = mulberry32(seed);
  const suffix = terse ? "quickbite" : name === "F3" ? "national" : "citygrub";
  const dbPath = path.join(OUT_DIR, `${name}_${suffix}.db`);
  rmSync(dbPath, { force: true });

  // ============================================================
  // THE COMPLETE MAP — every table, PK, FK, column, both flavors.
  // DDL and verification reference NOTHING outside this object.
  // ============================================================
  const T = terse
    ? {
        rst: "rst",  rstPk: "rst_id",  rstNm: "rst_nm",  rstCu: "cusin", rstCity: "city", rstRat: "rat",
        mnu: "mnu",  mnuPk: "itm_id",  mnuRst: "rst_id", mnuNm: "itm_nm", mnuPrc: "prc", mnuCat: "cat", mnuVeg: "veg",
        cst: "cst",  cstPk: "cst_id",  cstNm: "cst_nm",  cstPh: "ph",
        ord: "ords", ordPk: "ord_id",  ordCst: "cst_id", ordRst: "rst_id", ordCur: "cur_id", ordDt: "ord_dt", ordTot: "tot_amt", ordSt: "st",
        cur: "cur",  curPk: "cur_id",  curNm: "cur_nm",  curVeh: "veh",
        oi: "oi",    oiOrd: "ord_id",  oiItm: "itm_id",  oiQty: "qty",
      }
    : {
        rst: "restaurants", rstPk: "restaurant_id", rstNm: "restaurant_name", rstCu: "cuisine", rstCity: "city", rstRat: "rating",
        mnu: "menu_items",  mnuPk: "item_id",       mnuRst: "restaurant_id",  mnuNm: "item_name", mnuPrc: "price", mnuCat: "category", mnuVeg: "is_veg",
        cst: "customers",   cstPk: "customer_id",   cstNm: "customer_name",   cstPh: "phone",
        ord: "orders",      ordPk: "order_id",      ordCst: "customer_id",    ordRst: "restaurant_id", ordCur: "courier_id", ordDt: "order_date", ordTot: "total_amount", ordSt: "status",
        cur: "couriers",    curPk: "courier_id",    curNm: "courier_name",    curVeh: "vehicle",
        oi: "order_items",  oiOrd: "order_id",      oiItm: "item_id",         oiQty: "quantity",
      };

  const L = [];
  L.push("PRAGMA journal_mode=DELETE;");
  L.push("BEGIN TRANSACTION;");

  // restaurants
  const restaurants = [];
  for (let r = 0; r < nRestaurants; r++) {
    restaurants.push({
      id: r + 1,
      name: terse ? `RST_${String(r + 1).padStart(3, "0")}` : `${REST_NAMES[r % REST_NAMES.length]} ${["", "II", "III", "Express", "Grand"][r % 5]}`,
      cuisine: pick(rng, CUISINES),
      city: pick(rng, CITIES),
      rating: int(rng, 30, 50) / 10,
    });
  }

  // menu items (4–8 per restaurant, prices in cents)
  const menuItems = [];
  for (const r of restaurants) {
    const n = int(rng, 4, 8);
    for (let m = 0; m < n; m++) {
      menuItems.push({
        id: menuItems.length + 1,
        rstId: r.id,
        name: terse ? `ITM_${r.id}_${m + 1}` : pick(rng, DISHES),
        price: int(rng, 4900, 45000) / 100,
        category: pick(rng, ITEM_CATS),
        veg: rng() < 0.5 ? 1 : 0,
      });
    }
  }

  // customers
  const customers = [];
  for (let c = 0; c < nCustomers; c++) {
    customers.push({
      id: c + 1,
      name: terse ? `${pick(rng, LAST)}, ${pick(rng, FIRST)}` : `${pick(rng, FIRST)} ${pick(rng, LAST)}`,
      phone: `9${int(rng, 1000000000, 9999999999)}`,
      city: pick(rng, CITIES),
    });
  }

  // couriers
  const couriers = [];
  for (let k = 0; k < 30; k++) {
    couriers.push({
      id: k + 1,
      name: terse ? `CUR_${String(k + 1).padStart(3, "0")}` : `${pick(rng, FIRST)} ${pick(rng, LAST)}`,
      vehicle: pick(rng, VEHICLES),
    });
  }

  // orders — total computed FROM its items (internally consistent data)
  const orders = [];
  const orderItems = [];
  let oid = 0, oiid = 0;
  for (let o = 0; o < nOrders; o++) {
    oid++;
    const rst = pick(rng, restaurants);
    const rstMenu = menuItems.filter(m => m.rstId === rst.id);
    const status = pick(rng, ORDER_STATUS);
    const day = int(rng, 1, 28), month = int(rng, 1, 12), year = int(rng, 2024, 2025);
    const date = terse
      ? `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`
      : `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${int(rng, 10, 23)}:${String(int(rng, 0, 59)).padStart(2, "0")}:00`;

    const nItems = int(rng, 2, 5);
    let total = int(rng, 1500, 6000) / 100;   // delivery fee component
    const lineItems = [];
    for (let i = 0; i < nItems; i++) {
      const item = pick(rng, rstMenu);
      const qty = int(rng, 1, 3);
      total += item.price * qty;
      lineItems.push({ item: item.id, qty });
    }
    total = Math.round(total * 100) / 100;

    orders.push({
      id: oid, cst: pick(rng, customers).id, rst: rst.id, cur: pick(rng, couriers).id,
      date, total: total.toFixed(2), status,
    });
    if (status !== "Cancelled") {
      for (const li of lineItems) {
        orderItems.push({ id: ++oiid, ord: oid, itm: li.item, qty: li.qty });
      }
    }
  }

  // ── DDL — built entirely from the map ──
  L.push(`CREATE TABLE ${T.rst} (${T.rstPk} INTEGER PRIMARY KEY, ${T.rstNm} TEXT NOT NULL, ${T.rstCu} TEXT, ${T.rstCity} TEXT, ${T.rstRat} REAL);`);
  restaurants.forEach(r => L.push(`INSERT INTO ${T.rst} VALUES (${r.id}, '${esc(r.name)}', '${r.cuisine}', '${r.city}', ${r.rating});`));
  L.push(`CREATE TABLE ${T.mnu} (${T.mnuPk} INTEGER PRIMARY KEY, ${T.mnuRst} INTEGER NOT NULL, ${T.mnuNm} TEXT NOT NULL, ${T.mnuPrc} REAL NOT NULL, ${T.mnuCat} TEXT, ${T.mnuVeg} INTEGER);`);
  menuItems.forEach(m => L.push(`INSERT INTO ${T.mnu} VALUES (${m.id}, ${m.rstId}, '${esc(m.name)}', ${m.price}, '${m.category}', ${m.veg});`));
  L.push(`CREATE TABLE ${T.cst} (${T.cstPk} INTEGER PRIMARY KEY, ${T.cstNm} TEXT NOT NULL, ${T.cstPh} TEXT);`);
  customers.forEach(c => L.push(`INSERT INTO ${T.cst} VALUES (${c.id}, '${esc(c.name)}', '${c.phone}');`));
  L.push(`CREATE TABLE ${T.cur} (${T.curPk} INTEGER PRIMARY KEY, ${T.curNm} TEXT NOT NULL, ${T.curVeh} TEXT);`);
  couriers.forEach(c => L.push(`INSERT INTO ${T.cur} VALUES (${c.id}, '${esc(c.name)}', '${c.vehicle}');`));
  L.push(`CREATE TABLE ${T.ord} (${T.ordPk} INTEGER PRIMARY KEY, ${T.ordCst} INTEGER NOT NULL, ${T.ordRst} INTEGER NOT NULL, ${T.ordCur} INTEGER, ${T.ordDt} TEXT NOT NULL, ${T.ordTot} REAL NOT NULL, ${T.ordSt} TEXT NOT NULL);`);
  orders.forEach(o => L.push(`INSERT INTO ${T.ord} VALUES (${o.id}, ${o.cst}, ${o.rst}, ${o.cur}, '${o.date}', ${o.total}, '${o.status}');`));
  L.push(`CREATE TABLE ${T.oi} (${T.oiOrd} INTEGER NOT NULL, ${T.oiItm} INTEGER NOT NULL, ${T.oiQty} INTEGER NOT NULL);`);
  orderItems.forEach(oi => L.push(`INSERT INTO ${T.oi} VALUES (${oi.ord}, ${oi.itm}, ${oi.qty});`));

  L.push(`CREATE INDEX idx_ord_cst ON ${T.ord}(${T.ordCst});`);
  L.push(`CREATE INDEX idx_ord_rst ON ${T.ord}(${T.ordRst});`);
  L.push(`CREATE INDEX idx_oi_ord ON ${T.oi}(${T.oiOrd});`);

  L.push("COMMIT;");
  const sqlFile = path.join(OUT_DIR, `.gen_${name}.sql`);
  writeFileSync(sqlFile, L.join("\n"));
  execSync(`sqlite3 "${dbPath}" < "${sqlFile}"`);
  rmSync(sqlFile);
  return { dbPath, T, restaurants, menuItems, customers, orders, orderItems, couriers };
}

const f1 = generateFoodDelivery({ name: "F1", seed: 81, restaurants: 30, customers: 200, orders: 1500, terse: true });
const f2 = generateFoodDelivery({ name: "F2", seed: 82, restaurants: 80, customers: 1000, orders: 10000, terse: false });
const f3 = generateFoodDelivery({ name: "F3", seed: 83, restaurants: 200, customers: 6000, orders: 45000, terse: false });

// ── verification: every reference through T — zero hardcoded names ──
for (const [label, g] of [["F1_quickbite (SMALL)", f1], ["F2_citygrub (MEDIUM)", f2], ["F3_national (LARGE)", f3]]) {
  console.log(`\n═══ ${label} — ${g.dbPath} ═══`);
  const T = g.T;
  const q = (s) => execSync(`sqlite3 "${g.dbPath}" "${s}"`).toString().trim();

  console.log("restaurants:", q(`SELECT COUNT(*) FROM ${T.rst};`));
  console.log("menu items:", q(`SELECT COUNT(*) FROM ${T.mnu};`));
  console.log("customers:", q(`SELECT COUNT(*) FROM ${T.cst};`));
  console.log("orders:", q(`SELECT COUNT(*) FROM ${T.ord};`));
  console.log("couriers:", q(`SELECT COUNT(*) FROM ${T.cur};`));
  console.log("order item lines:", q(`SELECT COUNT(*) FROM ${T.oi};`));
  console.log("cancelled:", q(`SELECT COUNT(*) FROM ${T.ord} WHERE ${T.ordSt}='Cancelled';`));
  console.log("avg delivered order value:", q(`SELECT ROUND(AVG(${T.ordTot}),2) FROM ${T.ord} WHERE ${T.ordSt}='Delivered';`));
  console.log("top restaurant by revenue:", q(`SELECT r.${T.rstNm}, ROUND(SUM(o.${T.ordTot}),2) rev FROM ${T.ord} o JOIN ${T.rst} r ON o.${T.ordRst}=r.${T.rstPk} WHERE o.${T.ordSt}='Delivered' GROUP BY 1 ORDER BY rev DESC LIMIT 1;`));
  console.log("top courier by deliveries:", q(`SELECT c.${T.curNm}, COUNT(*) d FROM ${T.ord} o JOIN ${T.cur} c ON o.${T.ordCur}=c.${T.curPk} WHERE o.${T.ordSt}='Delivered' GROUP BY 1 ORDER BY d DESC LIMIT 1;`));
  console.log("customers with NO orders (anti-join):", q(`SELECT COUNT(*) FROM ${T.cst} WHERE ${T.cstPk} NOT IN (SELECT ${T.ordCst} FROM ${T.ord});`));
  console.log("veg menu items:", q(`SELECT COUNT(*) FROM ${T.mnu} WHERE ${T.mnuVeg}=1;`));
}
console.log("\n✅ Food Delivery realm complete: F1 (small) + F2 (medium) + F3 (large)");