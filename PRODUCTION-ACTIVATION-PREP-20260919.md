# Milestone 1 production activation preparation — 2026-09-19

This is the mutation plan after source/local and live read-only acceptance. Human
scope was later changed to allow exactly one replacement BOX pilot after the
original immutable pilot became durably Temporal. The current M1 pilot identity is:

```text
agent ID   507d1f34-56d5-4085-9b48-23d40cb9c914
profile    harness:"box"
route      chatgpt-web/extra-high / xhigh
```

The retired pilot `97cf83a0-0401-4481-9f3f-8b321921f8b0` remains durably
`harness:"temporal"` and is outside the router allowlist. It was not modified or
deleted during replacement.

The existing user-facing Bot remains `harness:"temporal"` and is outside every
router allowlist.

## Fixed source and live baselines

Router source is `rcnir/grok-codex-router` branch
`rcnir/milestone-1-20260919`. The activation source binds exactly one pilot ID in
`DEFAULT_CONFIG.pilot.agentIds`; `DEFAULT_CONFIG.enabled` remains `false`. The
production config artifact is `M1-PRODUCTION-CONFIG-20260919.json`; it alone sets
`enabled:true` for activation.

The router artifact actually staged during Gate 2A (source commit `c3dc4b629...`)
and its activation config are:

```text
router tarball
  rcnir-grok-codex-router-0.1.0-rcnir-m1.0.tgz
  bytes   154140
  sha256  b720fc269d047f05cce7ce9d5cf1fe0b20c5fda9807f79242216dbf868262f5f

production config
  M1-PRODUCTION-CONFIG-20260919.json
  bytes   1385
  sha256  acc6b5a4e90cb2496d4370d8a90dbe6a9d3d733ff5e5d7ecedc208c113d47f42
```

The router package smoke test loads the packed artifact without installing
`node_modules`: the one pilot admits and resolves to
`chatgpt-web/extra-high / xhigh`; another BOX and every auxiliary workload are
stock passthrough. Later documentation/evidence commits do not silently replace
this staged package. Because current host/profile facts drifted after Gate 2A, a
Gate-2C package must be repacked and reaccepted after those blockers are resolved.

Runtime source remains `rcnir/execution-runtime` commit
`72c80325e0a36c4068e8f02f4b750fc4bd8db26e`. The exact `codex-runtime` archive
from that commit is 1,536,000 bytes with SHA-256
`b6097a5ef8624ee93459ac3b86c01b62f977dc6852c970de8ae1a7336da37929`.
Its deterministic `gzip -n -9` transport artifact is 720,463 bytes with SHA-256
`5cb6ea8f31cd842590c9114e492ada63188731b242006b069836f2e14de5398d`.
For the existing text-only bounded native staging path, its no-newline base64 text
is 960,620 bytes (still below the 1 MiB decoded file-write limit) with SHA-256
`b7edcba46eae453a54d104221a5295bdd58863ca232864f7d52c7c0131bbadc8`.

Exact bounded transfer parts are recorded in
`M1-STAGE-TRANSFER-MANIFEST-20260919.json` (manifest SHA-256
`d80df970f0b02f4eb840f295bcb55908eedb0f52dcadb0ffa5c847d332e8937a`).
It contains 21 Runtime archive parts and 5 router-package parts, each at most
48,000 base64-text bytes, plus every per-part SHA-256.

Codex dynamic-only source is upstream `openai/codex` commit
`6b9826e3aa83b1a5947db50f4332cb9c65f1b340` plus patch SHA-256
`3084657c327fe53af7ef55f0fe718ed4bca78f1a39a5b989959bde298e617465`.
The patch manifest SHA-256 is
`f4df53e67fc999d0cfafacef6caadf60d22be892420330b90c2a0a9b0be7406e`.
Rust 1.95.0 is the pinned upstream build toolchain.

Fresh live Runtime baseline before any activation:

