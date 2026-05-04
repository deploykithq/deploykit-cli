import { existsSync } from "node:fs";

import { composeLogsStream } from "../lib/docker.js";
import { ensureLinux } from "../lib/system.js";
import { fail } from "../lib/ui.js";

import { COMPOSE_FILE, DEPLOYKIT_DIR_DEFAULT } from "../constants.js";

export interface ILogsOptions {
  dir?: string;
}

export const runLogs = async (raw: ILogsOptions): Promise<void> => {
  ensureLinux();
  const dir = raw.dir ?? DEPLOYKIT_DIR_DEFAULT;
  if (!existsSync(dir)) {
    fail(`DeployKit not found at ${dir}. Run \`deploykit install\` first.`);
  }
  await composeLogsStream({ cwd: dir, file: COMPOSE_FILE });
};
