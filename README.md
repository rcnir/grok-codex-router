# ROCANIIRU Grok Codex Router — Milestone 1 source candidate

This fork starts at `IgorWarzocha/grok-codex-router@599a2013b15592d17fe897126f549974351e4c3f`.
It retains the upstream source layout and wire helpers, but its package entrypoint
routes through the **existing** ROCANIIRU Runtime CLI/MCP boundary, not the private
Responses endpoint, OAuth stores, WebSocket or SSE transports described below.

**Activated through Gate 2C; pilot now reaches Runtime, but Milestone 1 acceptance is not yet complete.** Human Gate 1 originally created isolated BOX pilot
`97cf83a0-0401-4481-9f3f-8b321921f8b0`; it later drifted durably Temporal. After
same-ID repair was exhausted, the Human authorized exactly one replacement BOX
pilot, `507d1f34-56d5-4085-9b48-23d40cb9c914`. Its durable profile is
`harness:"box"`, serverId `4270685`. It had no Turn at replacement creation;
the later single acceptance attempt is described below. Gate 2A built and staged the patched
Codex/Runtime candidates without changing a current pointer or process. Its final
read-only postflight observed provider-owned host drift and a
durable pilot profile of `harness:"temporal"`. The host drift is now resolved:
current `a5b5d79` now has its own VERIFIED fingerprint-bound manifest while
`5ec1e7d`, `251860d` and `18cd065` remain supported separately and 0.53 remains
fail-closed. The pilot
drift was resolved by the explicitly authorized replacement ID; the retired pilot
remains Temporal and is outside the allowlist. The bounded,
thread-local
`toolIsolation:"dynamicOnly"` Codex source patch and Runtime/router capability
wiring remain separate from host compatibility. The pilot is now the only source
allowlist identity and its fixed route is `chatgpt-web/extra-high / xhigh`, while
the source default remains `enabled:false`; the live production config alone enables
the singleton pilot route. Gate 2B promoted the patched Codex/Runtime successfully.
After the first Gate-2C attempt failed closed on provider host drift, `a5b5d79`
compatibility was VERIFIED, current source was freshly repacked/reaccepted, and
Gate 2C completed: router/config installed, pristine stock backup written, exact
host patch applied, and one supervisor restart completed. The first approved pilot
Turn returned the expected text but fell through to stock inference because ordinary
0.57 main-session options omit `isSummarizationSession`; source fix `3274d17`
corrected that exact shape. Package SHA-256
`42ca75a055d93094d6e03c52bf90e3d3c23221cf3282d14bd89abb75068da6c5`
was then installed and one supervisor restart applied it.

Exactly one retry Turn was subsequently accepted. The live router now selected the
pilot route (`chatgpt-web/extra-high / xhigh`), but the Turn failed before the
first Runtime mutation: Runtime event cursor and the retained 25-Thread set did not
move, no assistant reply was appended, and Sand settled the Turn as retryable
`SAND-E0406`. The prior stock Turn had retained a signed assistant
`reasoning` part; current router validation rejected that private part before
`journal.begin`. A second source-only fix drops assistant reasoning from
Runtime/Codex transcript injection while continuing to reject private reasoning in
user/tool input. Exact artifact
`64689d1efdbe612d034244fe679ed1fdb08a594a32d53c5cfad7be12f69719aa`
from source `e7206a4483478e072c63e3b6c3386e45ab5a5295` is now live after exactly
one supervisor restart. Post-restart checks showed zero automatic resume/provider
activity and unchanged host/Runtime/Computer invariants.