```text
/opt/rocaniiru/codex-runtime/current
  -> /opt/rocaniiru/codex-runtime/0.1.0-3c4f121
Runtime source commit
  3c4f1219164278f1ae67266e81b14f00b7904793
Runtime source archive SHA-256
  c91bae3c1705d2748dd84044753e4b6d98e60d164b1a9b1b281faca64f6b6848
Runtime-owned App Server PID
  883943 at the latest read-only baseline
Codex version
  codex-cli 0.154.0
stock Codex SHA-256
  3188814c35471432d4123203e0eb38e5bddc60226e3d7ddf0e59e649ea140022
stock Codex bytes
  262858016
standalone/current
  -> releases/0.154.0-x86_64-unknown-linux-musl
durable state.json before activation
  bytes   829029
  sha256  1be40ad48c92fca2fa4f0b80bffba6e9561e8f224c65e06aa0c510b1b77b6369
retained Thread set
  count   25
  sha256  66aab9a7ede58034ef51cfd39714e5cac9e3a84a0980c18580b2372324c31d55

filesystem preflight
  root/workspace/home/opt overlay available  ~110 GiB
  stock standalone release                 ~324 MiB
  current Runtime package                  ~9.5 MiB
```

There is also an independently started Codex App Server process. It is not owned
by the ROCANIIRU Runtime and must never be stopped by this plan. Both processes
currently execute the stock standalone binary. A later standalone `current`
switch changes only future launches; already-running unrelated processes keep
their open executable inode. This shared future-launch effect is an explicit
impact of the existing `run-codex.sh` deployment path and is not widened here.

The earlier verified Grok host compatibility target remains supported:

```text
Grok Bot             0.57.0
host version         18cd065
stock bytes          26438264
stock SHA-256        c667b530962bbf94a2ba77659b0440f20dd553dfdbabdd4a2cd157e4335bba29
patched bytes        26439011
patched SHA-256      07835cd847c027aa2628741c2fb93a7c2ebbcb67a55c4861254dfc51af522b1d
marker version       1
```

The Sand supervisor later performed an external upgrade that was not initiated by
this task. At Gate 2A preflight, that then-current target completed the same
source/local plus actual-host read-only acceptance:

```text
Gate-2A-preflight host version   251860d
stock bytes                     26453384
stock SHA-256                   2354d46da4304d11110645f4e7fa565a15de1b30cd1d80971db2b8934a278161
reviewed patched bytes          26454131
reviewed patched SHA            8d8c2c239667e38f421d6b96af994c279b69fdbaddbb91bed927f16a02aef5ea
router marker count    0
supervisor command     upgrade-251860d / upgrade
host running           true
pending upgrade        none
```

`grok-bot-0.57-251860d` remains `anchorProof:"VERIFIED"`. Its fresh actual-host anchor
counts were 1/1/1/1 in the reviewed order, all router markers were zero, and the
built read-only `--check` passed with `state=stock`. At that preflight there was no
router/config/journal directory, pristine backup or candidate Runtime/Codex release.
Gate 2A subsequently created only the approved versioned candidates; it did not
change either live `current` pointer. Its final postflight is recorded below.

## Gate 2A — build and stage only

This gate does **not** change either `current` symlink, stop a process, install
the router, write the host backup, patch `host-main.cjs`, restart Sand, or start a
provider/model Turn.

### Gate 2A execution result

Gate 2A was explicitly approved and completed as build/stage only. It produced:

```text
patched Codex 0.154.0 x86_64-musl
  bytes   1283274448
  sha256  790879dcee4a675f34cc1aba9a2ab3fd0edb447588cf97f5cb111967b12fc8e7
  static  PASS (no ELF interpreter / no dynamic NEEDED entries)

versioned standalone candidate
  /home/box/.codex/packages/standalone/releases/
    0.154.0-rcnir-dynamic-only-3084657-x86_64-unknown-linux-musl

Runtime candidate
  /opt/rocaniiru/codex-runtime/0.1.0-72c8032

Runtime candidate tests
  Python 114/114 PASS

candidate schema
  digest                    93fcd1f5a09f8192669e7ab24c65e35b8ef988456351895928ad103ecaf38d49
  tree SHA256               b7d78c70759cad42c27edf9242997ccc6ed4eceb5d37cc75ef87104d2e88a8a1
  dynamic_only_tool_policy  true
```

