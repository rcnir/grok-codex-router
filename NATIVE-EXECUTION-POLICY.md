# Codex 0.154.0 thread-local native execution exclusion

## Result

**UNVERIFIED. No production Grok-owned thread is admitted.**
`productionThreadPolicy.verify()` in `src/native-execution-policy.ts` rejects before
`runtime_session_open`. No configuration flag or environment variable turns it on.
Fake tests explicitly inject a verifier to test lifecycle mechanics; that injection
is not proof that Codex native execution has been disabled. Do not remove the gate
because `sandbox:"read-only"` or `approval_policy:"never"` was supplied. Neither is
a dynamic-tools-only contract; read-only native shell/web/MCP activity can still be
a second execution authority.

## Pinned primary source

Official repository `openai/codex`, tag `rust-v0.154.0`, peeled source commit
`6b9826e3aa83b1a5947db50f4332cb9c65f1b340`. This is public source inspection,
not a fresh live installed-binary fingerprint or a real thread execution test.

Evidence paths below are relative to that pinned repository:

- `codex-rs/app-server/src/config_manager.rs:186-198,216-254`: `thread/start.config`
  request overrides are converted to TOML and appended after process CLI overrides
  when loading the thread's effective configuration. They are a real per-thread
  configuration layer, not a process-wide config-file edit.
- `codex-rs/config/src/overrides.rs:9-14,17-98` and
  `codex-rs/config/src/merge.rs:57-59,95-134`: dotted override construction and
  recursive table merge. In particular **`mcp_servers:{}` does not clear inherited
  configured servers**. Treating an empty table as global MCP denial is incorrect.
- `codex-rs/core/src/tools/spec_plan.rs:1079-1087,1202-1204,1255-1258,1269-1280`:
  environment presence gates shell, request_permissions, apply_patch and view_image.
  Explicit empty environments are materially different from omission/defaults.
- `codex-rs/core/src/tools/spec_plan.rs:1128-1133`: native MCP resource tools depend
  on the MCP catalog, not only environment access.
- `codex-rs/app-server/src/extensions.rs:75-134`: the thread registry installs
  multiple extension contributors, including MCP/executor plugins, web search,
  image generation, skills, guardian and memory-related contributors. Registration
  alone does not prove activity, but each applicable execution path needs a real
  effective-config exclusion proof.

## Acceptance still required

### Bounded source review findings

The source-proven generic MCP deny-all is an **empty managed-requirements
`mcp_servers` allowlist**, not an empty ordinary configuration map.
`core/src/config/mod.rs:2088-2110` disables every effective unmatched MCP server;
`1643-1680` applies the top-level requirements to plugin MCP too. Normal thread
config overrides do not author this managed-requirements layer.

Enumerating current MCP names and setting each `enabled:false` is not a stable
substitute: `app-server/src/mcp_refresh.rs:191-237` tests a later global MCP entry
being merged alongside preserved thread overrides. Also, disabling apps does not
hide ordinary MCP (`core/src/mcp_tool_exposure.rs:75-145`).
`orchestrator.mcp.enabled` is a CODEX_APPS special case
(`core/src/tools/handlers/mcp_resource.rs:43-56`), and `features.tool_registry`
is metadata/collision configuration (`features/src/feature_configs.rs:9-18`),
not a generic native-tool deny-all.

Other source-proven exclusions would still need to be part of an enforced, pinned
thread profile before admission. They are **not currently installed or forwarded**
by the M1 production path:

| Authority | Relevant thread-local contract / evidence |
| --- | --- |
| Shell/file/environment tools | Explicit `environments:[]`; `app-server-protocol/src/protocol/thread.rs:129-137` and environment-gated tool construction cited above. |
| Native subagents | `agents.enabled:false`, `features.multi_agent_v2:false`, defensively `multi_agent:false`; v2 otherwise takes precedence (`config/src/config_toml.rs:680-685`, `core/src/config/mod.rs:1544-1571`, `core/src/tools/spec_plan.rs:648-659`). |
| Hosted web search | Top-level `web_search:"disabled"`; explicit mode precedence (`core/src/config/mod.rs:2628-2639`) and no hosted spec when disabled (`core/src/tools/hosted_spec.rs:14-20`). |
| Command hooks | `features.hooks:false`; hooks include SessionStart/UserPromptSubmit and default enabled (`features/src/lib.rs:1167-1170`, `config/src/hook_config.rs:35-60,161-174`). Feature false reaches `HooksConfig` and an empty registry (`core/src/session/mod.rs:4705-4733`, `hooks/src/registry.rs:304-307`). |
| Memory helpers | `memories.generate_memories:false`, `use_memories:false`, `dedicated_tools:false`, `features.memories:false`; defaults and persisted memory mode in `config/src/types.rs:289-346`, `core/src/session/session.rs:886-923`. |
| Apps/plugins/image generation | Review and pin `features.apps`, `plugins`, `remote_plugin`, `tool_suggest`, `recommended_plugins`, `image_generation` false (`features/src/lib.rs:1283-1365,1457-1460`; `core/src/tools/spec_plan.rs:699-735`). This does not solve generic MCP. |
| Code-mode execution | Feature flags alone do not override model `tool_mode` (`core/src/tools/mod.rs:68-89`). `code_mode_host:false` with `code_mode.disable_in_process_fallback:false` selects the disabled provider (`core/src/thread_manager.rs:472-479`, `code-mode/src/remote_session.rs:92-102`). |

Browser/computer are also a separate host/managed-policy boundary in this source:
the feature comments describe requirements-only gates (`features/src/lib.rs:236-271`)
and `allow_browser_and_computer_use` is a managed requirements field
(`config/src/config_requirements.rs:1000-1013`). Do not claim ordinary thread
`features.browser_use:false/computer_use:false` proves that boundary.

For a Grok dynamic-only thread, `dynamicTools` must explicitly contain the mapped
Grok tool catalog (or an empty list when Grok supplied no tools). Do not copy an
empty-catalog research example into an actual tool-using Grok run.

Thus this task has **not established an operational thread-local native-exclusion
configuration**. Changing shared managed requirements or adding a dedicated
App Server thread-local deny-all capability is a separate reviewed design/change;
neither was performed to bypass the user's unchanged-live/shared-process constraint.

Identify and validate an exact thread-local contract excluding inherited MCP,
plugin/application tools, native web/browser/computer and subagent execution, plus
any execution-capable extension contributors. Verify the *effective* contract,
including defaults, model-dependent tool eligibility and config refresh semantics;
do not rely solely on requested flags or on an instruction telling the model not
to call native tools. Keep harmless non-execution utilities distinct from actual
execution authority instead of inventing a nonexistent universal tool switch.

No shared App Server process configuration or Runtime live installation was changed
for this research. No separate App Server, paid model turn, native tool invocation,
global MCP disabling or Secret Broker change is permitted by the current task gate.
