// Read-only checks for the requested static/source submission, not a behavior certification.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const git = (args) =>
  execFileSync("git", args, { encoding: "utf8" }).split("\0").filter(Boolean);
const allChanged = git(["diff", "--name-only", "-z"]);
const changed = allChanged.filter((f) => fs.existsSync(f));
const added = git(["ls-files", "--others", "--exclude-standard", "-z"]);
const files = [...new Set([...changed, ...added])].filter(
  (f) => !f.startsWith("test/scratch/") && !f.startsWith(".imd/"),
);
const forbidden =
  /^(?:\.git\/|\.github\/|lib\/|foundry\.toml$|foundry\.lock$|remappings\.txt$|\.gitmodules$|package\.json$|package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$)|(?:^|\/)(?:node_modules|\.env(?:\..*)?)(?:\/|$)/;
assert.equal(
  [...allChanged, ...added].filter((f) => forbidden.test(f)).length,
  0,
  "Protected paths changed",
);
assert.equal(
  files.filter((f) => /\.tgz$|\.map$/.test(f)).length,
  0,
  "Unnecessary archive/source map in work files",
);
const artifactFiles = files.filter((f) => f.startsWith("artifacts/"));
const artifactBytes = artifactFiles.reduce(
  (n, f) => n + fs.statSync(f).size,
  0,
);
assert.ok(
  artifactBytes <= 786432,
  `Artifacts exceed the explicit 768 KiB path budget: ${artifactBytes}`,
);
const workBytes = files.reduce((n, f) => n + fs.statSync(f).size, 0);
assert.ok(workBytes <= 8388608, `Work files exceed 8 MiB: ${workBytes}`);
const html = fs.readFileSync("dist/index.html", "utf8");
for (const needed of [
  "<title>",
  'name="description"',
  'rel="icon"',
  'property="og:title"',
  'property="og:image"',
])
  assert.ok(html.includes(needed), needed);
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const url = match[1];
  assert.ok(url.startsWith("./"), `Nonrelative asset URL: ${url}`);
  assert.ok(fs.existsSync(path.join("dist", url)), `Missing ${url}`);
}
for (const name of ["favicon.svg", "og-image.png", "hatchery.config.json"])
  assert.deepEqual(
    fs.readFileSync("dist/" + name),
    fs.readFileSync("public/" + name),
  );
const config = JSON.parse(fs.readFileSync("dist/hatchery.config.json", "utf8"));
assert.equal(config.chainId, 11155111);
assert.equal(config.contractAddress, null);
assert.equal(config.startBlock, null);
assert.equal(config.proofServiceUrl, null);
const input = JSON.parse(
  fs.readFileSync("artifacts/contracts/standard-input.json", "utf8"),
);
for (const [file, source] of Object.entries(input.sources))
  if (file.startsWith("contracts/"))
    assert.equal(
      fs.readFileSync(file, "utf8"),
      source.content,
      `Compiler input is stale: ${file}`,
    );
const contract = JSON.parse(
  fs.readFileSync("artifacts/contracts/SqueekHatchery.json", "utf8"),
);
const abiText = fs.readFileSync("src/abi.ts", "utf8");
const abi = JSON.parse(
  abiText.slice(abiText.indexOf("=") + 1, abiText.lastIndexOf(" as const")),
);
assert.deepEqual(abi, contract.abi, "Frontend ABI differs from compiler");
for (const name of [
  "initialize",
  "claim",
  "hatch",
  "upgradeToAndCall",
  "transferOwnership",
  "acceptOwnership",
])
  assert.ok(abi.some((x) => x.type === "function" && x.name === name));
assert.ok(
  !abi.some((x) => x.type === "function" && x.name === "mint"),
  "Old public mint route remains",
);
assert.ok(
  (contract.deployedBytecode.length - 2) / 2 <= 24576,
  "Implementation exceeds EIP-170",
);
const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
const exportFiles = walk("dist");
const exportBytes = exportFiles.reduce((n, f) => n + fs.statSync(f).size, 0);
if (process.argv[2]) {
  const reference = path.resolve(process.argv[2]);
  assert.deepEqual(
    exportFiles.map((f) => path.relative("dist", f)).sort(),
    walk(reference)
      .map((f) => path.relative(reference, f))
      .sort(),
    "Export tree differs from production build",
  );
  for (const f of exportFiles)
    assert.deepEqual(
      fs.readFileSync(f),
      fs.readFileSync(path.join(reference, path.relative("dist", f))),
    );
}
console.log(
  JSON.stringify(
    {
      passed: true,
      workFiles: files.length,
      workBytes,
      artifactBytes,
      artifactBudget: 786432,
      limit: 8388608,
      exportFiles: exportFiles.length,
      exportBytes,
      implementationBytes: (contract.deployedBytecode.length - 2) / 2,
      relativeAssets: true,
      nullPublicConfig: true,
      abiAndCompilerSourcesMatch: true,
    },
    null,
    2,
  ),
);
