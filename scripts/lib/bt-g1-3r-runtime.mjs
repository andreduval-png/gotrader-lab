import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const SOURCE_EXTENSIONS = [".ts", ".tsx"];

const resolveSource = (root, importer, specifier) => {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return undefined;
  const base = specifier.startsWith("@/")
    ? path.join(root, "src", specifier.slice(2))
    : path.resolve(path.dirname(importer), specifier);
  const candidates = [
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
    base
  ];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
};

const outputFor = (root, outputRoot, source) => path.join(
  outputRoot,
  path.relative(root, source).replace(/\.(?:ts|tsx)$/, ".mjs")
);

const importSpecifiers = (source) => [...source.matchAll(
  /(?:from\s*|import\s*\()(["'])([^"']+)\1/g
)].map((match) => match[2]);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const compileBtG13rRuntime = ({
  root = process.cwd(),
  outputRoot = path.resolve(".gotrader", "bt-g1-3r-runtime"),
  entries
}) => {
  const allowedRoot = path.resolve(root, ".gotrader");
  outputRoot = path.resolve(outputRoot);
  const relativeOutput = path.relative(allowedRoot, outputRoot);
  if (!relativeOutput || relativeOutput.startsWith("..") || path.isAbsolute(relativeOutput)) {
    throw new Error("BT_G1_3R_RUNTIME_OUTPUT_OUTSIDE_WORKSPACE");
  }
  fs.rmSync(outputRoot, { recursive: true, force: true });
  const pending = entries.map((entry) => path.resolve(root, entry));
  const compiled = new Set();
  while (pending.length) {
    const sourcePath = pending.pop();
    if (compiled.has(sourcePath)) continue;
    if (!fs.existsSync(sourcePath)) throw new Error(`BT_G1_3R_RUNTIME_SOURCE_MISSING: ${sourcePath}`);
    const source = fs.readFileSync(sourcePath, "utf8");
    const resolutions = new Map();
    for (const specifier of importSpecifiers(source)) {
      const resolved = resolveSource(root, sourcePath, specifier);
      if (!resolved) continue;
      resolutions.set(specifier, resolved);
      pending.push(resolved);
    }
    let output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
        verbatimModuleSyntax: false
      },
      fileName: sourcePath
    }).outputText;
    const outputPath = outputFor(root, outputRoot, sourcePath);
    for (const [specifier, resolved] of resolutions) {
      let relative = path.relative(path.dirname(outputPath), outputFor(root, outputRoot, resolved)).replace(/\\/g, "/");
      if (!relative.startsWith(".")) relative = `./${relative}`;
      output = output.replace(
        new RegExp(`(["'])${escapeRegex(specifier)}\\1`, "g"),
        (_match, quote) => `${quote}${relative}${quote}`
      );
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, output, "utf8");
    compiled.add(sourcePath);
  }
  return Object.freeze({
    outputRoot,
    compiledFiles: compiled.size,
    entryUrls: Object.fromEntries(entries.map((entry) => [
      entry,
      pathToFileURL(outputFor(root, outputRoot, path.resolve(root, entry))).href
    ]))
  });
};
