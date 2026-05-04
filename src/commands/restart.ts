import { existsSync } from "node:fs";

import { ensureLinux, ensureRoot } from "../lib/system.js";
import { composeRestart } from "../lib/docker.js";
import { fail, log } from "../lib/ui.js";

import { COMPOSE_FILE, DEPLOYKIT_DIR_DEFAULT } from "../constants.js";

export interface IRestartOptions {
  dir?: string;
}

export const runRestart = async (raw: IRestartOptions): Promise<void> => {
  ensureLinux();
  ensureRoot();
  const dir = raw.dir ?? DEPLOYKIT_DIR_DEFAULT;
  if (!existsSync(dir)) {
    fail(`DeployKit not found at ${dir}.`);
  }
  await composeRestart({ cwd: dir, file: COMPOSE_FILE });
  log("Restarted.");
};
