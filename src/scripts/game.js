const canvas = document.querySelector("#breakout-game");

if (canvas) {
  const ctx = canvas.getContext("2d");
  const ui = {
    overlay: document.querySelector("[data-game-overlay]"),
    kicker: document.querySelector("[data-overlay-kicker]"),
    title: document.querySelector("[data-overlay-title]"),
    copy: document.querySelector("[data-overlay-copy]"),
    summary: document.querySelector("[data-game-summary]"),
    levels: document.querySelector("[data-level-select]"),
    primary: document.querySelector("[data-game-primary]"),
    secondary: document.querySelector("[data-game-secondary]"),
    tertiary: document.querySelector("[data-game-tertiary]"),
    pause: document.querySelector("[data-game-pause]"),
    sound: document.querySelector("[data-game-sound]"),
    volume: document.querySelector("[data-game-volume]"),
    volumePanel: document.querySelector("[data-game-volume-panel]"),
    score: document.querySelector("[data-game-score]"),
    best: document.querySelector("[data-game-best]"),
    lives: document.querySelector("[data-game-lives]"),
    level: document.querySelector("[data-game-level]"),
    message: document.querySelector("[data-game-message]"),
    status: document.querySelector("[data-game-status]")
  };
  const STORAGE_KEY = "annie-redbean-breakout-v2";
  const dogImage = new Image();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  dogImage.src = canvas.dataset.dogSrc;

  const LAYOUTS = {
    desktop: { width: 900, height: 600, hud: 66, side: 28, bottom: 16, paddleWidth: 138, paddleHeight: 16, paddleBottom: 36, radius: 17, imageSize: 54, keySpeed: 760, brickGap: 7, brickHeight: 25 },
    mobile: { width: 390, height: 700, hud: 84, side: 18, bottom: 14, paddleWidth: 98, paddleHeight: 16, paddleBottom: 54, radius: 17, imageSize: 56, keySpeed: 510, brickGap: 6, brickHeight: 25 }
  };
  const levelDataElement = document.querySelector("#redbean-level-data");
  if (!levelDataElement) throw new Error("Redbean Breakout level data is missing.");
  const levelDocument = JSON.parse(levelDataElement.textContent);
  const LEVELS = levelDocument.levels;
  if (levelDocument.schemaVersion !== 1 || !Array.isArray(LEVELS) || !LEVELS.length) {
    throw new Error("Redbean Breakout level data is invalid.");
  }
  const colors = { red: "#a93438", redLight: "#ef7a76", green: "#9da65e", greenLight: "#dce69b", strong: "#d08a43", strongLight: "#ffd19a", moving: "#4d9190", movingLight: "#9de0d4", obstacle: "#595963", chalk: "#eee8d8" };
  const defaultSave = { highScore: 0, highestUnlocked: 1, levelBest: {}, levelCleared: {}, bestCombo: 0, noMissClear: {}, volume: .7, muted: false };

  let save = readSave();
  let layoutName = getLayoutName();
  let layout = LAYOUTS[layoutName];
  let width = layout.width;
  let height = layout.height;
  let bounds = getBounds();
  let state = "menu";
  let currentLevel = Math.max(0, Math.min(LEVELS.length - 1, save.highestUnlocked - 1));
  let score = 0, lives = 3, combo = 0, maxCombo = 0, misses = 0, destroyedCount = 0;
  let gameTime = 0, countdown = 3, countdownTimer = 0, messageTimer = 0;
  let lastTime = performance.now(), viewportWidth = window.innerWidth, audioContext = null;
  let bricks = [], obstacles = [], balls = [], pickups = [], particles = [];
  let primaryAction = function () {}, secondaryAction = function () {}, tertiaryAction = function () {};
  const keys = { left: false, right: false };
  const pointer = { active: false, id: null, offset: 0 };
  const paddle = { x: 0, y: 0, width: layout.paddleWidth, height: layout.paddleHeight, baseWidth: layout.paddleWidth };
  const effects = { longUntil: 0, pierceUntil: 0, multiUntil: 0 };

  function getLayoutName() {
    return window.innerWidth <= 600 && window.innerHeight > window.innerWidth ? "mobile" : "desktop";
  }
  function getBounds() {
    return { left: layout.side, right: width - layout.side, top: layout.hud + 10, bottom: height - layout.bottom };
  }
  function readSave() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      const legacy = Number.parseInt(localStorage.getItem("annie-pome-break-best") || "0", 10) || 0;
      return Object.assign({}, defaultSave, parsed || {}, { highScore: Math.max((parsed && parsed.highScore) || 0, legacy) });
    } catch {
      return Object.assign({}, defaultSave);
    }
  }
  function writeSave() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch { /* Optional local scores. */ }
  }
  function seeded(index, salt) {
    const value = Math.sin((index + 1) * 9283.31 + (currentLevel + 1) * 77.13 + (salt || 0)) * 43758.5453;
    return value - Math.floor(value);
  }
  function patternAllows(pattern, row, column, rows, columns) {
    const x = columns === 1 ? 0 : column / (columns - 1) * 2 - 1;
    const y = rows === 1 ? 0 : row / (rows - 1);
    if (pattern === "stripes") return row % 2 === 0 || column % 3 !== 1;
    if (pattern === "steps") return column >= Math.floor(row * columns / (rows * 2)) && column < columns - Math.floor((rows - 1 - row) * columns / (rows * 2));
    if (pattern === "gates") return row < 2 || Math.abs(x) > .22 || row === rows - 1;
    if (pattern === "diamond") return Math.abs(x) + Math.abs(y * 2 - 1) < 1.38;
    if (pattern === "ring") { const d = Math.sqrt(x * x + Math.pow(y * 2 - 1, 2)); return d > .48 && d < 1.25; }
    if (pattern === "tunnel") return row < 2 || column < 2 || column >= columns - 2 || (row === rows - 1 && Math.abs(x) > .35);
    if (pattern === "checker") return (row + column) % 2 === 0 || row === 0 || row === rows - 1;
    if (pattern === "fortress") return row < 2 || column < 2 || column >= columns - 2 || (row > rows / 2 && Math.abs(x) < .34);
    if (pattern === "heart") return Math.pow(x * x + Math.pow(y * 1.65 - .65, 2) - .55, 3) - x * x * Math.pow(y * 1.65 - .65, 3) < 0;
    if (pattern === "zigzag") return row % 2 === 0 || column === (row % 4 < 2 ? columns - 1 : 0) || (column + row) % 5 === 0;
    if (pattern === "shield") return row < 3 || Math.abs(x) < .72 - y * .36;
    if (pattern === "pinwheel") return Math.abs(x) < .2 || Math.abs(y * 2 - 1) < .18 || (x > 0 && y < .5 && column % 2 === 0) || (x < 0 && y > .5 && column % 2 === 1);
    if (pattern === "core") { const d = Math.max(Math.abs(x), Math.abs(y * 2 - 1)); return d > .42 || (Math.abs(x) < .2 && Math.abs(y * 2 - 1) < .2); }
    if (pattern === "final") return row < 2 || row === rows - 1 || column < 2 || column >= columns - 2 || (row + column) % 3 !== 1;
    return true;
  }

  function makeLevel(previous) {
    const config = LEVELS[currentLevel];
    const columns = layoutName === "mobile" ? config.mobileCols : config.cols;
    const rows = config.rows;
    const gap = layout.brickGap;
    const available = bounds.right - bounds.left;
    const brickWidth = (available - gap * (columns - 1)) / columns;
    const top = bounds.top + (layoutName === "mobile" ? 24 : 20);
    const old = previous ? new Map(previous.map(function (brick) { return [brick.id, brick]; })) : null;
    bricks = [];
    let index = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (!patternAllows(config.pattern, row, column, rows, columns)) continue;
        const id = row + "-" + column;
        const chance = seeded(index, row * 13 + column);
        const moving = Boolean(config.moving && chance < config.moving);
        const strong = Boolean(!moving && config.strong && chance > 1 - config.strong);
        const prior = old && old.get(id);
        const x = bounds.left + column * (brickWidth + gap);
        bricks.push({
          id: id, row: row, column: column, x: x, baseX: x,
          y: top + row * (layout.brickHeight + gap), width: brickWidth, height: layout.brickHeight,
          type: moving ? "moving" : strong ? "strong" : "normal",
          hp: prior ? prior.hp : strong ? 2 : 1, maxHp: strong ? 2 : 1,
          alive: prior ? prior.alive : true,
          phase: seeded(index, 7) * Math.PI * 2,
          moveSpeed: .55 + seeded(index, 9) * .35,
          moveRange: Math.min(gap * 1.7, layoutName === "mobile" ? 6 : 10)
        });
        index += 1;
      }
    }
    const brickFieldBottom = top + rows * (layout.brickHeight + gap) - gap;
    obstacles = (config.obstacles || []).map(function (item, obstacleIndex) {
      return {
        id: "wall-" + obstacleIndex,
        x: bounds.left + item.x * available,
        y: Math.max(brickFieldBottom + 14, bounds.top + item.y * (bounds.bottom - bounds.top)),
        width: item.w * available,
        height: Math.max(10, item.h * (bounds.bottom - bounds.top))
      };
    });
  }
  function resetPaddle() {
    paddle.baseWidth = layout.paddleWidth;
    paddle.width = paddle.baseWidth;
    paddle.height = layout.paddleHeight;
    paddle.y = bounds.bottom - layout.paddleBottom - paddle.height;
    paddle.x = width / 2 - paddle.width / 2;
  }
  function clampPaddle() {
    paddle.x = Math.max(bounds.left, Math.min(bounds.right - paddle.width, paddle.x));
  }
  function levelSpeed() {
    const base = layoutName === "mobile" ? 365 : 410;
    return Math.min(layoutName === "mobile" ? 475 : 540, base * LEVELS[currentLevel].speed);
  }
  function newBall(direction, spawned) {
    const speed = levelSpeed();
    const travelDirection = direction || (Math.random() > .5 ? 1 : -1);
    return {
      x: paddle.x + paddle.width / 2, y: paddle.y - layout.radius - 3,
      vx: speed * .48 * travelDirection, vy: -speed * .88, radius: layout.radius,
      angle: 0, lastHit: "", hitCooldown: 0, dead: false, spawned: Boolean(spawned)
    };
  }
  function dockBalls() {
    if (!balls.length) balls = [newBall()];
    const keeper = balls.find(function (ball) { return !ball.spawned; }) || balls[0];
    balls = [keeper];
    keeper.spawned = false;
    keeper.x = paddle.x + paddle.width / 2;
    keeper.y = paddle.y - keeper.radius - 3;
    const speed = levelSpeed();
    const direction = Math.sign(keeper.vx) || 1;
    keeper.vx = speed * .48 * direction;
    keeper.vy = -speed * .88;
    keeper.dead = false;
  }
  function applyLayout() {
    const nextName = getLayoutName();
    if (nextName === layoutName) return;
    const oldWidth = width, oldHeight = height, oldBricks = bricks;
    const ratios = balls.map(function (ball) {
      return Object.assign({}, ball, { rx: ball.x / oldWidth, ry: ball.y / oldHeight });
    });
    layoutName = nextName;
    layout = LAYOUTS[layoutName];
    width = layout.width;
    height = layout.height;
    bounds = getBounds();
    canvas.width = width;
    canvas.height = height;
    resetPaddle();
    makeLevel(oldBricks);
    balls = ratios.map(function (ball) {
      return Object.assign({}, ball, { x: ball.rx * width, y: ball.ry * height, radius: layout.radius });
    });
    clampPaddle();
    if (state === "menu" || state === "countdown") dockBalls();
    if (state === "playing") pauseGame();
  }

  function buttonContent(label, japanese, arrow) {
    return "<span>" + label + (japanese ? '<small lang="ja">' + japanese + "</small>" : "") + "</span>" + (arrow ? '<b aria-hidden="true">→</b>' : "");
  }
  function configureButton(element, label, japanese, action, options) {
    const settings = options || {};
    element.hidden = Boolean(settings.hidden);
    if (settings.hidden) return;
    element.innerHTML = buttonContent(label, japanese, settings.arrow);
    if (element === ui.primary) primaryAction = action;
    if (element === ui.secondary) secondaryAction = action;
    if (element === ui.tertiary) tertiaryAction = action;
  }
  function setOverlayText(kicker, title, japanese, copy) {
    ui.kicker.textContent = kicker;
    ui.title.innerHTML = title + (japanese ? '<small lang="ja">' + japanese + "</small>" : "");
    ui.copy.innerHTML = copy;
  }
  function showOverlay() { ui.overlay.hidden = false; }
  function hideOverlay() { ui.overlay.hidden = true; }
  function setStatus(chinese, japanese) {
    ui.status.innerHTML = chinese + (japanese ? '<small lang="ja">' + japanese + "</small>" : "");
  }
  function updateHud() {
    ui.level.textContent = currentLevel === LEVELS.length - 1 ? "FINAL" : "LEVEL " + String(currentLevel + 1).padStart(2, "0");
    ui.score.textContent = String(score).padStart(4, "0");
    ui.best.textContent = String(Math.max(save.highScore, score)).padStart(4, "0");
    ui.lives.textContent = lives > 0 ? Array.from({ length: lives }, function () { return "♥"; }).join(" ") : "—";
    ui.lives.setAttribute("aria-label", "剩余" + Math.max(0, lives) + "次机会");
    ui.pause.disabled = !["playing", "countdown", "paused"].includes(state);
    ui.pause.textContent = state === "paused" ? "▶" : "⏸";
  }
  function flashMessage(text) {
    ui.message.textContent = text;
    ui.message.hidden = false;
    ui.message.style.animation = "none";
    void ui.message.offsetWidth;
    ui.message.style.animation = "";
    messageTimer = 2.1;
  }
  function renderLevelButtons() {
    ui.levels.replaceChildren();
    LEVELS.forEach(function (level, index) {
      const button = document.createElement("button");
      const unlocked = index < save.highestUnlocked;
      button.type = "button";
      button.className = "level-button" + (index === LEVELS.length - 1 ? " final-level" : "");
      button.disabled = !unlocked;
      button.setAttribute("aria-current", String(index === currentLevel));
      button.setAttribute("aria-label", unlocked ? (index === LEVELS.length - 1 ? "FINAL " : "LEVEL " + (index + 1) + " ") + level.name : "LEVEL " + (index + 1) + " 未解锁");
      button.title = level.name;
      button.innerHTML = (index === LEVELS.length - 1 ? "FINAL" : String(index + 1).padStart(2, "0")) + (save.levelCleared[index] ? "<small>✓</small>" : !unlocked ? "<small>×</small>" : "");
      button.addEventListener("click", function () { startLevel(index); });
      ui.levels.append(button);
    });
  }
  function showMainMenu() {
    state = "menu";
    currentLevel = Math.max(0, Math.min(LEVELS.length - 1, save.highestUnlocked - 1));
    score = 0;
    lives = 3;
    makeLevel();
    resetPaddle();
    balls = [newBall()];
    updateHud();
    setOverlayText("ARCADE MODE", "红豆打砖块", "小豆ブロック崩し", '移动挡板，接住红豆，把所有砖块打掉。<br><small>鼠标 · A D · 方向键 · 触摸拖动</small><small lang="ja">バーを動かして、小豆でブロックを全部壊そう。</small>');
    ui.summary.hidden = true;
    ui.levels.hidden = true;
    ui.volumePanel.hidden = false;
    configureButton(ui.primary, save.highestUnlocked > 1 ? "继续挑战" : "开始游戏", "スタート", function () { startLevel(currentLevel); }, { arrow: true });
    configureButton(ui.secondary, "选择关卡", "レベル選択", showLevelSelect);
    configureButton(ui.tertiary, "", "", function () {}, { hidden: true });
    showOverlay();
    setStatus("等待开始", "スタート待機");
  }
  function showLevelSelect() {
    state = "level-select";
    setOverlayText("SELECT LEVEL", "选择关卡", "レベル選択", "已开放 " + Math.min(save.highestUnlocked, LEVELS.length) + " / " + LEVELS.length + " · 完成关卡会开放下一关");
    ui.summary.hidden = true;
    ui.levels.hidden = false;
    ui.volumePanel.hidden = true;
    renderLevelButtons();
    configureButton(ui.primary, "", "", function () {}, { hidden: true });
    configureButton(ui.secondary, "返回标题", "タイトルへ", showMainMenu);
    configureButton(ui.tertiary, "", "", function () {}, { hidden: true });
    showOverlay();
  }

  function resetRun() {
    score = 0; lives = 3; combo = 0; maxCombo = 0; misses = 0; destroyedCount = 0; gameTime = 0;
    bricks = []; obstacles = []; balls = []; pickups = []; particles = [];
    effects.longUntil = 0; effects.pierceUntil = 0; effects.multiUntil = 0;
    makeLevel();
    resetPaddle();
    balls = [newBall()];
  }
  function startLevel(index) {
    initAudio();
    currentLevel = Math.max(0, Math.min(LEVELS.length - 1, index));
    resetRun();
    beginCountdown();
    hideOverlay();
    ui.volumePanel.hidden = true;
    setStatus(LEVELS[currentLevel].name + "，准备！", "スタート準備");
    updateHud();
  }
  function beginCountdown() {
    state = "countdown";
    countdown = 3;
    countdownTimer = .72;
    dockBalls();
    updateHud();
  }
  function pauseGame() {
    if (!["playing", "countdown"].includes(state)) return;
    keys.left = false; keys.right = false;
    state = "paused";
    setOverlayText("PAUSED", "游戏暂停", "一時停止", "LEVEL " + String(currentLevel + 1).padStart(2, "0") + " · 当前位置与进度已保留");
    ui.summary.hidden = true;
    ui.levels.hidden = true;
    ui.volumePanel.hidden = false;
    configureButton(ui.primary, "继续游戏", "再開", resumeGame, { arrow: true });
    configureButton(ui.secondary, "重新开始", "リスタート", function () { startLevel(currentLevel); });
    configureButton(ui.tertiary, "退出并选择关卡", "レベル選択へ", showLevelSelect);
    showOverlay();
    updateHud();
    setStatus("游戏暂停", "一時停止");
  }
  function resumeGame() {
    initAudio();
    state = "playing";
    hideOverlay();
    lastTime = performance.now();
    updateHud();
    setStatus("继续游戏", "ゲーム再開");
  }
  function togglePause() {
    if (state === "paused") resumeGame();
    else pauseGame();
  }
  function showSummary() {
    const prior = save.levelBest[currentLevel] || 0;
    const record = score >= prior && score > 0;
    ui.summary.innerHTML =
      "<div><small>本局得分</small><b>" + score + "</b></div>" +
      "<div><small>最高记录</small><b>" + Math.max(prior, score) + "</b></div>" +
      "<div><small>最大连击</small><b>" + maxCombo + "</b></div>" +
      "<div><small>评价</small><b>" + (misses === 0 ? "NO MISS" : record ? "NEW" : "CLEAR") + "</b></div>";
    ui.summary.hidden = false;
  }
  function completeLevel() {
    if (state === "clear") return;
    state = "clear";
    playSound("clear");
    burst(width / 2, height * .42, colors.strongLight, 34);
    const previous = save.levelBest[currentLevel] || 0;
    save.levelBest[currentLevel] = Math.max(previous, score);
    save.levelCleared[currentLevel] = true;
    save.noMissClear[currentLevel] = Boolean(save.noMissClear[currentLevel] || misses === 0);
    save.highScore = Math.max(save.highScore, score);
    save.bestCombo = Math.max(save.bestCombo, maxCombo);
    save.highestUnlocked = Math.min(LEVELS.length, Math.max(save.highestUnlocked, currentLevel + 2));
    writeSave();
    const final = currentLevel === LEVELS.length - 1;
    setOverlayText(final ? "ALL CLEAR!" : "LEVEL CLEAR!", final ? "街机挑战完成" : "全部击破", final ? "オールクリア" : "ステージクリア", final ? "红豆穿过了最后一道防线。完美收工！" : LEVELS[currentLevel].name + " 完成" + (score > previous ? " · 刷新纪录！" : ""));
    showSummary();
    ui.levels.hidden = true;
    ui.volumePanel.hidden = true;
    configureButton(ui.primary, final ? "再战 FINAL" : "下一关", final ? "もう一度" : "次のレベル", function () { startLevel(final ? currentLevel : currentLevel + 1); }, { arrow: true });
    configureButton(ui.secondary, "再玩一次", "もう一度", function () { startLevel(currentLevel); });
    configureButton(ui.tertiary, "返回选关", "レベル選択", showLevelSelect);
    showOverlay();
    updateHud();
    setStatus("关卡完成", "ステージクリア");
  }
  function gameOver() {
    state = "over";
    playSound("over");
    const prior = save.levelBest[currentLevel] || 0;
    save.levelBest[currentLevel] = Math.max(prior, score);
    save.highScore = Math.max(save.highScore, score);
    save.bestCombo = Math.max(save.bestCombo, maxCombo);
    writeSave();
    setOverlayText("GAME OVER", "再来一次？", "もう一度？", LEVELS[currentLevel].name + " · 红豆等你把剩下的砖块打掉。");
    showSummary();
    ui.levels.hidden = true;
    ui.volumePanel.hidden = false;
    configureButton(ui.primary, "再来一次", "リトライ", function () { startLevel(currentLevel); }, { arrow: true });
    configureButton(ui.secondary, "返回选关", "レベル選択", showLevelSelect);
    configureButton(ui.tertiary, "返回标题", "タイトルへ", showMainMenu);
    showOverlay();
    updateHud();
    setStatus("本局得分 " + score, "スコア " + score);
  }
  function loseLife() {
    lives -= 1;
    misses += 1;
    combo = 0;
    playSound("lose");
    updateHud();
    if (lives <= 0) {
      gameOver();
      return;
    }
    flashMessage("还剩 " + lives + " 次机会");
    balls = [newBall()];
    beginCountdown();
  }

  function initAudio() {
    if (save.muted) return;
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") audioContext.resume();
    } catch { /* Web Audio is an enhancement. */ }
  }
  function playSound(kind) {
    if (save.muted || save.volume <= 0) return;
    initAudio();
    if (!audioContext) return;
    const sounds = {
      wall: [180, .035, "sine", .045], paddle: [310, .055, "triangle", .07], brick: [520, .045, "square", .045],
      strong: [250, .07, "sawtooth", .06], power: [720, .15, "sine", .08], combo: [880, .11, "triangle", .07],
      lose: [130, .28, "sawtooth", .08], clear: [1040, .42, "triangle", .08], over: [85, .48, "square", .055]
    };
    const sound = sounds[kind] || sounds.wall;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = sound[2];
    oscillator.frequency.setValueAtTime(sound[0], now);
    if (kind === "clear" || kind === "power") oscillator.frequency.exponentialRampToValueAtTime(sound[0] * 1.5, now + sound[1]);
    if (kind === "lose" || kind === "over") oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, sound[0] * .55), now + sound[1]);
    gain.gain.setValueAtTime(Math.max(.0001, sound[3] * save.volume), now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + sound[1]);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + sound[1]);
  }
  function toggleSound() {
    save.muted = !save.muted;
    writeSave();
    updateSoundUi();
    if (!save.muted) { initAudio(); playSound("power"); }
  }
  function updateSoundUi() {
    ui.sound.textContent = save.muted ? "×" : "♪";
    ui.sound.classList.toggle("is-muted", save.muted);
    ui.sound.setAttribute("aria-label", save.muted ? "开启音效" : "关闭音效");
    ui.sound.title = save.muted ? "开启音效" : "关闭音效";
    ui.volume.value = String(save.volume);
  }

  function circleHitsRect(ball, rect) {
    const nearestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.width));
    const nearestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.height));
    const dx = ball.x - nearestX, dy = ball.y - nearestY;
    return dx * dx + dy * dy <= ball.radius * ball.radius;
  }
  function bounceRect(ball, rect, previousX, previousY) {
    if (previousY + ball.radius <= rect.y) {
      ball.y = rect.y - ball.radius - .5;
      ball.vy = -Math.abs(ball.vy);
    } else if (previousY - ball.radius >= rect.y + rect.height) {
      ball.y = rect.y + rect.height + ball.radius + .5;
      ball.vy = Math.abs(ball.vy);
    } else if (previousX + ball.radius <= rect.x) {
      ball.x = rect.x - ball.radius - .5;
      ball.vx = -Math.abs(ball.vx);
    } else if (previousX - ball.radius >= rect.x + rect.width) {
      ball.x = rect.x + rect.width + ball.radius + .5;
      ball.vx = Math.abs(ball.vx);
    } else {
      const centerDx = ball.x - (rect.x + rect.width / 2);
      const centerDy = ball.y - (rect.y + rect.height / 2);
      if (Math.abs(centerDx / rect.width) > Math.abs(centerDy / rect.height)) ball.vx *= -1;
      else ball.vy *= -1;
    }
  }
  function normalizeVelocity(ball) {
    const speed = Math.min(levelSpeed() * 1.22, Math.max(levelSpeed() * .94, Math.hypot(ball.vx, ball.vy)));
    const minX = speed * .17, minY = speed * .34;
    if (Math.abs(ball.vx) < minX) ball.vx = (Math.sign(ball.vx) || (Math.random() > .5 ? 1 : -1)) * minX;
    if (Math.abs(ball.vy) < minY) ball.vy = (Math.sign(ball.vy) || -1) * minY;
    const adjusted = Math.hypot(ball.vx, ball.vy);
    ball.vx = ball.vx / adjusted * speed;
    ball.vy = ball.vy / adjusted * speed;
  }
  function paddleBounce(ball) {
    ball.y = paddle.y - ball.radius - 1;
    const speed = Math.min(levelSpeed() * 1.22, Math.hypot(ball.vx, ball.vy) + 5);
    const offset = Math.max(-1, Math.min(1, (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2)));
    const angle = offset * Math.PI * .37;
    ball.vx = speed * Math.sin(angle);
    ball.vy = -Math.abs(speed * Math.cos(angle));
    combo = 0;
    playSound("paddle");
    normalizeVelocity(ball);
  }
  function burst(x, y, color, count) {
    if (reducedMotion.matches) return;
    const total = count || 7;
    for (let index = 0; index < total; index += 1) {
      const angle = seeded(particles.length + index, gameTime) * Math.PI * 2;
      const speed = 35 + seeded(index, x + y) * 100;
      particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .35 + seeded(index, 4) * .35, color: color, size: 2 + seeded(index, 6) * 3 });
    }
    if (particles.length > 130) particles.splice(0, particles.length - 130);
  }
  function brickColor(brick) {
    if (brick.type === "strong") return [colors.strong, colors.strongLight];
    if (brick.type === "moving") return [colors.moving, colors.movingLight];
    return [colors.red, colors.redLight];
  }
  function spawnPickup(brick) {
    const every = LEVELS[currentLevel].powerEvery;
    if (!every || destroyedCount % every !== 0) return;
    const types = ["long", "multi", "pierce", "life"];
    pickups.push({ x: brick.x + brick.width / 2, y: brick.y + brick.height / 2, vy: layoutName === "mobile" ? 105 : 125, radius: 13, type: types[(destroyedCount / every + currentLevel) % types.length | 0] });
  }
  function hitBrick(ball, brick) {
    brick.hp -= 1;
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    const multiplier = 1 + Math.floor(Math.max(0, combo - 1) / 5) * .25;
    score += Math.round((brick.type === "strong" ? 75 : brick.type === "moving" ? 140 : 100) * multiplier);
    const palette = brickColor(brick);
    burst(ball.x, ball.y, palette[1], brick.hp <= 0 ? 9 : 4);
    if (brick.hp <= 0) {
      brick.alive = false;
      destroyedCount += 1;
      spawnPickup(brick);
      playSound("brick");
    } else {
      playSound("strong");
    }
    if (combo >= 5 && combo % 5 === 0) {
      flashMessage(combo + " COMBO · ×" + multiplier.toFixed(2));
      playSound("combo");
    }
    save.highScore = Math.max(save.highScore, score);
    writeSave();
    updateHud();
    if (bricks.every(function (item) { return !item.alive; })) completeLevel();
  }
  function activatePower(type) {
    const now = gameTime;
    if (type === "long") {
      effects.longUntil = now + 12;
      paddle.width = Math.min(bounds.right - bounds.left, paddle.baseWidth * 1.48);
      clampPaddle();
      flashMessage("挡板加长 · 12秒");
    } else if (type === "multi") {
      effects.multiUntil = now + 10;
      const source = balls[0];
      if (source) {
        while (balls.length < 3) {
          const sign = balls.length % 2 ? 1 : -1;
          balls.push(Object.assign({}, source, { vx: source.vx * .72 + Math.abs(source.vy) * .34 * sign, vy: -Math.abs(source.vy), angle: source.angle + sign * .6, lastHit: "", spawned: true, dead: false }));
        }
      }
      flashMessage("三只红豆 · 10秒");
    } else if (type === "pierce") {
      effects.pierceUntil = now + 9;
      flashMessage("穿透模式 · 9秒");
    } else {
      lives = Math.min(5, lives + 1);
      flashMessage("额外机会 +1");
    }
    playSound("power");
    updateHud();
  }
  function updateEffects() {
    if (effects.longUntil && gameTime >= effects.longUntil) {
      effects.longUntil = 0;
      const center = paddle.x + paddle.width / 2;
      paddle.width = paddle.baseWidth;
      paddle.x = center - paddle.width / 2;
      clampPaddle();
    }
    if (effects.multiUntil && gameTime >= effects.multiUntil) {
      effects.multiUntil = 0;
      if (balls.length) {
        const keeper = balls.find(function (ball) { return !ball.spawned; }) || balls[0];
        keeper.spawned = false;
        balls = [keeper];
      }
    }
    if (effects.pierceUntil && gameTime >= effects.pierceUntil) effects.pierceUntil = 0;
  }
  function updatePickups(step) {
    pickups.forEach(function (pickup) {
      pickup.y += pickup.vy * step;
      if (circleHitsRect({ x: pickup.x, y: pickup.y, radius: pickup.radius }, paddle)) {
        pickup.dead = true;
        activatePower(pickup.type);
      } else if (pickup.y - pickup.radius > bounds.bottom) pickup.dead = true;
    });
    pickups = pickups.filter(function (pickup) { return !pickup.dead; });
  }
  function updateParticles(step) {
    particles.forEach(function (particle) {
      particle.x += particle.vx * step;
      particle.y += particle.vy * step;
      particle.vy += 120 * step;
      particle.life -= step;
    });
    particles = particles.filter(function (particle) { return particle.life > 0; });
  }
  function updateBall(ball, step) {
    ball.hitCooldown = Math.max(0, ball.hitCooldown - step);
    const distance = Math.hypot(ball.vx, ball.vy) * step;
    const substeps = Math.max(1, Math.ceil(distance / Math.max(7, ball.radius * .55)));
    const slice = step / substeps;
    for (let substep = 0; substep < substeps && state === "playing"; substep += 1) {
      const previousX = ball.x, previousY = ball.y;
      ball.x += ball.vx * slice;
      ball.y += ball.vy * slice;
      if (!reducedMotion.matches) ball.angle += slice * 4.2;
      if (ball.x - ball.radius <= bounds.left) {
        ball.x = bounds.left + ball.radius; ball.vx = Math.abs(ball.vx); playSound("wall");
      } else if (ball.x + ball.radius >= bounds.right) {
        ball.x = bounds.right - ball.radius; ball.vx = -Math.abs(ball.vx); playSound("wall");
      }
      if (ball.y - ball.radius <= bounds.top) {
        ball.y = bounds.top + ball.radius; ball.vy = Math.abs(ball.vy); playSound("wall");
      }
      if (ball.vy > 0 && circleHitsRect(ball, paddle)) paddleBounce(ball);
      let collided = false;
      for (const obstacle of obstacles) {
        if (!circleHitsRect(ball, obstacle)) continue;
        bounceRect(ball, obstacle, previousX, previousY);
        playSound("wall");
        collided = true;
        break;
      }
      if (!collided) {
        for (const brick of bricks) {
          if (!brick.alive || (ball.hitCooldown > 0 && ball.lastHit === brick.id) || !circleHitsRect(ball, brick)) continue;
          const piercing = effects.pierceUntil > gameTime && brick.type !== "strong";
          hitBrick(ball, brick);
          if (!piercing) bounceRect(ball, brick, previousX, previousY);
          ball.lastHit = brick.id;
          ball.hitCooldown = .035;
          normalizeVelocity(ball);
          break;
        }
      }
      if (ball.y - ball.radius > bounds.bottom) { ball.dead = true; break; }
    }
  }
  function update(step) {
    messageTimer -= step;
    if (messageTimer <= 0) ui.message.hidden = true;
    updateParticles(step);
    if (state === "countdown") {
      if (keys.left) paddle.x -= layout.keySpeed * step;
      if (keys.right) paddle.x += layout.keySpeed * step;
      clampPaddle();
      dockBalls();
      countdownTimer -= step;
      if (countdownTimer <= 0) {
        countdown -= 1;
        countdownTimer = .72;
        if (countdown <= 0) {
          state = "playing";
          playSound("paddle");
          setStatus("红豆出发！", "小豆、出発！");
          updateHud();
        }
      }
      return;
    }
    if (state !== "playing") return;
    gameTime += step;
    if (keys.left) paddle.x -= layout.keySpeed * step;
    if (keys.right) paddle.x += layout.keySpeed * step;
    clampPaddle();
    bricks.forEach(function (brick) {
      if (brick.alive && brick.type === "moving") {
        brick.x = Math.max(bounds.left, Math.min(bounds.right - brick.width, brick.baseX + Math.sin(gameTime * brick.moveSpeed * Math.PI + brick.phase) * brick.moveRange));
      }
    });
    updateEffects();
    updatePickups(step);
    balls.forEach(function (ball) { updateBall(ball, step); });
    balls = balls.filter(function (ball) { return !ball.dead; });
    if (!balls.length && state === "playing") loseLife();
  }

  function roundedRect(x, y, rectWidth, rectHeight, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + rectWidth - radius, y);
    ctx.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + radius);
    ctx.lineTo(x + rectWidth, y + rectHeight - radius);
    ctx.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - radius, y + rectHeight);
    ctx.lineTo(x + radius, y + rectHeight);
    ctx.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#11201d");
    gradient.addColorStop(1, "#07100f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.strokeStyle = "rgba(238,232,216,.035)";
    ctx.lineWidth = 1;
    for (let y = bounds.top + 22; y < bounds.bottom; y += 38) {
      ctx.beginPath();
      ctx.moveTo(bounds.left, y + Math.sin(y) * 1.5);
      ctx.lineTo(bounds.right, y);
      ctx.stroke();
    }
    ctx.setLineDash([5, 9]);
    ctx.strokeStyle = "rgba(238,232,216,.08)";
    ctx.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
    ctx.restore();
  }
  function drawBricks() {
    bricks.forEach(function (brick) {
      if (!brick.alive) return;
      const palette = brickColor(brick);
      ctx.save();
      ctx.shadowColor = palette[0];
      ctx.shadowBlur = brick.type === "moving" ? 16 : 10;
      roundedRect(brick.x, brick.y, brick.width, brick.height, 5);
      ctx.fillStyle = palette[0];
      ctx.fill();
      ctx.shadowBlur = 0;
      roundedRect(brick.x + 3, brick.y + 3, brick.width - 6, 4, 2);
      ctx.fillStyle = palette[1];
      ctx.globalAlpha = .7;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (brick.type === "strong") {
        ctx.strokeStyle = brick.hp === 1 ? "rgba(44,24,18,.75)" : "rgba(255,255,255,.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(brick.x + brick.width * .56, brick.y + 5);
        ctx.lineTo(brick.x + brick.width * .43, brick.y + brick.height * .5);
        if (brick.hp === 1) ctx.lineTo(brick.x + brick.width * .62, brick.y + brick.height - 3);
        ctx.stroke();
      } else if (brick.type === "moving") {
        ctx.fillStyle = "rgba(255,255,255,.76)";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("↔", brick.x + brick.width / 2, brick.y + brick.height / 2 + 1);
      }
      ctx.restore();
    });
  }
  function drawObstacles() {
    obstacles.forEach(function (obstacle) {
      ctx.save();
      roundedRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 4);
      ctx.fillStyle = colors.obstacle;
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = "rgba(255,255,255,.24)";
      ctx.lineWidth = 3;
      for (let x = obstacle.x - obstacle.height; x < obstacle.x + obstacle.width; x += 13) {
        ctx.beginPath();
        ctx.moveTo(x, obstacle.y + obstacle.height);
        ctx.lineTo(x + obstacle.height, obstacle.y);
        ctx.stroke();
      }
      ctx.restore();
    });
  }
  function drawPaddle() {
    const matcha = document.body.classList.contains("matcha-mode");
    const base = matcha ? colors.green : colors.red;
    const light = matcha ? colors.greenLight : colors.redLight;
    ctx.save();
    ctx.shadowColor = base;
    ctx.shadowBlur = 20;
    roundedRect(paddle.x, paddle.y, paddle.width, paddle.height, 8);
    ctx.fillStyle = base;
    ctx.fill();
    ctx.shadowBlur = 0;
    roundedRect(paddle.x + 8, paddle.y + 3, Math.max(4, paddle.width - 16), 4, 2);
    ctx.fillStyle = light;
    ctx.fill();
    ctx.restore();
  }
  function drawBalls() {
    balls.forEach(function (ball) {
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(ball.angle);
      ctx.shadowColor = effects.pierceUntil > gameTime ? colors.strongLight : "rgba(255,255,255,.52)";
      ctx.shadowBlur = effects.pierceUntil > gameTime ? 24 : 13;
      if (dogImage.complete && dogImage.naturalWidth) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(dogImage, -layout.imageSize / 2, -layout.imageSize / 2, layout.imageSize, layout.imageSize);
      } else {
        ctx.font = "42px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🐶", 0, 1);
      }
      ctx.restore();
    });
  }
  function drawPickups() {
    const labels = { long: "长", multi: "多", pierce: "穿", life: "♥" };
    const fills = { long: colors.green, multi: colors.redLight, pierce: colors.strong, life: "#d84f62" };
    pickups.forEach(function (pickup) {
      ctx.save();
      ctx.shadowColor = fills[pickup.type];
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, pickup.radius, 0, Math.PI * 2);
      ctx.fillStyle = fills[pickup.type];
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.font = "900 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labels[pickup.type], pickup.x, pickup.y + .5);
      ctx.restore();
    });
  }
  function drawParticles() {
    particles.forEach(function (particle) {
      ctx.globalAlpha = Math.min(1, particle.life * 2.2);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    });
    ctx.globalAlpha = 1;
  }
  function drawEffects() {
    const active = [];
    if (effects.longUntil > gameTime) active.push("加长 " + Math.ceil(effects.longUntil - gameTime) + "s");
    if (effects.multiUntil > gameTime) active.push("多球 " + Math.ceil(effects.multiUntil - gameTime) + "s");
    if (effects.pierceUntil > gameTime) active.push("穿透 " + Math.ceil(effects.pierceUntil - gameTime) + "s");
    if (!active.length) return;
    ctx.save();
    ctx.fillStyle = "rgba(238,232,216,.72)";
    ctx.font = (layoutName === "mobile" ? 10 : 11) + "px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(active.join(" · "), bounds.right, bounds.top + 12);
    ctx.restore();
  }
  function drawCountdown() {
    if (state !== "countdown") return;
    ctx.save();
    ctx.fillStyle = "rgba(4,10,9,.46)";
    ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
    ctx.fillStyle = colors.chalk;
    ctx.shadowColor = "rgba(255,255,255,.35)";
    ctx.shadowBlur = 18;
    ctx.font = "400 " + (layoutName === "mobile" ? 86 : 100) + "px Archivo Black, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(countdown), width / 2, height * .57);
    ctx.restore();
  }
  function drawBoard() {
    ctx.clearRect(0, 0, width, height);
    drawBackground();
    drawBricks();
    drawObstacles();
    drawPickups();
    drawParticles();
    drawPaddle();
    drawBalls();
    drawEffects();
    drawCountdown();
  }
  function frame(now) {
    const step = Math.min((now - lastTime) / 1000, .034);
    lastTime = now;
    update(step);
    drawBoard();
    requestAnimationFrame(frame);
  }

  function pointerX(event) {
    const rect = canvas.getBoundingClientRect();
    return (event.clientX - rect.left) * width / rect.width;
  }
  function movePaddleWithPointer(event) {
    if (!["playing", "countdown"].includes(state)) return;
    const x = pointerX(event);
    if (event.pointerType === "touch") {
      if (!pointer.active || event.pointerId !== pointer.id) return;
      paddle.x = x - pointer.offset;
    } else {
      paddle.x = x - paddle.width / 2;
    }
    clampPaddle();
  }
  canvas.addEventListener("pointerdown", function (event) {
    if (!["playing", "countdown"].includes(state)) return;
    event.preventDefault();
    initAudio();
    if (event.pointerType === "touch") {
      pointer.active = true;
      pointer.id = event.pointerId;
      pointer.offset = pointerX(event) - paddle.x;
      if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    }
    movePaddleWithPointer(event);
  });
  canvas.addEventListener("pointermove", function (event) {
    if (event.pointerType === "touch" || event.buttons) event.preventDefault();
    movePaddleWithPointer(event);
  });
  canvas.addEventListener("pointerup", function (event) {
    if (event.pointerId === pointer.id) { pointer.active = false; pointer.id = null; }
  });
  canvas.addEventListener("pointercancel", function () { pointer.active = false; pointer.id = null; });
  window.addEventListener("keydown", function (event) {
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "a", "d", " ", "escape", "p"].includes(key)) event.preventDefault();
    if (key === "arrowleft" || key === "a") keys.left = true;
    if (key === "arrowright" || key === "d") keys.right = true;
    if ((key === "p" || key === "escape") && ["playing", "countdown", "paused"].includes(state)) togglePause();
    if ((key === " " || key === "enter") && state === "paused") resumeGame();
  });
  window.addEventListener("keyup", function (event) {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") keys.left = false;
    if (key === "arrowright" || key === "d") keys.right = false;
  });
  window.addEventListener("blur", function () { if (["playing", "countdown"].includes(state)) pauseGame(); });
  document.addEventListener("visibilitychange", function () { if (document.hidden && ["playing", "countdown"].includes(state)) pauseGame(); });
  window.addEventListener("resize", function () {
    if (window.innerWidth === viewportWidth) return;
    viewportWidth = window.innerWidth;
    applyLayout();
  });
  ui.primary.addEventListener("click", function () { primaryAction(); });
  ui.secondary.addEventListener("click", function () { secondaryAction(); });
  ui.tertiary.addEventListener("click", function () { tertiaryAction(); });
  ui.pause.addEventListener("click", togglePause);
  ui.sound.addEventListener("click", toggleSound);
  ui.volume.addEventListener("input", function () {
    save.volume = Number(ui.volume.value);
    save.muted = false;
    writeSave();
    updateSoundUi();
    initAudio();
  });
  ui.volume.addEventListener("change", function () { playSound("power"); });

  canvas.width = width;
  canvas.height = height;
  updateSoundUi();
  showMainMenu();
  requestAnimationFrame(frame);
}
