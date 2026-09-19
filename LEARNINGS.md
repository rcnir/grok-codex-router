# Engineering learnings

## 2026-09-19 — Runtime-backed Grok inference candidate

The M1 branch is source-only and not accepted. Preserve unresolved proof boundaries
in the code as admission guards, not only as prose warnings.

Exact `callId` and JSON-RPC `(request_id,generation)` are separate identities;
numeric and string request IDs must never be conflated. Tool-result replies belong
to the existing Turn. Returning a tool result through another `turn/start` creates
a different execution rather than resuming the pending dynamic call.

Persist SENT before dispatch. A timeout, client failure, changed generation or
uncertain filesystem persistence never authorizes another send. A new invocation
ID or new executor ordinal cannot be used to escape an existing durable fence.

Protocol-invalid Runtime events marked `known:false` are not output evidence.
Durable terminal items outrank streamed fragments; an explicitly blank final must
remain blank, not become a preceding nonblank commentary message. Official reasoning
summaries are separate from raw reasoning and from ordinary answer text.

Preserved upstream converters can intentionally omit unsupported data or normalize
IDs for a different transport. A Runtime adapter must validate supported content
before conversion and restore exact historical tool IDs where the Runtime contract
requires them. Tests passing against only synthetic host anchors do not validate a
different proprietary host image, even when its requested fingerprint is known.

An empty TOML table merges with inherited configuration. It is not evidence that
MCP/plugin execution is disabled. A read-only sandbox or a developer instruction
is also not an execution-authority boundary.

Default local checks must not silently run the retained upstream live-VM acceptance
suite. Retain upstream files for comparison but separately test that the active
package entrypoint imports no private provider transport or control bootstrap.

A standard Runtime CLI is still subject to process argument-size limits and argv
visibility. Structured image/transcript payloads need bounded stdin input to the
same CLI/MCP boundary, not a new transport or a second App Server.

## 2026-09-19 — Dynamic-only source continuation

A native-tool exclusion must constrain the executable handler registry, not only
the displayed tool schemas. Build the isolated plan before native/MCP/extension
sources merge, and prevent finalization from adding search, code-mode or child
dispatchers. A refreshed MCP binding can remain available to other threads while
the isolated thread's next plan still exposes only its dynamic catalog.

Thread policy is immutable persisted metadata, not an ordinary recursive config
field. Check both legacy/copied and paginated/reference-backed history paths.
Derived TurnContexts and config refresh must preserve the effective policy.

A request is not an effective-policy acknowledgement. Runtime must durably retain
the actual acknowledged policy and verify it on recovery. Never re-echo the caller's
request or clear a current policy fence using an old successful resume ACK.

Codex 0.154 uses precomputed App Server schema exports. Regenerate stable and
experimental artifacts from the Rust types; merely adding the Rust field would
leave Runtime capability discovery stale. The API request can be optional while
the persisted/core policy and effective response remain required typed values.

Test event streams can contain legacy notifications between typed item events.
A dynamic tool round-trip should match typed completion with exact call/Turn
identity, not assume the next event is its completion.

## 2026-09-19 — Grok Bot 0.57 host compatibility port

Host compatibility must be versioned independently from the router/runtime policy.
Keep old manifests as fail-closed historical targets and add a new exact fingerprint
plus structural proof for each upstream host revision. A host version string or SHA
alone is not enough to authorize a patch.

Anchor validation should prove the exact seam and ordering, but must not count a
generic field name across the whole proprietary bundle. Grok Bot 0.57 already had
many unrelated `conversationId` properties, so the safe invariant is one versioned
router marker block containing the exact three inserted identity fields, not one
global occurrence of those field spellings.

For 0.57 the narrow inference seam is the unique stock fallback after
`inferenceOptions` is fully assembled. Inserting the opt-in hook immediately before
that fallback preserves mock/model experiment/requested-model behavior. The main
identity seam can likewise prepend fields to the unique `mainSessionOptions` object
without changing its executor-profile/model selection or dispatch path.

