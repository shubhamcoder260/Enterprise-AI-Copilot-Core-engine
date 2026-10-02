/**
 * Voice & Audio-Assisted Mark Entry Service (R4)
 * Provides speech-to-intent parsing, fuzzy roster matching, ambiguity handling,
 * and pre-commit validation.
 */

// Number words to integer mapping
const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100
};

/**
 * Convert spoken number phrases into numeric values
 * e.g., "forty two" -> 42, "thirty-eight" -> 38, "forty five point five" -> 45.5
 */
export function parseSpokenNumber(input) {
  if (typeof input === "number") return input;
  if (!input) return null;

  const clean = String(input).trim().toLowerCase().replace(/-/g, " ");

  // Direct number parse
  const directNum = parseFloat(clean);
  if (!isNaN(directNum) && String(directNum) === clean) {
    return directNum;
  }

  // Handle decimals like "forty two point five"
  const parts = clean.split(/\s+point\s+/);
  const wholePart = parts[0];
  const decimalPart = parts[1] || null;

  const words = wholePart.split(/\s+/);
  let total = 0;
  let current = 0;
  let matchedAny = false;

  for (const w of words) {
    if (NUMBER_WORDS[w] !== undefined) {
      matchedAny = true;
      const val = NUMBER_WORDS[w];
      if (val === 100) {
        current = (current === 0 ? 1 : current) * 100;
      } else if (val >= 20) {
        current += val;
      } else {
        current += val;
      }
    } else if (!isNaN(parseFloat(w))) {
      matchedAny = true;
      current += parseFloat(w);
    }
  }
  total += current;

  if (!matchedAny) {
    const fallback = parseFloat(input);
    return isNaN(fallback) ? null : fallback;
  }

  if (decimalPart) {
    const decWords = decimalPart.split(/\s+/);
    let decStr = "";
    for (const dw of decWords) {
      if (NUMBER_WORDS[dw] !== undefined) {
        decStr += NUMBER_WORDS[dw];
      } else if (!isNaN(parseInt(dw, 10))) {
        decStr += dw;
      }
    }
    if (decStr.length > 0) {
      return parseFloat(`${total}.${decStr}`);
    }
  }

  return total;
}

/**
 * Standard Levenshtein distance for fuzzy name matching
 */
function levenshteinDistance(s1, s2) {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  const track = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= str2.length; j += 1) track[j][0] = j;

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  return track[str2.length][str1.length];
}

/**
 * Calculate similarity ratio (0.0 to 1.0)
 */
function similarityScore(s1, s2) {
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, 1.0 - dist / maxLen);
}

/**
 * Split transcript into student entry clauses
 */
function splitTranscriptClauses(transcript) {
  if (!transcript || typeof transcript !== "string") return [];

  // Split on newlines, semicolons, or speech boundary markers ("next", "and then")
  const rawClauses = transcript
    .replace(/\b(?:and then|next student|next)\b/gi, ";")
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return rawClauses;
}

/**
 * Parse an individual clause into student identifier and mark
 * Supports:
 * - "Rahul Sharma, forty-two out of fifty"
 * - "roll twenty-three, thirty-eight"
 * - "roll number 104, 45 out of 50"
 * - "Sneha Rao, 48"
 */
