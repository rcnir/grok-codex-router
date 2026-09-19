# Grok Bot Agent → Persistent Codex App Server — M1

## Status and ownership

Source candidate only. **Human Gate 1 is complete: one isolated BOX pilot was
created and independently read back. The next boundary is production activation
Gate 2A (build/stage only).**
No live router package was installed and no pilot Turn was started. No pristine backup was written
to the VM, no host source patched/restarted, no live Runtime replaced and no real
provider/model inference started by this task. The existing persistent App Server
remains the stock Codex 0.154.0 process.

The fork is `rcnir/grok-codex-router`, with `upstream` pointing to
`IgorWarzocha/grok-codex-router`. The implementation branch is
`rcnir/milestone-1-20260919`, based exactly on
`599a2013b15592d17fe897126f549974351e4c3f`.
The companion Runtime branch is `agent/grok-router-m1-20260919` in
`rcnir/execution-runtime`, based exactly on merged
`de20bf8f756e0fc2d8b276adb53893bc76066c51`.
Neither branch is a live deployment or a change to Intelligence/D1/Cloudflare.

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

Gate 2B remains closed, but the host side of that drift is now resolved by the
verified `5ec1e7d` port above. The remaining blocker is the immutable pilot:
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

Therefore immutable-ID Milestone 1 activation is blocked. There is no exact repair
request to approve under current 0.57 contracts. The only remaining Human scope
decision that can make M1 progress is whether to allow creation of a **new BOX
pilot with a new immutable agent ID**; that scope change has not been granted and
no replacement pilot is created here.

The earlier activation-preparation readback found an external Sand upgrade to
`251860d`; that stock host was independently VERIFIED as above. Gate 2A subsequently
completed build/stage only. Its final postflight then observed a second external
upgrade to stock `5ec1e7d` and an external pilot-profile change to
`harness:"temporal"`. Gate 2B/2C are therefore closed again; staged candidates are
retained, but neither new production fact is silently accepted or mutated.

## Local checks

`npm run knip` checks active and retained source. `npm run check` builds, runs local
Node fake/fixture tests, and runs upstream telemetry ingestion under Bun.
The live `tests/vm-contract.test.ts` is deliberately not executed by the local test
runner. Provider request/stream tests among the retained upstream tests are local
serialization/fake event tests, not paid provider calls.

Blocker 1 source/local evidence remains in `DYNAMIC-ONLY-EVIDENCE-20260919.json`;
the 0.57 port and Gate 1 evidence are in `HOST-057-EVIDENCE-20260919.json`; current
production-activation preparation and fresh read-only baselines are in
`ACTIVATION-PREP-EVIDENCE-20260919.json` and
`PRODUCTION-ACTIVATION-PREP-20260919.md`.

Current regression acceptance passed 97 router tests plus telemetry ingestion and
`knip`, 219 Runtime Node tests, and 114 Runtime Python tests. The Runtime source was
not changed by the host port. `git diff --check` passed.

Fresh live read-only Runtime status is generation 12 / PID 883943,
`started=true`, `ready=true`, persistence healthy, `fenced=false`,
`uncertain=false`, UNKNOWN 0, pending input 0, 25 retained Threads, no active Turn
and no blocked Thread. The current user-facing Bot
readback remains `harness:"temporal"`. Final Computer status is 0.2.3 on
service identity `a6299bb2e1242f491855fd38608b0dc5f65c6f5f956f734cf5ba16aaf9527e41`
with `clear/CLEAR`.