Pin both the pristine stock fingerprint and the deterministic patched fingerprint.
That makes read-only `--check` able to authenticate either exact state while partial
markers, stale backups or hand-edited patched images still fail closed.

## 2026-09-19 — Pilot binding and activation boundary

Binding an approved pilot is not activation. Keep `enabled:false` in source while
pinning the one immutable agent ID and its intended Runtime model/effort; an
explicit production config is the later activation switch. This lets source tests
prove that the pilot is the sole eligible BOX root while Temporal, other BOX and
every auxiliary workload remain stock before any live file changes.

The accepted Runtime wrapper launches an absolute shared standalone Codex path.
Therefore dynamic-only activation cannot be represented as a Runtime-Python-only
deployment: the patched Codex executable and its generated schema must be staged
and promoted with the Runtime. Switching the standalone `current` pointer affects
future Codex launches outside Runtime too, although already-running unrelated App
Server processes keep their open executable inode. That impact belongs in the
Human Gate rather than being hidden behind the Runtime restart.

Keep build/stage, Runtime/Codex promotion, and Grok-host patch/restart as separate
gates. Staging can be rolled back by deleting new versioned paths; Runtime rollback
restores pointers without overwriting a newer durable journal; host rollback uses
the verified pristine backup and the same supervisor-controlled restart path.

## 2026-09-19 — Automatic host drift can be ported without weakening old support

When Sand upgrades the stock host between gates, keep the old verified manifest as
an exact historical compatibility target and add the new host as another
fingerprint-bound target. Do not relax a prior manifest to accept multiple hashes.
For `251860d`, the M1 insertion seams remained structurally identical to `18cd065`,
but verification still required a fresh stock SHA/size, exact anchor counts/order,
zero router markers, deterministic patched-image SHA and an actual-host read-only
`--check` before `anchorProof` could be promoted.

## 2026-09-19 — Revalidate admission facts after staging, not only before it

Gate 2A proved that immutable build/stage work can succeed while provider-owned
state changes underneath it. The staged Runtime/Codex candidates remained valid,
but the final postflight observed both a new automatic Sand host upgrade and an
external pilot-profile harness change. Treat those as independent admission facts:
do not infer that a valid candidate artifact authorizes promotion after its live
target/profile preconditions have drifted. Preserve the staged artifacts, keep
current pointers untouched, and close the next gate until the Human explicitly
resolves the new production facts.

## 2026-09-19 — Harness projection and durable profile are separate authorities

The coordinator keeps an in-memory harness map for routing, and
`restoreTemporalAgentRouting` only repopulates that projection. Do not mistake that
for a durable harness conversion API. `profile.json` independently carries the
server binding; current host code parses `serverId` + `harness` and serializes both
back to disk. When official roster and the durable profile agree on Temporal, the
agent is not merely displayed as Temporal.

Current Grok Bot 0.57 exposes harness selection on `createAgent`, but
`updateAgent` accepts only ordinary profile fields and cannot change harness. No
same-ID `setAgentHarness`/convert/migrate/restore-BOX command exists in the current
coordinator surface. If an immutable M1 pilot becomes durably Temporal, fail closed
rather than hand-edit `profile.json` or silently create a replacement ID.

The same boundary continues below the coordinator. `CreateGrokBotAgentRequest`
contains harness while `UpdateGrokBotAgentRequest` does not, and
`SandAgentIdentityService.pushEdit` sends only ordinary identity/avatar fields to
that update RPC. Internal harness migration is explicitly BOX-to-Temporal rollout
orchestration: status/hold/pass requests do not provide a per-agent target-harness
reverse operation. Admin identity surfaces can inspect or delete agents but expose
no harness setter. Treat an internal migration/status RPC name as evidence only
after its request shape and direction are read; do not turn rollout machinery into
an invented user repair path.

