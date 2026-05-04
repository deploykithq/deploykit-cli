import { readFile } from "node:fs/promises";
import { platform } from "node:os";

import { run } from "./exec.js";

import { fail, log, warn } from "./ui.js";

export interface ISystemInfo {
  prettyName: string;
  totalMemMb: number | null;
  freeDiskGb: number | null;
}

export const ensureLinux = (): void => {
  if (platform() !== "linux") {
    fail(
      "DeployKit CLI only runs on Linux. Connect to your VPS via SSH and run it there.",
    );
  }
};

export const ensureRoot = (): void => {
  if (process.getuid?.() !== 0) {
    fail("Please run as root or with sudo.");
  }
};

const readOsRelease = async (): Promise<string> => {
  try {
    const raw = await readFile("/etc/os-release", "utf8");
    const match = raw.match(/PRETTY_NAME="?([^"\n]+)"?/);
    return match?.[1] ?? "Unknown Linux";
  } catch {
    return "Unknown Linux";
  }
};

const readTotalMemMb = async (): Promise<number | null> => {
  const result = await run("sh", ["-c", "free -m | awk '/Mem:/{print $2}'"]);
  const value = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(value) ? value : null;
};

const readFreeDiskGb = async (): Promise<number | null> => {
  const result = await run("sh", [
    "-c",
    'df -BG / | awk \'NR==2{gsub("G","",$4); print $4}\'',
  ]);
  const value = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(value) ? value : null;
};

export const collectSystemInfo = async (): Promise<ISystemInfo> => {
  const [prettyName, totalMemMb, freeDiskGb] = await Promise.all([
    readOsRelease(),
    readTotalMemMb(),
    readFreeDiskGb(),
  ]);
  return { prettyName, totalMemMb, freeDiskGb };
};

export const reportSystemInfo = (sys: ISystemInfo): void => {
  log(`OS: ${sys.prettyName}`);
  const ram = sys.totalMemMb !== null ? `${sys.totalMemMb}MB` : "unknown";
  const disk = sys.freeDiskGb !== null ? `${sys.freeDiskGb}GB free` : "unknown";
  log(`RAM: ${ram}  |  Disk: ${disk}`);
  if (sys.totalMemMb !== null && sys.totalMemMb < 512) {
    warn("Less than 512MB RAM — DeployKit may be slow to start.");
  }
};
