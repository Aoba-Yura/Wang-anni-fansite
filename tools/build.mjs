import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = join(root, "src");
const pages = join(source, "pages");
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of await readdir(pages)) {
  if (!file.endsWith(".html")) continue;
  let html = await readFile(join(pages, file), "utf8");
  html = html
    .replaceAll("../assets/icons/favicon.svg", "./favicon.svg")
    .replaceAll("../styles/main.css", "./styles.css")
    .replaceAll("../scripts/main.js", "./script.js");
  await writeFile(join(dist, file), html);
}

await cp(join(source, "styles/main.css"), join(dist, "styles.css"));
await cp(join(source, "scripts/main.js"), join(dist, "script.js"));
await cp(join(source, "assets/icons/favicon.svg"), join(dist, "favicon.svg"));

console.log(`Built ${await readdir(dist).then(files => files.length)} files in dist/`);