Neither `standalone/current` nor Runtime `current` changed. Runtime PID 883943,
generation 12, its 25 retained Threads, journal SHA, zero UNKNOWN/pending state,
and the unrelated App Server PID 1188039 remained untouched.

However, the final read-only postflight discovered two external changes that this
task did not perform: Sand advanced the stock host again from `251860d` to
`5ec1e7d` (`26460874` bytes / SHA-256
`8b0e2747c0b7b91fca368c886880b24906a28214e2979029a60a98d8ab0c9bc0`,
zero router markers), and the immutable pilot profile now reads
`harness:"temporal"` instead of the Gate-2A-preflight `harness:"box"`. The pilot
profile mtime is `2026-09-19 12:20:43.339102233 +0900`; no profile mutation was
issued by this task. Sand supervisor reports `upgrade-5ec1e7d / upgrade`.

Therefore Gate 2A artifacts are accepted as staged candidates, but **Gate 2B is
CLOSED**. Do not promote them until the Human explicitly resolves both the current
host compatibility and pilot-harness facts. Full evidence is in
`GATE-2A-EVIDENCE-20260919.json`.

Use one new scratch root:

```text
/workspace/rcnir-m1-activation-20260919
```

1. Stage the accepted Runtime archive, router tarball and production config under
   the scratch workspace through the **existing Groken ExecService** already used
   for read-only VM work; do not create a controller/tunnel/file-transfer service
   and do not read any credential value. Rebuild the local artifacts and verify
   their exact hashes before sending. Split Runtime/router standard-base64 text
   exactly according to `M1-STAGE-TRANSFER-MANIFEST-20260919.json`.

   For each part, issue one bounded command whose literal payload is at most
   48,000 bytes. The command is idempotent by content, not by blind append:

   ```sh
   set -eu
   mkdir -p /workspace/rcnir-m1-activation-20260919/transfer/<artifact>.parts
   p=/workspace/rcnir-m1-activation-20260919/transfer/<artifact>.parts/<NNN>
   expected=<per-part-sha256-from-manifest>
   if test -e "$p"; then
     test "$(sha256sum "$p" | cut -d' ' -f1)" = "$expected"
   else
     t="$p.tmp.$$"
     printf '%s' '<exact-part-text>' > "$t"
     test "$(sha256sum "$t" | cut -d' ' -f1)" = "$expected"
     mv "$t" "$p"
   fi
   ```

   After every part verifies, concatenate in numeric order, verify the complete
   base64-text SHA, decode **once** to a temporary binary, verify raw bytes/SHA,
   then rename into the scratch artifact. No append to the final artifact and no
   unverified decode is allowed. The 1,385-byte UTF-8 production config is staged
   as one create-only scratch file and verified against SHA `acc6b5a4...`.
2. Extract the Runtime archive and verify commit/archive plus
   `dynamic-only.patch`/`manifest.json` digests above. Clone public `openai/codex`,
   check out exactly `6b9826e3...`, and run:

   ```sh
   python3 <runtime-source>/codex-runtime/upstream/codex-0.154.0/manage_patch.py \
     --source <codex-source> --apply
   python3 <runtime-source>/codex-runtime/upstream/codex-0.154.0/manage_patch.py \
     --source <codex-source> --check
   ```

