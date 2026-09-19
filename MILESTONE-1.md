# Grok Bot Agent → Persistent Codex App Server — M1

## Status and ownership

**Production activation is complete through Gate 2C.** Gate 1 created the isolated
BOX pilot; Gate 2A staged the patched Codex/Runtime; Gate 2B promoted them; Gate 2C
installed the router/config, wrote the pristine host backup, applied the verified
`a5b5d79` host patch and performed exactly one Sand-supervisor restart.
The first pilot Turn was later separately Human-approved and executed exactly once.
It produced a stock-inference response but did **not** enter the Runtime/Codex route;
no retry was sent. No Gate-2C provider/model inference was performed; the first
post-Gate-2C pilot attempt is recorded separately below.

The fork is `rcnir/grok-codex-router`, with `upstream` pointing to
`IgorWarzocha/grok-codex-router`. The implementation branch is
`rcnir/milestone-1-20260919`, based exactly on
`599a2013b15592d17fe897126f549974351e4c3f`.
The companion Runtime branch is `agent/grok-router-m1-20260919` in
`rcnir/execution-runtime`, based exactly on merged
`de20bf8f756e0fc2d8b276adb53893bc76066c51`.
The accepted router package built from this branch is now live through Gate 2C,
and the Gate-2B Runtime/Codex candidate remains live. Intelligence/D1/Cloudflare
were not changed by M1 activation.

The source-only continuation adds the pinned Codex thread-local
`toolIsolation:"dynamicOnly"` contract, Runtime schema-backed capability and
effective-policy recovery checks. The 400 selected Codex tests passed, including
enabled MCP refresh and Legacy/Paginated persistent resume/fork. The 0.57
host compatibility snapshot is independently accepted read-only in
`HOST-057-EVIDENCE-20260919.json`; `DYNAMIC-ONLY-EVIDENCE-20260919.json` remains
the Blocker 1 source record, and `EVIDENCE-M1-20260919.json` remains historical.

The Runtime continuation preserves the subsequent docs-only commit `71eaefab...`
already present after the saved `8b565576...` candidate. No branch/worktree or
execution-plane replacement is introduced.

## Active source path

`src/session.ts` retains the PromptSession/PromptExecutor interface. Its only
inference implementation is `src/runtime-execution.ts` through
`src/runtime-client.ts`. The client invokes the assigned absolute Runtime
`entrypoint.py client` over the fixed socket
`/run/rcnir-codex-runtime/mcp.sock`. It never invokes the daemon/runtime/schema
launcher modes, a shell, `codex`, or a provider HTTP endpoint.

`src/message-wire.ts` and `src/tool-wire.ts` retain the upstream conversion
structure. `src/runtime-wire.ts` adds strict Runtime semantics: schema conversion,
complete supported transcript validation, exact tool IDs, current user text/image,
tool text/image/failure results. Unsupported content fails before dispatch rather
than being silently discarded. Prior transcript is injected once through
`runtime_session_inject_items`; current user content starts the Turn.

Each PromptExecutor/inference run lazily owns one thread, while all of them use
the already-persistent shared App Server process. Thread creation occurs only
after readiness, capability, persistence, pending-input, UNKNOWN and native-policy
checks. A tool loop resumes the **same Turn** via `runtime_respond`; it does not
create another Turn or thread. A terminal result is checked against the durable
Runtime operation before the thread is archived and the admission fence released.

`callId` is the Grok-facing exact call identity. The JSON-RPC `request_id` plus
`generation` is the separate Runtime response identity. Both are retained and
checked. Numeric `42` and string `"42"` are distinct. Validate an entire returned
tool batch before replying to its first request. Duplicate/mismatched call IDs,
request identities, generations or tool sets fence the run.

## Routing policy

Both `enabled:true` and membership in `pilot.agentIds` are necessary. The source
allowlist now contains exactly the approved immutable pilot ID
`97cf83a0-0401-4481-9f3f-8b321921f8b0`; its source route is fixed to
`chatgpt-web/extra-high / xhigh`. `DEFAULT_CONFIG.enabled` remains `false`, so this
binding alone cannot activate routing. A legacy
entry in `agents` is a model route, **not** pilot authorization. The wrapper reads
only the exact selected agent profile and requires lowercase `harness:"box"`.
It rejects a group profile. Conversation/transcript identity and explicit root
classifiers are required; missing or unknown classifiers fail closed. All excluded
workloads return stock before creating a router session.

