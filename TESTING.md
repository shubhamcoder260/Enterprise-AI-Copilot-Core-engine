# Testing — Evidence Culture
36+ verification scripts in CogniCore_Project/backend/test/
Canonical regression (server running): bash test/verifyFullRegression.sh → 8 suites:
college acceptance 6/6 · validator security 37/37 · conn lifecycle 20/20 · pipeline override
2/2 · gate integrity · bypass · litmus new-tool · trace evidence.
Benchmarks: runPartDEcommerceBenchmark.js · verifyErpGroundTruth.js (measured 3/6).
Specimens: 9 captured silent-wrong cases (S1–S9) — golden regression set for the honesty
guards (in development).
