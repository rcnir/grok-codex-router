#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { configPath, DEFAULT_CONFIG, loadConfig, writeConfig } from "../src/config.js";
import { LocalRuntimeClient, RuntimeFault } from "../src/runtime-client.js";
import { NATIVE_POLICY_RESEARCH } from "../src/native-execution-policy.js";

const UPSTREAM = "599a2013b15592d17fe897126f549974351e4c3f";

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const [command = "help", ...args] = argv;
  if (command === "help" || command === "--help") {
    console.log("grok-codex-router (ROCANIIRU M1 source candidate)\n" +
      "  --check [--host PATH]    read-only fingerprint/compatibility inspection\n" +
      "  status                  local config and admission status (no provider calls)\n" +
      "  runtime-status          read-only existing Runtime MCP status\n" +
      "  routes                  configured routes, not an opt-in allowlist\n" +
      "  init                    create a disabled, empty-allowlist config\n" +
      "  off                     disable routing without changing any Bot profile\n" +
      "Activation/install/restart/inference are closed in this source candidate.");
    return;
  }
  if (command === "--check" || command === "check") {
    if (args.length && !(args.length === 2 && args[0] === "--host" && args[1])) {
      throw new RuntimeFault("CHECK_ARGUMENTS_INVALID");
    }
    const script = path.resolve(__dirname, "..", "scripts", "patch-host.js");
    const result = spawnSync(process.execPath, [script, "--check", ...args], { stdio: "inherit", shell: false });
    process.exitCode = result.status ?? 1;
    return;
  }
  if (["on", "install", "recover", "verify", "restart", "restart-host", "control"].includes(command)) {
    // No OAuth lookup, private transport, package install, host restart, or
    // provider inference can be reached through retained upstream CLI verbs.
    throw new RuntimeFault("HUMAN_GATE_CLOSED_NATIVE_POLICY_UNVERIFIED");
  }
  if (args.length) throw new RuntimeFault("UNEXPECTED_ARGUMENTS");
  if (command === "init") {
    const file = configPath();
    if (!fs.existsSync(file)) writeConfig(structuredClone(DEFAULT_CONFIG));
    console.log(JSON.stringify({ config: file, enabled: loadConfig().enabled }));
    return;
  }
  const config = loadConfig();
  if (command === "status") {
    console.log(JSON.stringify({ upstream: UPSTREAM, config: configPath(), enabled: config.enabled,
      pilotCount: config.pilot?.agentIds.length ?? 0, runtimeConfigured: !!config.runtime,
      nativeExecutionPolicy: NATIVE_POLICY_RESEARCH, liveActivationAllowed: false }, null, 2));
  } else if (command === "routes") {
    console.log(JSON.stringify({ default: config.default, agents: config.agents,
      pilotAgentIds: config.pilot?.agentIds ?? [], auxiliaryRouting: "stock" }, null, 2));
  } else if (command === "runtime-status") {
    if (!config.runtime) throw new RuntimeFault("RUNTIME_CONFIGURATION_REQUIRED");
    console.log(JSON.stringify(await new LocalRuntimeClient(config.runtime).call("runtime_status", {}), null, 2));
  } else if (command === "off") {
    config.enabled = false;
    writeConfig(config);
    console.log(JSON.stringify({ enabled: false, profilesChanged: false }));
  } else throw new RuntimeFault("UNSUPPORTED_COMMAND");
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof RuntimeFault ? error.code : "ROUTER_COMMAND_FAILED");
    process.exitCode = 1;
  });
}
