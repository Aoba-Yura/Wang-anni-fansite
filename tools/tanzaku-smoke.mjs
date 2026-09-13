import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.slice(1));
const candidates = [process.env.BROWSER_PATH, "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"];
const browserPath = candidates.find((path) => path && existsSync(path));
if (!browserPath) throw new Error("Chrome or Edge was not found; set BROWSER_PATH.");

const auditPath = join(root, "dist", "__tanzaku-smoke.html");
const auditHtml = `<!doctype html><meta charset="utf-8"><iframe id="desktop" src="./hymn.html" style="width:1280px;height:900px"></iframe><iframe id="mobile" src="./hymn.html" style="width:390px;height:844px"></iframe><pre id="result"></pre><script>
const waitFrame=frame=>new Promise(resolve=>frame.addEventListener('load',()=>setTimeout(resolve,500),{once:true}));
const glyphHash=(doc,glyph,font)=>{const canvas=doc.createElement('canvas');canvas.width=96;canvas.height=96;const context=canvas.getContext('2d');context.font='48px '+font;context.fillStyle='#000';context.fillText(glyph,12,64);let hash=2166136261;for(const value of context.getImageData(0,0,96,96).data){hash^=value;hash=Math.imul(hash,16777619)}return hash>>>0};
Promise.all([...document.querySelectorAll('iframe')].map(waitFrame)).then(async()=>{
 const inspect=async frame=>{const doc=frame.contentDocument;doc.querySelector('[data-literary-tab="haiku-senryu"]').click();await new Promise(r=>setTimeout(r,500));await Promise.all([doc.fonts.load('48px "Yuji Syuku"','安妮'),doc.fonts.load('48px "Ma Shan Zheng"','安妮')]);await doc.fonts.ready;const fonts=['"Yuji Syuku","Ma Shan Zheng",serif','"Yuji Syuku",serif','"Ma Shan Zheng",serif'];const fallback={an:fonts.map(font=>glyphHash(doc,'安',font)),ni:fonts.map(font=>glyphHash(doc,'妮',font))};const panelRoot=doc.querySelector('.short-form-panel'),poem=doc.querySelector('.tanzaku-poem'),phrases=[...poem.querySelectorAll('.phrase')],phraseRects=phrases.map(phrase=>{const range=doc.createRange();range.selectNodeContents(phrase);const rect=range.getBoundingClientRect();return{x:Math.round(rect.x),top:Math.round(rect.top),bottom:Math.round(rect.bottom)}});const header=doc.querySelector('.site-header'),hero=doc.querySelector('.page-hero'),heading=hero.querySelector('.section-heading-line'),stage=doc.querySelector('.literary-stage'),panelsRoot=doc.querySelector('[data-literary-panels]'),paper=doc.querySelector('.tanzaku-paper'),hanger=doc.querySelector('.tanzaku-hanging'),gallery=doc.querySelector('.tanzaku-gallery'),sourceLink=doc.querySelector('.tanzaku-source-link');return{poems:doc.querySelectorAll('.tanzaku-card').length,writingMode:getComputedStyle(poem).writingMode,fallback,phraseRects,paper:[Math.round(paper.offsetWidth),Math.round(paper.offsetHeight)],hangerHeight:Math.round(hanger.offsetHeight),rhythm:[Math.round(heading.getBoundingClientRect().top-header.getBoundingClientRect().bottom),Math.round(hero.getBoundingClientRect().bottom-heading.getBoundingClientRect().bottom),Math.round(parseFloat(getComputedStyle(stage).paddingTop)),Math.round(parseFloat(getComputedStyle(panelsRoot).paddingTop))],galleryOffset:Math.round(gallery.getBoundingClientRect().top-panelRoot.getBoundingClientRect().top),visiblePaper:Math.round(Math.max(0,Math.min(paper.getBoundingClientRect().bottom,frame.contentWindow.innerHeight)-Math.max(paper.getBoundingClientRect().top,0))/paper.getBoundingClientRect().height*100),redundantHeading:Boolean(panelRoot.querySelector(':scope > h2,:scope > .short-form-intro')),galleryDisplay:getComputedStyle(gallery).display,snap:getComputedStyle(gallery).scrollSnapType,source:sourceLink?.href,target:sourceLink?.target,panels:doc.querySelectorAll('.tanzaku-source-panel').length,overflow:doc.documentElement.scrollWidth>doc.documentElement.clientWidth,font:getComputedStyle(poem).fontFamily};};
 const desktop=await inspect(document.querySelector('#desktop')),mobile=await inspect(document.querySelector('#mobile'));document.querySelector('#result').textContent=JSON.stringify({desktop,mobile});
});<\/script>`;

