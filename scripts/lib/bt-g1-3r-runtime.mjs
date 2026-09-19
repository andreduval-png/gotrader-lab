import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { createHash } from "node:crypto";
import { canonicalHash } from "./bt-g1-3-certified-dataset.mjs";

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

// Reuse only a complete, package-bound runtime. Never rebuild a damaged cache.
export const loadBoundRuntime = ({ outputRoot, entries, packageBinding }) => {
  const manifestFile = path.join(outputRoot, "runtime-manifest.json");
  const bindingHash = canonicalHash({ packageBinding, entries });
  const inventory = () => fs.readdirSync(outputRoot, { recursive: true, withFileTypes: true })
    .filter((item) => item.isFile() && item.name !== "runtime-manifest.json")
    .map((item) => {
      const file = path.join(item.parentPath ?? item.path, item.name);
      return { file: path.relative(outputRoot, file).replace(/\\/g, "/"),
        hash: createHash("sha256").update(fs.readFileSync(file)).digest("hex") };
    }).sort((a, b) => a.file.localeCompare(b.file));
  if (fs.existsSync(outputRoot)) {
    const { manifestHash, ...manifest } = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    if (manifestHash !== canonicalHash(manifest) || manifest.bindingHash !== bindingHash ||
        canonicalHash(manifest.files) !== canonicalHash(inventory())) throw new Error("BOUND_RUNTIME_INTEGRITY_FAILURE");
    return { outputRoot, compiledFiles: manifest.files.length,
      entryUrls: Object.fromEntries(entries.map((entry) => [entry,
        pathToFileURL(path.join(outputRoot, entry.replace(/\.(?:ts|tsx)$/, ".mjs"))).href])) };
  }
  const runtime = compileBtG13rRuntime({ outputRoot, entries });
  const manifest = { bindingHash, files: inventory() };
  fs.writeFileSync(manifestFile, JSON.stringify({ ...manifest, manifestHash: canonicalHash(manifest) }), { flag: "wx" });
  return runtime;
};

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
