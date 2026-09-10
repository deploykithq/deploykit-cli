export const DEPLOYKIT_REPO = "https://github.com/deploykithq/deploykit.git";
export const DEPLOYKIT_FALLBACK_BRANCH = "master";
export const DEPLOYKIT_DIR_DEFAULT = "/opt/deploykit";
export const COMPOSE_FILE = "docker-compose.prod.yml";
export const NETWORK_NAME = "deploykit-network";
export const BACKUP_DIR = "/var/backups/deploykit";
export const API_CONTAINER = "deploykit-api";

export const HEALTH_TIMEOUT_MS = 120_000;
export const HEALTH_POLL_INTERVAL_MS = 3_000;
export const API_READY_ATTEMPTS = 40;
