import { DEPLOYKIT_FALLBACK_BRANCH } from "../constants.js";
import { run } from "./exec.js";
import { fail } from "./ui.js";

export type TRefSource = "pinned" | "branch" | "latest" | "fallback";

export interface IResolvedRef {
  ref: string;
  isTag: boolean;
  source: TRefSource;
}

export interface IRefRequest {
  tag?: string;
  branch?: string;
}

interface ISemver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

const SEMVER_RE =
  /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

const TAG_REF_RE = /^\S+\s+refs\/tags\/(.+)$/;

const parseSemver = (tag: string): ISemver | null => {
  const m = SEMVER_RE.exec(tag.trim());
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split(".") : [],
  };
};

const comparePrereleaseIds = (a: string, b: string): number => {
  const aNum = /^\d+$/.test(a);
  const bNum = /^\d+$/.test(b);
  if (aNum && bNum) return Number(a) - Number(b);
  // Per semver: numeric identifiers always rank lower than alphanumeric ones.
  if (aNum) return -1;
  if (bNum) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
};

const comparePrerelease = (a: string[], b: string[]): number => {
  // No prerelease outranks any prerelease of the same version.
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const diff = comparePrereleaseIds(a[i] as string, b[i] as string);
    if (diff !== 0) return diff;
  }
  return a.length - b.length;
};

export const parseRemoteTags = (stdout: string): string[] =>
  stdout
    .split("\n")
    .map((line) => TAG_REF_RE.exec(line.trim())?.[1]?.trim())
    .filter((name): name is string => Boolean(name) && !name!.endsWith("^{}"));

export const compareSemver = (a: string, b: string): number => {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;

  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch !== right.patch) return left.patch - right.patch;
  return comparePrerelease(left.prerelease, right.prerelease);
};

export const pickLatestTag = (tags: readonly string[]): string | null => {
  const stable = tags.filter((tag) => {
    const parsed = parseSemver(tag);
    return parsed !== null && parsed.prerelease.length === 0;
  });
  if (stable.length === 0) return null;
  return [...stable].sort(compareSemver).at(-1) ?? null;
};

export const matchTag = (
  requested: string,
  tags: readonly string[],
): string | null => {
  const bare = (value: string): string => value.trim().replace(/^v/i, "");
  const target = bare(requested);
  return tags.find((tag) => bare(tag) === target) ?? null;
};

export const resolveRefFrom = (
  tags: readonly string[],
  req: IRefRequest,
): IResolvedRef => {
  if (req.tag) {
    if (tags.length === 0) {
      throw new Error(
        `Cannot install ${req.tag}: the repository has no tags. Use --branch to install from a branch instead.`,
      );
    }
    const matched = matchTag(req.tag, tags);
    if (!matched) {
      throw new Error(
        `Tag "${req.tag}" not found. Available tags: ${tags.join(", ")}`,
      );
    }
    return { ref: matched, isTag: true, source: "pinned" };
  }

  if (req.branch) {
    return { ref: req.branch, isTag: false, source: "branch" };
  }

  const latest = pickLatestTag(tags);
  if (latest) return { ref: latest, isTag: true, source: "latest" };

  return {
    ref: DEPLOYKIT_FALLBACK_BRANCH,
    isTag: false,
    source: "fallback",
  };
}

export const listRemoteTags = async (repo: string): Promise<string[]> => {
  const result = await run("git", ["ls-remote", "--tags", "--refs", repo]);
  if (result.exitCode !== 0) {
    fail(
      `Could not read versions from ${repo}. Check your internet connection.`,
    );
  }
  return parseRemoteTags(result.stdout);
};

export const resolveRef = async (
  repo: string,
  req: IRefRequest,
): Promise<IResolvedRef> => {
  // An explicit branch never needs the tag list — skip the network round-trip.
  if (!req.tag && req.branch) {
    return { ref: req.branch, isTag: false, source: "branch" };
  }
  return resolveRefFrom(await listRemoteTags(repo), req);
};

export const describeRef = (resolved: IResolvedRef): string => {
  switch (resolved.source) {
    case "pinned":
      return `Version: ${resolved.ref} (pinned via --tag)`;
    case "branch":
      return `Version: branch ${resolved.ref} (unreleased code)`;
    case "latest":
      return `Version: ${resolved.ref} (latest release)`;
    case "fallback":
      return `Version: branch ${resolved.ref} (no released version found)`;
  }
};
