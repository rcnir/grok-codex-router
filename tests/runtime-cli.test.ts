import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { LocalRuntimeClient, RuntimeFault, RUNTIME_SOCKET } from "../src/runtime-client.js";

test("Runtime CLI receives large image/text JSON through stdin, never process argv", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "grok-cli-fixture-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const discovery = spawnSync("python3", ["-c", "import sys; print(sys.executable)"], { encoding: "utf8" });
  assert.equal(discovery.status, 0, "Local CLI fixtures require Python 3, not a real Runtime/App Server");
  const entrypoint = path.join(directory, "entrypoint.py");
  fs.writeFileSync(entrypoint, [
    "import json,sys",
    "assert sys.argv[1] == 'client'",
    "assert sys.argv[-1] == '--arguments-stdin'",
    "assert '--arguments-json' not in sys.argv",
    "assert not any('FIXTURE_PRIVATE' in arg for arg in sys.argv)",
    "raw=sys.stdin.buffer.read(12*1024*1024+1)",
    "body=json.loads(raw.decode('utf-8'))",
    "assert body['input_items'][0]['type']=='text'",
    "assert body['input_items'][1]['type']=='image'",
    "print(json.dumps({'structuredContent':{'ok':True,'body_bytes':len(raw),'mode':'fixture-client-only'}}))"
  ].join("\n"));
  const client = new LocalRuntimeClient({ python: discovery.stdout.trim(), entrypoint, socket: RUNTIME_SOCKET });
  const args = { session_id: "fixture", operation_id: "fixture", input_items: [
    { type: "text", text: "FIXTURE_PRIVATE日本語".repeat(16000) },
    { type: "image", url: "data:image/png;base64," + "YQ==".repeat(100000) }
  ] };
  const result = await client.call("runtime_turn_start", args);
  assert.equal(result.mode, "fixture-client-only");
  assert.equal(result.body_bytes, Buffer.byteLength(JSON.stringify(args)));
  assert.ok((result.body_bytes as number) > 128 * 1024);
});

test("Runtime client validates assigned paths/socket before any child process", () => {
  assert.throws(() => new LocalRuntimeClient({ python: "python3", entrypoint: "/tmp/entrypoint.py", socket: RUNTIME_SOCKET }), RuntimeFault);
  assert.throws(() => new LocalRuntimeClient({ python: "/usr/bin/python3", entrypoint: "/tmp/daemon.py", socket: RUNTIME_SOCKET }), RuntimeFault);
  assert.throws(() => new LocalRuntimeClient({ python: "/usr/bin/python3", entrypoint: "/tmp/entrypoint.py", socket: "/tmp/other.sock" }), RuntimeFault);
});