function parseClause(clause, defaultMaxMarks = 50) {
  const clean = clause.trim();

  // Pattern: <Identifier>, <Mark> [out of <Max>]
  const commaMatch = clean.match(/^([^,]+),\s*(.+)$/i);
  if (commaMatch) {
    const rawIdentifier = commaMatch[1].trim();
    const rawMarkPart = commaMatch[2].trim();

    // Check for "out of"
    const outOfMatch = rawMarkPart.match(/^(.+?)\s+out of\s+(.+)$/i);
    let rawObtained = rawMarkPart;
    let rawMax = defaultMaxMarks;

    if (outOfMatch) {
      rawObtained = outOfMatch[1].trim();
      rawMax = parseSpokenNumber(outOfMatch[2]) || defaultMaxMarks;
    }

    const obtainedMarks = parseSpokenNumber(rawObtained);
    const maxMarks = typeof rawMax === "number" ? rawMax : parseSpokenNumber(rawMax) || defaultMaxMarks;

    return {
      rawIdentifier,
      obtainedMarks,
      maxMarks,
      validFormat: obtainedMarks !== null
    };
  }

  // Fallback pattern: Space separation with number at the end
  const tailMatch = clean.match(/^(.+?)\s+(\d+(?:\.\d+)?|\b(?:forty|thirty|twenty|fifty|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b.*)$/i);
  if (tailMatch) {
    const rawIdentifier = tailMatch[1].trim();
    const rawMarkPart = tailMatch[2].trim();
    const obtainedMarks = parseSpokenNumber(rawMarkPart);

    return {
      rawIdentifier,
      obtainedMarks,
      maxMarks: defaultMaxMarks,
      validFormat: obtainedMarks !== null
    };
  }

  return {
    rawIdentifier: clean,
    obtainedMarks: null,
    maxMarks: defaultMaxMarks,
    validFormat: false
  };
}

/**
 * Match a raw student identifier against a course roster
 * Priority:
 * 1. Roll number / Register number match
 * 2. Exact name match
 * 3. Fuzzy name match
 * 4. Ambiguity detection
 */
export function matchStudentToRoster(rawIdentifier, roster = []) {
  const cleanId = rawIdentifier.trim().toLowerCase();

  // 1. Check for Roll number / Register number pattern
  let rollNumberOnly = "";
  if (/\b(?:roll|roll number|register|reg|number|no)\b/i.test(cleanId)) {
    const rollExtract = cleanId.replace(/\b(?:roll|roll number|register|reg|number|no)\b/gi, "").trim();
    const parsedNum = parseSpokenNumber(rollExtract);
    if (parsedNum !== null && !isNaN(parsedNum)) {
      rollNumberOnly = String(Math.floor(parsedNum));
    } else {
      rollNumberOnly = rollExtract.replace(/\D/g, "");
    }
  } else if (/^\d+$/.test(cleanId.trim())) {
    rollNumberOnly = cleanId.trim();
  }

  if (rollNumberOnly.length > 0) {
    const rollMatch = roster.find((s) => {
      const regStr = String(s.register_number || "");
      return regStr === rollNumberOnly || regStr.endsWith(rollNumberOnly);
    });
    if (rollMatch) {
      return {
        matchedStudent: rollMatch,
        confidence: 1.0,
        matchType: "roll_number",
        isAmbiguous: false,
        ambiguousCandidates: []
      };
    }
  }

  // 2. Name Matching
  const cleanQueryName = cleanId
    .replace(/\b(?:roll|roll number|register|reg|number|no)\b/gi, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Check for prefix ambiguity (e.g. "Rahul Sharma" and "Rahul Sharma Jr.")
  const prefixMatches = roster.filter((s) => {
    const fn = `${s.first_name} ${s.last_name}`.trim().toLowerCase();
    return fn === cleanQueryName || fn.startsWith(cleanQueryName + " ") || cleanQueryName.startsWith(fn + " ");
  });

  if (prefixMatches.length > 1) {
    return {
      matchedStudent: null,
      confidence: 0.95,
      matchType: "ambiguous",
      isAmbiguous: true,
      ambiguousCandidates: prefixMatches
    };
  }

  const scoredCandidates = roster.map((s) => {
    const fullName = `${s.first_name} ${s.last_name}`.trim().toLowerCase();
    const reverseName = `${s.last_name} ${s.first_name}`.trim().toLowerCase();
    const firstName = (s.first_name || "").toLowerCase();
    const lastName = (s.last_name || "").toLowerCase();

    // Exact matches
    if (fullName === cleanQueryName || reverseName === cleanQueryName) {
      return { student: s, score: 1.0 };
    }
    if (firstName === cleanQueryName || lastName === cleanQueryName) {
      return { student: s, score: 0.9 };
    }

    // Levenshtein similarity on full name
    const fullScore = similarityScore(cleanQueryName, fullName);
    const revScore = similarityScore(cleanQueryName, reverseName);
    const bestScore = Math.max(fullScore, revScore);

    return { student: s, score: Number(bestScore.toFixed(3)) };
  });

  // Sort descending by score
  scoredCandidates.sort((a, b) => b.score - a.score);

  const topMatch = scoredCandidates[0];
  const secondMatch = scoredCandidates[1];

  if (!topMatch || topMatch.score < 0.4) {
    return {
      matchedStudent: null,
      confidence: 0,
      matchType: "none",
      isAmbiguous: false,
      ambiguousCandidates: []
    };
  }

  // Ambiguity Detection for close fuzzy scores
  const isAmbiguous =
    secondMatch &&
    topMatch.score >= 0.70 &&
    secondMatch.score >= 0.70 &&
    Math.abs(topMatch.score - secondMatch.score) <= 0.15;

  const ambiguousCandidates = isAmbiguous
    ? scoredCandidates.filter((c) => c.score >= topMatch.score - 0.15).map((c) => c.student)
    : [];

  return {
    matchedStudent: isAmbiguous ? null : topMatch.student,
    confidence: topMatch.score,
    matchType: isAmbiguous ? "ambiguous" : topMatch.score >= 0.9 ? "exact_name" : "fuzzy_name",
    isAmbiguous,
    ambiguousCandidates
  };
}

/**
 * Main Entry Point: Parse Speech Transcript into Verified Batch Entries
 */
export function parseVoiceMarksBatch(transcript, roster = [], defaultMaxMarks = 50) {
  const clauses = splitTranscriptClauses(transcript);
  const results = [];

  for (const clause of clauses) {
    const parsed = parseClause(clause, defaultMaxMarks);
    const match = matchStudentToRoster(parsed.rawIdentifier, roster);

    let hasRangeError = false;
    let rangeErrorMsg = null;
    let isOverwrite = false;
    let previousMark = null;

    // Range Check: 0 <= mark <= max
    if (parsed.obtainedMarks !== null) {
      if (parsed.obtainedMarks < 0 || parsed.obtainedMarks > parsed.maxMarks) {
        hasRangeError = true;
        rangeErrorMsg = `Mark ${parsed.obtainedMarks} exceeds valid range (0 - ${parsed.maxMarks})`;
      }
    }

    // Overwrite Check
    if (match.matchedStudent && match.matchedStudent.current_mark !== undefined && match.matchedStudent.current_mark !== null) {
      isOverwrite = true;
      previousMark = match.matchedStudent.current_mark;
    }

    results.push({
      originalClause: clause,
      rawIdentifier: parsed.rawIdentifier,
      obtainedMarks: parsed.obtainedMarks,
      maxMarks: parsed.maxMarks,
      matchedStudent: match.matchedStudent,
      confidence: match.confidence,
      matchType: match.matchType,
      isAmbiguous: match.isAmbiguous,
      ambiguousCandidates: match.ambiguousCandidates,
      hasRangeError,
      rangeErrorMsg,
      isOverwrite,
      previousMark,
      requiresReview: match.isAmbiguous || hasRangeError || isOverwrite || match.confidence < 0.75
    });
  }

  return {
    totalEntries: results.length,
    validEntries: results.filter((r) => r.matchedStudent && !r.hasRangeError && !r.isAmbiguous).length,
    needsAttention: results.filter((r) => r.requiresReview).length,
    entries: results
  };
}
