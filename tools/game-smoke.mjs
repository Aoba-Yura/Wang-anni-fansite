import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const mode = process.argv[2] === "mobile" ? "mobile" : "desktop";
const levelDataJson = await readFile(new URL("../src/data/redbean-levels.json", import.meta.url), "utf8");
const listeners = new Map();
let scheduledFrame = null;

class ClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    const enabled = force === undefined ? !this.values.has(value) : force;
    if (enabled) this.values.add(value); else this.values.delete(value);
    return enabled;
  }
}

class ElementMock {
  constructor(name) {
    this.name = name;
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.innerHTML = "";
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.className = "";
    this.classList = new ClassList();
    this.attributes = {};
    this.offsetWidth = 100;
  }
  addEventListener(type, callback) { this.listeners ||= {}; this.listeners[type] = callback; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
  click() { this.listeners?.click?.({}); }
  getBoundingClientRect() { return { left: 0, top: 0, width: mode === "mobile" ? 390 : 900, height: mode === "mobile" ? 700 : 600 }; }
}

const gradient = { addColorStop() {} };
const drawingContext = new Proxy({}, {
  get(target, property) {
    if (property === "createLinearGradient") return function () { return gradient; };
    if (!(property in target)) target[property] = function () {};
    return target[property];
  },
  set(target, property, value) { target[property] = value; return true; }
});

const selectors = [
  "[data-game-overlay]", "[data-overlay-kicker]", "[data-overlay-title]", "[data-overlay-copy]",
  "[data-game-summary]", "[data-level-select]", "[data-game-primary]", "[data-game-secondary]",
  "[data-game-tertiary]", "[data-game-pause]", "[data-game-sound]", "[data-game-volume]",
  "[data-game-volume-panel]", "[data-game-score]", "[data-game-best]", "[data-game-lives]",
  "[data-game-level]", "[data-game-message]", "[data-game-status]"
];
const elements = new Map(selectors.map(function (selector) { return [selector, new ElementMock(selector)]; }));
const hud = new ElementMock("game-hud");
let hudHeight = mode === "mobile" ? 76 : 64;
hud.getBoundingClientRect = function () {
  const rectWidth = window.innerWidth <= 768 && window.innerHeight > window.innerWidth ? 390 : 900;
  return { left: 0, top: 0, right: rectWidth, bottom: hudHeight, width: rectWidth, height: hudHeight };
};
elements.set(".game-hud", hud);
const levelDataElement = new ElementMock("redbean-level-data");
levelDataElement.textContent = levelDataJson;
elements.set("#redbean-level-data", levelDataElement);
const canvas = new ElementMock("canvas");
canvas.dataset.dogSrc = "./assets/images/pomeranian-ball.png";
canvas.getContext = function () { return drawingContext; };
canvas.setPointerCapture = function () {};
canvas.getBoundingClientRect = function () {
  const mobileViewport = window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
  return { left: 0, top: 0, width: mobileViewport ? 390 : 900, height: mobileViewport ? 700 : 600 };
};
elements.set("#breakout-game", canvas);

globalThis.document = {
  hidden: false,
  body: { classList: new ClassList() },
  querySelector(selector) { return elements.get(selector) || null; },
  createElement(name) { return new ElementMock(name); },
  addEventListener(type, callback) { listeners.set("document:" + type, callback); }
};
globalThis.window = {
  innerWidth: mode === "mobile" ? 390 : 1280,
  innerHeight: mode === "mobile" ? 844 : 800,
  addEventListener(type, callback) { listeners.set("window:" + type, callback); }
};
globalThis.localStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, String(value)); }
};
globalThis.localStorage.setItem("annie-redbean-breakout-v2", JSON.stringify({ highestUnlocked: 18 }));
globalThis.matchMedia = function () { return { matches: false }; };
globalThis.Image = class {
  constructor() { this.complete = true; this.naturalWidth = 64; this.src = ""; }
};
globalThis.requestAnimationFrame = function (callback) { scheduledFrame = callback; return 1; };

