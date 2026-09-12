import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.slice(1));
const candidates = [process.env.BROWSER_PATH, "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"];
const browserPath = candidates.find((path) => path && existsSync(path));
if (!browserPath) throw new Error("Chrome or Edge was not found; set BROWSER_PATH.");

const pages = ["index.html", "profile.html", "diary.html", "notices.html", "hymn.html", "game.html", "redbean-breakout.html"];
const viewports = [[360,800], [375,812], [390,844], [412,915], [430,932]];
const auditPath = join(root, "dist", "__mobile-audit.html");
const frames = viewports.flatMap(([width, height]) => pages.map((page) => `<iframe data-page="${page}" data-viewport="${width}x${height}" src="./${page}" style="width:${width}px;height:${height}px"></iframe>`)).join("");
const auditHtml = `<!doctype html><meta charset="utf-8"><style>iframe{display:block;border:0}</style>${frames}<pre id="result"></pre><script>
  const frames=[...document.querySelectorAll('iframe')];
  Promise.all(frames.map((frame)=>new Promise((resolve)=>frame.addEventListener('load',()=>setTimeout(resolve,300),{once:true})))).then(()=>{
    const results=frames.map((frame)=>{const doc=frame.contentDocument,win=frame.contentWindow;const overflow=[...doc.querySelectorAll('body *:not([aria-hidden="true"])')].filter((el)=>{if(el.closest('.filter-options,.month-index-items'))return false;const r=el.getBoundingClientRect();return r.right>doc.documentElement.clientWidth+1||r.left<-1}).slice(0,8).map((el)=>String(el.className||el.tagName));const japanese=[...doc.querySelectorAll('.section-heading__title [lang="ja"],.desktop-nav [lang="ja"],.mobile-nav [lang="ja"]')].filter((el)=>{const range=doc.createRange();range.selectNodeContents(el);return range.getClientRects().length>1}).map((el)=>el.textContent.trim()).slice(0,8);const profile=doc.querySelector('.profile-layout');const profileOrder=profile?[...profile.querySelectorAll('.profile-photo,.profile-overline,.profile-content h2,.source-chip,.fact-table')].map((el)=>Math.round(el.getBoundingClientRect().top)):null;const canvas=doc.querySelector('#breakout-game');const hero=doc.querySelector('.diary-hero'),section=doc.querySelector('.diary-section'),first=doc.querySelector('.diary-entry'),last=[...doc.querySelectorAll('.diary-entry')].at(-1),nav=doc.querySelector('.mobile-nav'),groups=[...doc.querySelectorAll('.filter-group')],buttons=[...doc.querySelectorAll('.filter-options button')];const diary=hero?{heroHeight:Math.round(hero.getBoundingClientRect().height),aligned:Math.abs(hero.getBoundingClientRect().left-section.getBoundingClientRect().left)<1,labelAligned:groups.every((group)=>{const label=group.querySelector('.filter-label'),button=group.querySelector('button');return !button||Math.abs(label.getBoundingClientRect().top-button.getBoundingClientRect().top)<12}),buttonHeights:buttons.map((button)=>Math.round(button.getBoundingClientRect().height)),buttonLines:buttons.map((button)=>{const range=doc.createRange();range.selectNodeContents(button);return range.getClientRects().length}),firstVisible:first&&nav?Math.round(Math.max(0,Math.min(first.getBoundingClientRect().bottom,nav.getBoundingClientRect().top)-Math.max(first.getBoundingClientRect().top,0))):0,navHeight:nav?Math.round(nav.getBoundingClientRect().height):0,lastBottomAtMax:last?Math.round(last.getBoundingClientRect().bottom-(doc.documentElement.scrollHeight-win.innerHeight)):null,navTop:nav?Math.round(nav.getBoundingClientRect().top):null}:null;return{page:frame.dataset.page,viewport:frame.dataset.viewport,scrollWidth:doc.documentElement.scrollWidth,clientWidth:doc.documentElement.clientWidth,overflow,japanese,profileOrder,canvasWidth:canvas?Math.round(canvas.getBoundingClientRect().width):null,diary}});document.querySelector('#result').textContent=JSON.stringify(results)
  });
<\/script>`;

try {
  await writeFile(auditPath, auditHtml);
  const run = spawnSync(browserPath, ["--headless=new", "--allow-file-access-from-files", "--disable-gpu", "--virtual-time-budget=3000", "--dump-dom", pathToFileURL(auditPath).href], { encoding: "utf8", maxBuffer: 20_000_000 });
  if (run.status !== 0) throw new Error(run.stderr || "Headless browser audit failed.");
  const output = run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1]?.replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
  if (!output) throw new Error("The browser did not return audit results.");
  const results = JSON.parse(output);
  const failures = results.filter((item) => item.scrollWidth > item.clientWidth || item.overflow.length || item.japanese.length || (item.profileOrder && item.profileOrder.some((top,index,values)=>index>0&&top<values[index-1])) || (item.canvasWidth && item.canvasWidth > Number(item.viewport.split("x")[0])) || (item.diary && (item.diary.heroHeight > 190 || !item.diary.aligned || !item.diary.labelAligned || item.diary.buttonHeights.some((height)=>height<38||height>48) || item.diary.buttonLines.some((lines)=>lines!==1) || item.diary.firstVisible<80 || item.diary.navHeight>92 || item.diary.lastBottomAtMax>item.diary.navTop-24)));
  results.forEach((item) => console.log(`${failures.includes(item) ? "FAIL" : "PASS"} ${item.viewport} ${item.page}`));
  if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exitCode = 1; }
} finally {
  await rm(auditPath, { force: true });
}