3. Build only the `codex` entrypoint for `x86_64-unknown-linux-musl` with a
   **scratch-only toolchain**. Do not use `apt`, replace the VM's system Rust,
   write `/usr/local`, or install a global Python package. The pinned inputs are:

   ```text
   Rust toolchain          1.95.0
   rustup-init target      x86_64-unknown-linux-gnu
   rustup-init URL         https://static.rust-lang.org/rustup/dist/x86_64-unknown-linux-gnu/rustup-init
   rustup-init SHA-256     dda7234360b7f578ca8b0ddcb80145646fa61a67c1720a5abc7051b35c9fcb71
   Rust build target       x86_64-unknown-linux-musl
   Zig                     0.14.0
   Zig tarball URL         https://ziglang.org/download/0.14.0/zig-linux-x86_64-0.14.0.tar.xz
   Zig tarball SHA-256     473ec26806133cf4d1918caf1a410f8403a13d979726a9045b421b685031a982
   CMake Python package    4.4.3
   CMake cp313 wheel SHA   bae3c4954623ec4d62e62c70443f0da7988b733111c2871fcc6a31ead5137e20
   Ninja Python package    1.13.2
   Ninja cp313 wheel SHA   65a24341b5ac09fcadcc37082660be40a94174e51a937fabf6e2cae26225fa2c
   rusty_v8 crate          150.4.0
   V8 checksum manifest    9bd5beb3a7bfa4f95bc887476ec3e4d564254c1815efe63296740e09bcc8665b
   V8 archive SHA-256      d06e08bcbf45a90cfeac8a4d322c7288775cb5e3609ca703ea312b155174e46a
   V8 binding SHA-256      7727826ae479bdb645e807239fb12d1f8e2e23de7a6cf16f5ee592690d1d8506
   ```

   Set `RUSTUP_HOME`/`CARGO_HOME` below the scratch root and install the musl
   target there. Extract Zig below the scratch root. Install pinned CMake/Ninja
   under a scratch prefix with the already-present Python/pip. Use Zig wrappers
   for target C/C++, and use the Rust 1.95 host toolchain's `rust-lld` as
   `CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER`. `codex-cli` does not depend
   on the separately packaged `codex-bwrap`, so production libcap is not a
   prerequisite for the `--bin codex` build.

   Set `CODEX_REPO_ROOT` to the exact checked-out Codex source and resolve
   `RUSTY_V8_ARCHIVE` plus `RUSTY_V8_SRC_BINDING_PATH` through the retained
   upstream `scripts/codex_package/v8.py`; it verifies OpenAI's pinned V8 release
   checksum manifest before Cargo sees the artifact. Build with
   `STABLE_GIT_COMMIT=6b9826e3aa83b1a5947db50f4332cb9c65f1b340` and:

   ```sh
   cargo build --target x86_64-unknown-linux-musl --release --bin codex
   ```

   Source/local acceptance has already proved the patched Rust/API contract and
   Runtime integration. A small x86_64-musl cross-link probe also passes with
   Rust 1.95 `rust-lld`. A full `codex` release cross-build on the arm64 macOS
   controller is **not** an authoritative production build: host proc-macro/native
   dependencies (for example SQLx/SQLite) must link for the macOS host while the
   final artifact links for Linux musl. That host/target split is why no local
   cross-build SHA is promoted as a production expectation. Gate 2A performs the
   authoritative build natively on the assigned x86_64 Linux VM and records that
   VM's actual binary bytes/SHA. If the scratch-only native build cannot complete
   without changing system packages, Gate 2A stops as a blocker; it must not fall
   through to `apt`, `/usr/local`, a `current` pointer, or a process restart.
4. Create but do not select the versioned standalone release:

   ```text
   /home/box/.codex/packages/standalone/releases/
     0.154.0-rcnir-dynamic-only-3084657-x86_64-unknown-linux-musl
   ```

   Copy the existing 0.154.0 release as the resource baseline and replace only
   `bin/codex` with the just-built entrypoint. `standalone/current` remains stock.
