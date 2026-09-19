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

## 2026-09-19 — Positive Runtime traversal is necessary but not sufficient for pilot acceptance

The second-fix acceptance Turn proved the route end-to-end through Runtime admission:
a new Runtime Thread and Turn were created, the event cursor advanced, all three
admission mutations were ACKed, and Codex emitted the expected dynamic
`SendToUser` call. That is materially stronger evidence than route-selection logs
alone.

It still did not satisfy pilot acceptance because the dynamic-tool handoff failed
before user delivery. The durable host settlement is `SAND-E0406`, router journal
is `BLOCKED`, and Runtime retains the active Turn/pending input. Acceptance must
therefore require both positive Runtime traversal and successful terminal
delivery/cleanup. A successful provider/tool event by itself is not a terminal
acceptance signal.

## 2026-09-19 — Recover orphaned Runtime Turns by generation, never by replaying tool responses

When Sand had already abandoned the client Turn but Runtime still held a dynamic
tool request, the existing cancellation contract mattered: canceling while waiting
for tool results must not synthesize or replay a `runtime_respond`. The safe
recovery was exact-turn interrupt, observe terminal `interrupted`, archive the
session, then rotate only the App Server child generation so stale pending requests
from the old generation disappear. The durable router run can then be closed only
after those external terminal/archive facts are proven.

## 2026-09-19 — A real contract gap can still be non-causal

The inner router PromptSession lacked `getResolvedModelId()`, while current host
code expects that surface through its sanitizing wrapper. Adding it was correct and
fully tested, but the same SAND-E0406 sequence reproduced afterward. Treating every
real incompatibility as *the* root cause would have produced another false closure.

The live stream first-token deadline was also measured at 150000ms, so the observed
~9s failure is not the first-token watchdog. The next diagnostic must expose the
sanitized router `RuntimeFault.code` directly rather than infer it from the outer
SAND-E0406 classification.

## 2026-09-19 — Fingerprint normalized transcript data, not raw Sand message objects

The sanitized diagnostic exposed the first deterministic router failure as
`NON_JSON_VALUE uncertain=false`. All three Runtime admission mutations had
already completed and were journaled ACK. The next fingerprint in the source path
is `this.consumedPrefixHash = fingerprint(messages)`, before `observe()`.

`canonicalJson()` intentionally rejects values outside recursive JSON primitives,
arrays and plain records. The router was fingerprinting the raw Sand message
objects even though earlier wire conversion already has a JSON-safe normalized
representation for Runtime input. That makes the replay/prefix fence depend on
host-object representation rather than normalized transcript semantics.

The exact offending raw field was not captured, so it should not be invented.
The next fix should preserve the prefix-change/replay fence while fingerprinting a
deterministic JSON-safe normalized transcript representation instead of raw host
message objects.

## 2026-09-19 — request_id does not necessarily mean a new server request

The normalized-transcript repair proved that the previous fingerprint diagnosis was
correct: the Turn passed initial admission, crossed the dynamic tool boundary,
`runtime_respond` was ACKed, and `SendToUser` produced a real transcript
delivery.

The next fault came from treating every event with a non-null `request_id` as an
active server request unless its method was literally `item/tool/call`. Runtime
also emits `engine/serverRequestResponded` after a response write succeeds and
attaches the historical request_id for correlation. That is a confirmation event,
not new work requiring execution.

Event policy therefore has to classify by both method and identity, not by
`request_id` presence alone. The narrow safe exception is the confirmation of an
already allowed dynamic `item/tool/call`: event request_id must equal
`params.requestId` and `params.method` must be `item/tool/call`. Other
request-bearing event types remain fail-closed.

## 2026-09-19 — Final acceptance needs four independent proofs

The final pilot did not stop at visible text. Milestone 1 was accepted only after
four independent facts agreed:

1. the user-facing transcript contained the exact `SendToUser` delivery;
2. Runtime operation proof reported the exact Turn terminal `completed`;
3. Sand durably settled the exact client nonce with `outcome:"success"`; and
4. router journal independently returned to `active:null` with the runHash in
   `completed`.

