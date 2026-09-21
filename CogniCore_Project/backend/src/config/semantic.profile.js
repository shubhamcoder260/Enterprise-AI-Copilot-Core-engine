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
      match: /absent\w*\s*(percentage|pct|rate)/i,
      base: /attend|present/i,
      baseRate: /percentage|pct|rate/i,
      expr: (col) => `(100.0 - AVG("${col}"))`,
      veto: /no\.?\s*of|number\s*of|more\s*than|less\s*than|days?|\d+/i
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
