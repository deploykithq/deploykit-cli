import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import prompts from "prompts";
import {
  API_CONTAINER,
  API_READY_ATTEMPTS,
  BACKUP_DIR,
  COMPOSE_FILE,
  DEPLOYKIT_BRANCH_DEFAULT,
  DEPLOYKIT_DIR_DEFAULT,
  DEPLOYKIT_REPO,
  HEALTH_POLL_INTERVAL_MS,
  HEALTH_TIMEOUT_MS,
} from "../constants.js";
import {
  composeBuild,
  composeDown,
  composePs,
  composeUp,
  containerExec,
  countRunningServices,
  ensureCompose,
  ensureDocker,
  ensureNetwork,
} from "../lib/docker.js";
import { cloneOrUpdate, ensureGit, stripCrlf } from "../lib/git.js";
import { envExists, updateEnvDomain, writeFreshEnv } from "../lib/env.js";
import {
  collectSystemInfo,
  ensureLinux,
  ensureRoot,
  reportSystemInfo,
} from "../lib/system.js";
import {
  banner,
  bold,
  fail,
  info,
  log,
  step,
  successBanner,
  warn,
} from "../lib/ui.js";
import { pollUntil } from "../lib/wait.js";

export interface IInstallOptions {
  domain?: string;
  email?: string;
  adminEmail?: string;
  adminPassword?: string;
  dir?: string;
  branch?: string;
}

interface IResolvedOptions {
  domain: string;
  email: string;
  adminEmail: string;
  adminPassword: string;
  dir: string;
  branch: string;
}

const resolveOptions = async (
  raw: IInstallOptions,
): Promise<IResolvedOptions> => {
  const dir = raw.dir ?? DEPLOYKIT_DIR_DEFAULT;
  const branch = raw.branch ?? DEPLOYKIT_BRANCH_DEFAULT;

  let { domain, email, adminEmail, adminPassword } = raw;

  const needsPrompt = !domain || !email;
  if (needsPrompt && process.stdin.isTTY) {
    console.log(
      `  ${bold("No required arguments — entering interactive mode.")}\n`,
    );
    const answers = await prompts([
      {
        type: domain ? null : "text",
        name: "domain",
        message: "Dashboard domain (e.g. deploy.example.com):",
        validate: (v: string) =>
          v.trim().length > 0 ? true : "domain is required",
      },
      {
        type: email ? null : "text",
        name: "email",
        message: "Email for SSL certificates:",
        validate: (v: string) =>
          v.includes("@") ? true : "must be a valid email",
      },
      {
        type: "text",
        name: "adminEmail",
        message: "Admin email (leave blank to register via UI):",
      },
      {
        type: (prev: string) => (prev && prev.length > 0 ? "password" : null),
        name: "adminPassword",
        message: "Admin password (min 8 chars):",
        validate: (v: string) => (v.length >= 8 ? true : "min 8 chars"),
      },
    ]);
    domain = (answers.domain as string | undefined) ?? domain;
    email = (answers.email as string | undefined) ?? email;
    adminEmail = (answers.adminEmail as string | undefined) ?? adminEmail;
    adminPassword =
      (answers.adminPassword as string | undefined) ?? adminPassword;
  }

  const finalDomain = domain ?? "";
  const finalEmail = email ?? "";
  if (!finalDomain)
    fail("--domain is required. Run `deploykit install --help` for usage.");
  if (!finalEmail)
    fail("--email is required. Run `deploykit install --help` for usage.");

  return {
    domain: finalDomain,
    email: finalEmail,
    adminEmail: adminEmail ?? "",
    adminPassword: adminPassword ?? "",
    dir,
    branch,
  };
};

const TOTAL_STEPS = 7;

const tryCreateAdmin = async (
  adminEmail: string,
  adminPassword: string,
): Promise<boolean> => {
  const payload = JSON.stringify({
    "0": { json: { email: adminEmail, password: adminPassword } },
  });
  const cmd = [
    "curl -sf",
    "-H 'Content-Type: application/json'",
    `-d ${JSON.stringify(payload)}`,
    "'http://localhost:4000/trpc/auth.register?batch=1'",
  ].join(" ");
  const { ok, stdout } = await containerExec(API_CONTAINER, cmd);
  return ok && stdout.includes('"result"');
};