## 2026-09-19 — Repeated host drift keeps one manifest per fingerprint

`5ec1e7d` preserved the same M1 structural seams as `18cd065` and `251860d`, but it
still received a separate exact stock fingerprint, fresh required-anchor proof,
deterministic patched SHA and actual-host `--check`. Keeping one manifest per host
fingerprint lets provider upgrades fail closed without weakening earlier accepted
targets.

The subsequent stock `a5b5d79` drift confirmed the same rule again. Fresh actual
source proof found all four required anchors exactly once and in order at byte
offsets 22859014, 22861850, 26018280 and 26019542 (lines 605907, 605972, 680169 and
680194). The M1 inference and identity seams are semantically unchanged from
`5ec1e7d`; unrelated bundle growth moved offsets only. A fresh deterministic
in-memory transform produced 26463887 bytes / SHA-256
`abdd0acc11b94fbf9f0b6004a6e0aac27eb4e2fb305b36829b6f57f72e8dfb30`, with
each of the four router markers and the identity block exactly once.

Compatibility source is part of the packaged patcher surface. Therefore a router
package accepted before a new built-in host manifest is added cannot be reused just
because the routing code itself is unchanged. Gate-2C package
`b0716767531a13e1b97b1617ebcbc4271b7569eb69c741c46c249b6844e496fc` predates
`a5b5d79` support and must be repacked/reaccepted before any future activation.

## 2026-09-19 — Gate 2C activation keeps compatibility and inference as separate gates

After the `a5b5d79` compatibility port, Gate 2C was explicitly re-approved. The
router was repacked from the exact current source commit rather than reusing the
stale pre-port artifact. The accepted package was 156879 bytes / SHA-256
`3790c70e9acfd7a9a4ba375973c1c4e8032c9f7ba72dc865e6652e1dcb303dd2`.

Activation was still staged as distinct fail-close boundaries: final stock host
check, live router/config install, pristine backup, deterministic patch verification,
then one supervisor restart. The post-restart read-only routing check proved that
only the replacement BOX pilot is admitted while every retired/Temporal or auxiliary
workload remains stock. Keeping the router state directory empty until the separate
pilot-Turn approval provides a simple observable boundary between **activation**
and **provider inference**.

## 2026-09-19 — Fixture `false` is not equivalent to an omitted production field

The first real pilot Turn exposed a shape mismatch that fixture-only testing had
hidden. Tests supplied `isSummarizationSession:false` on the ordinary root path,
but current 0.57 production `mainSessionOptions` omits the property entirely.
Because the router policy intentionally failed closed on non-boolean classifiers,
the missing property made every ordinary root Turn bypass the router even though
the allowlist, BOX profile, host patch and production config were all correct.

For optional discriminators, regression fixtures must reproduce the exact production
presence/absence shape, not only an equivalent logical value. Here the safe contract
is asymmetric: missing `isSummarizationSession` is the known ordinary-root shape;
explicit `true` is summarization and stays stock; explicit non-boolean remains
invalid and fail-closed. Other root classifiers remain required booleans.

## 2026-09-19 — Private stock reasoning may exist in prior transcript without being model input

After the root-shape repair was deployed, the retry proved routing selection but
still failed before Runtime admission. The first stock Turn had persisted an
assistant `reasoning` part with a private signature alongside its delivery tool
call. Rejecting that part merely because it existed made a safe cross-provider
continuation impossible even though the router never intended to expose the private
reasoning to Codex.

The correct boundary is to distinguish **presence in Sand history** from
**model-visible Runtime input**. Assistant reasoning/thinking is omitted entirely
from Runtime/Codex transcript injection; it is neither copied nor summarized.
Historical tool-call/result identities remain exact. Private reasoning supplied as
user/tool content remains invalid and fail-closed. A production-shaped regression
must include the signed assistant reasoning part so this boundary cannot silently
regress back to fixture-only behavior.
