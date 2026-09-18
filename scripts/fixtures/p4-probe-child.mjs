if (process.argv[2] === "spin") {
  while (true) { /* Deliberately block the worker event loop. */ }
} else {
  setTimeout(() => process.exit(process.argv[2] === "fail" ? 2 : 0), 150);
}
