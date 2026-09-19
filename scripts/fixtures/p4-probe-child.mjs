if (process.argv[2] === "require-small-heap") {
  const { getHeapStatistics } = await import("node:v8");
  if (!process.execArgv.includes("--max-old-space-size=256") ||
      getHeapStatistics().heap_size_limit > 512 * 1024 ** 2) process.exit(4);
  setTimeout(() => process.exit(0), 150);
} else if (process.argv[2] === "require-gc") {
  if (typeof global.gc !== "function") process.exit(3);
  global.gc();
  setTimeout(() => process.exit(0), 150);
} else if (process.argv[2] === "spin") {
  while (true) { /* Deliberately block the worker event loop. */ }
} else {
  setTimeout(() => process.exit(process.argv[2] === "fail" ? 2 : 0), 150);
}