Default configuration is disabled with that one inert pilot binding. The CLI's old
install/on/recover/verify/restart/control verbs are blocked. `off` edits only router
configuration, never Bot profiles. Retained control/supervisor/recovery/diagnostics
and transport sources are upstream comparison surfaces, not activated services.
The package entrypoint dependency test excludes OAuth, transport, old turn execution
and control-service imports. No control service is to be bootstrapped by the M1 hook.

## Durable no-replay contract

`src/runtime-state.ts` stores only identities, hashes and operation status in
private files. It acquires an exclusive filesystem lock, persists SENT before
dispatch, uses atomic fsynced file replacement, and preserves UNKNOWN/BLOCKED or
pending state after restart. There is no stale-lock takeover, retry loop, automatic
resend, journal reset or recovery inference. A changed invocation ID cannot bypass
an active run. A completed invocation cannot be replayed via a new executor ordinal.

Cancellation issues one journaled interrupt for the existing Turn and observes
the interrupted terminal before release. Unknown cancellation is not repeated.
Changing consumed history or assistant tool echoes is rejected. An omitted echo
is allowed only because exact pending identities, not a reconstructed new Turn,
remain authoritative.

Only `item/reasoning/summaryTextDelta` becomes a reasoning summary. Raw reasoning,
private encrypted state and invalid (`known:false`) events never become output.
Answer selection comes from the durable terminal's final-answer item, including
an explicitly blank final. Commentary cannot replace a blank final. Usage is
mapped from cumulative totals into segment deltas; reasoning-output tokens are
not counted a second time.

## 0.57 production compatibility and retained earlier support

The production contract accepted at Human Gate 1 was freshly measured read-only:

```
Grok Bot: 0.57.0
Host version: 18cd065
Bytes: 26438264
SHA256: c667b530962bbf94a2ba77659b0440f20dd553dfdbabdd4a2cd157e4335bba29
Path: /home/box/sand-host/host-main.cjs
Router markers: all zero (stock)
```

`scripts/manifests/grok-bot-0.57-18cd065.ts` is a built-in fingerprint-bound
compatibility target with `routerMarkerVersion:1`, exact stock and deterministic
patched fingerprints, an explicit 0600 pristine-backup SHA policy, and four
required structural anchors. Fresh actual-host counts were exactly one each and
in order: `inferenceOwner`, the stock inference fallback `inferenceHook`,
`mainSessionOptions`, and its `mainSessionDispatch`. Only after that live
structural proof passed was `anchorProof:"VERIFIED"` recorded.

The 0.57 hook is inserted immediately before the unique stock fallback
`return createCursorInferencePromptSession(inferenceOptions);`. It does not alter
mock handling, model experiments, requested-model resolution or inference option
construction. The identity patch adds only `conversationId`,
`transcriptId: host.getTranscriptId()` and `isGroupMemberTurn` at the unique main
session-options seam. The existing executor-profile/model-ID choice and all other
turn logic remain stock.

The deterministic reviewed patched image is:

```
Bytes: 26439011
SHA256: 07835cd847c027aa2628741c2fb93a7c2ebbcb67a55c4861254dfc51af522b1d
```

The built read-only check passed on the then-current host with
`--compat grok-bot-0.57-18cd065`. No backup or host write occurred. Unknown
fingerprints, zero/duplicate required anchors, partial markers, missing/mismatched
backup, and a non-deterministic marked image remain fail-closed.

The later automatic Sand upgrade to host `251860d` was re-verified under the same
M1 semantics and added as a separate built-in compatibility target rather than
overwriting `18cd065`:

```text
Grok Bot: 0.57.0
Host version: 251860d
Bytes: 26453384
SHA256: 2354d46da4304d11110645f4e7fa565a15de1b30cd1d80971db2b8934a278161
Router markers: all zero (stock)
Patched bytes: 26454131
Patched SHA256: 8d8c2c239667e38f421d6b96af994c279b69fdbaddbb91bed927f16a02aef5ea
```

