#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const root=process.cwd(),src=path.join(root,"src","lib"),out=path.join(root,".gotrader","lrs-r1-trial-controls-test");
compileTypescriptModules({outRoot:out,files:["strategyLibrary/liquidityReclaimScalper/liquidityReclaimScalperR1TrialControls.ts"].map(file=>path.join(src,file))});
const controls=await import(`${pathToFileURL(path.join(out,"liquidityReclaimScalperR1TrialControls.mjs")).href}?t=${Date.now()}`);
const first=await controls.buildLrsR1TrialDefinitions(),second=await controls.buildLrsR1TrialDefinitions();
assert.equal(first.length,128); assert.deepEqual(first,second); assert.deepEqual(first.map(item=>item.ordinal),Array.from({length:128},(_,i)=>i));
assert.equal(first.every(item=>item.sampleIndex===1730+64+item.ordinal),true);
assert.equal(first.every(item=>item.authority.executionAuthority==="none"&&item.capabilities.canPlaceOrder===false),true);
assert.equal(first.every(item=>/^sha256:[0-9a-f]{64}$/.test(item.parameterHash)&&/^sha256:[0-9a-f]{64}$/.test(item.trialId)),true);
assert.equal(new Set(first.map(item=>item.trialId)).size,128); assert.ok(new Set(first.map(item=>item.parameterHash)).size<=128);
for(const item of first.filter(item=>item.initialDisposition==="coalesced_duplicate")) assert.match(item.duplicateOfTrialId,/^sha256:[0-9a-f]{64}$/);
const attempted=await controls.buildLrsR1TrialEvent({trialId:first[0].trialId,sequence:0,disposition:"attempted",recordedAtUtc:"2026-08-14T00:00:00.000Z",reasonCodes:[],evidenceIds:[]});
const completed=await controls.buildLrsR1TrialEvent({trialId:first[0].trialId,sequence:1,disposition:"completed",recordedAtUtc:"2026-08-14T00:01:00.000Z",reasonCodes:[],evidenceIds:["sha256:"+"8".repeat(64)],previousEventId:attempted.eventId});
assert.notEqual(attempted.eventId,completed.eventId); assert.equal(completed.previousEventId,attempted.eventId);
const files=new Map(); const storage={readText:async key=>files.get(key),writeTextAtomic:async(key,value)=>files.set(key,value)};
const repo=new controls.LrsR1TrialControlRepository(storage); await repo.writeTrial(first[0]); await repo.writeTrial(first[0]); await repo.writeEvent(attempted);
await assert.rejects(repo.writeTrial({...first[0],ordinal:1}),/conflict/);
const checkpoint=await repo.writeCheckpoint({nextTrialOrdinal:1,orderedTrialIds:[first[0].trialId],orderedEventIds:[attempted.eventId],controllerCommit:"6506b11b9ea14a80d63500448621e5e5501fd860"});
assert.deepEqual(await repo.readCheckpoint(),checkpoint); assert.equal(checkpoint.executionAuthorized,false);
files.set("checkpoints/current.json",files.get("checkpoints/current.json").replace('"nextTrialOrdinal":1','"nextTrialOrdinal":2'));
await assert.rejects(repo.readCheckpoint(),/integrity/);
await assert.rejects(controls.buildLrsR1Checkpoint({nextTrialOrdinal:129,orderedTrialIds:[],orderedEventIds:[],controllerCommit:"6506b11b9ea14a80d63500448621e5e5501fd860"}),/budget/);
console.log(JSON.stringify({status:"passed",attempts:first.length,uniqueParameters:new Set(first.map(item=>item.parameterHash)).size,
  duplicateAttempts:first.filter(item=>item.initialDisposition==="coalesced_duplicate").length,firstTrialId:first[0].trialId,
  checkpointIntegrity:true,executionAuthorized:false,authority:"none/none/none"},null,2));