5. Create but do not select the Runtime candidate:

   ```text
   /opt/rocaniiru/codex-runtime/0.1.0-72c8032
   ```

   It must contain the exact archived `codex-runtime` source. Before schema
   publication, run the same Linux Runtime Python suite against this staged source:

   ```sh
   cd <candidate>/codex-runtime
   PYTHONPATH=<candidate>/codex-runtime PYTHONDONTWRITEBYTECODE=1 \
     /opt/rocaniiru/codex-runtime/venv/bin/python3 \
     -m unittest discover -s tests -v
   ```

   Then generate the schema
   from the staged patched binary. Because the candidate's normal `run-codex.sh`
   intentionally still resolves `standalone/current`, Gate 2A must **not** use that
   normal wrapper before promotion. Create one scratch-only schema wrapper that
   reproduces its privilege drop but names the staged release explicitly:

   ```sh
   # $STAGED_CODEX is the new versioned release's bin/codex.
   cat > "$SCRATCH/run-staged-codex.sh" <<EOF
   #!/bin/sh
   set -eu
   exec /usr/bin/setpriv --reuid=1000 --regid=1000 --clear-groups \
     --no-new-privs --pdeathsig TERM \
     /usr/bin/env -i HOME=/home/box USER=box LOGNAME=box \
     PATH=/home/box/.local/bin:/usr/local/bin:/usr/bin:/bin \
     "$STAGED_CODEX" "\$@"
   EOF
   chmod 0700 "$SCRATCH/run-staged-codex.sh"
   ```

   Then use the same schema-generation flags as the accepted production staging
   procedure:

   ```sh
   sudo /opt/rocaniiru/codex-runtime/venv/bin/python3 -I -B \
     <candidate>/codex-runtime/entrypoint.py schema generate \
     --codex "$SCRATCH/run-staged-codex.sh" --directory <candidate>/schema \
     --experimental --typescript --generator-uid 1000

   sudo /opt/rocaniiru/codex-runtime/venv/bin/python3 -I -B \
     <candidate>/codex-runtime/entrypoint.py schema verify \
     --codex "$SCRATCH/run-staged-codex.sh" --directory <candidate>/schema \
     --generator-uid 1000
   ```

6. Record exact patched Linux binary bytes/SHA-256 and generated schema digest.
   Gate 2A satisfied this identity gate with binary SHA-256
   `790879dcee4a675f34cc1aba9a2ab3fd0edb447588cf97f5cb111967b12fc8e7`
   and schema digest
   `93fcd1f5a09f8192669e7ab24c65e35b8ef988456351895928ad103ecaf38d49`;
   `Protocol.dynamic_only_tool_policy` evaluated `true`. Also
   record the staged binary's `codex --version` (`codex-cli 0.154.0`) and prove
   that the staged source/archive/patch hashes still match the Gate 2A inputs.
   Publish those accepted identities in the candidate's `SOURCE.json`; at minimum
   it must bind this complete tuple:

   ```json
   {
     "commit": "72c80325e0a36c4068e8f02f4b750fc4bd8db26e",
     "archiveSha256": "b6097a5ef8624ee93459ac3b86c01b62f977dc6852c970de8ae1a7336da37929",
     "codexUpstreamCommit": "6b9826e3aa83b1a5947db50f4332cb9c65f1b340",
     "codexPatchSha256": "3084657c327fe53af7ef55f0fe718ed4bca78f1a39a5b989959bde298e617465",
     "codexBinarySha256": "<Gate-2A measured>",
     "schemaSha256": "<Gate-2A generated>"
   }
   ```

   Gate 2B independently re-hashes the files and does not trust this JSON by
   itself.
7. Stage the exact router tarball and production config in the scratch root only;
   do not create `/home/box/grok-codex-router` or live config/state paths yet.

Rollback for 2A is deletion of the **new** scratch/candidate/release paths only.
No accepted journal, current pointer, process, host file, or Bot profile is touched.

## Gate 2B — Runtime/Codex promotion

This gate is not requested until 2A produces the staged binary/schema hashes.
It must run before the host/router gate.

Preflight must establish all of the following in one snapshot:

- Runtime `started=true`, `ready=true`, persistence `healthy`,
  `fenced=false`, `uncertain=false`.
- `unknown_operations=[]`, `pending_inputs=[]`, every retained Thread has
  `active_turn_id=null` and is not blocked.
- exact current Runtime target `0.1.0-3c4f121` and exact stock standalone target.
- candidate and patched release hashes equal the accepted Gate 2A evidence.
- native Runtime registration is enabled/registered.
- the unrelated App Server PID is recorded and excluded from all stop actions.

Promotion uses the existing `/var/lib/rcnir-codex-runtime/promotion.lock` and only
the Runtime-owned service lifecycle:

```sh
sudo /opt/rocaniiru/codex-runtime/current/codex-runtime/deploy/service.sh stop
```

The expected live effects of that stop are limited to the Runtime owner: the
native descriptor `/tmp/sand-desktop/rcnir-runtime/runtime.json` is unregistered,
the `rcnir-codex-service` tmux supervisor exits, `/run/rcnir-codex-runtime/mcp.sock`
disappears, and the Runtime-owned App Server process exits after TERM/wait. The
durable state under `/var/lib/rcnir-codex-runtime` remains in place. The unrelated
App Server process recorded by preflight is neither signaled nor adopted.