Fresh actual-host proof found exactly one `inferenceOwner`, one stock inference
fallback, one `mainSessionOptions` seam and one `mainSessionDispatch`, in that
order. The built read-only check passed on that production host with
`--compat grok-bot-0.57-251860d`. The insertion algorithm is unchanged: one opt-in
hook immediately before the stock inference fallback and one exact three-field
identity block inside the main session options. Existing `18cd065` and 0.53
artifacts remain unchanged.

The next automatic Sand upgrade to `5ec1e7d` was handled the same way without
weakening either prior manifest:

```text
Grok Bot: 0.57.0
Host version: 5ec1e7d
Bytes: 26460874
SHA256: 8b0e2747c0b7b91fca368c886880b24906a28214e2979029a60a98d8ab0c9bc0
Router markers: all zero (stock)
Patched bytes: 26461621
Patched SHA256: 58493df0bc8fa4b22d981a23835468fa4908a3f73c1819b27375eaaab13e018f
```

Its four required anchors are again unique and ordered; source/local fixtures and
the actual production `--check --compat grok-bot-0.57-5ec1e7d` both pass. The new
manifest is therefore `anchorProof:"VERIFIED"`; `18cd065`, `251860d` and 0.53
artifacts remain separate and unchanged.

The next provider-owned host drift to `a5b5d79` was handled identically and is now
the current VERIFIED production target:

```text
Grok Bot: 0.57.0
Host version: a5b5d79
Bytes: 26463140
SHA256: 2fd89dc7097ef9eb9f6df8b7d77823f9b4b237b96556a6ae408c33927d0045c7
Router markers: all zero (stock)
Patched bytes: 26463887
Patched SHA256: abdd0acc11b94fbf9f0b6004a6e0aac27eb4e2fb305b36829b6f57f72e8dfb30
```

The same four M1 anchors are unique and ordered. The inference seam preserves the
same mock/model-experiment/requested-model/inferenceOptions flow and the identity
seam preserves the same executor-profile/workload-classifier/main-session dispatch
flow as `5ec1e7d`; only unrelated bundle offsets moved. The built read-only
`--check --compat grok-bot-0.57-a5b5d79` passes on the actual current host. See
`HOST-A5B5D79-EVIDENCE-20260919.json`.

The 0.53/`11dd264` manifest is retained as a separate built-in compatibility
target and remains `anchorProof:"BLOCKED"`; its legacy insertion seam is still
covered by the original fixture suite. A custom fixture manifest still cannot
override the canonical production host or an alias to it.

## Human Gate 1 result and Gate 2 boundary

Gate 1 created exactly one pilot:

```text
ID       97cf83a0-0401-4481-9f3f-8b321921f8b0
name     ROCANIIRU Codex BOX M1 Pilot
profile  harness:"box"
running  false
```

The creation returned an empty transcript and no provider/model Turn was started.
The user-facing Bot remained `harness:"temporal"`. The pilot must not be recreated,
renamed or profile-mutated as part of M1 activation.

At Human Gate 1, fresh read-only prerequisites passed: the then-current 0.57 host
`18cd065` fingerprint/anchors and router check, healthy/ready Runtime with
persistence healthy and no fence or
uncertainty, UNKNOWN 0, pending input 0, Computer 0.2.3 on the same service identity
with `clear/CLEAR`, and the existing user-facing Bot still
`harness:"temporal"`. The current 0.57 coordinator's `createAgent` validator and
BOX branch were read directly: explicit `creationRoute:{kind:"box"}` stays on the
host-mediated BOX path and `harness:"box"` is a valid field.

Production activation is split into independently approved gates in
`PRODUCTION-ACTIVATION-PREP-20260919.md`: 2A stages source/binaries/schemas without
changing a current pointer or process; 2B promotes the patched Codex + Runtime;
2C installs the router/config, writes the pristine host backup, applies the exact
0.57 patch and performs one Sand-supervisor restart. The first pilot Turn remains
a later separate Human decision.

Gate 2A has now completed successfully as build/stage only. The exact staged Codex
binary is 1,283,274,448 bytes / SHA-256
`790879dcee4a675f34cc1aba9a2ab3fd0edb447588cf97f5cb111967b12fc8e7`;
the Runtime candidate passed 114 Python tests and its generated schema reports
`dynamic_only_tool_policy=true` with digest
`93fcd1f5a09f8192669e7ab24c65e35b8ef988456351895928ad103ecaf38d49`.
No current pointer or process changed.

