import fs from "node:fs";
import path from "node:path";

export const inspectDiskBudget = ({ directory, maxOutputBytes, minimumFreeDiskBytes }) => {
  if (![maxOutputBytes, minimumFreeDiskBytes].every((n) => Number.isSafeInteger(n) && n >= 0)) {
    throw new Error("P4_INVALID_DISK_LIMIT");
  }
  let outputBytes = 0;
  let entries = 0;
  const visit = (file) => {
    if (++entries > 10000) throw new Error("P4_OUTPUT_ENTRY_LIMIT");
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error("P4_OUTPUT_LINK_FORBIDDEN");
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(file)) visit(path.join(file, name));
    } else if (stat.isFile()) outputBytes += stat.size;
    else throw new Error("P4_OUTPUT_TYPE_INVALID");
  };
  visit(directory);
  const disk = fs.statfsSync(directory);
  const freeDiskBytes = disk.bavail * disk.bsize;
  if (!Number.isSafeInteger(freeDiskBytes) || freeDiskBytes < 0) throw new Error("P4_DISK_UNAVAILABLE");
  return {
    outputBytes, freeDiskBytes,
    reason: outputBytes > maxOutputBytes ? "OUTPUT_LIMIT" :
      freeDiskBytes < minimumFreeDiskBytes ? "FREE_DISK_LIMIT" : null
  };
};
