#!/bin/bash
for f in verify_college_attendance verifyLlm1ValidatorSecurity verifyConnLifecycle verifyPipelineOverride verifyGateIntegrity verifyBypass; do
  echo "════ $f"; node "test/$f.js" > /tmp/litmus-$f.log 2>&1 && echo "  ✅" || { echo "  ❌ FAILED — see /tmp/litmus-$f.log"; exit 1; }
done
echo "🏆 FULL REGRESSION GREEN"