Before the Human scope change, Gate 2B remained closed even after the host side of
the drift was resolved by the verified `5ec1e7d` port. The then-remaining blocker
was the original immutable pilot:
official roster and durable profile both report `harness:"temporal"`, with
`serverId:"4168251"`. Current 0.57 `updateAgent` cannot change harness,
`restoreTemporalAgentRouting` only re-applies Temporal routing projection, and no
supported same-ID Temporal-to-BOX command exists in the current coordinator
surface. The deeper provider/server audit reaches the same result: provider
`CreateGrokBotAgentRequest` has a harness field but `UpdateGrokBotAgentRequest`
does not; identity-sync edits push only ordinary profile/avatar fields; the internal
harness migration RPCs are explicitly BOX-to-Temporal rollout/status/hold/pass
surfaces and accept no per-agent target harness; Primary Bot migration is a
user/cohort batch flow; available Grok Bot admin surfaces read/list/delete but do
not set harness. Direct profile editing is not an official repair and remains
forbidden.

The Human subsequently changed scope to allow exactly one new BOX pilot. One and
only one replacement was created:

```text
ID       507d1f34-56d5-4085-9b48-23d40cb9c914
name     ROCANIIRU Codex BOX M1 Pilot 2
profile  harness:"box"
serverId 4270685
running  false
Turn     none
```

The coordinator roster's BOX projection reports `harness:null`, while the durable
profile carries lowercase `harness:"box"`; M1 admission deliberately reads the
durable profile. The retired `97cf…` pilot remains Temporal and is no longer
allowlisted. The user-facing Bot remains Temporal. Source/config now bind exactly
the replacement ID and regression tests prove the retired ID stays on stock.

Gate 2B then completed successfully. Runtime `current` moved from
`0.1.0-3c4f121` to `0.1.0-72c8032` and standalone `current` moved from stock Codex
0.154.0 to the Gate-2A patched release. Runtime-owned App Server PID changed
`883943 -> 1569085` and generation `12 -> 13`; the exact 25-Thread set remained
unchanged. Postflight is healthy/not fenced/not uncertain with UNKNOWN 0, pending
input 0, active turn 0, blocked thread 0, and
`dynamic_only_tool_policy=true`. Unrelated App Server PID `1188039` was not
signaled or adopted. No provider/model Turn was started and no host/router mutation
occurred.

The first Gate-2C attempt repacked current source but then failed closed
**before any live mutation** because Sand had automatically advanced from verified
`5ec1e7d` to stock/unpatched `a5b5d79`:

```text
version  a5b5d79
bytes    26463140
sha256   2fd89dc7097ef9eb9f6df8b7d77823f9b4b237b96556a6ae408c33927d0045c7
markers  0
```

The `5ec1e7d` manifest rejected that drift as intended. After `a5b5d79`
compatibility was independently VERIFIED, the Human re-approved Gate 2C. Current
source commit `164cea8d795f54d7cb09bd7608f6fa62d3341a98` was freshly repacked and
reaccepted: 101/101 router tests plus telemetry/knip/diff-check passed, the package
contains only replacement pilot `507d1f34-56d5-4085-9b48-23d40cb9c914`, and the
retired Temporal pilot is absent from the route map. The accepted package is:

```text
bytes   156879
sha256  3790c70e9acfd7a9a4ba375973c1c4e8032c9f7ba72dc865e6652e1dcb303dd2
```

Gate 2C then installed that package and production config, created the 0700 router
state directory, wrote the pristine 0600 host backup, applied the exact deterministic
`a5b5d79` patch and completed one Sand-supervisor restart
`grok-codex-router-1789816115688-f91a02e8`.

Postflight is PASS: host version remains `a5b5d79`, patched bytes/SHA are
`26463887` /
`abdd0acc11b94fbf9f0b6004a6e0aac27eb4e2fb305b36829b6f57f72e8dfb30`,
all four router markers occur exactly once, Runtime remains generation 13 with the
same 25 Threads and zero pending/UNKNOWN/active/blocked work, and Computer remains
`clear/CLEAR`. Read-only routing evaluation returns true only for the replacement
BOX pilot; retired/user-facing Temporal agents and all auxiliary workloads remain
stock. Router state remains empty, so no pilot Turn/provider inference was started.
See `GATE-2C-EVIDENCE-20260919.json`.

