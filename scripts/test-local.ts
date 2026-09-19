#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// The upstream VM contract is a separately authorized live acceptance suite,
// not a fixture. Default npm check/test must never touch a VM or OAuth store.
const directory = path.resolve(__dirname, "..", "tests");
const files = fs.readdirSync(directory).filter((file) => file.endsWith(".test.js") && file !== "vm-contract.test.js")
  .sort().map((file) => path.join(directory, file));
if (!files.length) throw new Error("NO_LOCAL_TESTS");
console.log(`Local test files: ${files.length}; live VM contract: NOT RUN`);
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit", shell: false });
process.exitCode = result.status ?? 1;
