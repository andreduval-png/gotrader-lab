import fs from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";

const LOCAL_ENV_FILES = [".env.local", ".env"];

export async function loadLocalEnvironment({ cwd = process.cwd(), env = process.env } = {}) {
  const loadedFiles = [];
  const addedKeys = [];

  for (const fileName of LOCAL_ENV_FILES) {
    const filePath = path.join(cwd, fileName);
    let source;
    try {
      source = await fs.readFile(filePath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    const parsed = parseEnv(source);
    loadedFiles.push(fileName);
    for (const [key, value] of Object.entries(parsed)) {
      if (env[key] !== undefined) continue;
      env[key] = value;
      addedKeys.push(key);
    }
  }

  return { loadedFiles, addedKeys };
}
