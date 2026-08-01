import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import path from "node:path";

const transientRenameCodes = new Set(["EACCES", "EBUSY", "EPERM"]);

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createCanonicalResearchNodeStorage({ root }) {
  const absoluteRoot = path.resolve(root);
  let writesToFail = 0;

  const resolveSafe = (relativePath) => {
    if (
      typeof relativePath !== "string" ||
      relativePath.length === 0 ||
      relativePath.includes("\\") ||
      relativePath.split("/").some((segment) => !segment || segment === "." || segment === "..")
    ) {
      throw new Error("Canonical research storage path is invalid.");
    }
    const resolved = path.resolve(absoluteRoot, ...relativePath.split("/"));
    if (!resolved.startsWith(`${absoluteRoot}${path.sep}`)) {
      throw new Error("Canonical research storage path escaped its root.");
    }
    return resolved;
  };

  const renameWithRetry = async (source, destination) => {
    let latestError;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        await fs.rename(source, destination);
        return;
      } catch (error) {
        latestError = error;
        if (!transientRenameCodes.has(error?.code) || attempt === 5) throw error;
        await delay(Math.min(25 * (2 ** attempt), 400));
      }
    }
    throw latestError;
  };

  const adapter = {
    async readText(relativePath) {
      try {
        return await fs.readFile(resolveSafe(relativePath), "utf8");
      } catch (error) {
        if (error?.code === "ENOENT") return undefined;
        throw error;
      }
    },
    async writeTextAtomic(relativePath, value) {
      if (writesToFail > 0) {
        writesToFail -= 1;
        const error = new Error("Injected transient atomic-write contention.");
        error.code = "EAGAIN";
        throw error;
      }
      const destination = resolveSafe(relativePath);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, value, { encoding: "utf8", flag: "wx" });
        await renameWithRetry(temporary, destination);
      } catch (error) {
        await fs.rm(temporary, { force: true }).catch(() => undefined);
        throw error;
      }
    },
    async listFiles(relativePath) {
      const directory = resolveSafe(relativePath);
      try {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        return entries
          .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
          .map((entry) => entry.name)
          .sort();
      } catch (error) {
        if (error?.code === "ENOENT") return [];
        throw error;
      }
    },
    async removeFile(relativePath) {
      await fs.rm(resolveSafe(relativePath), { force: true });
    }
  };

  return Object.freeze({
    adapter: Object.freeze(adapter),
    root: absoluteRoot,
    resolveSafe,
    failNextWrites(count = 1) {
      writesToFail = Math.max(0, Math.trunc(count));
    }
  });
}
