#!/bin/bash
# LITMUS #6 — THE CANONICAL REGRESSION SET (base-complete definition)
# Usage: bash test/verifyFullRegression.sh   (server must be running)
cd "$(dirname "$0")"
export VAULT_MASTER_KEY="${VAULT_MASTER_KEY:-cognicore_production_vault_master_key_2026_aes256gcm}"
PASS=0; FAIL=0
for f in \
  verify_college_attendance \
  verifyLlm1ValidatorSecurity \
  verifyConnLifecycle \
  verifyPipelineOverride \
  verifyGateIntegrity \
  verifyBypass \
  verifyLitmusGeneralization \
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
  verify_live_action_demo \
  verify_live_docstatus_wiring \
  verify_credential_vault \
  verify_source_persistence \
  verify_test_connection_endpoint \
  verify_grant_script_generator \
  verify_auto_provisioning \
  verify_source_crud_api \
  verify_dynamic_source_e2e; do
  echo "════ $f"
  node "$f.js" > "/tmp/litmus-$f.log" 2>&1 && { echo "  ✅"; PASS=$((PASS+1)); } \
    || { echo "  ❌ FAILED — see /tmp/litmus-$f.log"; FAIL=$((FAIL+1)); }
done
echo "══════════════════════════"
echo "REGRESSION: $PASS passed, $FAIL failed ($PASS/$((PASS+FAIL)))"
[ $FAIL -eq 0 ] && echo "🏆 FULL REGRESSION GREEN — BASE HOLDS (26/26)" || echo "🚨 BASE INTEGRITY BREACH"
exit $FAIL