This combination distinguishes a true routed success from earlier cases where
visible text came from stock inference, Runtime continued after Sand had failed, or
delivery occurred before a later router fault.

## 2026-09-19 — Keep post-turn ancillary failures separate from root-Turn acceptance

After the successful final Turn and `AGENT_REQUEST_END`, Sand memory extraction
attempted another router execution without an invocation ID and logged
`sand.memory.extraction_failed (INVOCATION_ID_REQUIRED)`. The root Turn had
already settled success, Runtime was terminal/archived, and the router journal was
complete.

Ancillary post-turn failures should be recorded and investigated, but should not be
retroactively conflated with the independently proven root-Turn outcome.

## 2026-09-20 — Auxiliary memory inference needs identity without weakening the root fence

Sand's memory extractor intentionally calls a fresh auxiliary PromptExecutor with
no invocation ID. Requiring the root-Turn identity contract on that auxiliary path
prevented memory extraction, but globally making invocation IDs optional would
weaken replay fencing.

The safe distinction is structural: the root executor still requires an external
invocation ID. Only auxiliary executors with the exact Sand
`<<SAND_MEMORY_EXTRACTION>>` or `<<SAND_MEMORY_EPISODE>>` system marker,
the exact `providerOptions.cursor.inferenceReason="memory-extraction"`, exactly
two prompt messages and no tools derive a deterministic internal invocation
identity from the normalized prompt and executor ordinal.

This preserves completed-run replay protection while allowing the post-turn
memory/episode workloads the host intentionally invokes without a request ID.

## 2026-09-20 — Broader production rollout should add a fresh BOX identity, not mutate Temporal

The existing user-facing and auxiliary Bots remain Temporal and cannot safely be
reinterpreted in place as the BOX execution harness. Broader production used a
fresh BOX identity with no introduction, kickstart or transcript, then widened the
live allowlist from one reviewed BOX identity to exactly two. Temporal and
auxiliary workload classes stayed stock.

This keeps the accepted pilot as an audit/control identity while giving production
traffic its own durable agent/profile/journal identity.

## 2026-09-20 — Provider host updates can migrate identity semantics

A host update is not only a binary replacement. The `f608393` provider update
reconciled the previously accepted BOX pilot and production profiles to Temporal.
The router's explicit BOX profile check therefore failed closed before any
post-update provider Turn.

Do not respond to that drift by broadening an allowlist or treating Temporal as an
equivalent harness. Re-evaluate the new host's durable identity contract, create
fresh BOX identities under that contract when needed, and rotate the exact
allowlist only after readback proves the intended harness.

## 2026-09-20 — Accept version races before mutating provider-owned host state

During the approved update preflight, the host's cached latest version was
`720baf1` while the public provider latest advanced to `f608393`. Updating against
only the cached target would have created an avoidable compatibility race.

The safer pattern is to fingerprint and structurally accept every target that can
win the observed race, then reset stale provider metadata and require the final
cached/latest target to match immediately before mutation. Only then execute the
provider update once. After the swap, verify exact stock bytes before applying the
reviewed deterministic patch.

## 2026-09-20 — A harness route label is not a permanent model identity

The persistent App Server exposes a live model catalog. On 2026-09-20 it reported
`gpt-6-astra` as the catalog default and separately exposed
`chatgpt-web/extra-high` with `xhigh`, plus direct model IDs such as
`gpt-5.6-sol`.

The current production route intentionally pins `chatgpt-web/extra-high / xhigh`;
it does not inherit the catalog default. OpenAI's current ChatGPT documentation
maps Extra High to GPT-5.6 Sol, so “Sol Extra High” is a valid current
interpretation of that route. It must not be promoted into an immutable code/config
assumption, because the `chatgpt-web/*` route namespace can remain stable while the
underlying ChatGPT model changes.

Operational rule: query the live `runtime_models` / App Server `model/list` surface
before changing or auditing a production model route. Validate the exact route plus
effort pair from the catalog. Use a direct model ID when the underlying model
identity is itself the contract; use a `chatgpt-web/*` route only when the ChatGPT
product route is the intended contract.