The separately approved acceptance Turn then positively traversed the router and
Runtime: Runtime created a new `grok:` session/thread/Turn, advanced its event
cursor from `55834575072` to `55834575093`, and produced the expected dynamic
`SendToUser` call containing `ROCANIIRU_M1_PILOT_ACCEPTANCE_PASS`. The handoff
did not complete. Sand settled the client Turn as retryable `SAND-E0406`, no
assistant transcript entry was delivered, router journal became `BLOCKED`, and
Runtime retains one active Turn / one pending dynamic input. No resend, cancellation,
additional fix or additional restart was performed. Gate artifacts, current host
proof and harness authority
are documented in `GATE-2A-EVIDENCE-20260919.json`,
`GATE-2B-EVIDENCE-20260919.json`,
`GATE-2C-EVIDENCE-20260919.json`,
`PILOT-FIRST-TURN-EVIDENCE-20260919.json`,
`PILOT-RETRY-EVIDENCE-20260919.json`,
`PILOT-ACCEPTANCE-EVIDENCE-20260919.json`,
`PILOT-CONTRACT-REPAIR-EVIDENCE-20260919.json`,
`HOST-5EC1E7D-EVIDENCE-20260919.json`, `HOST-A5B5D79-EVIDENCE-20260919.json`,
`PILOT-HARNESS-EVIDENCE-20260919.json`,
`PILOT-REPLACEMENT-EVIDENCE-20260919.json` and
`PRODUCTION-ACTIVATION-PREP-20260919.md`.

The later recovery gate first interrupted and archived that orphaned Runtime Turn,
then advanced only the Runtime App Server child from generation 13 to 14 so the
stale pending server request disappeared. The blocked router journal was closed
against the independently proven interrupted/archived Runtime state.

An actual host-contract gap was then repaired: the inner router session now exposes
`getResolvedModelId()` with the same fixed route as `getModelId()`. Source
`6711ae13987cb5b4852ee3298b136d47ddadf366` packaged to 158520 bytes /
SHA-256 `e134ef299343149a83496c000d24403a1dc72adbebaef7317ebfc9f9582299c9`
and is live after exactly one supervisor restart
`grok-codex-router-1789821001599-02908436`.

The one bounded post-repair Turn still reproduced `SAND-E0406`, so that contract
gap was not the primary failure. Its Runtime Turn was likewise interrupted,
archived, and cleared through App Server generation 15; router journal is again
`active:null`, Runtime has 27 retained Threads with zero pending/UNKNOWN/active/
blocked work, and Computer remains `clear/CLEAR`.

Current source-only commit `36e8d3808661e3cbd69331b7ecd5ca494ac9d41f`
adds only sanitized `RuntimeFault.code` / `uncertain` logging. Its candidate
package is 158651 bytes / SHA-256
`f9e990c1ce01fc87e0ec8dc628a5f63e20ca13569d773be7c0d247e96b116b14`;
that diagnostic is now live after exactly one supervisor restart
`grok-codex-router-1789822659539-3f004c60`.

The one bounded diagnostic Turn captured the first exact inner fault:
`NON_JSON_VALUE uncertain=false`. All later
`PENDING_RUN_NO_REPLAY uncertain=true` entries are secondary retry attempts after
the deterministic run had already been fenced. Source ordering identifies
`this.consumedPrefixHash = fingerprint(messages)` in
`src/runtime-execution.ts` as the failing fingerprint: all Runtime admission
mutations were already ACKed, and that is the next fingerprint before
`observe()`. The exact non-JSON field inside the raw Sand message objects was not
captured and is not inferred.

The diagnostic Runtime Turn itself completed successfully and produced durable
terminal output, but Sand had already settled `SAND-E0406`. The completed session
was archived, exact blocked runHash
`4f9ad1679fc2ad75809b5cba6b8da7eaf33e4a806ee4ad1634f40d4cb05189c3`
was moved to completed, and router journal is again `active:null`. At that
diagnostic boundary Runtime was generation 15 / PID 1658692 with 28 retained Threads and zero
pending/UNKNOWN/active/blocked work. See
`PILOT-FAULT-DIAGNOSTIC-EVIDENCE-20260919.json`.

Source commit `581dfd143ec6ac42a6b1ec23e226db1b4959981f` then replaced raw
Sand-message hashing with deterministic JSON-safe normalized transcript
fingerprints for both consumed-prefix and assistant-echo replay fences. Focused
Runtime-router tests pass 40/40 and the full router suite passes 103/103 plus
telemetry, knip and diff-check. Exact live package: 160281 bytes / SHA-256
`9f7c482af345f781d223c69c821a5c9434b13fb63a268ce3abeaae733a35354e`,
loaded by one restart `grok-codex-router-1789824122588-5437c29c`.

