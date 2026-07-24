import { mkdir, open, stat, unlink } from "node:fs/promises";
import path from "node:path";

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const removeStaleLock = async (lockPath, staleAfterMs) => {
  try {
    const details = await stat(lockPath);
    if (Date.now() - details.mtimeMs > staleAfterMs) {
      await unlink(lockPath);
      return true;
    }
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
  return false;
};

export const withFileLock = async (
  lockPath,
  operation,
  {
    retryDelayMs = 25,
    staleAfterMs = 30_000,
    timeoutMs = 5_000
  } = {}
) => {
  await mkdir(path.dirname(lockPath), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  let handle;

  while (!handle) {
    try {
      handle = await open(lockPath, "wx");
      await handle.writeFile(
        JSON.stringify({ createdAt: new Date().toISOString(), pid: process.pid }),
        "utf8"
      );
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      await removeStaleLock(lockPath, staleAfterMs);
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for GoTrader file lock: ${lockPath}`);
      }
      await sleep(retryDelayMs);
    }
  }

  try {
    return await operation();
  } finally {
    await handle.close();
    await unlink(lockPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
};
