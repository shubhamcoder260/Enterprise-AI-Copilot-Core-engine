import assert from "assert";
import {
  scoreTables,
  buildRelationshipGraph,
  pruneSchema
} from "../CogniCore_Project/backend/src/core/schema.pruner.js";

console.log("=== RUNNING VERIFY SCHEMA PRUNER TESTS (P-U1 to P-U7) ===");

// Mock 12-table schema for testing
const mockSchema = {
  artists: {
    columns: [{ name: "ArtistId", primaryKey: true }, { name: "Name" }],
    foreignKeys: []
  },
  albums: {
    columns: [
      { name: "AlbumId", primaryKey: true },
      { name: "Title" },
      { name: "ArtistId" }
    ],
    foreignKeys: [{ from: "ArtistId", toTable: "artists", toColumn: "ArtistId" }]
  },
  tracks: {
    columns: [
      { name: "TrackId", primaryKey: true },
      { name: "Name" },
      { name: "AlbumId" },
      { name: "UnitPrice" }
    ],
    foreignKeys: [{ from: "AlbumId", toTable: "albums", toColumn: "AlbumId" }]
  },
  invoices: {
    columns: [
      { name: "InvoiceId", primaryKey: true },
      { name: "CustomerId" },
      { name: "Total" }
    ],
    foreignKeys: [{ from: "CustomerId", toTable: "customers", toColumn: "CustomerId" }]
  },
  invoice_items: {
    columns: [
      { name: "InvoiceLineId", primaryKey: true },
      { name: "InvoiceId" },
      { name: "TrackId" },
      { name: "UnitPrice" }
    ],
    foreignKeys: [
      { from: "InvoiceId", toTable: "invoices", toColumn: "InvoiceId" },
      { from: "TrackId", toTable: "tracks", toColumn: "TrackId" }
    ]
  },
  customers: {
    columns: [
      { name: "CustomerId", primaryKey: true },
      { name: "FirstName" },
      { name: "LastName" },
      { name: "Country" }
    ],
    foreignKeys: []
  },
  employees: {
    columns: [{ name: "EmployeeId", primaryKey: true }, { name: "ReportsTo" }],
    foreignKeys: [{ from: "ReportsTo", toTable: "employees", toColumn: "EmployeeId" }]
  },
  genres: {
    columns: [{ name: "GenreId", primaryKey: true }, { name: "Name" }],
    foreignKeys: []
  },
  media_types: {
    columns: [{ name: "MediaTypeId", primaryKey: true }, { name: "Name" }],
    foreignKeys: []
  },
  playlists: {
    columns: [{ name: "PlaylistId", primaryKey: true }, { name: "Name" }],
    foreignKeys: []
  },
  playlist_track: {
    columns: [{ name: "PlaylistId" }, { name: "TrackId" }],
    foreignKeys: [
      { from: "PlaylistId", toTable: "playlists", toColumn: "PlaylistId" },
      { from: "TrackId", toTable: "tracks", toColumn: "TrackId" }
    ]
  },
  audit_logs: {
    columns: [{ name: "id", primaryKey: true }, { name: "log_msg" }],
    foreignKeys: []
  }
};

// P-U1: Small schemas (<= topK) are never pruned
const smallSchema = {
  users: { columns: [{ name: "id" }] },
  orders: { columns: [{ name: "id" }] }
};
const prunedSmall = pruneSchema(smallSchema, "how many orders?", { topK: 6 });
assert.deepStrictEqual(Object.keys(prunedSmall), ["users", "orders"], "P-U1 fail: schema <= topK should not prune");
console.log("✅ P-U1 PASS: Small schemas (<= topK) are not pruned");

// P-U2: Table name match scoring produces higher score than non-match
const scores = scoreTables(mockSchema, "Total revenue per country for customers");
assert(scores.get("customers") >= 10, "P-U2 fail: customers table should score >= 10");
assert(scores.get("customers") > scores.get("genres"), "P-U2 fail: customers should score higher than genres");
console.log("✅ P-U2 PASS: Table name match scoring works correctly");

// P-U3: Column name match scoring
const trackScore = scoreTables(mockSchema, "unitprice summary");
assert(trackScore.get("tracks") >= 3, "P-U3 fail: tracks table has unitprice column");
console.log("✅ P-U3 PASS: Column name match scoring works correctly");

// P-U4: Graph adjacency correctly builds undirected FK links
const graph = buildRelationshipGraph(mockSchema);
assert(graph.get("albums").has("artists"), "P-U4 fail: albums should connect to artists");
assert(graph.get("artists").has("albums"), "P-U4 fail: artists should connect to albums");
assert(graph.get("tracks").has("albums"), "P-U4 fail: tracks should connect to albums");
console.log("✅ P-U4 PASS: Relationship graph builds undirected FK connections");

// P-U5: Fallback when no tables score > 0 (returns topK tables + FK closure)
const fallbackPruned = pruneSchema(mockSchema, "xyzzy foobar completely unknown nonsense", { topK: 4 });
assert(Object.keys(fallbackPruned).length >= 4, "P-U5 fail: should contain at least topK fallback tables");
console.log("✅ P-U5 PASS: Fallback to topK when no tables match (tables:", Object.keys(fallbackPruned).length, ")");

// P-U6: Pure function — does not mutate input schema
const schemaClone = JSON.parse(JSON.stringify(mockSchema));
pruneSchema(mockSchema, "list all artists and tracks", { topK: 3 });
assert.deepStrictEqual(mockSchema, schemaClone, "P-U6 fail: pruneSchema must not mutate input schema");
console.log("✅ P-U6 PASS: pruneSchema is a pure function");

// P-U7: CRITICAL TRIPWIRE — FK Closure preserves intermediate join table
// When question mentions 'artists' and 'tracks', 'albums' has direct score 0,
// but MUST be included in the closure because it connects artists and tracks.
const artistTrackPruned = pruneSchema(mockSchema, "Which 5 artists have the most tracks?", { topK: 2 });
const prunedTableNames = Object.keys(artistTrackPruned);
console.log("Pruned tables for 'artists have the most tracks':", prunedTableNames);
assert(prunedTableNames.includes("artists"), "P-U7 fail: must include 'artists'");
assert(prunedTableNames.includes("tracks"), "P-U7 fail: must include 'tracks'");
assert(prunedTableNames.includes("albums"), "P-U7 fail: FK closure MUST include intermediate join table 'albums'!");
console.log("✅ P-U7 PASS: FK-closure preserves intermediate join table 'albums'!");

console.log("\nALL P-U1 to P-U7 TESTS PASSED!");
