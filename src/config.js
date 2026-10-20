import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const CONFIG_PATH = join(homedir(), ".config", "pixalera", "config.json");

export function loadConfig() {
  try {
    if (!existsSync(CONFIG_PATH)) return {};
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

export function saveConfig(patch) {
  const next = { ...loadConfig(), ...patch };
  mkdirSync(dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
  if (process.platform !== 'win32') chmodSync(CONFIG_PATH, 0o600);
  return next;
}

export function configPath() {
  return CONFIG_PATH;
}

/** API key: env var wins, then saved config. */
export function getApiKey() {
  const key = process.env.PIXALERA_API_KEY?.trim() || loadConfig().apiKey;
  if (!key) {
    throw new Error(
      "No Pixalera API key found.\n" +
        "Run: pixalera init --key <your-key>\n" +
        "or set the PIXALERA_API_KEY environment variable.\n" +
        "Create a key at https://app.pixalera.in/dashboard/settings?section=developers",
    );
  }
  return key;
}

export function getApiBase() {
  return (
    process.env.PIXALERA_API_URL?.trim() ||
    loadConfig().apiBase ||
    "https://api.pixalera.in"
  ).replace(/\/+$/, "");
}