### First pilot Turn acceptance attempt

The Human approved one first pilot Turn after Gate 2C. Preflight had an empty pilot
transcript, patched host SHA `abdd0acc...dfb30`, Runtime generation 13 with 25
Threads and event cursor `55834575072`, and zero pending/UNKNOWN/active/blocked
work. Exactly one prompt was accepted as transcript entry `t0u`; the assistant
returned exactly `ROCANIIRU_M1_PILOT_TURN_PASS` as `t0s0`.

That user-visible success did **not** satisfy M1 acceptance. Runtime event cursor
remained exactly `55834575072`, Thread count remained 25, no pilot Runtime session
appeared and router state remained empty. Therefore the Turn took stock inference.
No second Turn was sent.

Read-only source/actual-host comparison found the cause. Ordinary `a5b5d79`
`mainSessionOptions` omits `isSummarizationSession`, while dedicated summarization
sessions explicitly set `isSummarizationSession:true`. The live pilot policy
incorrectly required the omitted root value to be a boolean and therefore rejected
every ordinary root Turn before routing.

Source commit `3274d1781c8a1dd4ec670e6885c55bb57de7d037` treats absent
`isSummarizationSession` as the documented ordinary-root shape, still rejects
explicit `true` to stock and fail-closes on an explicit non-boolean value. All
other root classifiers remain required booleans. That fix was packaged as 157422
bytes / SHA-256
`42ca75a055d93094d6e03c52bf90e3d3c23221cf3282d14bd89abb75068da6c5`,
installed as the live router without rewriting the production config, and loaded
with exactly one supervisor restart
`grok-codex-router-1789817756783-e163ca36`. Host SHA, Runtime generation 13 /
25-Thread state and Computer `clear/CLEAR` remained unchanged.

### Pilot retry after root-shape repair

Exactly one retry send was accepted as transcript entry `t1u`. The repaired live
policy now selected the intended route: live logs recorded
`agent=507d1f34-56d5-4085-9b48-23d40cb9c914 workload=agent
model=chatgpt-web/extra-high effort=xhigh`. Sand internally re-entered that session
four times while handling the same retryable Turn, but there was only one accepted
client send and no resend by this task.

The retry still **did not pass M1 acceptance**. No assistant transcript entry was
produced, Runtime event cursor stayed `55834575072`, the retained Thread count
stayed 25, no `grok:` Runtime session appeared and router state remained empty.
The durable Turn settlement is `SAND-E0406 / retryable=true`. Therefore routing
selection is proven, but Runtime traversal is not.

The second defect is independently reproduced in source. The previous stock Turn
left a signed/private assistant `reasoning` part before its `SendToUser`
tool-call/result. `initialRuntimeInput()` rejected that production-shaped history
with `PRIVATE_REASONING_TRANSCRIPT_FORBIDDEN` before `journal.begin`, exactly
matching the live absence of any Runtime mutation.

Source-only follow-up commit
`e7206a4483478e072c63e3b6c3386e45ab5a5295` omits assistant
reasoning/thinking from Runtime/Codex transcript injection while preserving exact
historical tool-call/result identities; private reasoning in user input and other
unsupported content still fail closed. Focused Runtime-router tests pass 39/39 and
the complete router suite remains 102/102 plus telemetry, knip and diff-check.
The next candidate package is 158036 bytes / SHA-256
`64689d1efdbe612d034244fe679ed1fdb08a594a32d53c5cfad7be12f69719aa`.
That exact artifact was later separately approved, installed live without rewriting
the production config, and loaded with exactly one supervisor restart
`grok-codex-router-1789819567026-ea0c50f6`.

### Pilot acceptance after private-reasoning repair

The second-fix preflight passed on unchanged `0.57.0 / a5b5d79`. Runtime was
generation 13 / PID 1569085 with 25 retained Threads, cursor
`55834575072`, no pending/UNKNOWN/active/blocked work and
`dynamic_only_tool_policy=true`. Computer was `clear/CLEAR`.

