import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { exists, run } from "./exec.js";
import { fail, info, log, warn } from "./ui.js";

export const ensureGit = async (): Promise<void> => {
  if (await exists("git")) {
    const v = await run("git", ["--version"]);
    log(`Git already installed: ${v.stdout.trim().split(" ")[2] ?? ""}`);
    return;
  }

  info("Installing Git...");
  if (await exists("apt-get")) {
    await run("sh", ["-c", "apt-get update -qq && apt-get install -y -qq git"]);
  } else if (await exists("yum")) {
    await run("yum", ["install", "-y", "git"]);
  } else if (await exists("apk")) {
    await run("apk", ["add", "--quiet", "git"]);
  }

  if (!(await exists("git"))) {
    fail("Git install failed. Install manually.");
  }
  log("Git installed");
};

export interface ICloneOptions {
  repo: string;
  branch: string;
  dir: string;
}

export const cloneOrUpdate = async (opts: ICloneOptions): Promise<void> => {
  const gitDir = join(opts.dir, ".git");
  if (existsSync(gitDir)) {
    info("Existing installation found — updating...");
    const fetched = await run("git", ["fetch", "origin", opts.branch], { cwd: opts.dir });
    if (fetched.exitCode !== 0) {
      warn("Git update failed — using existing code.");
      return;
    }
    await run("git", ["reset", "--hard", `origin/${opts.branch}`], { cwd: opts.dir });
    log("Updated to latest");
    return;
  }

  if (existsSync(opts.dir)) {
    await rm(opts.dir, { recursive: true, force: true });
  }
  info("Cloning repository...");
  const cloned = await run("git", [
    "clone",
    "--depth",
    "1",
    "--branch",
    opts.branch,
    opts.repo,
    opts.dir,
  ]);
  if (cloned.exitCode !== 0) {
    fail("Clone failed. Check your internet connection.");
  }
  log(`Downloaded to ${opts.dir}`);
};

export const stripCrlf = async (dir: string): Promise<void> => {
  await run("sh", [
    "-c",
    `find . -name "*.sh" -exec sed -i 's/\\r$//' {} + 2>/dev/null; find . -name "Dockerfile" -exec sed -i 's/\\r$//' {} + 2>/dev/null; true`,
  ], { cwd: dir });
};

export const pullLatest = async (dir: string, branch: string): Promise<void> => {
  const fetched = await run("git", ["fetch", "origin", branch], { cwd: dir });
  if (fetched.exitCode !== 0) fail("Pull failed.");
  const reset = await run("git", ["reset", "--hard", `origin/${branch}`], { cwd: dir });
  if (reset.exitCode !== 0) fail("Pull failed.");
};
