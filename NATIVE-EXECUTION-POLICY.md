# Codex 0.154.0 thread-local dynamic-only contract

## Scope and status

This source candidate adds a bounded patch to exact upstream Codex commit
`6b9826e3aa83b1a5947db50f4332cb9c65f1b340` (`rust-v0.154.0`). It does not
change shared Codex configuration or managed requirements. It does not install
a second App Server, a new service or a different execution plane.

The patch is owned by the existing Runtime repository at
`codex-runtime/upstream/codex-0.154.0/`. Its manifest binds the upstream commit,
patch digest and exact before/after source-file hashes. Generated schema changes
are included. The current local validation result is recorded separately in
`DYNAMIC-ONLY-EVIDENCE-20260919.json`; implementation alone is not acceptance.

**Not deployed. Human Gate 1 remains closed.** The current Grok 0.53 production
manifest remains `anchorProof:"BLOCKED"`. No fresh VM/Computer/host probes, unknown
operation retries or acknowledgements are part of this source-only continuation.

## Typed, immutable thread policy

`ToolIsolation` has two wire values: `default` and `dynamicOnly`.
`thread/start.toolIsolation` selects it for a newly created thread. Omission keeps
the default normal tool surface. It is not an ordinary recursive config override.

The typed value passes through `ThreadStartParams`, `StartThreadOptions`,
`SessionSpawnArgs`, `SessionConfiguration`, and each derived `TurnContext`.
It is persisted in the existing `SessionMeta` record through the thread-store and
rollout recorder. Resume restores the stored value; copied and reference-backed
forks inherit the source metadata. Old metadata with an omitted value remains
`default`. Unknown enum values are rejected instead of silently becoming default.

There is no resume/turn/config setter that downgrades a stored dynamic-only thread.
Model changes, review contexts and MCP configuration refresh do not change the
thread's immutable policy. A fresh, independently host-created thread has its own
policy; this is not a new process-wide or transitive global authorization system.
Model-initiated native collaboration tools are absent from the isolated registry.

The legacy `thread/resume.history` input creates a **new history-derived thread**;
it does not overwrite the policy of the persisted thread identified by its normal
resume path. The router does not use this input as a recovery mechanism.

## Tool-plan enforcement

`core/src/tools/spec_plan.rs::build_tool_router` checks the policy before adding
native, MCP, resource, extension or hosted tools. Its dynamic-only path starts with
an empty registry and calls only `append_dynamic_tool_runtimes` with Grok's supplied
catalog. This constrains both the model-visible schemas and the executable handler
registry; hiding a schema while leaving a callable native handler is insufficient.

Finalization preserves existing dynamic schema conversion and collision checks,
but does not add native tool search, code-mode dispatchers or child-management
tools. The effective tool mode is Direct even if model metadata selects code mode.
Deferred dynamic tools become directly exposed so they remain callable without
introducing a native discovery tool. Dynamic namespaces remain supported.

Consequently the isolated plan has no native shell/exec, apply_patch, view_image,
MCP tools/resources, apps/plugins/extensions, hosted or standalone web search,
image generation, native request_input/permissions, sleep/clock, subagents,
tool search or code-mode entrypoints. Browser/computer MCP tools such as
`node_repl` and `cua_repl` are excluded by the same boundary, not by an invented
second browser policy. Grok-supplied dynamic tools retain their existing response
and call-ID contract.

Shared MCP connections and refresh behavior remain intact. A new global MCP server
can be present internally without entering an isolated thread's next tool plan.
The normal thread still uses the original construction path and normal refresh.

## Runtime capability and effective-policy proof

`runtime_session_open(..., tool_isolation="dynamicOnly")` maps to the typed
App Server creation field. Supplied policy participates in the existing canonical
creation fingerprint. Old callers that omit it retain their prior fingerprint.

`runtime_status.capabilities.dynamic_only_tool_policy` is derived from the verified
App Server schema: the start request must have the exact policy enum and the start
and resume responses must require the effective `toolIsolation` field with the
same enum. The existing Runtime executable/schema verification remains mandatory.
An unmodified 0.154 schema does not advertise this capability. Merely installing
new Runtime Python code cannot turn stock Codex into a dynamic-only provider.

Start/resume/fork response fields are read from the actual session configuration,
not copied from the request. Runtime must retain acknowledged effective policy and
check resumed effective policy before allowing that thread to run. Missing or
different effective policy is a thread-level failure, never permission to retry a
creation, replay an operation or silently select another execution path.

## Router admission

The production verifier requires both the explicit requested policy `dynamicOnly`
and `capabilities.dynamic_only_tool_policy === true`. It otherwise stops with
`NATIVE_TOOL_CONTRACT_UNVERIFIED` before opening a session. After opening, the router
also requires the exact effective `tool_isolation:"dynamicOnly"` response before
injecting transcript or starting a Turn. There is no injectable fake verifier in
the production path. Fake Runtime tests use the same capability/request/echo checks.

The actual Grok dynamic catalog is still supplied. Existing model selection,
transcript injection, structured current input, exact request_id/generation and
callId correlation, same-Turn tool responses, cancellation and no-replay journal
remain in place. No source change permits raw/private reasoning to be exposed.

## Why the earlier stock alternatives stay rejected

Ordinary `mcp_servers:{}` recursively merges with inherited configuration, and
later refresh can add global entries. Sandbox/approval settings are not a native
tool deny-all. Enumerating currently known MCP names does not constrain future
servers. The patch therefore enforces the invariant at tool construction instead
of disabling many feature flags or changing global managed requirements.

The earlier stock-source investigation is preserved in Git history at router
commit `8ef30c035c7cf2a24424f677e88d260c60ea1bd7`. Its inability to prove a stock
contract must not be confused with acceptance of this separately tested source
patch, or with future live deployment acceptance.
