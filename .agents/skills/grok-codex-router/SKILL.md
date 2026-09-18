---
name: grok-codex-router
description: "ROCANIIRU M1 source candidate: read before editing, testing or assessing any Grok Router activation."
---

Read `MILESTONE-1.md`, `NATIVE-EXECUTION-POLICY.md` and `LEARNINGS.md` first.
The pinned upstream is `599a2013b15592d17fe897126f549974351e4c3f`. Keep its
source layout and history; do not replace this integration with another router.

The only new inference transport is the existing Runtime CLI/MCP boundary at
`/run/rcnir-codex-runtime/mcp.sock`. Never start another App Server or replace a
live Runtime in order to test this source candidate. Do not use the retained
OAuth/private Responses/WebSocket/SSE modules as a fallback.

Only explicitly allowlisted, immutable pilot agent IDs with an actual
`profile.harness === "box"` and a proven root inference identity can route.
Temporal, other BOX, summary, subagent, browser, computer, automation and group
workloads remain stock. Never change an existing Temporal profile to box.

Run `npm run knip` and `npm run check` locally. Those checks do not authorize
live VM acceptance, installation or inference. Do not run the archived
`vm-contract` suite as a substitute for the scoped read-only acceptance.

Production host anchor proof is BLOCKED; production native-tool policy is
UNVERIFIED. Neither a custom fixture manifest nor a test-only verifier is
deployment evidence. Do not bypass these guards or infer readiness from tests.

No UNKNOWN operation may be retried, replayed or assigned a replacement operation
ID. Keep pending durable state blocked after restart. Do not delete journals to
make progress. Preserve official reasoning summaries only; never expose raw
reasoning/private chain of thought, credentials, prompts, tool arguments or
provider response bodies in logs or diagnostics.

Human Gate 1, only after every prerequisite passes, concerns ONE new pilot via
the official `createAgent` path with `harness:"box"`. It does not authorize a
router install, a host backup/write/restart, Runtime replacement, or inference.
