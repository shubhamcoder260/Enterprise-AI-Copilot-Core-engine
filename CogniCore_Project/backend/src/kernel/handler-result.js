// ============================================================
// HANDLER RESULT — the only vocabulary engine links may speak.
// Frozen contract: every link returns exactly ONE of these.
//   ANSWERED(response) → stop cascade, return response to user
//   PASS(reason)       → expected miss; quiet log; cascade
//   ABSTAIN(reason)    → declined for a REASON (interim: cascades like PASS;
//                        step 5.5 routes on the reason — see O15)
//   BUG(reason, err)   → unexpected failure; LOUD log; cascade anyway
// Law: expected failure stays quiet; real bugs get loud; nothing crashes.
// ============================================================

export const ANSWERED = (response) => ({ status: "ANSWERED", response });
export const PASS = (reason, extra) => ({ status: "PASS", reason, ...extra });
export const ABSTAIN = (reason) => ({ status: "ABSTAIN", reason });
export const BUG = (reason, err) => ({ status: "BUG", reason, err: err?.message || String(err) });

// True when the shape was produced by this module (loop uses this during migration).
export const isHandlerResult = (o) => o && typeof o.status === "string" &&
  ["ANSWERED", "PASS", "ABSTAIN", "BUG"].includes(o.status);

