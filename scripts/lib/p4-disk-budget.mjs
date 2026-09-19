import fs from "node:fs";
import path from "node:path";

export const inspectDiskBudget = ({ directory, maxOutputBytes, minimumFreeDiskBytes, fileSystem = fs }) => {
  if (![maxOutputBytes, minimumFreeDiskBytes].every((n) => Number.isSafeInteger(n) && n >= 0)) {
    throw new Error("P4_INVALID_DISK_LIMIT");
  }
  let outputBytes = 0;
  let entries = 0;
  const visit = (file) => {
    if (++entries > 10000) throw new Error("P4_OUTPUT_ENTRY_LIMIT");
    const stat = fileSystem.lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error("P4_OUTPUT_LINK_FORBIDDEN");
    if (stat.isDirectory()) {
      for (const name of fileSystem.readdirSync(file)) visit(path.join(file, name));
    } else if (stat.isFile()) outputBytes += stat.size;
    else throw new Error("P4_OUTPUT_TYPE_INVALID");
  };
  // Atomic checkpoint renames can invalidate a directory listing. Rescan the
  // entire tree rather than silently omitting the vanished file's bytes.
  for (let attempt = 0; ; attempt += 1) {
    outputBytes = 0;
    entries = 0;
    try { visit(directory); break; }
    catch (error) { if (error.code !== "ENOENT" || attempt >= 2) throw error; }
  }
  const disk = fileSystem.statfsSync(directory);
  const freeDiskBytes = disk.bavail * disk.bsize;
  if (!Number.isSafeInteger(freeDiskBytes) || freeDiskBytes < 0) throw new Error("P4_DISK_UNAVAILABLE");
  return {
    outputBytes, freeDiskBytes,
    reason: outputBytes > maxOutputBytes ? "OUTPUT_LIMIT" :
      freeDiskBytes < minimumFreeDiskBytes ? "FREE_DISK_LIMIT" : null
  };
};
