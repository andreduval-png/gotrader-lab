import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const moduleFileFor = (specifier) => `${path.basename(specifier).replace(/\.tsx?$/, "")}.mjs`;

const rewriteRelativeImports = (source) =>
  source.replace(
    /(from\s+|import\s*)["'](\.\.?\/[^"']+)["']/g,
    (match, prefix, specifier) => `${prefix}"./${moduleFileFor(specifier)}"`
  );

export function compileTypescriptModules({ files, outRoot }) {
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });

  for (const sourcePath of files) {
    const source = fs.readFileSync(sourcePath, "utf8");
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