After router-only replacement and the single restart, transcript entry count,
send-acceptance record count, router-session count and Runtime cursor were all
unchanged from their pre-restart baselines. This proves zero automatic resume or
provider activity. Read-only routing still admitted only canonical BOX pilot
`507d1f34-56d5-4085-9b48-23d40cb9c914`; summarization, retired/user-facing
Temporal, subagent, browser, computer, automation and group remained stock.

Exactly one acceptance send was then accepted as `t2u`, nonce
`369698f6-cb29-43ec-87c6-d9b8e4c837af`. This Turn positively traversed the
M1 route. Runtime Thread count increased 25 -> 26 and cursor advanced
`55834575072 -> 55834575093`. New identities were:

```text
session  grok:916cabe323e4803f8c6959b3:ce9db519eabb16246e86d7f9
thread   01a0b990-9de0-7360-bf0f-17383f9ff53d
turn     01a0b990-aa20-7642-9ffb-7004f4be75df
```

`runtime_session_open`, `runtime_session_inject_items` and
`runtime_turn_start` are all journaled ACK. Runtime then emitted a dynamic
`SendToUser` call whose content is exactly
`ROCANIIRU_M1_PILOT_ACCEPTANCE_PASS`.

Acceptance still **failed** because that dynamic-tool handoff did not complete.
There is no assistant transcript entry after `t2u`. Sand durably settled the
client Turn as `SAND-E0406 / retryable=true`; router journal is `BLOCKED`
with no pending identities, while Runtime remains healthy but has one active Turn
and one pending dynamic input. No UNKNOWN operation exists. The exact router fault
code is not surfaced in current host logs, so no third defect is claimed beyond the
observed dynamic-tool handoff boundary.

No resend, Runtime cancel/recovery, additional router fix, additional supervisor
restart or later production phase was performed. See
`PILOT-ACCEPTANCE-EVIDENCE-20260919.json`. Milestone 1 pilot acceptance remains
**incomplete** and any further live mutation requires a new Human approval.

### Recovery and PromptSession contract probe

The next approved recovery interrupted the exact orphaned Runtime Turn once,
observed terminal `interrupted`, archived its Runtime session, and restarted only
the Runtime App Server child. Generation changed 13 -> 14, PID
`1569085 -> 1649828`, while all 26 retained Threads remained durable and stale
pending/UNKNOWN state returned to zero. The router journal was then closed by
moving exact runHash
`ce9db519eabb16246e86d7f948ae379e0f1b4d08c7f16efcdc73f27c54a94792`
from `active:BLOCKED` into `completed`.

Host-source inspection showed that the inner PromptSession surface should expose
`getResolvedModelId()`. Source commit
`6711ae13987cb5b4852ee3298b136d47ddadf366` adds that fixed-route method.
Focused tests pass 3/3; the full router suite remains 102/102 plus telemetry, knip
and diff-check. Exact package: 158520 bytes / SHA-256
`e134ef299343149a83496c000d24403a1dc72adbebaef7317ebfc9f9582299c9`.
It was installed router-only and loaded by exactly one supervisor restart
`grok-codex-router-1789821001599-02908436`; host/config/Runtime source were
unchanged and restart postflight showed zero automatic activity.

Exactly one Turn `t3u` was accepted with nonce
`fea97a2b-99c2-49ea-933e-ccff1d1391af`. The same pattern recurred:
Sand settled `SAND-E0406` before any user delivery, while Runtime independently
continued generation-14 Turn
`01a0b9a6-0ab3-7451-893b-bcdd64546678` and later produced the expected
`SendToUser(ROCANIIRU_M1_PILOT_FINAL_PASS)`. Therefore
`getResolvedModelId()` was a real contract gap but not the primary failure.

Live Statsig bootstrap resolves the stream deadline to 150000ms first-token /
90000ms idle, excluding the first-token watchdog as the ~9s SAND-E0406 source.
The exact inner RuntimeFault is not persisted in current host logs.

The t3 orphan was then recovered once using the same contract: interrupt, terminal
`interrupted`, archive, App Server child generation 14 -> 15
(`1649828 -> 1658692`) to discard the stale pending request, then exact router
journal closure. At that recovery boundary Runtime was generation 15 with 27 retained Threads,
pending/UNKNOWN/active/blocked all zero and healthy persistence.

