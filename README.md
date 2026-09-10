# @deploykit/cli

> Install, update, and manage a self-hosted [DeployKit](https://github.com/deploykithq/deploykit) instance on a Linux VPS.

```bash
npm install -g @deploykit/cli
sudo deploykit install --domain deploy.example.com --email you@example.com
```

This is a native Node port of the `curl | sh` installer that ships with DeployKit. Everything the shell installer does — installing Docker, cloning the repo, generating secrets, building containers, bootstrapping the admin account — is reproduced here as a typed, scriptable CLI.

---

## Requirements

- A Linux VPS (Ubuntu, Debian, RHEL, Alpine)
- Root or `sudo`
- Node.js >= 20 on the VPS (only needed to run the CLI itself; everything else is installed for you)
- Ports 80 and 443 reachable from the public internet

> The CLI refuses to run on macOS or Windows on purpose. Connect to the VPS via SSH and run it there.

## Install the CLI

```bash
npm install -g @deploykit/cli
```

Or one-shot via `npx`:

```bash
sudo npx @deploykit/cli install --domain deploy.example.com --email you@example.com
```

## Commands

### `deploykit install`

Bootstraps DeployKit on the current machine.

```bash
sudo deploykit install \
  --domain deploy.example.com \
  --email you@example.com \
  --admin-email admin@example.com \
  --admin-password mypassword123
```

| Flag | Description | Default |
|------|-------------|---------|
| `--domain <domain>` | Dashboard domain (required) | — |
| `--email <email>` | Let's Encrypt email (required) | — |
| `--admin-email <email>` | Pre-create admin account | — |
| `--admin-password <pwd>` | Admin password, min 8 chars | — |
| `--dir <path>` | Install directory | `/opt/deploykit` |
| `--tag <tag>` | Install a specific release, e.g. `v0.2.0` | latest release |
| `--branch <branch>` | Install from a Git branch instead of a release | — |

If `--domain` and `--email` are omitted in a TTY, the CLI drops into interactive prompts.

#### Which version gets installed

By default the CLI installs the **latest released version** — it reads the tags
from the DeployKit repository, picks the highest semver tag, and checks that out.
Pre-releases (`v1.2.0-rc.1`) are ignored.

```bash
sudo deploykit install --domain deploy.example.com --email you@example.com  # latest release
sudo deploykit install --tag v0.2.0 ...                                     # pin a release
sudo deploykit install --branch master ...                                  # unreleased code
```

The `v` prefix is optional, so `--tag 0.2.0` and `--tag v0.2.0` are equivalent.
An unknown tag fails immediately and lists the tags that do exist. If the
repository has no released version at all, the CLI warns and falls back to
`master`.

### `deploykit update`

Moves the installation to the latest released version, rebuilds the images, and
restarts the stack. Takes the same `--tag` and `--branch` flags as `install`, so
you can pin or roll back to a specific release.

```bash
sudo deploykit update                 # latest release
sudo deploykit update --tag v0.2.0    # pin (or roll back) to a release
sudo deploykit update --branch master # track unreleased code
```

### `deploykit status`

Lists running containers via `docker compose ps`.

```bash
deploykit status
```

### `deploykit logs`

Streams live logs from all services.

```bash
deploykit logs
```

### `deploykit restart`

Restarts every DeployKit service.

```bash
sudo deploykit restart
```

### `deploykit uninstall`

Stops the stack and removes the installation. Add `--delete-data` to wipe Postgres/Redis volumes and backups.

```bash
sudo deploykit uninstall --yes
sudo deploykit uninstall --yes --delete-data
```

## After install

```text
Dashboard:  https://<your-domain>
Directory:  /opt/deploykit
```

Make sure an `A` record points your domain to the server's public IP — Traefik issues a Let's Encrypt cert on first request.

## Development

```bash
git clone https://github.com/deploykithq/deploykit-cli.git
cd deploykit-cli
npm install
npm run dev -- install --help    # run from source
npm run build                    # compile to dist/
npm run lint                     # tsc --noEmit
npm test                         # vitest
```

The CLI itself is pure Node (no shell scripts) so you can lint and build it from any OS, but the runtime ops (Docker, systemctl, apt-get) only succeed on Linux.

## Releasing

Releases are automated. Do not run `npm version` or `npm publish` by hand — a
manual bump desyncs `.release-please-manifest.json`, and the next automated
release then fights it.

1. Merge a PR into `master` with a [Conventional Commits](https://www.conventionalcommits.org/)
   title (`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, ...). PRs are
   squash-merged, so the PR title becomes the commit that drives the changelog;
   a CI check enforces the format.
2. [release-please](https://github.com/googleapis/release-please) keeps a
   `chore(master): release X.Y.Z` PR open, accumulating the changelog entries
   and the version bump.
3. Merging that PR creates the `vX.Y.Z` tag and the GitHub Release, and the
   `publish` job ships the package to npm.

`feat:` bumps the minor, `fix:` the patch, and a `!` or a `BREAKING CHANGE:`
footer bumps the major. While the package is pre-1.0, breaking changes bump the
minor instead.

The version lives in `package.json`; `VERSION` in `src/bin/deploykit.ts` carries
an `x-release-please-version` annotation so the two never drift.

npm publishing uses [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) —
the workflow authenticates through GitHub's OIDC provider, so there is no
`NPM_TOKEN` secret to rotate and every release ships with provenance.

`prepublishOnly` runs `clean && build`. The published tarball only includes `dist/`, `README.md`, and `LICENSE`.

## License

[MIT](LICENSE)
