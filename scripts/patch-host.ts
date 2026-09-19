#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  GROK_BOT_053_11DD264_MANIFEST
} from "./manifests/grok-bot-0.53-11dd264.js";
import { GROK_BOT_057_18CD065_MANIFEST } from "./manifests/grok-bot-0.57-18cd065.js";
import { GROK_BOT_057_251860D_MANIFEST } from "./manifests/grok-bot-0.57-251860d.js";
import { GROK_BOT_057_5EC1E7D_MANIFEST } from "./manifests/grok-bot-0.57-5ec1e7d.js";
import type {
  GrokBotHostCompatibilityManifest,
  HostFingerprint
} from "./manifests/types.js";

const SESSION_START = "/* GROK_CODEX_ROUTER_SESSION_START */";
const SESSION_END = "/* GROK_CODEX_ROUTER_SESSION_END */";
const IDENTITY_START = "/* GROK_CODEX_ROUTER_IDENTITY_START */";
const IDENTITY_END = "/* GROK_CODEX_ROUTER_IDENTITY_END */";
const SERVICE_START = "/* GROK_CODEX_ROUTER_SERVICE_START */";
const SERVICE_END = "/* GROK_CODEX_ROUTER_SERVICE_END */";
const MARKERS = [
  SESSION_START,
  SESSION_END,
  IDENTITY_START,
  IDENTITY_END
] as const;

interface CliOptions {
  host?: string | undefined;
  backup?: string | undefined;
  manifest?: string | undefined;
  compat?: string | undefined;
  check: boolean;
  restore: boolean;
}

interface HostInspection {
  state: "stock" | "patched";
  hostBytes: Buffer;
  stockBytes: Buffer;
  patchedBytes: Buffer;
}

function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

function sha256(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function fail(message: string): never {
  throw new Error(message);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { check: false, restore: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") {
      options.check = true;
      continue;
    }
    if (argument === "--restore") {
      options.restore = true;
      continue;
    }
    if (argument === "--host" || argument === "--backup" || argument === "--manifest" || argument === "--compat") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`${argument} requires a value`);
      if (argument === "--host") options.host = value;
      if (argument === "--backup") options.backup = value;
      if (argument === "--manifest") options.manifest = value;
      if (argument === "--compat") options.compat = value;
      index += 1;
      continue;
    }
    fail(`unknown argument: ${argument}`);
  }
  if (options.check && options.restore) fail("--check and --restore are mutually exclusive");
  if (options.manifest && options.compat) fail("--manifest and --compat are mutually exclusive");
  return options;
}

const BUILTIN_MANIFESTS = Object.freeze<Record<string, GrokBotHostCompatibilityManifest>>({
  "grok-bot-0.53-11dd264": GROK_BOT_053_11DD264_MANIFEST,
  "grok-bot-0.57-18cd065": GROK_BOT_057_18CD065_MANIFEST,
  "grok-bot-0.57-251860d": GROK_BOT_057_251860D_MANIFEST,
  "grok-bot-0.57-5ec1e7d": GROK_BOT_057_5EC1E7D_MANIFEST
});

function validateFingerprint(value: HostFingerprint | undefined, label: string): void {
  if (!value || !Number.isInteger(value.bytes) || value.bytes <= 0) {
    fail(`${label}.bytes must be a positive integer`);
  }
  if (typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256)) {
    fail(`${label}.sha256 must be a lowercase SHA-256 digest`);
  }
}