await import("../src/scripts/game.js?smoke=" + mode);

assert.equal(canvas.width, mode === "mobile" ? 390 : 900);
assert.equal(elements.get("[data-game-level]").textContent, "FINAL");
assert.equal(elements.get("[data-game-overlay]").hidden, false);

elements.get("[data-game-secondary]").click();
const levelGrid = elements.get("[data-level-select]");
assert.equal(levelGrid.children.length, 18);
assert.equal(levelGrid.children.filter(function (button) { return !button.disabled; }).length, 18);

const playableButtons = levelGrid.children;
playableButtons.forEach(function (button) {
  button.click();
  assert.equal(typeof scheduledFrame, "function");
  scheduledFrame(performance.now() + 16);
});
assert.equal(elements.get("[data-game-overlay]").hidden, true);
assert.equal(elements.get("[data-game-pause]").disabled, false);

const debug = window.__redbeanGameDebug;
assert.ok(debug);
assert.equal(debug.getLayoutName(), mode);
assert.equal(debug.getBounds().top, mode === "mobile" ? 76 : 64);
assert.equal(debug.visualRadius(), mode === "mobile" ? 28 : 27);
const worldBall = { x: 0, y: 0, vx: -80, vy: -120, radius: 17 };
assert.equal(debug.constrainBallToWorld(worldBall), true);
assert.equal(worldBall.x, debug.getBounds().left + debug.visualRadius());
assert.equal(worldBall.y, debug.getBounds().top + debug.visualRadius());
assert.ok(worldBall.vx > 0 && worldBall.vy > 0);

// A corner impact is separated along its true contact normal and reflected once.
const cornerBall = { x: 91, y: 91, vx: 120, vy: 120, radius: 14 };
const obstacle = { x: 100, y: 100, width: 60, height: 20 };
assert.equal(debug.bounceRect(cornerBall, obstacle), true);
assert.ok(Math.hypot(cornerBall.x - 100, cornerBall.y - 100) > cornerBall.radius);
assert.ok(cornerBall.vx < 0 && cornerBall.vy < 0);
const afterCornerVelocity = [cornerBall.vx, cornerBall.vy];
assert.equal(debug.bounceRect(cornerBall, obstacle), false);
assert.deepEqual([cornerBall.vx, cornerBall.vy], afterCornerVelocity);

// A deeply embedded ball is pushed to the nearest face before reflection.
const embeddedBall = { x: 105, y: 110, vx: 90, vy: 15, radius: 17 };
assert.equal(debug.bounceRect(embeddedBall, obstacle), true);
assert.ok(embeddedBall.x < obstacle.x - embeddedBall.radius);
assert.ok(embeddedBall.vx < 0);

// Every moving brick owns an empty adjacent grid slot and traverses one full pitch.
const levelBricks = debug.getBricks();
const occupied = new Set(levelBricks.map(function (brick) { return brick.row + "-" + brick.column; }));
const movingBricks = levelBricks.filter(function (brick) { return brick.type === "moving"; });
assert.ok(movingBricks.length > 0);
movingBricks.forEach(function (brick) {
  assert.ok(brick.railEndX - brick.railStartX >= brick.width);
  assert.equal(occupied.has(brick.row + "-" + (brick.column + 1)), false);
});

if (mode === "mobile") {
  window.innerWidth = 700;
  window.innerHeight = 900;
  hudHeight = 78;
  listeners.get("window:resize")();
  await new Promise(function (resolve) { setTimeout(resolve, 150); });
  assert.equal(debug.getLayoutName(), "mobile");
  assert.equal(debug.getBounds().top, 78);

  // Height-only browser chrome changes must refresh the measured HUD boundary.
  window.innerHeight = 860;
  hudHeight = 74;
  listeners.get("window:resize")();
  await new Promise(function (resolve) { setTimeout(resolve, 150); });
  assert.equal(debug.getBounds().top, 74);
}

console.log("PASS game smoke " + mode + " (" + canvas.width + "x" + canvas.height + ", " + playableButtons.length + " level layouts)");
