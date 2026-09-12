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
const levelDataElement = new ElementMock("redbean-level-data");
levelDataElement.textContent = levelDataJson;
elements.set("#redbean-level-data", levelDataElement);
const canvas = new ElementMock("canvas");
canvas.dataset.dogSrc = "./assets/images/pomeranian-ball.png";
canvas.getContext = function () { return drawingContext; };
canvas.setPointerCapture = function () {};
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

console.log("PASS game smoke " + mode + " (" + canvas.width + "x" + canvas.height + ", " + playableButtons.length + " level layouts)");