function validateManifest(raw: unknown): GrokBotHostCompatibilityManifest {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) fail("manifest must be an object");
  const manifest = raw as Partial<GrokBotHostCompatibilityManifest>;
  if (typeof manifest.grokBotVersion !== "string" || !manifest.grokBotVersion) {
    fail("manifest.grokBotVersion must be a non-empty string");
  }
  if (typeof manifest.hostVersion !== "string" || !manifest.hostVersion) {
    fail("manifest.hostVersion must be a non-empty string");
  }
  if (typeof manifest.hostPath !== "string" || !manifest.hostPath) {
    fail("manifest.hostPath must be a non-empty string");
  }
  if (manifest.anchorProof !== "VERIFIED" && manifest.anchorProof !== "BLOCKED") {
    fail("manifest.anchorProof must be VERIFIED or BLOCKED");
  }
  if (manifest.routerMarkerVersion !== 1) fail("manifest.routerMarkerVersion must be 1");
  validateFingerprint(manifest.stockHost, "manifest.stockHost");
  const stockHost = manifest.stockHost;
  if (!stockHost) fail("manifest.stockHost is required");
  if (manifest.deterministicPatchedHost !== undefined) {
    validateFingerprint(manifest.deterministicPatchedHost, "manifest.deterministicPatchedHost");
  }
  if (manifest.pristineBackup !== undefined) {
    if (manifest.pristineBackup.sha256 !== stockHost.sha256) {
      fail("manifest.pristineBackup.sha256 must equal manifest.stockHost.sha256");
    }
    if (manifest.pristineBackup.mode !== 0o600) {
      fail("manifest.pristineBackup.mode must be 0600");
    }
  }
  if (!manifest.anchors || typeof manifest.anchors !== "object") fail("manifest.anchors must be an object");
  const anchorEntries = Object.entries(manifest.anchors).filter((entry): entry is [string, string] =>
    typeof entry[1] === "string" && entry[1].length > 0
  );
  for (const [name, anchor] of anchorEntries) {
    if (!anchor) fail(`manifest anchor ${name} must be a non-empty string`);
  }
  if (typeof manifest.anchors.inferenceOwner !== "string" || !manifest.anchors.inferenceOwner) {
    fail("manifest anchor inferenceOwner must be a non-empty string");
  }
  if (typeof manifest.anchors.mainSessionOptions !== "string" || !manifest.anchors.mainSessionOptions) {
    fail("manifest anchor mainSessionOptions must be a non-empty string");
  }
  const hookAnchors = [manifest.anchors.nativeSession, manifest.anchors.inferenceHook]
    .filter((anchor): anchor is string => typeof anchor === "string" && anchor.length > 0);
  if (hookAnchors.length !== 1) {
    fail("manifest must define exactly one inference hook anchor: nativeSession or inferenceHook");
  }
  const requiredAnchorCounts = manifest.requiredAnchorCounts ?? Object.fromEntries(
    anchorEntries.map(([name]) => [name, 1])
  );
  for (const [name, expected] of Object.entries(requiredAnchorCounts)) {
    const anchor = (manifest.anchors as Record<string, string | undefined>)[name];
    if (typeof anchor !== "string" || !anchor) fail(`required anchor ${name} is not defined`);
    if (!Number.isInteger(expected) || expected !== 1) fail(`required anchor count ${name} must be exactly 1`);
  }
  for (const [name] of anchorEntries) {
    if (requiredAnchorCounts[name] !== 1) fail(`manifest anchor ${name} must have required count 1`);
  }
  return manifest as GrokBotHostCompatibilityManifest;
}

