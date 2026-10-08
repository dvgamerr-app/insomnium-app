// Source inventory, not runtime acceptance. Run from the repository root with Bun.
import { parse, parseCss, VERSION } from "svelte/compiler";
import { createHash } from "node:crypto";
import { resolve, relative, dirname } from "node:path";
import { mkdir } from "node:fs/promises";

const root = process.cwd();
const uiRoot = resolve("src/lib/components/ui");
const portable = (path) => path.replaceAll("\\", "/");
const files = (
  await Array.fromAsync(
    new Bun.Glob("src/**/*.{svelte,css,js}").scan({ cwd: root }),
  )
).sort();
const source = new Map(
  await Promise.all(
    files.map(async (path) => [portable(path), await Bun.file(path).text()]),
  ),
);
const components = [];
const raw = [];
const styles = [];
const dynamicElements = [];
const nativeNames = new Set([
  "input",
  "select",
  "textarea",
  "button",
  "dialog",
]);

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    // Expression ASTs cannot contain Svelte markup; avoid script/object data.
    if (!["expression", "attributes", "metadata", "loc"].includes(key))
      walk(value, visit);
  }
}

for (const [path, text] of source) {
  if (!path.endsWith(".svelte")) continue;
  const ast = parse(text, { modern: true, filename: path });
  const imports = new Map();
  for (const node of ast.instance?.content.body ?? []) {
    if (
      node.type !== "ImportDeclaration" ||
      typeof node.source.value !== "string"
    )
      continue;
    const specifier = node.source.value;
    const target = specifier.startsWith("$lib/")
      ? resolve("src/lib", specifier.slice(5))
      : specifier.startsWith(".")
        ? resolve(dirname(path), specifier)
        : null;
    if (
      !target ||
      (!target.startsWith(uiRoot + "/") && !target.startsWith(uiRoot + "\\"))
    )
      continue;
    for (const imported of node.specifiers)
      imports.set(imported.local.name, portable(relative(root, target)));
  }
  walk(ast.fragment, (node) => {
    const line = text.slice(0, node.start).split("\n").length;
    if (node.type === "RegularElement" && nativeNames.has(node.name)) {
      raw.push({
        path,
        line,
        name: node.name,
        sharedOwner: path.startsWith("src/lib/components/ui/"),
      });
    }
    if (node.type === "SvelteElement") dynamicElements.push({ path, line });
    if (node.type === "Component" && imports.has(node.name)) {
      components.push({
        path,
        line,
        name: node.name,
        owner: imports.get(node.name),
        internal: path.startsWith("src/lib/components/ui/"),
      });
    }
  });
  if (ast.css) styles.push({ path, css: ast.css.content.styles });
}
for (const [path, text] of source) {
  if (path.endsWith(".css")) styles.push({ path, css: text });
}

const definitions = new Map();
const declarations = [];
for (const { path, css } of styles) {
  walk(parseCss(css), (node) => {
    if (node.type !== "Declaration") return;
    declarations.push({ path, property: node.property, value: node.value });
    if (!node.property.startsWith("--")) return;
    const rows = definitions.get(node.property) ?? [];
    rows.push({ path, value: node.value.trim() });
    definitions.set(node.property, rows);
  });
}
const tokens = [...definitions]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, declarations]) => {
    const references = [...source].flatMap(([path, text]) => {
      const count = [
        ...text.matchAll(/var\(\s*(--[\w-]+)(?=\s*[,\)])/g),
      ].filter((match) => match[1] === name).length;
      return count ? [{ path, count }] : [];
    });
    return {
      name,
      declarations,
      references,
      aliases: declarations.filter((row) =>
        /^var\(--[\w-]+\)$/.test(row.value),
      ),
    };
  });
const cssOrder = [];
const active = new Set();
async function visitCss(path) {
  path = portable(path);
  if (active.has(path)) throw Error("CSS import cycle: " + path);
  active.add(path);
  const text = source.get(path);
  if (text === undefined) throw Error("Missing local stylesheet: " + path);
  cssOrder.push(path);
  for (const match of text.matchAll(/@import\s+["']([^"']+)["']/g)) {
    await visitCss(portable(relative(root, resolve(dirname(path), match[1]))));
  }
  active.delete(path);
}
await visitCss("src/lib/styles.css");
const consumers = [...new Set(components.map((row) => row.owner))]
  .sort()
  .map((owner) => {
    const publicSites = components.filter(
      (row) => row.owner === owner && !row.internal,
    );
    return {
      owner,
      sites: publicSites.length,
      consumers: [...new Set(publicSites.map((row) => row.path))].sort(),
      internalSites: components.filter(
        (row) => row.owner === owner && row.internal,
      ).length,
    };
  });
const report = {
  generatedAt: new Date().toISOString(),
  compilerVersion: VERSION,
  sourceHash: createHash("sha256")
    .update([...source].map(([path, text]) => path + "\0" + text).join("\0"))
    .digest("hex"),
  scope:
    "Production src only; Svelte AST static markup sites, not mounted controls or runtime/CSS reachability acceptance. CSS var references are lexical candidates, not proof of dead code or externally unused public tokens.",
  summary: {
    svelteFiles: [...source.keys()].filter((path) => path.endsWith(".svelte"))
      .length,
    featureRawControls: raw.filter((row) => !row.sharedOwner),
    dynamicElements,
    sharedMarkupSites: components.filter((row) => !row.internal).length,
    featureScopedStyleFiles: styles
      .filter(
        (row) =>
          row.path.endsWith(".svelte") &&
          !row.path.startsWith("src/lib/components/ui/"),
      )
      .map((row) => row.path),
    tokenCount: tokens.length,
    tokensWithoutVarReferences: tokens
      .filter((row) => !row.references.length)
      .map((row) => row.name),
    tokenMultipleOwnerFiles: tokens
      .filter(
        (row) => new Set(row.declarations.map((item) => item.path)).size > 1,
      )
      .map((row) => row.name),
    duplicateCssImports: cssOrder.filter(
      (path, index) => cssOrder.indexOf(path) !== index,
    ),
    cssDeclarationCount: declarations.length,
    unresolvedVarNames: [
      ...new Set(
        [...source.values()].flatMap((text) =>
          [...text.matchAll(/var\(\s*(--[\w-]+)(?=\s*[,\)])/g)].map(
            (match) => match[1],
          ),
        ),
      ),
    ]
      .filter((name) => !definitions.has(name))
      .sort(),
    dynamicVarSources: [...source].flatMap(([path, text]) =>
      [...text.matchAll(/var\(\s*(--[\w-]+)(?![\w-])(?=[^\s,)])/g)].map(
        (match) => ({ path, prefix: match[1] }),
      ),
    ),
  },
  consumers,
  raw,
  cssOrder,
  tokens,
  declarations,
};
await mkdir("artifacts/ui-inventory", { recursive: true });
await Bun.write(
  "artifacts/ui-inventory/report.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      summary: report.summary,
      consumers: consumers.map(({ owner, sites, consumers }) => ({
        owner,
        sites,
        consumerFiles: consumers.length,
      })),
    },
    null,
    2,
  ),
);