export const runInstall = async (raw: IInstallOptions): Promise<void> => {
  ensureLinux();
  ensureRoot();

  banner();
  const opts = await resolveOptions(raw);

  step({ current: 1, total: TOTAL_STEPS }, "Pre-flight checks");
  log("Running as root");
  const sys = await collectSystemInfo();
  reportSystemInfo(sys);
  log(`Domain: ${opts.domain}`);
  log(`Email:  ${opts.email}`);

  step({ current: 2, total: TOTAL_STEPS }, "Docker");
  await ensureDocker();
  await ensureCompose();

  step({ current: 3, total: TOTAL_STEPS }, "Git");
  await ensureGit();

  step({ current: 4, total: TOTAL_STEPS }, "Downloading DeployKit");
  await cloneOrUpdate({
    repo: DEPLOYKIT_REPO,
    branch: opts.branch,
    dir: opts.dir,
  });
  await stripCrlf(opts.dir);

  step({ current: 5, total: TOTAL_STEPS }, "Configuration");
  const envPath = join(opts.dir, ".env");
  if (envExists(envPath)) {
    log("Existing .env found — keeping secrets, updating domain if changed.");
    await updateEnvDomain(envPath, {
      domain: opts.domain,
      acmeEmail: opts.email,
    });
  } else {
    info("Generating secrets...");
    await composeDown({ cwd: opts.dir, file: COMPOSE_FILE }, true);
    await writeFreshEnv(envPath, {
      domain: opts.domain,
      acmeEmail: opts.email,
    });
    log(`Secrets generated and saved to ${envPath}`);
  }

  step({ current: 6, total: TOTAL_STEPS }, "Starting DeployKit");
  await mkdir(BACKUP_DIR, { recursive: true });
  await ensureNetwork();
  info("Building images (this takes 2–4 minutes on first run)...");
  await composeBuild({ cwd: opts.dir, file: COMPOSE_FILE });
  log("Images built");
  info("Starting services...");
  await composeUp({ cwd: opts.dir, file: COMPOSE_FILE });
  log("Services started");

  info("Waiting for services to be healthy...");
  const attempts = Math.ceil(HEALTH_TIMEOUT_MS / HEALTH_POLL_INTERVAL_MS);
  const healthy = await pollUntil(
    async () =>
      (await countRunningServices({ cwd: opts.dir, file: COMPOSE_FILE })) >= 4,
    { attempts, intervalMs: HEALTH_POLL_INTERVAL_MS },
  );
  if (healthy) {
    const running = await countRunningServices({
      cwd: opts.dir,
      file: COMPOSE_FILE,
    });
    log(`All services healthy (${running} containers running)`);
  } else {
    warn("Some services may still be starting.");
    process.stdout.write(
      await composePs({ cwd: opts.dir, file: COMPOSE_FILE }),
    );
  }

  step({ current: 7, total: TOTAL_STEPS }, "Admin account");
  info("Waiting for API...");
  const apiReady = await pollUntil(
    async () => {
      const probe = await containerExec(
        API_CONTAINER,
        "curl -sf http://localhost:4000/health >/dev/null 2>&1",
      );
      return probe.ok;
    },
    { attempts: API_READY_ATTEMPTS, intervalMs: HEALTH_POLL_INTERVAL_MS },
  );

  if (!apiReady) {
    warn("API not responding yet.");
    info("Check logs: docker logs deploykit-api");
    info(`Once running, open https://${opts.domain} to register.`);
  } else if (opts.adminEmail && opts.adminPassword) {
    const created = await tryCreateAdmin(opts.adminEmail, opts.adminPassword);
    if (created) {
      log(`Admin account created: ${opts.adminEmail}`);
    } else {
      warn("Admin account could not be created automatically.");
      info(
        `Open https://${opts.domain} to register — first user becomes admin.`,
      );
    }
  } else {
    info(
      "No --admin-email provided. Open the dashboard to create your admin account.",
    );
    info("The first user to register becomes admin.");
  }

  successBanner();
  console.log(`  ${bold("Dashboard:")}  https://${opts.domain}`);
  console.log(`  ${bold("Directory:")}  ${opts.dir}`);
  console.log("");
  console.log(`  ${bold("Useful commands:")}`);
  console.log(`    deploykit status`);
  console.log(`    deploykit logs`);
  console.log(`    deploykit restart`);
  console.log("");
  console.log(`  ${bold("Update later:")}`);
  console.log(`    deploykit update`);
  console.log("");
  warn(
    `DNS: make sure an A record points ${opts.domain} → this server's public IP.`,
  );
  console.log("");
};
