# ROCANIIRU Grok Codex Router — Milestone 1 source candidate

This fork starts at `IgorWarzocha/grok-codex-router@599a2013b15592d17fe897126f549974351e4c3f`.
It retains the upstream source layout and wire helpers, but its package entrypoint
routes through the **existing** ROCANIIRU Runtime CLI/MCP boundary, not the private
Responses endpoint, OAuth stores, WebSocket or SSE transports described below.

**Not deployed. Not Milestone-1 accepted. Human Gate 1 is closed.**
The current-host 0.53 anchor proof and complete Codex 0.154.0 native-execution
exclusion contract are unverified. Production patch/restore and production
inference admission therefore fail closed. Successful fixture tests do not remove
either gate. Do not run a live pilot, install, host restart or provider inference.

See [`MILESTONE-1.md`](MILESTONE-1.md) for the implementation contract and status,
[`NATIVE-EXECUTION-POLICY.md`](NATIVE-EXECUTION-POLICY.md) for the remaining native
authority proof, and [`LEARNINGS.md`](LEARNINGS.md) for integration corrections.

Local development uses Node, Bun and the pinned dev dependencies. `npm run check`
builds and runs **local fake/fixture tests only**, plus upstream local telemetry
ingestion. The old live `vm-contract` test is not part of that command.
`npm run knip` checks both the active modules and deliberately retained upstream
modules; lint entry declarations do not put retained transports on the live path.

## Archived upstream README — not the M1 runbook

The following original description and commands are retained for upstream
comparison. They are **not current installation or operation instructions** for
this ROCANIIRU candidate. In particular, do not apply upstream `install.sh` to 0.53.

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