After proving the Runtime socket/supervisor/owned App Server are gone, atomically
switch these two pointers while the Runtime is stopped:

```text
/home/box/.codex/packages/standalone/current
  stock 0.154.0 -> staged dynamic-only 0.154.0 release

/opt/rocaniiru/codex-runtime/current
  0.1.0-3c4f121 -> 0.1.0-72c8032
```

The accepted atomic-pointer pattern is `new symlink -> os.replace(current) ->
fsync(parent) -> resolve-and-compare`. Preserve the existing ownership boundary:
`/home/box/.codex/packages/standalone/current` is uid/gid `1000:1000`, while
`/opt/rocaniiru/codex-runtime/current` is `0:0`. The promotion script must create
each temporary symlink with the matching owner (`os.lchown` before replace) and
must refuse to continue unless both old pointers resolve to the exact preflight
targets immediately before switching.

Then start only the Runtime-owned service:

```sh
sudo /opt/rocaniiru/codex-runtime/current/codex-runtime/deploy/service.sh start
```

Start re-registers the same native descriptor, recreates the Runtime socket and
rotates only the Runtime service log (`service.log` -> `service.previous.log`) as
the existing supervisor already does. It starts exactly one new Runtime-owned App
Server from the newly selected standalone binary.

Postflight requires a new Runtime-owned App Server PID, generation advance, exact
same retained Thread-ID set, zero pending/UNKNOWN, healthy persistence, and
`runtime_status.capabilities.dynamic_only_tool_policy=true`. No model Turn is
started. Durable session/operation identity is compared across the stop/start;
an older state file is never restored over a newer journal.

The candidate keeps `STATE_VERSION = 1`. `toolIsolation` is an optional additive
session field: retained pre-M1 sessions with no such field resolve to no retained
policy and are revalidated normally; only sessions that previously persisted an
effective tool-isolation value require that same value on resume. Therefore Gate
2B does not rewrite or migrate the existing 25-session journal merely to activate
the capability.

Rollback on any failed postflight: stop the candidate through `service.sh stop`,
atomically restore both `current` pointers to their exact old targets, start the
old Runtime through `service.sh start`, and prove the same Thread set plus healthy
zero-pending/zero-UNKNOWN state. Never `pkill`, never start a second Runtime/App
Server, and never restore the saved pre-promotion journal over the current one.

## Gate 2C — router install, config, host patch and Sand restart

This gate remains closed until Gate 2B passes and the pilot is authoritatively BOX.
It does not include any provider or model inference. Host compatibility itself has
now been re-established for the current stock target `grok-bot-0.57-5ec1e7d`.

Preflight rechecks:

- dynamic-only Runtime capability is live and Runtime is idle/healthy.
- pilot profile is `harness:"box"`; user-facing Bot is still
  `harness:"temporal"`.
- Computer is the same service identity and `clear/CLEAR`.
- `patch-host --check --compat grok-bot-0.57-5ec1e7d` reports stock with SHA
  `8b0e2747c0b7b91fca368c886880b24906a28214e2979029a60a98d8ab0c9bc0`.
- `/home/box/grok-codex-router`, live router config/journal directory and pristine
  host backup are still absent.
- Sand supervisor is fresh/running and has no pending command.

Then, and only then:

1. Extract the accepted router package into `/home/box/grok-codex-router`. The
   package smoke test proves the active M1 `require(package)` path needs no
   `node_modules` install. The npm tarball has the normal `package/` prefix, so
   create the destination as uid/gid `1000:1000`, mode 0755, and extract with
   `tar --strip-components=1`; `/home/box/grok-codex-router/package.json` and
   `/home/box/grok-codex-router/dist/src/session.js` must exist afterward.
2. Create `/home/box/sand-data/grok-codex-router-state` owned by `box`, mode 0700.
3. Atomically install `M1-PRODUCTION-CONFIG-20260919.json` as
   `/home/box/sand-data/grok-codex-router.json`, owned by `box`, mode 0600.