function loadManifest(manifestPath: string | undefined, compat: string | undefined): GrokBotHostCompatibilityManifest {
  if (!manifestPath) {
    const selected = compat ? BUILTIN_MANIFESTS[compat] : GROK_BOT_053_11DD264_MANIFEST;
    if (!selected) fail(`unknown built-in compatibility: ${compat}`);
    return validateManifest(selected);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`failed to read compatibility manifest ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return validateManifest(raw);
}

function inferenceHookAnchor(manifest: GrokBotHostCompatibilityManifest): string {
  const anchor = manifest.anchors.inferenceHook ?? manifest.anchors.nativeSession;
  if (!anchor) fail("manifest inference hook anchor is unavailable");
  return anchor;
}

function resolvedPath(file: string): string {
  const absolute = path.resolve(file);
  try { return fs.realpathSync(absolute); }
  catch { return absolute; }
}

function lexicalSymlinkTarget(file: string): string {
  let current = path.resolve(file);
  const seen = new Set<string>();
  for (let depth = 0; depth < 16 && !seen.has(current); depth += 1) {
    seen.add(current);
    try {
      if (!fs.lstatSync(current).isSymbolicLink()) break;
      current = path.resolve(path.dirname(current), fs.readlinkSync(current));
    } catch {
      break;
    }
  }
  return current;
}

function rejectCustomManifestOnProductionHost(manifestPath: string | undefined, hostFile: string): void {
  if (!manifestPath) return;
  const canonical = path.resolve(GROK_BOT_053_11DD264_MANIFEST.hostPath);
  const canonicalResolved = resolvedPath(canonical);
  const host = path.resolve(hostFile);
  const hostResolved = resolvedPath(host);
  const hostSymlinkTarget = lexicalSymlinkTarget(host);
  if (host === canonical || hostResolved === canonical || hostSymlinkTarget === canonical ||
      host === canonicalResolved || hostResolved === canonicalResolved || hostSymlinkTarget === canonicalResolved) {
    fail("CUSTOM_MANIFEST_FORBIDDEN_ON_PRODUCTION_HOST");
  }
}

function readCanonicalUtf8(file: string): { bytes: Buffer; source: string } {
  const bytes = fs.readFileSync(file);
  const source = bytes.toString("utf8");
  if (!Buffer.from(source, "utf8").equals(bytes)) fail(`${file} is not canonical UTF-8 text`);
  return { bytes, source };
}

function validateStockFingerprint(
  bytes: Buffer,
  manifest: GrokBotHostCompatibilityManifest,
  label: string
): void {
  if (bytes.length !== manifest.stockHost.bytes) {
    fail(`${label} byte size ${bytes.length} is not the reviewed ${manifest.stockHost.bytes}`);
  }
  const digest = sha256(bytes);
  if (digest !== manifest.stockHost.sha256) {
    fail(`${label} SHA-256 ${digest} is not the reviewed ${manifest.stockHost.sha256}`);
  }
}

function validateAnchors(source: string, manifest: GrokBotHostCompatibilityManifest): void {
  if (manifest.anchorProof !== "VERIFIED") fail("ANCHOR_PROOF_BLOCKED");
  const requiredAnchorCounts = manifest.requiredAnchorCounts ?? Object.fromEntries(
    Object.entries(manifest.anchors)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
      .map(([name]) => [name, 1])
  );
  for (const [name, expected] of Object.entries(requiredAnchorCounts)) {
    const anchor = (manifest.anchors as Record<string, string | undefined>)[name];
    if (!anchor) fail(`host anchor ${name} is not defined`);
    const matches = count(source, anchor);
    if (matches !== expected) fail(`host anchor ${name} occurred ${matches} times; expected exactly ${expected}`);
  }
  const owner = source.indexOf(manifest.anchors.inferenceOwner);
  const inferenceHook = source.indexOf(inferenceHookAnchor(manifest));
  const mainSession = source.indexOf(manifest.anchors.mainSessionOptions);
  const servicePrelude = manifest.anchors.servicePrelude === undefined ? -1 : source.indexOf(manifest.anchors.servicePrelude);
  const mainSessionDispatch = manifest.anchors.mainSessionDispatch === undefined ? -1 : source.indexOf(manifest.anchors.mainSessionDispatch);
  if (manifest.anchors.servicePrelude !== undefined && (servicePrelude < 0 || servicePrelude > owner)) {
    fail("reviewed service prelude does not precede the inference seam");
  }
  if (owner < 0 || inferenceHook <= owner) fail("stock inference hook is not inside the reviewed inference seam order");
  if (mainSession <= inferenceHook) fail("main session options do not follow the reviewed inference seam");
  if (manifest.anchors.mainSessionDispatch !== undefined && mainSessionDispatch <= mainSession) {
    fail("main session dispatch does not follow the reviewed main session options");
  }
}

function requireAnchorProof(manifest: GrokBotHostCompatibilityManifest): void {
  if (manifest.anchorProof !== "VERIFIED") {
    fail(`ANCHOR_PROOF_BLOCKED: host ${manifest.hostVersion} anchors are not production-proven`);
  }
}

function markerState(source: string): "none" | "complete" {
  if (source.includes(SERVICE_START) || source.includes(SERVICE_END)) {
    fail("legacy control-service markers are forbidden in the M1 host image");
  }
  const counts = MARKERS.map((marker) => count(source, marker));
  if (counts.every((value) => value === 0)) return "none";
  if (counts.every((value) => value === 1)) return "complete";
  fail(`router markers are partial or duplicated: ${counts.join(",")}`);
}

function routerHook(): string {
  return [
    `      ${SESSION_START}`,
    '      const __grokCodexRouterHome = process.env.SAND_CODEX_ROUTER_HOME || require("path").join(require("os").homedir(), "grok-codex-router");',
    "      const { createCodexRouterSession, shouldUseCodexRouter } = require(__grokCodexRouterHome);",
    "      if (shouldUseCodexRouter(sessionOptions)) {",
    "        return createCodexRouterSession({",
    "          requestedModel,",
    "          onRequestId,",
    "          sessionOptions",
    "        });",
    "      }",
    `      ${SESSION_END}`
  ].join("\n");
}

function identityMarkerBlock(anchor: string): string {
  const newline = anchor.indexOf("\n");
  if (newline < 0) fail("main session-options anchor must span at least two lines");
  const firstLine = anchor.slice(0, newline);
  const indentation = firstLine.match(/^\s*/)?.[0] ?? "";
  const propertyIndentation = `${indentation}  `;
  return [
    `${propertyIndentation}${IDENTITY_START}`,
    `${propertyIndentation}conversationId,`,
    `${propertyIndentation}transcriptId: host.getTranscriptId(),`,
    `${propertyIndentation}isGroupMemberTurn: options2.isGroupMemberTurn === true,`,
    `${propertyIndentation}${IDENTITY_END}`
  ].join("\n");
}

function identityReplacement(anchor: string): string {
  const newline = anchor.indexOf("\n");
  if (newline < 0) fail("main session-options anchor must span at least two lines");
  const firstLine = anchor.slice(0, newline);
  const rest = anchor.slice(newline + 1);
  return [
    firstLine,
    identityMarkerBlock(anchor),
    rest
  ].join("\n");
}

function validateDeterministicPatchedFingerprint(
  bytes: Buffer,
  manifest: GrokBotHostCompatibilityManifest
): void {
  const expected = manifest.deterministicPatchedHost;
  if (!expected) return;
  if (bytes.length !== expected.bytes) {
    fail(`deterministic patched byte size ${bytes.length} is not the reviewed ${expected.bytes}`);
  }
  const digest = sha256(bytes);
  if (digest !== expected.sha256) {
    fail(`deterministic patched SHA-256 ${digest} is not the reviewed ${expected.sha256}`);
  }
}

function patchStockSource(source: string, manifest: GrokBotHostCompatibilityManifest): string {
  if (markerState(source) !== "none") fail("stock source already contains router markers");
  validateAnchors(source, manifest);

  const hook = routerHook();
  const inferenceHook = inferenceHookAnchor(manifest);
  let patched = source.replace(inferenceHook, `${hook}\n${inferenceHook}`);
  patched = patched.replace(
    manifest.anchors.mainSessionOptions,
    identityReplacement(manifest.anchors.mainSessionOptions)
  );

  if (markerState(patched) !== "complete") fail("deterministic patch did not produce one complete marker set");
  if (count(patched, identityMarkerBlock(manifest.anchors.mainSessionOptions)) !== 1) {
    fail("deterministic patch did not insert exactly one reviewed main identity block");
  }
  validateDeterministicPatchedFingerprint(Buffer.from(patched, "utf8"), manifest);
  return patched;
}

function verifiedBackup(file: string, manifest: GrokBotHostCompatibilityManifest): Buffer {
  if (!fs.existsSync(file)) fail(`pristine stock backup is missing: ${file}`);
  const backup = readCanonicalUtf8(file);
  validateStockFingerprint(backup.bytes, manifest, "stock backup");
  if (manifest.pristineBackup && sha256(backup.bytes) !== manifest.pristineBackup.sha256) {
    fail("stock backup SHA-256 does not match manifest.pristineBackup.sha256");
  }
  if (markerState(backup.source) !== "none") fail("pristine stock backup contains router markers");
  validateAnchors(backup.source, manifest);
  const requiredMode = manifest.pristineBackup?.mode ?? 0o600;
  if ((fs.statSync(file).mode & 0o777) !== requiredMode) {
    fail(`pristine stock backup must have mode 0${requiredMode.toString(8)}`);
  }
  return backup.bytes;
}

function inspectHost(
  hostFile: string,
  backupFile: string,
  manifest: GrokBotHostCompatibilityManifest
): HostInspection {
  if (!fs.existsSync(hostFile)) fail(`host not found: ${hostFile}`);
  const host = readCanonicalUtf8(hostFile);
  const state = markerState(host.source);

  if (state === "none") {
    validateStockFingerprint(host.bytes, manifest, "host");
    validateAnchors(host.source, manifest);
    if (fs.existsSync(backupFile)) {
      const backupBytes = verifiedBackup(backupFile, manifest);
      if (!backupBytes.equals(host.bytes)) {
        fail("existing pristine backup does not match the reviewed live stock host");
      }
    }
    const patchedBytes = Buffer.from(patchStockSource(host.source, manifest), "utf8");
    return { state: "stock", hostBytes: host.bytes, stockBytes: host.bytes, patchedBytes };
  }

  const stockBytes = verifiedBackup(backupFile, manifest);
  const stockSource = stockBytes.toString("utf8");
  const patchedBytes = Buffer.from(patchStockSource(stockSource, manifest), "utf8");
  if (!host.bytes.equals(patchedBytes)) {
    fail("patched host does not exactly match the deterministic image reconstructed from the pristine backup");
  }
  return { state: "patched", hostBytes: host.bytes, stockBytes, patchedBytes };
}

function fsyncDirectory(directory: string): void {
  const directoryFd = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(directoryFd);
  } finally {
    fs.closeSync(directoryFd);
  }
}

function writeExclusiveBackup(file: string, bytes: Buffer, mode = 0o600): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const backupFd = fs.openSync(file, "wx", mode);
  try {
    fs.writeFileSync(backupFd, bytes);
    fs.fsyncSync(backupFd);
  } catch (error) {
    try { fs.unlinkSync(file); } catch {}
    throw error;
  } finally {
    fs.closeSync(backupFd);
  }
  fsyncDirectory(path.dirname(file));
}

function atomicReplace(file: string, bytes: Buffer, mode: number): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.grok-codex-router.${process.pid}.tmp`);
  try {
    const temporaryFd = fs.openSync(temporary, "wx", mode);
    try {
      fs.writeFileSync(temporaryFd, bytes);
      fs.fsyncSync(temporaryFd);
    } finally {
      fs.closeSync(temporaryFd);
    }
    fs.renameSync(temporary, file);
    fsyncDirectory(path.dirname(file));
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function assertFileBytesUnchanged(file: string, expected: Buffer, label: string): void {
  if (!fs.existsSync(file)) fail(`${label} disappeared before replacement`);
  const current = fs.readFileSync(file);
  if (!current.equals(expected)) fail(`${label} changed before replacement; refusing overwrite`);
}

function install(
  hostFile: string,
  backupFile: string,
  manifest: GrokBotHostCompatibilityManifest
): "installed" | "already-installed" {
  requireAnchorProof(manifest);
  const inspection = inspectHost(hostFile, backupFile, manifest);
  if (inspection.state === "patched") return "already-installed";

  const hostMode = fs.statSync(hostFile).mode & 0o777;
  if (fs.existsSync(backupFile)) {
    const backupBytes = verifiedBackup(backupFile, manifest);
    if (!backupBytes.equals(inspection.stockBytes)) fail("existing pristine backup does not match the reviewed live stock host");
  } else {
    writeExclusiveBackup(backupFile, inspection.stockBytes, manifest.pristineBackup?.mode ?? 0o600);
  }
  assertFileBytesUnchanged(backupFile, inspection.stockBytes, "stock backup");
  assertFileBytesUnchanged(hostFile, inspection.hostBytes, "host");
  atomicReplace(hostFile, inspection.patchedBytes, hostMode);
  return "installed";
}

function restore(
  hostFile: string,
  backupFile: string,
  manifest: GrokBotHostCompatibilityManifest
): "restored" | "already-stock" {
  requireAnchorProof(manifest);
  const stockBytes = verifiedBackup(backupFile, manifest);
  const stockSource = stockBytes.toString("utf8");
  const patchedBytes = Buffer.from(patchStockSource(stockSource, manifest), "utf8");

  let mode = 0o644;
  let observedHostBytes: Buffer | undefined;
  if (fs.existsSync(hostFile)) {
    mode = fs.statSync(hostFile).mode & 0o777;
    const host = readCanonicalUtf8(hostFile);
    observedHostBytes = host.bytes;
    const state = markerState(host.source);
    if (state === "none") {
      if (!host.bytes.equals(stockBytes)) fail("unmarked host does not match the pristine stock backup; refusing restore");
      return "already-stock";
    }
    if (!host.bytes.equals(patchedBytes)) {
      fail("marked host does not match the deterministic patched image; refusing restore");
    }
  }

  assertFileBytesUnchanged(backupFile, stockBytes, "stock backup");
  if (observedHostBytes) {
    assertFileBytesUnchanged(hostFile, observedHostBytes, "host");
  } else if (fs.existsSync(hostFile)) {
    fail("host appeared before replacement; refusing overwrite");
  }
  atomicReplace(hostFile, stockBytes, mode);
  return "restored";
}

function defaultBackupPath(hostFile: string): string {
  return `${hostFile}.grok-codex-router-bak`;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const manifest = loadManifest(options.manifest, options.compat);
  const hostFile = options.host ||
    (process.env.SAND_HOST_DIR ? path.join(process.env.SAND_HOST_DIR, "host-main.cjs") : manifest.hostPath);
  rejectCustomManifestOnProductionHost(options.manifest, hostFile);
  const backupFile = options.backup || process.env.SAND_CODEX_ROUTER_HOST_BACKUP || defaultBackupPath(hostFile);

  if (options.check && manifest.anchorProof !== "VERIFIED") {
    if (!fs.existsSync(hostFile)) fail(`host not found: ${hostFile}`);
    const host = readCanonicalUtf8(hostFile);
    if (markerState(host.source) !== "none") {
      fail("ANCHOR_PROOF_BLOCKED: marked host cannot be authenticated without verified anchors");
    }
    validateStockFingerprint(host.bytes, manifest, "host");
    console.log(
      `host fingerprint check passed: state=stock version=${manifest.hostVersion} sha256=${manifest.stockHost.sha256} anchorProof=BLOCKED compatible=false`
    );
    process.exitCode = 2;
    return;
  }

  if (options.restore) {
    const status = restore(hostFile, backupFile, manifest);
    console.log(`${status}: ${hostFile}`);
    return;
  }

  if (options.check) {
    const inspection = inspectHost(hostFile, backupFile, manifest);
    console.log(
      `host patch check passed: state=${inspection.state} version=${manifest.hostVersion} sha256=${manifest.stockHost.sha256}`
    );
    return;
  }

  const status = install(hostFile, backupFile, manifest);
  console.log(`${status}: ${hostFile}`);
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