That repair worked through the previously failing boundary. The one bounded Turn
`t5u` reached `SendToUser`, `runtime_respond` was ACKed and the user-facing
transcript gained `t5s0 = ROCANIIRU_M1_NORMALIZED_FINGERPRINT_PASS`. Runtime
then emitted `engine/serverRequestResponded` carrying the already answered
request_id 0. The router incorrectly classified that confirmation event as a new
native execution request and raised
`NATIVE_EXECUTION_REQUEST_FORBIDDEN uncertain=true`. Runtime itself completed
the Turn durably, but Sand settled `SAND-E0406`, so M1 acceptance is still
incomplete.

The completed Runtime session was archived and exact UNKNOWN journal runHash
`79adecc49a4520cfae80f73452f76dd663f21520efc201c56056122117f0fb7b`
was reconciled to completed. Current Runtime is generation 15 / PID 1658692 with
29 retained Threads and zero pending/UNKNOWN/active/blocked work; router journal is
`active:null`. See `PILOT-NORMALIZED-FINGERPRINT-EVIDENCE-20260919.json`.

See [`MILESTONE-1.md`](MILESTONE-1.md) for the implementation contract and status,
[`NATIVE-EXECUTION-POLICY.md`](NATIVE-EXECUTION-POLICY.md) for the thread policy,
[`DYNAMIC-ONLY-EVIDENCE-20260919.json`](DYNAMIC-ONLY-EVIDENCE-20260919.json) for this
source-only continuation, [`HOST-057-EVIDENCE-20260919.json`](HOST-057-EVIDENCE-20260919.json)
for the accepted 0.57/Gate-1 snapshot,
[`ACTIVATION-PREP-EVIDENCE-20260919.json`](ACTIVATION-PREP-EVIDENCE-20260919.json)
for the current live read-only activation state, and [`LEARNINGS.md`](LEARNINGS.md)
for corrections.

Local development uses Node, Bun and the pinned dev dependencies. `npm run check`
builds and runs **local fake/fixture tests only**, plus upstream local telemetry
ingestion. The old live `vm-contract` test is not part of that command.
`npm run knip` checks both the active modules and deliberately retained upstream
modules; lint entry declarations do not put retained transports on the live path.

## Archived upstream README — not the M1 runbook

The following original description and commands are retained for upstream
comparison. They are **not current installation or operation instructions** for
this ROCANIIRU candidate. In particular, do not apply upstream `install.sh` to the
production 0.57 host or the retained 0.53 compatibility target.

> [!WARNING]
> This is an unofficial experimental project. It patches Grok Bot and uses a private ChatGPT Codex endpoint that can change without notice. It may break your VM, lose work, violate service terms, or get an account restricted or banned. You use it entirely at your own risk. The author accepts no responsibility for broken installations, lost data, account action, or anything else that goes sideways.

Run Grok Bot on your ChatGPT Codex subscription without replacing Grok Bot's interface, tools, permissions, or agent loop.

The router connects Grok Bot directly to the ChatGPT Codex Responses endpoint. It reuses an existing Pi or Codex CLI login, routes GPT-5.6 models and reasoning per agent, and keeps Grok Bot's background workloads independently configurable.

## Requirements

- A Grok Bot Sand VM
- Node.js 22.19 or newer
- Bun 1.4 or newer
- An existing OpenAI Codex OAuth login from Pi or Codex CLI

The router does not include a login flow. If neither local account is usable, installation stops without modifying authentication.

## Install

```bash
git clone https://github.com/IgorWarzocha/grok-codex-router.git ~/grok-codex-router
cd ~/grok-codex-router
./install.sh
```

The installer builds and checks the router, selects an existing authenticated account, applies the Sand host patch, starts the local control service, restarts Grok Bot safely, and completes a real cached tool round-trip.

Open the control UI inside the VM:

```text
http://127.0.0.1:21371
```

## Configure routing

The UI is the normal management surface.

- **Default** sets the model and reasoning used by ordinary agents.
- **Agents** adds an override for one discovered individual Grok Bot profile. Chat rooms are excluded.
- **Task models** controls summarization, subagents, browser use, computer use, automations, and group turns.
- **Settings** selects the authenticated local account and transport mode.
- **Stats** shows token use, prompt-cache reads, inference time, and failures by agent.
- **Activity** shows sanitized recent routing and transport events.

