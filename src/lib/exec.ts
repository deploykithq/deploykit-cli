import { execa, type Options as ExecaOptions, type ResultPromise } from "execa";

export interface IRunOptions {
  cwd?: string;
  env?: Record<string, string>;
  stdio?: "inherit" | "pipe" | "ignore";
  reject?: boolean;
}

export interface IRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const toOptions = (opts: IRunOptions = {}): ExecaOptions => ({
  cwd: opts.cwd,
  env: opts.env,
  stdio: opts.stdio ?? "pipe",
  reject: opts.reject ?? false,
  all: false,
});

export const run = async (
  command: string,
  args: readonly string[] = [],
  opts: IRunOptions = {},
): Promise<IRunResult> => {
  const result = await execa(command, args as string[], toOptions(opts));
  return {
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
    exitCode: result.exitCode ?? 0,
  };
};

export const runInherit = (
  command: string,
  args: readonly string[] = [],
  opts: IRunOptions = {},
): ResultPromise =>
  execa(command, args as string[], { ...toOptions(opts), stdio: "inherit" });

export const exists = async (command: string): Promise<boolean> => {
  const result = await run("sh", ["-c", `command -v ${command}`]);
  return result.exitCode === 0 && result.stdout.trim().length > 0;
};

export const isOk = (result: IRunResult): boolean => result.exitCode === 0;