4. Apply the already-reviewed deterministic host transform:

   ```sh
   node /home/box/grok-codex-router/dist/scripts/patch-host.js \
     --compat grok-bot-0.57-5ec1e7d \
     --host /home/box/sand-host/host-main.cjs \
     --backup /home/box/sand-host/host-main.cjs.grok-codex-router-bak
   ```

   This must create the pristine backup exclusively at mode 0600 with stock
   SHA-256 `8b0e2747c0b7b91fca368c886880b24906a28214e2979029a60a98d8ab0c9bc0`
   and replace the host atomically with exact patched bytes `26461621` / SHA-256
   `58493df0bc8fa4b22d981a23835468fa4908a3f73c1819b27375eaaab13e018f`.
   A follow-up `--check` must report `state=patched` before restart.
5. Restart through the existing Sand supervisor only:

   ```sh
   node /home/box/grok-codex-router/dist/scripts/restart-host.js
   ```

   No `pkill`, alternate host, alternate runtime or second process tree is allowed.
6. Postflight: host still version `5ec1e7d`, exact patched SHA, complete version-1
   markers, supervisor host running, pilot/Temporal profiles unchanged, Runtime
   still healthy dynamic-only capable, Computer still clear. Do **not** start the
   pilot Turn.

Rollback before the Sand restart: run the same patcher with `--restore`; because
the running host has not loaded the patched file yet, no restart is needed after a
successful pre-restart restore. Rollback after a Sand restart: restore the exact
pristine backup with `--restore`, verify stock SHA `8b0e2747...`, then request one
supervisor-controlled restart back onto stock. Disable/remove the router config
and package only after the host file is stock again. The pristine backup remains
evidence unless a later separately approved cleanup removes it.

## After Gate 2C

No provider/model call is implied by any of these gates. The first pilot Turn is a
separate Human decision after the fully activated system is read back with zero
pending/UNKNOWN state.

## Approval boundaries

Gate 2A produced the required Runtime/Codex hashes and current host `5ec1e7d` passed
fresh compatibility acceptance. The Human then authorized exactly one replacement
BOX pilot. `507d1f34-56d5-4085-9b48-23d40cb9c914` is durably `harness:"box"`, has
no Turn, and is now the singleton M1 allowlist identity. The retired Temporal pilot
and user-facing Temporal Bot are unchanged. With that blocker resolved, Gate 2B is
authorized to proceed; Gate 2C remains separate and is not implied by Gate 2B.

### Completed: Gate 2A

Gate 2A was approved and completed within the following boundary:

- creation of `/workspace/rcnir-m1-activation-20260919` and scratch toolchain/build
  files below it;
- public source/toolchain downloads pinned above;
- creation of the new, currently absent standalone release
  `0.154.0-rcnir-dynamic-only-3084657-x86_64-unknown-linux-musl`;
- creation of the new, currently absent Runtime candidate
  `/opt/rocaniiru/codex-runtime/0.1.0-72c8032`;
- candidate schema generation/verification and Runtime Python tests;
- read-only comparison of all generated identities with the accepted inputs.

It explicitly does **not** authorize changing either `current` symlink, stopping or
starting any process, writing the live router/config/journal, writing a host backup,
changing `host-main.cjs`, requesting a Sand restart, changing any Bot profile, or
starting provider/model inference.

Gate 2A returned the measured Linux Codex SHA/bytes, schema SHA, candidate
`SOURCE.json`, tests and unchanged live pointers/processes. Its provider-owned host
and pilot-profile postconditions changed externally, so those measured candidate
identities are retained but do not by themselves open Gate 2B.

### Later approval: Gate 2B

Gate 2B is now explicitly authorized by the Human after replacement-pilot
acceptance. It authorizes the one clean Runtime stop, two atomic pointer switches,
and one Runtime start described above. It never touches the Grok host/router and
does not start a Turn.

### Later approval: Gate 2C

Only after Gate 2B acceptance, Gate 2C may authorize router/config installation,
one pristine host backup, the verified deterministic `5ec1e7d` patch and one
supervisor-owned Sand restart. Gate 2C still does not start the pilot Turn.
