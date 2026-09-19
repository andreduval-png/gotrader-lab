if (process.argv[2] === "require-gc") {
  if (typeof global.gc !== "function") process.exit(3);
  global.gc();
  setTimeout(() => process.exit(0), 150);
} else if (process.argv[2] === "spin") {
  while (true) { /* Deliberately block the worker event loop. */ }
} else {
  setTimeout(() => process.exit(process.argv[2] === "fail" ? 2 : 0), 150);
}
