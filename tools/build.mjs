import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = join(root, "src");
const pages = join(source, "pages");
const partials = join(source, "partials");
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
const footer = await readFile(join(partials, "footer.html"), "utf8");

for (const file of await readdir(pages)) {
  if (!file.endsWith(".html")) continue;
  let html = await readFile(join(pages, file), "utf8");
  html = html
    .replaceAll("../assets/icons/favicon.svg", "./favicon.svg")
    .replaceAll("../styles/main.css", "./styles.css")
    .replaceAll("../scripts/main.js", "./script.js")
    .replaceAll("<!-- SITE_FOOTER -->", footer);
  await writeFile(join(dist, file), html);
}

const stylesheet = await readFile(join(source, "styles/main.css"), "utf8");
await writeFile(join(dist, "styles.css"), stylesheet.replaceAll("../assets/", "./assets/"));
await cp(join(source, "scripts/main.js"), join(dist, "script.js"));
await cp(join(source, "assets/icons/favicon.svg"), join(dist, "favicon.svg"));
await cp(join(source, "assets"), join(dist, "assets"), { recursive: true });

console.log(`Built ${await readdir(dist).then(files => files.length)} files in dist/`);