const poemDocument = JSON.parse(await readFile(join(root, "src", "data", "poems.json"), "utf8"));
if (poemDocument.items.some((poem) => Object.hasOwn(poem, "date"))) throw new Error("Sourced poems must not duplicate diary dates.");
const builtHymn = await readFile(join(root, "dist", "hymn.html"), "utf8");
for (const date of ["2026-08-23", "2026-08-09", "2026-05-24", "2022-09-15"]) {
  if (!builtHymn.includes(date)) throw new Error(`Diary date was not embedded: ${date}`);
}

try {
  await writeFile(auditPath, auditHtml);
  const run = spawnSync(browserPath, ["--headless=new", "--allow-file-access-from-files", "--disable-gpu", "--virtual-time-budget=4000", "--dump-dom", pathToFileURL(auditPath).href], { encoding: "utf8", maxBuffer: 10_000_000 });
  if (run.status !== 0) throw new Error(run.stderr || "Headless browser test failed.");
  const encoded = run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
  if (!encoded) throw new Error("No test result returned.");
  const result = JSON.parse(encoded.replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
  const failures = [];
  if (result.desktop.poems !== 4 || result.mobile.poems !== 4) failures.push("poem data did not render");
  if (result.desktop.writingMode !== "vertical-rl" || !result.desktop.font.includes("Yuji Syuku") || !result.desktop.font.includes("Ma Shan Zheng")) failures.push("vertical font styling is missing");
  if (![result.desktop, result.mobile].every(({ fallback }) => fallback.an[0] === fallback.an[1] && fallback.an[0] !== fallback.an[2] && fallback.ni[0] === fallback.ni[2] && fallback.ni[0] !== fallback.ni[1])) failures.push("per-glyph fallback for 安妮 is incorrect");
  if (![result.desktop, result.mobile].every(({ phraseRects }) => phraseRects.length === 3 && new Set(phraseRects.map((rect) => rect.x)).size === 1 && phraseRects.every((rect, index) => !index || rect.top > phraseRects[index - 1].bottom))) failures.push("phrases are not separated on one vertical axis");
  if (String(result.desktop.paper) !== "143,560" || String(result.mobile.paper) !== "116,438") failures.push("tanzaku proportions changed");
  if (result.desktop.redundantHeading || result.mobile.redundantHeading || result.desktop.galleryOffset > 110) failures.push("redundant heading or excessive gallery spacing returned");
  if (String(result.desktop.rhythm) !== "16,11,20,8" || result.desktop.hangerHeight !== 22) failures.push("desktop vertical rhythm changed");
  if (result.desktop.visiblePaper < 99 || result.mobile.visiblePaper < 99) failures.push("the complete tanzaku is not visible in the first viewport");
  if (result.mobile.galleryDisplay !== "flex" || !result.mobile.snap.includes("x")) failures.push("mobile scroll-snap track is missing");
  if (![result.desktop, result.mobile].every((item) => item.source === "https://m.weibo.cn/status/ReH1M8F5F" && item.target === "_blank" && item.panels === 0 && !item.overflow)) failures.push("direct source link or page overflow is invalid");
  console.log(JSON.stringify(result, null, 2));
  if (failures.length) throw new Error(failures.join("; "));
  console.log("Tanzaku smoke test passed.");
} finally {
  await rm(auditPath, { force: true });
}
