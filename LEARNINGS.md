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
