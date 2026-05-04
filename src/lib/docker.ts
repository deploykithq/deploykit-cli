import { exists, run, runInherit } from "./exec.js";
import { fail, info, log } from "./ui.js";

import { COMPOSE_FILE, NETWORK_NAME } from "../constants.js";

export interface IComposeOptions {
  cwd: string;
  file?: string;
}

const composeFile = (opts: IComposeOptions): string =>
  opts.file ?? COMPOSE_FILE;

export const ensureDocker = async (): Promise<void> => {
  if (await exists("docker")) {
    const v = await run("docker", ["--version"]);
    log(
      `Docker already installed: ${v.stdout.trim().split(" ")[2]?.replace(",", "") ?? ""}`,
    );
    return;
  }

  info("Installing Docker...");
  const installer = await run("sh", [
    "-c",
    "curl -fsSL https://get.docker.com | sh",
  ]);
  if (installer.exitCode !== 0) {
    fail(
      "Docker install failed. Install manually: https://docs.docker.com/engine/install/",
    );
  }
  await run("systemctl", ["enable", "docker"]);
  await run("systemctl", ["start", "docker"]);
  log("Docker installed");
};

export const ensureCompose = async (): Promise<void> => {
  const probe = await run("docker", ["compose", "version"]);
  if (probe.exitCode === 0) {
    const short = await run("docker", ["compose", "version", "--short"]);
    log(`Docker Compose: ${short.stdout.trim() || "available"}`);
    return;
  }

  info("Installing Docker Compose plugin...");
  if (await exists("apt-get")) {
    await run("sh", ["-c", "apt-get update -qq"]);
    await run("sh", ["-c", "apt-get install -y -qq docker-compose-plugin"]);
  } else if (await exists("yum")) {
    await run("yum", ["install", "-y", "docker-compose-plugin"]);
  }

  const verify = await run("docker", ["compose", "version"]);
  if (verify.exitCode !== 0) {
    fail(
      "Docker Compose install failed. See: https://docs.docker.com/compose/install/",
    );
  }
  log("Docker Compose installed");
};

export const ensureNetwork = async (): Promise<void> => {
  await run("docker", ["network", "create", NETWORK_NAME]);
};

export const composeBuild = async (opts: IComposeOptions): Promise<void> => {
  const result = await runInherit(
    "docker",
    ["compose", "-f", composeFile(opts), "build"],
    {
      cwd: opts.cwd,
      reject: false,
    },
  );
  if (result.exitCode !== 0) {
    fail(
      `Build failed. Check the output above.\n  Debug: cd ${opts.cwd} && docker compose -f ${composeFile(opts)} build`,
    );
  }
};

export const composeUp = async (opts: IComposeOptions): Promise<void> => {
  const result = await run(
    "docker",
    ["compose", "-f", composeFile(opts), "up", "-d"],
    {
      cwd: opts.cwd,
      stdio: "inherit",
      reject: false,
    },
  );
  if (result.exitCode !== 0) {
    fail("docker compose up failed.");
  }
};

export const composeDown = async (
  opts: IComposeOptions,
  removeVolumes = false,
): Promise<void> => {
  const args = ["compose", "-f", composeFile(opts), "down"];
  if (removeVolumes) args.push("-v");
  await run("docker", args, { cwd: opts.cwd });
};

export const composePs = async (opts: IComposeOptions): Promise<string> => {
  const result = await run(
    "docker",
    ["compose", "-f", composeFile(opts), "ps"],
    { cwd: opts.cwd },
  );
  return result.stdout;
};

export const composeRestart = async (opts: IComposeOptions): Promise<void> => {
  await run("docker", ["compose", "-f", composeFile(opts), "restart"], {
    cwd: opts.cwd,
    stdio: "inherit",
  });
};

export const composeLogsStream = (opts: IComposeOptions): Promise<unknown> =>
  runInherit("docker", ["compose", "-f", composeFile(opts), "logs", "-f"], {
    cwd: opts.cwd,
  });

export const countRunningServices = async (
  opts: IComposeOptions,
): Promise<number> => {
  const out = await composePs(opts);
  return out.split("\n").filter((line) => /\bUp\b/.test(line)).length;
};

export const containerExec = async (
  container: string,
  command: string,
): Promise<{ ok: boolean; stdout: string }> => {
  const result = await run("docker", ["exec", container, "sh", "-c", command]);
  return { ok: result.exitCode === 0, stdout: result.stdout };
};

export const removeImagesByPrefix = async (prefix: string): Promise<void> => {
  const ids = await run("sh", ["-c", `docker images -q "${prefix}*"`]);
  const list = ids.stdout.split("\n").filter(Boolean);
  if (list.length === 0) return;
  await run("docker", ["rmi", ...list]);
};

export const removeVolume = async (name: string): Promise<void> => {
  await run("docker", ["volume", "rm", name]);
};