Agent settings are stored against immutable profile IDs. Renaming an agent does not break its route. Agents speaking inside a chat room use the separate **Group turns** setting.

The UI offers GPT-5.6 Sol, Luna, and Terra. An agent can inherit the complete default route or override both model and reasoning effort.

Settings gives Sol, Luna, and Terra independent effective context windows of 272k, 472k, or 872k tokens. The router reports the selected model's window to Grok Bot so native compaction uses the same budget. It does not send an unsupported context-limit field to Codex. Each model defaults to 272k.

## Switch inference source

Use **Switch off** in the UI to return Grok Bot to its native inference. The host patch, control service, routes, and usage history stay in place, so **Switch on** restores Codex routing without reinstalling anything.

The same actions are available from the CLI:

```bash
grok-codex-router off
grok-codex-router on
```

The switch applies when Grok Bot creates its next inference session. A turn already in progress finishes on its current source. No host restart is needed.

## Choose a transport

| Mode | Behavior |
| --- | --- |
| Cached WebSocket | Default. Reuses a live socket and sends a continuation delta only after validating the complete prior request and reconstructed response prefix. |
| WebSocket | Reuses a live socket but sends complete request history. |
| SSE | Sends complete request history over HTTP streaming. Also used as the automatic fallback when WebSocket transport is unavailable. |

A dead connection is replaced when the next request needs it. The router does not expire sockets, continuation state, or OpenAI prompt caching by age.

Every request keeps a stable prompt-cache identity for its agent workload. Provider-reported cache reads and token use appear in Stats. Codex turn state is retained through native tool calls and transport retries.

## Verify the VM

Run the local contract suite after changing the router or after a suspicious Sand update:

```bash
cd ~/grok-codex-router
bun run check
```

This suite does not contact OpenAI. It tests router-owned translation, routing, continuation, recovery, stream decoding, and resource cleanup. It also checks the live VM's host compatibility, patch state, package entrypoint, Sand supervisor, Bun runtime, agent discovery, local OAuth ownership, service state, and private file permissions.

Run the explicit provider smoke check separately:

```bash
grok-codex-router verify
```

`verify` performs a two-request tool round-trip on a synthetic diagnostic identity. The second request must reuse the cached WebSocket and send only the tool-result tail.

Finish deployment verification with one native Grok Bot turn that uses a harmless tool and returns through Grok Bot's normal delivery tool.

## Updates and recovery

The local service checks changed Sand host bundles before modifying them.

- A compatible installed patch is left alone.
- A compatible unpatched update is patched and restarted through Sand's supervisor.
- An unfamiliar host is left untouched and reported as incompatible.
- A partial patch or missing pristine backup fails closed.

For a failed recovery:

```bash
cd ~/grok-codex-router
git pull --ff-only
./install.sh
grok-codex-router diagnose > /tmp/grok-codex-router-report.md
```

Inspect the report before attaching it to a [GitHub issue](https://github.com/IgorWarzocha/grok-codex-router/issues/new). Never publish the Sand host bundle, OAuth files, prompts, tool arguments, request logs, or authorization data.

The bundled skill in `.agents/skills/grok-codex-router/` gives Codex-compatible agents the safe investigation and recovery procedure.

## CLI

```bash
grok-codex-router status
grok-codex-router agents
grok-codex-router routes
grok-codex-router off
grok-codex-router on
grok-codex-router route "Agent Name" gpt-5.6-sol high
grok-codex-router class summarization gpt-5.6-luna medium
grok-codex-router auth-store pi
grok-codex-router context-window luna 472k
grok-codex-router recover
```

Agent names are resolved against live profiles before an immutable ID is saved. `auth-store` accepts only a Pi or Codex CLI store that is already authenticated.

## Privacy and scope

The control server listens only on `127.0.0.1`. Configuration changes require an installation-specific local token. Router telemetry has a fixed safe schema and excludes prompts, message bodies, tool arguments, credentials, account identifiers, and authorization headers.

Inference continues if the control UI is unavailable. The router does not modify Grok Bot transcripts, profiles, native tools, or permissions.

## Remove

```bash
grok-codex-router service-stop
cp ~/sand-host/host-main.cjs.grok-codex-router-bak ~/sand-host/host-main.cjs
grok-codex-router restart-host
```
