import {
  parseSpokenNumber,
  matchStudentToRoster,
  parseVoiceMarksBatch
} from "../src/services/voice.mark.service.js";

async function runTests() {
  console.log("==================================================");
  console.log("   STEP 2 VERIFICATION — VOICE MARK SERVICE (R4)  ");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // --- TEST 1: Spoken Number Parsing ---
  assert(parseSpokenNumber("forty two") === 42, "Parses 'forty two' as 42");
  assert(parseSpokenNumber("thirty-eight") === 38, "Parses 'thirty-eight' as 38");
  assert(parseSpokenNumber("forty five point five") === 45.5, "Parses 'forty five point five' as 45.5");
  assert(parseSpokenNumber("50") === 50, "Parses numeric string '50' as 50");
  assert(parseSpokenNumber("zero") === 0, "Parses 'zero' as 0");

  // Sample course roster for testing
  const mockRoster = [
    { student_id: 1, register_number: "2026030023", first_name: "Aarav", last_name: "Patel", current_mark: null },
    { student_id: 2, register_number: "2026030045", first_name: "Nisha", last_name: "Das", current_mark: 35.0 },
    { student_id: 3, register_number: "2026030067", first_name: "Vivek", last_name: "Reddy", current_mark: null },
    // Ambiguity pair
    { student_id: 4, register_number: "2026030088", first_name: "Rahul", last_name: "Sharma", current_mark: null },
    { student_id: 5, register_number: "2026030089", first_name: "Rahul", last_name: "Sharma Jr", current_mark: null }
  ];

  // --- TEST 2: Roll Number Matching ---
  const rollMatch = matchStudentToRoster("roll twenty-three", mockRoster);
  assert(rollMatch.matchedStudent !== null && rollMatch.matchedStudent.student_id === 1, "Matches roll number 23 to student Aarav Patel");
  assert(rollMatch.matchType === "roll_number", "Tag is 'roll_number'");

  // --- TEST 3: Exact & Fuzzy Name Matching ---
  const exactMatch = matchStudentToRoster("Vivek Reddy", mockRoster);
  assert(exactMatch.matchedStudent !== null && exactMatch.matchedStudent.student_id === 3, "Exact name matches Vivek Reddy");

  const fuzzyMatch = matchStudentToRoster("Vivak Redy", mockRoster);
  assert(fuzzyMatch.matchedStudent !== null && fuzzyMatch.matchedStudent.student_id === 3, "Fuzzy match identifies 'Vivak Redy' as Vivek Reddy");
  assert(fuzzyMatch.confidence > 0.8, `Fuzzy confidence is high (${fuzzyMatch.confidence})`);

  // --- TEST 4: Explicit Ambiguity Resolution (Rahul Sharma vs Rahul Sharma Jr.) ---
  const ambigMatch = matchStudentToRoster("Rahul Sharma", mockRoster);
  assert(ambigMatch.isAmbiguous === true, "Flags ambiguous match when both 'Rahul Sharma' and 'Rahul Sharma Jr' exist");
  assert(ambigMatch.ambiguousCandidates.length === 2, `Provides both candidates for professor selection (${ambigMatch.ambiguousCandidates.length} candidates)`);
  assert(ambigMatch.matchedStudent === null, "Does NOT auto-assign student when ambiguous (requires human choice)");

  // --- TEST 5: Batch Spoken Transcript Parsing (5 marks in 1 recording) ---
  const spokenTranscript = `
    Aarav Patel, forty-two out of fifty;
    Nisha Das, fifty-five out of fifty;
    roll sixty-seven, thirty-eight;
    Rahul Sharma, forty;
    Vivak Redy, forty-four point five
  `;

  const batchResult = parseVoiceMarksBatch(spokenTranscript, mockRoster, 50);
  assert(batchResult.totalEntries === 5, `Parsed exactly 5 student clauses (total: ${batchResult.totalEntries})`);

  // Verify Entry 1: Aarav Patel (valid 42/50)
  const e1 = batchResult.entries[0];
  assert(e1.matchedStudent.first_name === "Aarav" && e1.obtainedMarks === 42, "Entry 1: Aarav Patel parsed with 42/50");
  assert(e1.hasRangeError === false, "Entry 1: No range error");

  // Verify Entry 2: Nisha Das (55/50 -> Out of range error!)
  const e2 = batchResult.entries[1];
  assert(e2.hasRangeError === true, "Entry 2: Caught out-of-range mark (55 > 50)");
  assert(e2.isOverwrite === true, "Entry 2: Caught overwrite warning (previous mark was 35.0)");

  // Verify Entry 3: Roll 67 -> Vivek Reddy (38/50)
  const e3 = batchResult.entries[2];
  assert(e3.matchedStudent.first_name === "Vivek" && e3.obtainedMarks === 38, "Entry 3: Roll 67 resolved to Vivek Reddy with 38/50");

  // Verify Entry 4: Rahul Sharma -> Ambiguous!
  const e4 = batchResult.entries[3];
  assert(e4.isAmbiguous === true, "Entry 4: Rahul Sharma requires manual disambiguation");

  // Verify Entry 5: Fuzzy Vivak Redy -> 44.5
  const e5 = batchResult.entries[4];
  assert(e5.matchedStudent.first_name === "Vivek" && e5.obtainedMarks === 44.5, "Entry 5: Fuzzy Vivak Redy matched to Vivek Reddy with 44.5");

  console.log("==================================================");
  console.log(`STEP 2 RESULT: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log("🏆 MILESTONE 2 VERIFIED 100% GREEN");
  }
  console.log("==================================================");
  process.exit(failed);
}

runTests().catch((err) => {
  console.error("FATAL ERROR in verify_voice_mark_service.js:", err);
  process.exit(1);
});
