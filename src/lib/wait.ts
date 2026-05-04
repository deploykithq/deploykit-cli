export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface IPollOptions {
  attempts: number;
  intervalMs: number;
}

export const pollUntil = async (
  check: () => Promise<boolean>,
  opts: IPollOptions,
): Promise<boolean> => {
  for (let i = 0; i < opts.attempts; i += 1) {
    if (await check()) return true;
    await sleep(opts.intervalMs);
  }
  return false;
};
