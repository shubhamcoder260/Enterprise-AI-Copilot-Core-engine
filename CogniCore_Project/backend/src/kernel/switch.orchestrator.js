// ============================================================
// SWITCH ORCHESTRATOR — coordinates active data source switches
// and manages concurrent query leases to ensure zero-collision switches.
// ============================================================

import crypto from 'crypto';

let activeLeases = new Set();
let switchPending = false;
let switchDrainResolvers = [];

let activeSource = {
  id: "sqlite_default",
  kind: "sqlite",
  dialect: "sqlite",
  status: "active"
};

/**
 * Acquire a query lease before running a query against the active database.
 * If a database switch is currently in progress, blocks until switch completes.
 */
export async function acquireQueryLease() {
  while (switchPending) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  const leaseId = crypto.randomUUID();
  activeLeases.add(leaseId);

  // Auto-expire lease after 30 seconds to prevent permanent deadlock on abandoned requests
  const timer = setTimeout(() => {
    if (activeLeases.has(leaseId)) {
      console.warn(`⚠️ [Switch Orchestrator] Query lease ${leaseId} auto-expired after 30s timeout`);
      releaseQueryLease(leaseId);
    }
  }, 30000);

  return {
    leaseId,
    release: () => {
      clearTimeout(timer);
      releaseQueryLease(leaseId);
    }
  };
}

/**
 * Release a query lease after query execution completes (or fails).
 * Must be called in a finally block.
 */
export function releaseQueryLease(leaseId) {
  if (!leaseId) return;
  activeLeases.delete(leaseId);

  if (activeLeases.size === 0 && switchDrainResolvers.length > 0) {
    const resolvers = [...switchDrainResolvers];
    switchDrainResolvers = [];
    for (const r of resolvers) r();
  }
}

/**
 * Returns count of currently active leases.
 */
export function getActiveLeaseCount() {
  return activeLeases.size;
}

/**
 * Returns the currently active source descriptor.
 */
export function getActiveSource() {
  return { ...activeSource };
}

/**
 * Sets the active source descriptor (internal or testing).
 */
export function setActiveSource(source) {
  activeSource = { ...source };
}

/**
 * Safely switch to a new data source:
 * 1. Mark switch pending so new queries wait.
 * 2. Drain all in-flight query leases.
 * 3. Swap the active source descriptor.
 * 4. Notify waiting queries.
 */
export async function switchTo(newSourceDescriptor) {
  switchPending = true;

  try {
    if (activeLeases.size > 0) {
      await new Promise(resolve => {
        switchDrainResolvers.push(resolve);
      });
    }

    activeSource = {
      ...newSourceDescriptor,
      status: "active"
    };

    return { ...activeSource };
  } finally {
    switchPending = false;
  }
}

/**
 * Reset switch orchestrator state (for testing).
 */
export function resetOrchestratorState() {
  activeLeases.clear();
  switchPending = false;
  switchDrainResolvers = [];
  activeSource = {
    id: "sqlite_default",
    kind: "sqlite",
    dialect: "sqlite",
    status: "active"
  };
}
