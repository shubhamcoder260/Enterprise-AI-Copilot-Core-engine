#!/bin/bash
# LITMUS #6 — THE CANONICAL REGRESSION SET (base-complete definition)
# Usage: bash test/verifyFullRegression.sh   (server must be running)
cd "$(dirname "$0")"
PASS=0; FAIL=0
for f in \
  verify_college_attendance \
  verifyLlm1ValidatorSecurity \
  verifyConnLifecycle \
  verifyPipelineOverride \
  verifyGateIntegrity \
  verifyBypass \
  verifyLitmusNewTool \
  verifyTraceEvidence \
  verify_unpolicied_table_rls \
  verifyFastIntentGolden \
  verifyGateSelector \
  verifyRlsPolicyGolden \
  verify_rls_live_pipeline \
  verifyWriteTemplates \
  verifyRlsWritePolicyGolden \
  verify_action_audit_log \
  verify_action_gateway_lifecycle \
  verify_live_action_demo; do
  echo "════ $f"
  node "$f.js" > "/tmp/litmus-$f.log" 2>&1 && { echo "  ✅"; PASS=$((PASS+1)); } \
    || { echo "  ❌ FAILED — see /tmp/litmus-$f.log"; FAIL=$((FAIL+1)); }
done
echo "══════════════════════════"
echo "REGRESSION: $PASS passed, $FAIL failed ($PASS/$((PASS+FAIL)))"
[ $FAIL -eq 0 ] && echo "🏆 FULL REGRESSION GREEN — BASE HOLDS (18/18)" || echo "🚨 BASE INTEGRITY BREACH"
exit $FAIL
