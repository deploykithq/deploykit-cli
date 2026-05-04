import { existsSync } from "node:fs";

import { ensureLinux } from "../lib/system.js";
import { composePs } from "../lib/docker.js";
import { fail } from "../lib/ui.js";

import { COMPOSE_FILE, DEPLOYKIT_DIR_DEFAULT } from "../constants.js";

export interface IStatusOptions {
  dir?: string;
}

export const runStatus = async (raw: IStatusOptions): Promise<void> => {
  ensureLinux();
  const dir = raw.dir ?? DEPLOYKIT_DIR_DEFAULT;
  if (!existsSync(dir)) {
    fail(`DeployKit not found at ${dir}. Run \`deploykit install\` first.`);
  }
  const out = await composePs({ cwd: dir, file: COMPOSE_FILE });
  process.stdout.write(out);
};
