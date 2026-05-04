import { rm } from "node:fs/promises";
import prompts from "prompts";

import {
  composeDown,
  removeImagesByPrefix,
  removeVolume,
} from "../lib/docker.js";
import { bold, info, log, warn } from "../lib/ui.js";
import { ensureLinux, ensureRoot } from "../lib/system.js";

import {
  COMPOSE_FILE,
  DEPLOYKIT_DIR_DEFAULT,
  BACKUP_DIR,
} from "../constants.js";

export interface IUninstallOptions {
  dir?: string;
  yes?: boolean;
  deleteData?: boolean;
}

export const runUninstall = async (raw: IUninstallOptions): Promise<void> => {
  ensureLinux();
  ensureRoot();

  const dir = raw.dir ?? DEPLOYKIT_DIR_DEFAULT;

  console.log(`\n${bold("Uninstalling DeployKit")}\n`);
  warn("This will remove DeployKit and all its data.");
  warn("User-deployed containers will NOT be affected.");
  console.log("");

  if (!raw.yes && process.stdin.isTTY) {
    const { confirm } = await prompts({
      type: "text",
      name: "confirm",
      message: "Type 'yes' to confirm:",
    });
    if (confirm !== "yes") {
      console.log("\n  Cancelled.\n");
      return;
    }
  } else if (!raw.yes) {
    console.log("\n  Refusing to uninstall non-interactively without --yes.\n");
    return;
  }

  info("Stopping services...");
  await composeDown({ cwd: dir, file: COMPOSE_FILE }, true);

  info("Removing images...");
  await removeImagesByPrefix("deploykit-");

  let deleteData = raw.deleteData ?? false;
  if (raw.deleteData === undefined && process.stdin.isTTY) {
    const { yn } = await prompts({
      type: "confirm",
      name: "yn",
      message: "Delete database and backups?",
      initial: false,
    });
    deleteData = Boolean(yn);
  }

  if (deleteData) {
    await removeVolume("deploykit_postgres-data");
    await removeVolume("deploykit_redis-data");
    await rm(BACKUP_DIR, { recursive: true, force: true });
    log("Data deleted.");
  }

  await rm(dir, { recursive: true, force: true });
  log("DeployKit has been removed.");
  console.log(
    "\n  Note: Docker, user containers, and deploykit-network were left intact.\n",
  );
};
