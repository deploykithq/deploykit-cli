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

export interface ICheckoutTarget {
  ref: string;
  isTag: boolean;
}

export interface ICloneOptions extends ICheckoutTarget {
  repo: string;
  dir: string;
}

/**
 * Moves an existing checkout onto `ref`. Tags need an explicit refspec so a
 * moved or re-cut tag overwrites the stale local one instead of being kept.
 */
const fetchRef = async (
  dir: string,
  target: ICheckoutTarget,
): Promise<boolean> => {
  const args = target.isTag
    ? [
        "fetch",
        "--depth",
        "1",
        "--force",
        "origin",
        `refs/tags/${target.ref}:refs/tags/${target.ref}`,
      ]
    : ["fetch", "origin", target.ref];

  const fetched = await run("git", args, { cwd: dir });
  return fetched.exitCode === 0;
};

const resetToRef = async (
  dir: string,
  target: ICheckoutTarget,
): Promise<boolean> => {
  const revision = target.isTag ? `refs/tags/${target.ref}` : `origin/${target.ref}`;
  const reset = await run("git", ["reset", "--hard", revision], { cwd: dir });
  return reset.exitCode === 0;
};

export const cloneOrUpdate = async (opts: ICloneOptions): Promise<void> => {
  const gitDir = join(opts.dir, ".git");
  if (existsSync(gitDir)) {
    info("Existing installation found — updating...");
    if (!(await fetchRef(opts.dir, opts))) {
      warn("Git update failed — using existing code.");
      return;
    }
    if (!(await resetToRef(opts.dir, opts))) {
      warn("Git update failed — using existing code.");
      return;
    }
    log(`Updated to ${opts.ref}`);
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
    opts.ref,
    opts.repo,
    opts.dir,
  ]);
  if (cloned.exitCode !== 0) {
    fail("Clone failed. Check your internet connection.");
  }
  log(`Downloaded ${opts.ref} to ${opts.dir}`);
};

export const stripCrlf = async (dir: string): Promise<void> => {
  await run("sh", [
    "-c",
    `find . -name "*.sh" -exec sed -i 's/\\r$//' {} + 2>/dev/null; find . -name "Dockerfile" -exec sed -i 's/\\r$//' {} + 2>/dev/null; true`,
  ], { cwd: dir });
};

export const pullLatest = async (
  dir: string,
  target: ICheckoutTarget,
): Promise<void> => {
  if (!(await fetchRef(dir, target))) fail("Pull failed.");
  if (!(await resetToRef(dir, target))) fail("Pull failed.");
};
