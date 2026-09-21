// ==========================================
// SEMANTIC PROFILE CONFIGURATION
//
// Adapting CogniCore to a new enterprise domain must always be achieved by
// adding profile configuration data, not by modifying the core query engine
// (honoring architectural Promise #4 at the line level). Domain-specific
// derivation rules, status criteria markers, and scalar ID conventions are
// declared here as frozen-shaped profile definitions.
// ==========================================

export const SEMANTIC_PROFILE = Object.freeze({
  derivations: [
    {
      // NOTE: the absent-family gate lives in fastIntent's wantAbsent branch;
      // this rule adds the rate-word requirement (ANYWHERE, as in A1 original)
      // and the quantity/threshold veto (word boundaries RESTORED verbatim).
      requiresRateWord: /\b(?:percentage|pct|rate)\b/i,
      veto: /\b(?:no.?\sof|number\sof|more\sthan|less\sthan|days?|\d+)\b/i,
      base: /attend|present/i,
      baseRate: /percentage|pct|rate/i,
      expr: (col) => `(100.0 - AVG("${col}"))`
    }
  ],
  statusMarkers: [
    /\bwhere\b/i,
    /\benrolled\b/i,
    /\bborn\b/i,
    /\bfrom\b/i,
    /\bin the year\b/i,
    /\bcompleted\b/i,
    /\bpending\b/i,
    /\bactive\b/i,
    /\binactive\b/i,
    /\bpaid\b/i,
    /\bunpaid\b/i,
    /\bpregnant\b/i,
    /\bradiology\b/i
  ],
  scalarIdNames: ["id", "student_id", "emp_id", "patient_id", "user_id"]
});
