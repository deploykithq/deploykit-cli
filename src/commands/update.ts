import { composeBuild, composeUp, containerExec } from "../lib/docker.js";
import { ensureLinux, ensureRoot } from "../lib/system.js";
import { pullLatest, stripCrlf } from "../lib/git.js";
import { bold, info, log, warn } from "../lib/ui.js";
import { pollUntil } from "../lib/wait.js";

import {
  API_CONTAINER,
  API_READY_ATTEMPTS,
  COMPOSE_FILE,
  DEPLOYKIT_BRANCH_DEFAULT,
  DEPLOYKIT_DIR_DEFAULT,
  HEALTH_POLL_INTERVAL_MS,
} from "../constants.js";

export interface IUpdateOptions {
  dir?: string;
  branch?: string;
}

export const runUpdate = async (raw: IUpdateOptions): Promise<void> => {
  ensureLinux();
  ensureRoot();

  const dir = raw.dir ?? DEPLOYKIT_DIR_DEFAULT;
  const branch = raw.branch ?? DEPLOYKIT_BRANCH_DEFAULT;

  console.log(`\n${bold("Updating DeployKit...")}\n`);

  info("Pulling latest changes...");
  await pullLatest(dir, branch);
  await stripCrlf(dir);

  info("Rebuilding images...");
  await composeBuild({ cwd: dir, file: COMPOSE_FILE });

  info("Restarting services...");
  await composeUp({ cwd: dir, file: COMPOSE_FILE });

  info("Waiting for API (migrations run on startup)...");
  const ready = await pollUntil(
    async () => {
      const probe = await containerExec(
        API_CONTAINER,
        "curl -sf http://localhost:4000/health >/dev/null 2>&1",
      );
      return probe.ok;
    },
    { attempts: API_READY_ATTEMPTS, intervalMs: HEALTH_POLL_INTERVAL_MS },
  );

  if (ready) {
    log("DeployKit updated!");
  } else {
    warn(
      "Update applied. API may still be starting — check: docker logs deploykit-api",
    );
  }
  console.log("");
};
