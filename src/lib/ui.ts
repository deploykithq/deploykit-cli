import chalk from "chalk";

export interface IStepContext {
  current: number;
  total: number;
}

export const banner = (): void => {
  const title = chalk.cyan.bold;
  process.stdout.write("\n");
  process.stdout.write(title("  ╔══════════════════════════════════════════╗\n"));
  process.stdout.write(title("  ║         ⚡  DeployKit                    ║\n"));
  process.stdout.write(title("  ║      Self-hosted PaaS installer          ║\n"));
  process.stdout.write(title("  ╚══════════════════════════════════════════╝\n"));
  process.stdout.write("\n");
};

export const successBanner = (): void => {
  const title = chalk.green.bold;
  process.stdout.write("\n");
  process.stdout.write(title("  ╔══════════════════════════════════════════╗\n"));
  process.stdout.write(title("  ║      ✓  DeployKit is ready!              ║\n"));
  process.stdout.write(title("  ╚══════════════════════════════════════════╝\n"));
  process.stdout.write("\n");
};

export const log = (msg: string): void => {
  console.log(`  ${chalk.green("✓")} ${msg}`);
};

export const warn = (msg: string): void => {
  console.log(`  ${chalk.yellow("⚠")}  ${msg}`);
};

export const info = (msg: string): void => {
  console.log(`  ${chalk.blue("→")} ${msg}`);
};

export const fail = (msg: string): never => {
  console.error(`\n  ${chalk.red("✗ Error:")} ${msg}\n`);
  process.exit(1);
};

export const step = (ctx: IStepContext, label: string): void => {
  console.log(`\n${chalk.bold(`[${ctx.current}/${ctx.total}] ${label}`)}`);
};

export const dim = (msg: string): string => chalk.dim(msg);
export const bold = (msg: string): string => chalk.bold(msg);
