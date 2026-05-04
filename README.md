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
| `--branch <branch>` | Git branch to install | `master` |

If `--domain` and `--email` are omitted in a TTY, the CLI drops into interactive prompts.

### `deploykit update`

Pulls the latest commit, rebuilds the images, and restarts the stack.

```bash
sudo deploykit update
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
```

The CLI itself is pure Node (no shell scripts) so you can lint and build it from any OS, but the runtime ops (Docker, systemctl, apt-get) only succeed on Linux.

## Publishing

```bash
npm login
npm version patch    # or minor / major
npm publish --access public
```

`prepublishOnly` runs `clean && build`. The published tarball only includes `dist/`, `README.md`, and `LICENSE`.

## License

[MIT](LICENSE)
