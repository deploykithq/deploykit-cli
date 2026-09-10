#!/usr/bin/env node
import { Command } from "commander";

import { runUninstall } from "../commands/uninstall.js";
import { runRestart } from "../commands/restart.js";
import { runInstall } from "../commands/install.js";
import { runStatus } from "../commands/status.js";
import { runUpdate } from "../commands/update.js";
import { runLogs } from "../commands/logs.js";

import { DEPLOYKIT_DIR_DEFAULT } from "../constants.js";

// Bumped by release-please on every release — keep the trailing annotation,
// it is what holds this in sync with package.json. Do not edit by hand.
const VERSION = "0.2.0"; // x-release-please-version

const program = new Command();

program
  .name("deploykit")
  .description(
    "Install and manage a self-hosted DeployKit instance on a Linux VPS.",
  )
  .version(VERSION);

program
  .command("install")
  .description("Install DeployKit on this machine")
  .option("--domain <domain>", "Dashboard domain (e.g. deploy.example.com)")
  .option("--email <email>", "Let's Encrypt email")
  .option("--admin-email <email>", "Pre-create admin account")
  .option("--admin-password <password>", "Admin password (min 8 chars)")
  .option("--dir <path>", "Install directory", DEPLOYKIT_DIR_DEFAULT)
  .option("--tag <tag>", "Install a specific release (default: latest release)")
  .option("--branch <branch>", "Install from a Git branch instead of a release")
  .action(async (opts) => {
    await runInstall(opts);
  });

program
  .command("update")
  .description("Update to the latest release, rebuild, and restart")
  .option("--dir <path>", "Install directory", DEPLOYKIT_DIR_DEFAULT)
  .option("--tag <tag>", "Update to a specific release (default: latest release)")
  .option("--branch <branch>", "Track a Git branch instead of a release")
  .action(async (opts) => {
    await runUpdate(opts);
  });

program
  .command("uninstall")
  .description("Stop services and remove DeployKit")
  .option("--dir <path>", "Install directory", DEPLOYKIT_DIR_DEFAULT)
  .option("-y, --yes", "Skip confirmation prompt")
  .option("--delete-data", "Also delete database volumes and backups")
  .action(async (opts) => {
    await runUninstall(opts);
  });

program
  .command("status")
  .description("Show container status")
  .option("--dir <path>", "Install directory", DEPLOYKIT_DIR_DEFAULT)
  .action(async (opts) => {
    await runStatus(opts);
  });

program
  .command("logs")
  .description("Stream live logs from all services")
  .option("--dir <path>", "Install directory", DEPLOYKIT_DIR_DEFAULT)
  .action(async (opts) => {
    await runLogs(opts);
  });

program
  .command("restart")
  .description("Restart all DeployKit services")
  .option("--dir <path>", "Install directory", DEPLOYKIT_DIR_DEFAULT)
  .action(async (opts) => {
    await runRestart(opts);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
});
