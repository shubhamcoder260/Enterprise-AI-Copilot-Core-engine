// ============================================================================
// VERIFICATION BATTERY — Grounding & Arithmetic Lie Detector (CAP v2.2 §217, §282)
//
// Proves:
//   1. Ungrounded numeric hallucinations are flagged (cannot invent phantom numbers).
//   2. Hallucinated arithmetic (bad sums, fake averages) is caught and rejected.
//   3. Honest grounded responses pass cleanly.
//   4. Query-level temporal/limit anchors are recognized as valid grounding context.
//   5. Self-consistency sampling consensus threshold is enforced.
//   6. End-to-end verification chain envelope and honest disclaimer behavior.
// ============================================================================

import assert from "node:assert/strict";
import {
  extractNumericTokens,
  verifyGrounding,
  verifyArithmetic,
  verifySelfConsistency,
  runVerificationChain
} from "../src/kernel/verify.chain.js";

async function runLieDetectorTests() {
  console.log("==================================================");
  console.log("   STEP D4e — LIE-CATCHING & GROUNDING BATTERY    ");
  console.log("==================================================");

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
    }
  }

  // TEST 1: Extract numeric tokens correctly
  test("Token Extraction: captures currency, percentages, floats, integers", () => {
    const text = "Total payroll is $85,000.50, up 12.5% from 2023's $75,000 across 4 employees.";
    const tokens = extractNumericTokens(text);
    assert.strictEqual(tokens.length, 5);
    assert.strictEqual(tokens[0].value, 85000.50);
    assert.strictEqual(tokens[0].isCurrency, true);
    assert.strictEqual(tokens[1].value, 12.5);
    assert.strictEqual(tokens[1].isPercentage, true);
    assert.strictEqual(tokens[2].value, 2023);
    assert.strictEqual(tokens[3].value, 75000);
    assert.strictEqual(tokens[4].value, 4);
  });

  // TEST 2: Grounding catches phantom hallucinated numbers
  test("Grounding Lie Detector: catches ungrounded phantom bonus ($15,000)", () => {
    const rawRecords = [
      { employee: "EMP-002", name: "Devon Vance", net_pay: 14000.00 }
    ];
    const query = "What is my salary?";
    const hallucinatedAnswer = "Your salary is $14,000.00 and you received a special bonus of $15,000.00!";

    const check = verifyGrounding(hallucinatedAnswer, rawRecords, query);
    assert.strictEqual(check.passed, false, "Should fail grounding check");
    assert.strictEqual(check.ungroundedTokens.length, 1);
    assert.strictEqual(check.ungroundedTokens[0].value, 15000);
    console.log(`   🛡️ Trapped ungrounded claim: ${check.reason}`);
  });

  // TEST 3: Grounded response passes cleanly
  test("Grounding Verification: honest response with record values passes", () => {
    const rawRecords = [
      { employee: "EMP-002", name: "Devon Vance", net_pay: 14000.00 }
    ];
    const query = "What is my salary?";
    const honestAnswer = "Found 1 record(s) matching your request. Net pay is $14,000.00.";

    const check = verifyGrounding(honestAnswer, rawRecords, query);
    assert.strictEqual(check.passed, true, "Grounded response must pass");
    assert.strictEqual(check.ungroundedTokens.length, 0);
  });

  // TEST 4: Query anchor numbers (years, limits) are valid grounding sources
  test("Grounding Verification: query temporal anchor (2024) and limit (5) recognized", () => {
    const rawRecords = [
      { department: "Sales", attendance: 92.5 }
    ];
    const query = "Show top 5 departments in 2024 by attendance";
    const honestAnswer = "Top 5 results for 2024: Sales department has 92.5% attendance.";

    const check = verifyGrounding(honestAnswer, rawRecords, query);
    assert.strictEqual(check.passed, true, "Query anchors must be accepted as grounded context");
  });

  // TEST 5: Arithmetic Lie-Detector catches LLM hallucinated sum
  test("Arithmetic Lie Detector: catches hallucinated total sum", () => {
    const rawRecords = [
      { employee: "EMP-001", net_pay: 35000.00 },
      { employee: "EMP-002", net_pay: 14000.00 },
      { employee: "EMP-003", net_pay: 18000.00 },
      { employee: "EMP-004", net_pay: 18000.00 }
    ];
    // True sum = 85000.00
    const fakeMathAnswer = "The total payroll for the company is $98,500.00 across 4 employees.";

    const check = verifyArithmetic(fakeMathAnswer, rawRecords, "SUM");
    assert.strictEqual(check.passed, false, "Arithmetic check must fail on fake sum");
    assert.strictEqual(check.expected, 85000);
    assert.strictEqual(check.actual, 98500);
    console.log(`   🛡️ Trapped math hallucination: ${check.reason}`);
  });

  // TEST 6: Arithmetic verification passes when LLM math matches ground truth
  test("Arithmetic Verification: accurate sum matches physical records", () => {
    const rawRecords = [
      { employee: "EMP-001", net_pay: 35000.00 },
      { employee: "EMP-002", net_pay: 14000.00 },
      { employee: "EMP-003", net_pay: 18000.00 },
      { employee: "EMP-004", net_pay: 18000.00 }
    ];
    const trueMathAnswer = "The total payroll for the company is $85,000.00 across 4 employees.";

    const check = verifyArithmetic(trueMathAnswer, rawRecords, "SUM");
    assert.strictEqual(check.passed, true, "Accurate arithmetic must pass");
  });

  // TEST 7: Arithmetic Lie Detector catches hallucinated average
  test("Arithmetic Lie Detector: catches fake average", () => {
    const rawRecords = [
      { department: "Support", resolution_hours: 10 },
      { department: "Sales", resolution_hours: 20 }
    ];
    // True avg = 15
    const fakeAvgAnswer = "The average resolution time is 35 hours across all departments.";

    const check = verifyArithmetic(fakeAvgAnswer, rawRecords, "AVG");
    assert.strictEqual(check.passed, false, "Arithmetic check must fail on bad average");
    assert.strictEqual(check.expected, 15);
  });

  // TEST 8: Self-consistency consensus sampling
  test("Self-Consistency Sampling: catches conflicting samples (split vote)", () => {
    const samples = [
      "The total is $85,000.",
      "The total is $72,000.",
      "The total is $90,000."
    ];
    const check = verifySelfConsistency(samples, { threshold: 0.6 });
    assert.strictEqual(check.passed, false, "Split vote should fail consensus threshold");
  });

  test("Self-Consistency Sampling: passes on high consensus (agreement ratio >= 0.66)", () => {
    const samples = [
      "The total is $85,000.",
      "The total is $85,000.",
      "The total is $85,000.",
      "The total is $72,000."
    ];
    const check = verifySelfConsistency(samples, { threshold: 0.6 });
    assert.strictEqual(check.passed, true, "Majority agreement should pass consensus");
    assert.strictEqual(check.consensus, 85000);
    assert.strictEqual(check.agreementRatio, 0.75);
  });

  // TEST 9: Full Verification Chain integration
  test("Full Verification Chain: attaches honest warning notice on ungrounded assertion", () => {
    const rawRecords = [
      { employee: "EMP-002", net_pay: 14000.00 }
    ];
    const hallucinated = runVerificationChain({
      answer: "Net pay is $14,000.00 plus guaranteed 50000 bonus.",
      records: rawRecords,
      query: "Show my salary"
    });

    assert.strictEqual(hallucinated.verified, false);
    assert.ok(hallucinated.honestNotice.includes("Verification Warning"));
    assert.ok(hallucinated.details.grounding.ungroundedTokens.length > 0);
  });

  console.log("==================================================");
  console.log(`LIE DETECTOR BATTERY RESULTS: ${passed}/${total} PASSED`);
  if (passed === total) {
    console.log("🏆 ALL GROUNDING & ARITHMETIC LIE DETECTOR TESTS GREEN");
    console.log("==================================================");
  } else {
    console.error(`💥 ${total - passed} TESTS FAILED`);
    process.exit(1);
  }
}

runLieDetectorTests().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
