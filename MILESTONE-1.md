# Grok Bot Agent → Persistent Codex App Server — M1

## Status and ownership

Source candidate only. **Milestone 1 incomplete; Human Gate 1 BLOCKED.**
No live router package was installed, no pilot created, no pristine backup written
to the VM, no host source patched/restarted, no live Runtime replaced and no real
App Server process or provider/model inference started by this task.

The fork is `rcnir/grok-codex-router`, with `upstream` pointing to
`IgorWarzocha/grok-codex-router`. The implementation branch is
`rcnir/milestone-1-20260919`, based exactly on
`599a2013b15592d17fe897126f549974351e4c3f`.
The companion Runtime branch is `agent/grok-router-m1-20260919` in
`rcnir/execution-runtime`, based exactly on merged
`de20bf8f756e0fc2d8b276adb53893bc76066c51`.
Neither branch is a live deployment or a change to Intelligence/D1/Cloudflare.

The current source-only continuation adds the pinned Codex thread-local
`toolIsolation:"dynamicOnly"` contract, Runtime schema-backed capability and
effective-policy recovery checks. The 400 selected Codex tests passed, including
enabled MCP refresh and Legacy/Paginated persistent resume/fork. This resolves
the stock-API source blocker, not host compatibility or live acceptance. Current
evidence is `DYNAMIC-ONLY-EVIDENCE-20260919.json`; the earlier
`EVIDENCE-M1-20260919.json` remains a historical record of the previous candidate.

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

Both `enabled:true` and membership in `pilot.agentIds` are necessary. A legacy
entry in `agents` is a model route, **not** pilot authorization. The wrapper reads
only the exact selected agent profile and requires lowercase `harness:"box"`.
It rejects a group profile. Conversation/transcript identity and explicit root
classifiers are required; missing or unknown classifiers fail closed. All excluded
workloads return stock before creating a router session.

Default configuration is disabled with an empty allowlist. The CLI's old
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

## 0.53 patcher and current-host blocker

The manifest binds the user-supplied current-host contract:

```
Grok Bot: 0.53
Host version: 11dd264
Bytes: 26361676
SHA256: bb7012d56e474375a879311eff1d91fbd389e098023f2856c376b963c5df3d83
Path: /home/box/sand-host/host-main.cjs
```

These current-host values were supplied by the user; they have **not** been
independently remeasured successfully during this task. A read-only source
transfer returned truncated data and no snapshot was accepted/written. A later
bounded source read was explicitly tool-blocked. It was not repeated through
another route. Do not claim current-host anchors or `--check` passed.

The production manifest therefore has `anchorProof:"BLOCKED"`. Its candidate
anchors come from retained prior-version source, not verified 0.53 source.
Fingerprint-only `--check` cannot report full compatibility, and any production
patch/restore is refused before backup or host writes. Custom fixture manifests
cannot target the canonical live host or a symlink/realpath alias.

The deterministic algorithm and temporary fixtures cover SHA/size, unique anchors,
single hook/identity insertion, idempotence, partial/tampered markers, backup
mismatch, exact restore and stock policy passthrough. These validate the algorithm,
not the current proprietary host's anchor layout.

## Human Gate 1 boundary

Gate 1 is **not requested yet**. The native exclusion source contract is described
in `NATIVE-EXECUTION-POLICY.md`; its source/local acceptance does not authorize
deployment. Before opening Gate 1, obtain actual 0.53 compatibility proof and record cloud-01
read-only acceptance: host version/SHA/size, router check, healthy ready Runtime,
no UNKNOWN or pending inputs, Computer clear/CLEAR, and the existing user-facing
Bot still `harness:"temporal"`.

Only then present a concrete official `createAgent` request for ONE new isolated
pilot with `harness:"box"`; capture its returned immutable ID and independently
read back its profile. The existing Temporal agent, existing conversations,
automations, groups, other BOX agents and model routes are unchanged. Creation
approval is not package-install/host-restart/inference approval. Do not fabricate
the exact createAgent payload or claim the official current path has been verified
until its current schema/handler has been read.

## Local checks

`npm run knip` checks active and retained source. `npm run check` builds, runs local
Node fake/fixture tests, and runs upstream telemetry ingestion under Bun.
The live `tests/vm-contract.test.ts` is deliberately not executed by the local test
runner. Provider request/stream tests among the retained upstream tests are local
serialization/fake event tests, not paid provider calls.

Current source/local results are recorded in `DYNAMIC-ONLY-EVIDENCE-20260919.json`.
The original counts and read-only observations below belong to the historical
`EVIDENCE-M1-20260919.json`; they are not fresh observations from this continuation.

The final local suites passed 82 router tests, 95 Runtime Python tests and 19
Runtime Node acceptance fixtures. Five generated wire envelopes also passed the
retained Codex 0.154.0 JSON schemas without generating schemas from a new binary.

The live Runtime read-only observation at `2026-09-19 05:10:57 JST` was healthy,
ready, generation 12, UNKNOWN count 0 and pending input count 0. It still advertised
only its existing capabilities; the source extensions remain undeployed. The most
recent Computer observation was `pending_ack / SUCCESS_PENDING_ACK`, not clear.
No receipt from another/unknown owner was acknowledged. The current user-facing
Temporal profile and exact official createAgent payload were not freshly verified;
the scoped retained createAgent source read was tool-blocked and not bypassed.

This continuation performs no cloud-01 or Computer checks. The user-reported
UNKNOWN host probe is not retried, replayed or acknowledged. The production
manifest is unchanged with `anchorProof:"BLOCKED"`; the current seam/main-options
hints supplied by the user are not promoted to fresh production anchor evidence.
