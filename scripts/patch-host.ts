#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  GROK_BOT_053_11DD264_MANIFEST,
  type GrokBotHostCompatibilityManifest
} from "./manifests/grok-bot-0.53-11dd264.js";

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
    if (argument === "--host" || argument === "--backup" || argument === "--manifest") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`${argument} requires a path`);
      if (argument === "--host") options.host = value;
      if (argument === "--backup") options.backup = value;
      if (argument === "--manifest") options.manifest = value;
      index += 1;
      continue;
    }
    fail(`unknown argument: ${argument}`);
  }
  if (options.check && options.restore) fail("--check and --restore are mutually exclusive");
  return options;
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
  if (!manifest.stockHost || !Number.isInteger(manifest.stockHost.bytes) || manifest.stockHost.bytes <= 0) {
    fail("manifest.stockHost.bytes must be a positive integer");
  }
  if (typeof manifest.stockHost.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(manifest.stockHost.sha256)) {
    fail("manifest.stockHost.sha256 must be a lowercase SHA-256 digest");
  }
  if (!manifest.anchors || typeof manifest.anchors !== "object") fail("manifest.anchors must be an object");
  for (const name of ["servicePrelude", "inferenceOwner", "nativeSession", "mainSessionOptions"] as const) {
    const anchor = manifest.anchors[name];
    if (typeof anchor !== "string" || !anchor) fail(`manifest anchor ${name} must be a non-empty string`);
  }
  return manifest as GrokBotHostCompatibilityManifest;
}

function loadManifest(manifestPath: string | undefined): GrokBotHostCompatibilityManifest {
  if (!manifestPath) return validateManifest(GROK_BOT_053_11DD264_MANIFEST);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`failed to read compatibility manifest ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return validateManifest(raw);
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
  for (const [name, anchor] of Object.entries(manifest.anchors)) {
    const matches = count(source, anchor);
    if (matches !== 1) fail(`host anchor ${name} occurred ${matches} times; expected exactly 1`);
  }
  const owner = source.indexOf(manifest.anchors.inferenceOwner);
  const nativeSession = source.indexOf(manifest.anchors.nativeSession);
  const mainSession = source.indexOf(manifest.anchors.mainSessionOptions);
  const servicePrelude = source.indexOf(manifest.anchors.servicePrelude);
  if (servicePrelude < 0 || servicePrelude > owner) fail("reviewed service prelude does not precede the inference seam");
  if (owner < 0 || nativeSession <= owner) fail("native inference session is not inside the reviewed inference seam order");
  if (mainSession <= nativeSession) fail("main session options do not follow the reviewed inference seam");
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

function identityReplacement(anchor: string): string {
  const newline = anchor.indexOf("\n");
  if (newline < 0) fail("main session-options anchor must span at least two lines");
  const firstLine = anchor.slice(0, newline);
  const rest = anchor.slice(newline + 1);
  const indentation = firstLine.match(/^\s*/)?.[0] ?? "";
  const propertyIndentation = `${indentation}  `;
  return [
    firstLine,
    `${propertyIndentation}${IDENTITY_START}`,
    `${propertyIndentation}conversationId,`,
    `${propertyIndentation}transcriptId: host.getTranscriptId(),`,
    `${propertyIndentation}isGroupMemberTurn: options2.isGroupMemberTurn === true,`,
    `${propertyIndentation}${IDENTITY_END}`,
    rest
  ].join("\n");
}

function patchStockSource(source: string, manifest: GrokBotHostCompatibilityManifest): string {
  if (markerState(source) !== "none") fail("stock source already contains router markers");
  validateAnchors(source, manifest);

  const hook = routerHook();
  let patched = source.replace(manifest.anchors.nativeSession, `${hook}\n${manifest.anchors.nativeSession}`);
  patched = patched.replace(
    manifest.anchors.mainSessionOptions,
    identityReplacement(manifest.anchors.mainSessionOptions)
  );

  if (markerState(patched) !== "complete") fail("deterministic patch did not produce one complete marker set");
  if (count(patched, "          conversationId,") !== 1) {
    fail("deterministic patch did not insert exactly one main conversation identity");
  }
  if (count(patched, "          transcriptId: host.getTranscriptId(),") !== 1) {
    fail("deterministic patch did not insert exactly one main transcript identity");
  }
  if (count(patched, "          isGroupMemberTurn: options2.isGroupMemberTurn === true,") !== 1) {
    fail("deterministic patch did not insert exactly one group-member guard");
  }
  return patched;
}

function verifiedBackup(file: string, manifest: GrokBotHostCompatibilityManifest): Buffer {
  if (!fs.existsSync(file)) fail(`pristine stock backup is missing: ${file}`);
  const backup = readCanonicalUtf8(file);
  validateStockFingerprint(backup.bytes, manifest, "stock backup");
  if (markerState(backup.source) !== "none") fail("pristine stock backup contains router markers");
  validateAnchors(backup.source, manifest);
  if ((fs.statSync(file).mode & 0o777) !== 0o600) {
    fail("pristine stock backup must have mode 0600");
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

function writeExclusiveBackup(file: string, bytes: Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const backupFd = fs.openSync(file, "wx", 0o600);
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
    writeExclusiveBackup(backupFile, inspection.stockBytes);
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
  const manifest = loadManifest(options.manifest);
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
