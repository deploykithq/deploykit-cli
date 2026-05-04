import { chmod } from "node:fs/promises";
import { resolve } from "node:path";

const binPath = resolve("dist/bin/deploykit.js");

await chmod(binPath, 0o755);
console.log(`chmod +x ${binPath}`);
