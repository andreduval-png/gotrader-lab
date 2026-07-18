#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  classifyGoTraderReadiness,
  compactSupervisorDiagnostics,
  gotraderSupervisorAuthority
} from "./gotrader-supervisor-core.mjs";
import {
  diagnoseService,
  isPidAlive,
  serviceDefinitions,
  stackDir
} from "./local-stack-utils.mjs";

const supervisorStatePath = path.join(stackDir, "supervisor.json");
let supervisor;
try {
  supervisor = JSON.parse(await fs.readFile(supervisorStatePath, "utf8"));
} catch {
  supervisor = undefined;
}

const diagnostics = [];
for (const service of serviceDefinitions) {
  diagnostics.push(await diagnoseService(service));
}

const readiness = classifyGoTraderReadiness(diagnostics);
const supervisorAlive = Boolean(supervisor?.pid && isPidAlive(supervisor.pid));
const result = {
  status: readiness.status,
  supervisor: {
    running: supervisorAlive,
    pid: supervisorAlive ? supervisor.pid : undefined,
    startedAt: supervisor?.startedAt,
    lastHealthCheckAt: supervisor?.updatedAt,
    recoveryAttempts: supervisor?.recoveryAttempts ?? 0
  },
  blockers: readiness.blockers,
  warnings: readiness.warnings,
  services: compactSupervisorDiagnostics(diagnostics),
  ...gotraderSupervisorAuthority
};

console.log("GoTrader unified launcher status");
console.log(JSON.stringify(result, null, 2));