Source-only commit `36e8d3808661e3cbd69331b7ecd5ca494ac9d41f` adds sanitized
fault observability: only `RuntimeFault.code` and `uncertain` are logged at the
router execution boundary. Tests remain 102/102 plus telemetry/knip/diff-check.
Candidate package is 158651 bytes / SHA-256
`f9e990c1ce01fc87e0ec8dc628a5f63e20ca13569d773be7c0d247e96b116b14`
and was later deployed router-only with one restart
`grok-codex-router-1789822659539-3f004c60`.

### Sanitized fault diagnostic

Restart postflight preserved the existing baselines exactly: transcript entries 5,
send-acceptance records 4, router-session count 12 and Runtime cursor
`64424509668`. No automatic resume/provider activity occurred.

Exactly one diagnostic Turn `t4u` was accepted, nonce
`4967c7c9-023b-4f61-9298-f149852ef648`, with no resend. The first sanitized
router error is:

```text
NON_JSON_VALUE uncertain=false
```

Only afterward do internal retries report
`PENDING_RUN_NO_REPLAY uncertain=true`. The first fault is therefore the causal
router failure; the pending-run errors are secondary.

Source control flow narrows `NON_JSON_VALUE` to
`src/runtime-execution.ts` immediately after successful
`runtime_turn_start`:

```ts
this.consumedPrefixHash = fingerprint(messages);
```

The tool-set fingerprint and all three admission mutation fingerprints had already
succeeded, all admission operations are journaled ACK, and no later Runtime event
processing had begun. `fingerprint(messages)` is therefore the first remaining
canonical-JSON fingerprint in that path. The exact raw Sand message field that is
non-JSON was not captured.

Runtime independently completed the diagnostic Turn:
session `grok:916cabe323e4803f8c6959b3:4f9ad1679fc2ad75809b5cba`,
thread `01a0b9bf-4212-7643-8f32-0cb11a6204e2`,
Turn `01a0b9bf-4aa8-7cf0-ab91-0c7d203089dd`, terminal
`completed`, terminal result available. Sand had already settled the client Turn
as retryable `SAND-E0406`.

Because the Runtime Turn was already terminal and pending input was zero, recovery
did not cancel or rotate the Runtime generation. The session was archived and exact
blocked runHash
`4f9ad1679fc2ad75809b5cba6b8da7eaf33e4a806ee4ad1634f40d4cb05189c3`
was moved to completed. Router journal returned to `active:null`.
See `PILOT-FAULT-DIAGNOSTIC-EVIDENCE-20260919.json`.

## Local checks

`npm run knip` checks active and retained source. `npm run check` builds, runs local
Node fake/fixture tests, and runs upstream telemetry ingestion under Bun.
The live `tests/vm-contract.test.ts` is deliberately not executed by the local test
runner. Provider request/stream tests among the retained upstream tests are local
serialization/fake event tests, not paid provider calls.

Blocker 1 source/local evidence remains in `DYNAMIC-ONLY-EVIDENCE-20260919.json`;
host compatibility is recorded in `HOST-057-EVIDENCE-20260919.json` and
`HOST-5EC1E7D-EVIDENCE-20260919.json`; replacement-pilot and Gate 2B evidence are
in `PILOT-REPLACEMENT-EVIDENCE-20260919.json` and
`GATE-2B-EVIDENCE-20260919.json`. The production plan is
`PRODUCTION-ACTIVATION-PREP-20260919.md`.

Current regression acceptance passed 102 router tests plus telemetry ingestion and
`knip`, 219 Runtime Node tests, and 114 Runtime Python tests. The Runtime source was
not changed by the host port. `git diff --check` passed.

Current Runtime is generation 15 / PID 1658692, `started=true`,
`ready=true`, persistence healthy, `fenced=false`, `uncertain=false`,
UNKNOWN 0 and dynamic-only enabled. It retains 28 Threads with zero pending,
active or blocked work after bounded recovery. The current user-facing Bot
readback remains `harness:"temporal"`. Final Computer status is 0.2.3 on
service identity `a6299bb2e1242f491855fd38608b0dc5f65c6f5f956f734cf5ba16aaf9527e41`
with `clear/CLEAR`.
