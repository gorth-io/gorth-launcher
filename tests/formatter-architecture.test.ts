import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const formatterPath = "lib/utils/formatter.ts";
const roots = [
  "app",
  "components",
  "controllers",
  "database",
  "hooks",
  "layouts",
  "lib",
  "main",
  "pages",
  "preload",
  "providers",
  "routes",
  "services",
];
function sourceFiles(directory: string): string[] {
  if (directory === "components/ui" || directory === "components/ui copy")
    return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = directory + "/" + entry.name;
    return entry.isDirectory()
      ? sourceFiles(filename)
      : /\.(ts|tsx|mjs|cjs|js)$/.test(filename)
        ? [filename]
        : [];
  });
}
function visit(node: ts.Node, inspect: (node: ts.Node) => void) {
  inspect(node);
  ts.forEachChild(node, (child) => visit(child, inspect));
}
function parse(filename: string) {
  return ts.createSourceFile(
    filename,
    readFileSync(path.resolve(filename), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
}
test("app-owned display formatting stays in lib/utils/formatter.ts", () => {
  const violations: string[] = [];
  const methods = new Set([
    "toLocaleString",
    "toLocaleDateString",
    "toLocaleTimeString",
    "toFixed",
    "toPrecision",
    "toISOString",
  ]);
  for (const filename of roots.flatMap(sourceFiles)) {
    if (filename === formatterPath) continue;
    const source = parse(filename);
    visit(source, (node) => {
      let violation = false;
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
      )
        violation = methods.has(node.expression.name.text);
      if (
        ts.isNewExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
      )
        violation ||=
          node.expression.expression.getText(source) === "Intl" &&
          [
            "DateTimeFormat",
            "NumberFormat",
            "RelativeTimeFormat",
            "DurationFormat",
          ].includes(node.expression.name.text);
      if (ts.isFunctionDeclaration(node) && node.name)
        violation ||= /^format[A-Z]/.test(node.name.text);
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) ||
          ts.isFunctionExpression(node.initializer))
      )
        violation ||= /^format[A-Z]/.test(node.name.text);
      if (violation) {
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        violations.push(filename + ":" + line + " " + node.getText(source));
      }
    });
  }
  assert.deepEqual(
    violations,
    [],
    "Move display formatters to " + formatterPath,
  );
});

test("formatters have no runtime imports, privileged access or implicit clock reads", () => {
  const source = parse(formatterPath);
  const forbidden = new Set([
    "process",
    "window",
    "document",
    "navigator",
    "fetch",
    "axios",
    "ipcMain",
    "ipcRenderer",
    "require",
    "console",
  ]);
  visit(source, (node) => {
    assert.ok(
      !ts.isImportDeclaration(node) && !ts.isExportDeclaration(node),
      "Formatting must be self-contained and pure",
    );
    if (ts.isIdentifier(node))
      assert.ok(
        !forbidden.has(node.text),
        "Unexpected formatter dependency: " + node.text,
      );
    if (ts.isPropertyAccessExpression(node)) {
      assert.notEqual(node.getText(source), "import.meta.env");
      assert.notEqual(node.getText(source), "Date.now");
    }
    if (ts.isNewExpression(node) && node.expression.getText(source) === "Date")
      assert.ok(node.arguments?.length, "Pass the clock value from the caller");
  });
});
