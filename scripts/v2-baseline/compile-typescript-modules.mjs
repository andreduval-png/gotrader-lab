import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const moduleFileFor = (specifier) => `${path.basename(specifier).replace(/\.tsx?$/, "")}.mjs`;

const resolveTypescriptDependency = (sourcePath, specifier) => {
  if (!specifier.startsWith(".")) return undefined;
  const unresolved = path.resolve(path.dirname(sourcePath), specifier);
  const extension = path.extname(unresolved);
  const candidates = extension
    ? [
        unresolved,
        unresolved.replace(/\.(?:mjs|cjs|js)$/, ".ts"),
        unresolved.replace(/\.(?:mjs|cjs|js)$/, ".tsx")
      ]
    : [
        `${unresolved}.ts`,
        `${unresolved}.tsx`,
        path.join(unresolved, "index.ts"),
        path.join(unresolved, "index.tsx")
      ];
  return candidates.find((candidate) => fs.existsSync(candidate));
};

const staticRelativeSpecifiers = (source, sourcePath) => {
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.ES2022,
    true,
    sourcePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  return sourceFile.statements.flatMap((statement) => {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith(".")
    ) {
      return [statement.moduleSpecifier.text];
    }
    return [];
  });
};

const collectTypescriptModules = (seedFiles) => {
  const queue = seedFiles.map((file) => path.resolve(file));
  const collected = new Map();
  while (queue.length > 0) {
    const sourcePath = queue.shift();
    if (collected.has(sourcePath)) continue;
    const source = fs.readFileSync(sourcePath, "utf8");
    collected.set(sourcePath, source);
    for (const specifier of staticRelativeSpecifiers(source, sourcePath)) {
      const dependency = resolveTypescriptDependency(sourcePath, specifier);
      if (dependency && !collected.has(dependency)) queue.push(dependency);
    }
  }
  return collected;
};

const rewriteRelativeImports = (source) =>
  source.replace(
    /(from\s+|import\s*)["'](\.\.?\/[^"']+)["']/g,
    (match, prefix, specifier) => `${prefix}"./${moduleFileFor(specifier)}"`
  );

export function compileTypescriptModules({ files, outRoot }) {
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });

  const modules = collectTypescriptModules(files);
  const outputOwners = new Map();
  for (const sourcePath of modules.keys()) {
    const outputName = `${path.basename(sourcePath).replace(/\.tsx?$/, "")}.mjs`;
    const existingOwner = outputOwners.get(outputName);
    if (existingOwner && existingOwner !== sourcePath) {
      throw new Error(
        `TypeScript test module basename collision: ${existingOwner} and ${sourcePath}`
      );
    }
    outputOwners.set(outputName, sourcePath);
  }

  for (const [sourcePath, source] of modules) {
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
        verbatimModuleSyntax: false
      },
      fileName: sourcePath
    }).outputText;
    const outputName = `${path.basename(sourcePath).replace(/\.tsx?$/, "")}.mjs`;
    fs.writeFileSync(path.join(outRoot, outputName), rewriteRelativeImports(transpiled), "utf8");
  }
}
