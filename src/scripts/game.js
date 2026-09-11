const canvas = document.querySelector("#breakout-game");

if (canvas) {
  const ctx = canvas.getContext("2d");
  const overlay = document.querySelector("[data-game-overlay]");
  const overlayKicker = document.querySelector("[data-overlay-kicker]");
  const overlayTitle = document.querySelector("[data-overlay-title]");
  const overlayCopy = document.querySelector("[data-overlay-copy]");
  const startButton = document.querySelector("[data-game-start]");
  const overlayResetButton = document.querySelector("[data-game-overlay-reset]");
  const hud = document.querySelector(".game-hud");
  const pauseButton = document.querySelector("[data-game-pause]");
  const resetButton = document.querySelector("[data-game-reset]");
  const scoreText = document.querySelector("[data-game-score]");
  const bestText = document.querySelector("[data-game-best]");
  const livesText = document.querySelector("[data-game-lives]");
  const statusText = document.querySelector("[data-game-status]");
  const dogImage = new Image();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const DESKTOP_LAYOUT = {
    width: 900, height: 600, brickColumns: 10, brickRows: 4,
    brickSide: 42, brickGap: 10, brickHeight: 30, brickTop: 82,
    paddleWidth: 140, paddleHeight: 17, paddleBottom: 48,
    ballRadius: 22, ballImageSize: 62, ballSpeedX: 305, ballSpeedY: 420
  };
  const MOBILE_LAYOUT = {
    width: 390, height: 700, brickColumns: 5, brickRows: 5,
    brickSide: 25, brickGap: 9, brickHeight: 31, brickTop: 112,
    paddleWidth: 100, paddleHeight: 17, paddleBottom: 68,
    ballRadius: 21, ballImageSize: 68, ballSpeedX: 205, ballSpeedY: 390
  };
  const palette = { red: "#9b2a2c", redLight: "#d86e71", green: "#b7ba6b", greenLight: "#dce09c" };

  let layout = getLayout();
  let width = layout.width;
  let height = layout.height;
  let bricks = [];
  let state = "idle";
  let score = 0;
  let lives = 3;
  let best = Number.parseInt(readGameStorage("annie-pome-break-best", "0"), 10) || 0;
  let lastTime = performance.now();
  const keys = { left: false, right: false };
  const paddle = { x: 0, y: 0, width: layout.paddleWidth, height: layout.paddleHeight, speed: 720 };
  const ball = { x: 0, y: 0, vx: 0, vy: 0, radius: layout.ballRadius, angle: 0 };
  let playableBounds = { left: 14, right: width - 14, top: 14, bottom: height - 14 };
  let viewportWidth = window.innerWidth;

  dogImage.src = canvas.dataset.dogSrc;

  function getLayout() {
    return window.innerWidth <= 600 && window.innerHeight > window.innerWidth ? MOBILE_LAYOUT : DESKTOP_LAYOUT;
  }

  function readGameStorage(key, fallback) {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  }

  function writeGameStorage(key, value) {
    try { localStorage.setItem(key, value); } catch { /* local scores are optional */ }
  }

  function clampPaddle() {
    paddle.x = Math.max(playableBounds.left, Math.min(playableBounds.right - paddle.width, paddle.x));
  }

  function updatePlayableBounds() {
    const canvasRect = canvas.getBoundingClientRect();
    const hudRect = hud?.getBoundingClientRect();
    const scaleY = canvasRect.height ? height / canvasRect.height : 1;
    const hudBottom = hudRect ? (hudRect.bottom - canvasRect.top) * scaleY : 14;
    playableBounds = {
      left: 14,
      right: width - 14,
      top: Math.max(14, Math.min(height - 80, hudBottom)),
      bottom: height - 14
    };
  }

  function makeBricks(destroyedRatio = 0) {
    const { brickRows: rows, brickColumns: columns, brickGap: gap, brickSide: side, brickHeight } = layout;
    const top = Math.max(layout.brickTop, playableBounds.top + 18);
    const brickWidth = (width - side * 2 - gap * (columns - 1)) / columns;
    const destroyed = Math.round(Math.max(0, Math.min(1, destroyedRatio)) * rows * columns);
    bricks = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        const red = (row + column) % 2 === 0;
        bricks.push({
          x: side + column * (brickWidth + gap), y: top + row * (brickHeight + gap),
          width: brickWidth, height: brickHeight,
          color: red ? palette.red : palette.green, light: red ? palette.redLight : palette.greenLight,
          alive: index >= destroyed
        });
      }
    }
  }

  function resetBall(direction = Math.random() > .5 ? 1 : -1) {
    paddle.width = layout.paddleWidth;
    paddle.height = layout.paddleHeight;
    paddle.y = height - layout.paddleBottom - paddle.height;
    paddle.x = width / 2 - paddle.width / 2;
    ball.radius = layout.ballRadius;
    ball.x = paddle.x + paddle.width / 2;
    ball.y = paddle.y - ball.radius - 4;
    ball.vx = layout.ballSpeedX * direction;
    ball.vy = -layout.ballSpeedY;
    ball.angle = 0;
  }

  function applyLayout(preserveProgress = false) {
    const next = getLayout();
    if (next === layout && canvas.width === next.width && canvas.height === next.height) return;
    const oldWidth = width;
    const oldHeight = height;
    const oldPaddleCenter = paddle.x + paddle.width / 2;
    const brokenRatio = bricks.length ? bricks.filter((brick) => !brick.alive).length / bricks.length : 0;
    const ballXRatio = oldWidth ? ball.x / oldWidth : .5;
    const ballYRatio = oldHeight ? ball.y / oldHeight : .7;
    layout = next;
    width = layout.width;
    height = layout.height;
    canvas.width = width;
    canvas.height = height;
    updatePlayableBounds();
    paddle.width = layout.paddleWidth;
    paddle.height = layout.paddleHeight;
    paddle.y = height - layout.paddleBottom - paddle.height;
    paddle.x = oldPaddleCenter / oldWidth * width - paddle.width / 2;
    clampPaddle();
    ball.radius = layout.ballRadius;
    ball.x = Math.max(ball.radius + 14, Math.min(width - ball.radius - 14, ballXRatio * width));
    ball.y = Math.max(playableBounds.top + ball.radius, Math.min(playableBounds.bottom - ball.radius, ballYRatio * height));
    ball.vx = Math.sign(ball.vx || 1) * layout.ballSpeedX;
    ball.vy = Math.sign(ball.vy || -1) * layout.ballSpeedY;
    makeBricks(preserveProgress ? brokenRatio : 0);
    if (state === "idle" || state === "ready") resetBall(Math.sign(ball.vx) || 1);
  }

  function updateHud() {
    scoreText.textContent = String(score).padStart(4, "0");
    bestText.textContent = String(best).padStart(4, "0");
    livesText.textContent = Array.from({ length: Math.max(0, lives) }, () => "♥").join(" ") || "—";
    livesText.setAttribute("aria-label", `剩余${Math.max(0, lives)}次机会 / 残り${Math.max(0, lives)}回`);
  }

  function setPauseButton(paused = false) {
    pauseButton.disabled = state !== "playing" && state !== "paused";
    pauseButton.textContent = paused ? "▶" : "⏸";
    pauseButton.setAttribute("aria-label", paused ? "继续游戏 / 再開" : "暂停游戏 / 一時停止");
    pauseButton.title = paused ? "继续游戏 / 再開" : "暂停游戏 / 一時停止";
  }

  function showOverlay({ kicker, title, titleJa, copy, copyJa, action, actionJa, showReset = false }) {
    overlayKicker.textContent = kicker;
    overlayTitle.innerHTML = `${title}<small lang="ja">${titleJa}</small>`;
    overlayCopy.innerHTML = `${copy}<small lang="ja">${copyJa}</small>`;
    startButton.innerHTML = `<span>${action}<small lang="ja">${actionJa}</small></span><b aria-hidden="true">→</b>`;
    overlayResetButton.hidden = !showReset;
    overlay.hidden = false;
  }

  function hideOverlay() { overlay.hidden = true; }
  function setStatus(message, japanese) { statusText.innerHTML = `${message}<small lang="ja">${japanese}</small>`; }

  function startGame() {
    if (state === "paused") {
      state = "playing";
      lastTime = performance.now();
      setPauseButton();
      hideOverlay();
      setStatus("继续游戏", "ゲーム再開");
      return;
    }
    if (state === "won" || state === "over") restartGame(true);
    if (state === "idle" || state === "ready") {
      state = "playing";
      lastTime = performance.now();
      setPauseButton();
      hideOverlay();
      setStatus("红豆出发！", "小豆、出発！");
    }
    updateHud();
  }

  function restartGame(startImmediately = true) {
    score = 0;
    lives = 3;
    state = startImmediately ? "playing" : "idle";
    makeBricks();
    resetBall();
    updateHud();
    setPauseButton();
    if (startImmediately) {
      hideOverlay();
      lastTime = performance.now();
      setStatus("新的一局开始了！", "新しいゲーム開始！");
    } else {
      showOverlay({ kicker: "READY?", title: "红豆打砖块", copy: "方向键或手指拖动挡板", copyJa: "矢印キー、または指で操作", action: "开始游戏", actionJa: "スタート" });
      setStatus("等待开始", "スタート待機");
    }
  }

  function pauseGame() {
    if (state !== "playing") return;
    keys.left = false;
    keys.right = false;
    state = "paused";
    setPauseButton(true);
    showOverlay({ kicker: "PAUSED", title: "游戏暂停", titleJa: "一時停止", copy: "当前位置与进度都会保留", copyJa: "位置と進行状況は保存されます", action: "继续游戏", actionJa: "再開", showReset: true });
    setStatus("游戏暂停", "一時停止");
  }

  function togglePause() {
    if (state === "playing") pauseGame();
    else if (state === "paused") startGame();
  }

  function circleHitsRect(rect) {
    const nearestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.width));
    const nearestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.height));
    const dx = ball.x - nearestX;
    const dy = ball.y - nearestY;
    return dx * dx + dy * dy <= ball.radius * ball.radius;
  }

  function bounceFromBrick(brick) {
    const fromLeft = Math.abs((ball.x + ball.radius) - brick.x);
    const fromRight = Math.abs((brick.x + brick.width) - (ball.x - ball.radius));
    const fromTop = Math.abs((ball.y + ball.radius) - brick.y);
    const fromBottom = Math.abs((brick.y + brick.height) - (ball.y - ball.radius));
    const smallest = Math.min(fromLeft, fromRight, fromTop, fromBottom);
    if (smallest === fromLeft || smallest === fromRight) ball.vx *= -1;
    else ball.vy *= -1;
  }

  function loseLife() {
    lives -= 1;
    updateHud();
    if (lives <= 0) {
      state = "over";
      setPauseButton();
      showOverlay({ kicker: "GAME OVER", title: "本轮结束", titleJa: "ゲーム終了", copy: `得分 ${score}，再陪红豆玩一局吧`, copyJa: `スコア ${score}。もう一度遊ぼう`, action: "再来一局", actionJa: "もう一度" });
      setStatus(`本轮得分 ${score}`, `今回のスコア ${score}`);
      return;
    }
    state = "ready";
    setPauseButton();
    resetBall();
    showOverlay({ kicker: "ONE MORE!", title: "再来一把", titleJa: "もう一回", copy: `还剩 ${lives} 次机会`, copyJa: `残り ${lives} 回`, action: "继续游戏", actionJa: "再開" });
    setStatus(`还剩 ${lives} 次机会`, `残り ${lives} 回`);
  }

  function completeGame() {
    state = "won";
    setPauseButton();
    showOverlay({ kicker: "CLEAR!", title: "全部击破", titleJa: "全クリア", copy: `得分 ${score}，红豆完成任务`, copyJa: `スコア ${score} ミッション完了`, action: "再玩一次", actionJa: "もう一度" });
    setStatus("全部砖块已清空", "全ブロッククリア");
  }

  function update(step) {
    if (state === "playing") {
      if (keys.left) paddle.x -= paddle.speed * step;
      if (keys.right) paddle.x += paddle.speed * step;
      clampPaddle();
    }
    if (state === "idle" || state === "ready") {
      ball.x = paddle.x + paddle.width / 2;
      ball.y = paddle.y - ball.radius - 4;
      return;
    }
    if (state !== "playing") return;

    const substeps = Math.max(1, Math.ceil(step / .009));
    const slice = step / substeps;
    for (let index = 0; index < substeps; index += 1) {
      ball.x += ball.vx * slice;
      ball.y += ball.vy * slice;
      if (!reducedMotion.matches) ball.angle += slice * 3.8;
      if (ball.x - ball.radius <= playableBounds.left) { ball.x = playableBounds.left + ball.radius; ball.vx = Math.abs(ball.vx); }
      else if (ball.x + ball.radius >= playableBounds.right) { ball.x = playableBounds.right - ball.radius; ball.vx = -Math.abs(ball.vx); }
      if (ball.y - ball.radius <= playableBounds.top) { ball.y = playableBounds.top + ball.radius; ball.vy = Math.abs(ball.vy); }

      if (ball.vy > 0 && circleHitsRect(paddle)) {
        ball.y = paddle.y - ball.radius - 1;
        const speed = Math.min(layout === MOBILE_LAYOUT ? 540 : 610, Math.hypot(ball.vx, ball.vy) + 7);
        const offset = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
        const angle = Math.max(-1, Math.min(1, offset)) * Math.PI * .36;
        ball.vx = speed * Math.sin(angle);
        ball.vy = -Math.abs(speed * Math.cos(angle));
      }

      for (const brick of bricks) {
        if (!brick.alive || !circleHitsRect(brick)) continue;
        brick.alive = false;
        bounceFromBrick(brick);
        score += 10;
        if (score > best) { best = score; writeGameStorage("annie-pome-break-best", String(best)); }
        updateHud();
        if (bricks.every((item) => !item.alive)) completeGame();
        break;
      }
      if (ball.y - ball.radius > playableBounds.bottom) { loseLife(); break; }
      if (state !== "playing") break;
    }
  }

  function roundedRect(x, y, rectWidth, rectHeight, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y); ctx.lineTo(x + rectWidth - radius, y);
    ctx.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + radius);
    ctx.lineTo(x + rectWidth, y + rectHeight - radius);
    ctx.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - radius, y + rectHeight);
    ctx.lineTo(x + radius, y + rectHeight); ctx.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - radius);
    ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
  }

  function drawBoard() {
    ctx.clearRect(0, 0, width, height);
    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, "#151022"); background.addColorStop(1, "#090713");
    ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
    ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.035)"; ctx.lineWidth = 1;
    for (let x = 20; x < width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 20; y < height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.restore();
    for (const brick of bricks) {
      if (!brick.alive) continue;
      ctx.save(); ctx.shadowColor = brick.color; ctx.shadowBlur = 15;
      roundedRect(brick.x, brick.y, brick.width, brick.height, 5); ctx.fillStyle = brick.color; ctx.fill();
      ctx.shadowBlur = 0; roundedRect(brick.x + 4, brick.y + 4, brick.width - 8, 5, 2);
      ctx.fillStyle = brick.light; ctx.globalAlpha = .64; ctx.fill(); ctx.restore();
    }
    const matchaMode = document.body.classList.contains("matcha-mode");
    const paddleColor = matchaMode ? palette.green : palette.red;
    const paddleLight = matchaMode ? palette.greenLight : palette.redLight;
    ctx.save(); ctx.shadowColor = paddleColor; ctx.shadowBlur = 22;
    roundedRect(paddle.x, paddle.y, paddle.width, paddle.height, 8); ctx.fillStyle = paddleColor; ctx.fill();
    ctx.shadowBlur = 0; roundedRect(paddle.x + 9, paddle.y + 3, paddle.width - 18, 4, 2);
    ctx.fillStyle = paddleLight; ctx.fill(); ctx.restore();
    const imageSize = layout.ballImageSize;
    ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(ball.angle); ctx.shadowColor = "rgba(255,255,255,.45)"; ctx.shadowBlur = 14;
    if (dogImage.complete && dogImage.naturalWidth) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(dogImage, -imageSize / 2, -imageSize / 2, imageSize, imageSize);
    } else {
      ctx.font = "48px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🐶", 0, 1);
    }
    ctx.restore(); ctx.strokeStyle = "rgba(255,255,255,.11)"; ctx.lineWidth = 2; ctx.strokeRect(13, 13, width - 26, height - 26);
  }

  function frame(now) {
    const step = Math.min((now - lastTime) / 1000, .034);
    lastTime = now;
    update(step); drawBoard(); requestAnimationFrame(frame);
  }

  function movePaddleWithPointer(event) {
    if (state !== "playing" && state !== "idle" && state !== "ready") return;
    const rect = canvas.getBoundingClientRect();
    paddle.x = (event.clientX - rect.left) * width / rect.width - paddle.width / 2;
    clampPaddle();
  }

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" || event.buttons) event.preventDefault();
    movePaddleWithPointer(event);
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (state !== "playing" && state !== "idle" && state !== "ready") return;
    event.preventDefault(); canvas.setPointerCapture?.(event.pointerId); movePaddleWithPointer(event);
    if (state === "idle" || state === "ready") startGame();
  });
  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
    if (state === "playing" && (event.key === "ArrowLeft" || event.key.toLowerCase() === "a")) keys.left = true;
    if (state === "playing" && (event.key === "ArrowRight" || event.key.toLowerCase() === "d")) keys.right = true;
    if ((event.key === " " || event.key === "Enter") && (state === "idle" || state === "ready" || state === "paused")) startGame();
    if ((event.key.toLowerCase() === "p" || event.key === "Escape") && (state === "playing" || state === "paused")) togglePause();
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keys.left = false;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keys.right = false;
  });
  window.addEventListener("blur", () => { if (state === "playing") pauseGame(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") pauseGame(); });
  window.addEventListener("resize", () => {
    // Mobile browser chrome changes innerHeight but not the stable svh-based stage.
    // Recalculate only when the real width/layout mode changes (including rotation).
    if (window.innerWidth === viewportWidth) return;
    viewportWidth = window.innerWidth;
    applyLayout(true);
    updatePlayableBounds();
  });
  if (hud && "ResizeObserver" in window) {
    const hudObserver = new ResizeObserver(() => {
      const brokenRatio = bricks.length ? bricks.filter((brick) => !brick.alive).length / bricks.length : 0;
      updatePlayableBounds();
      makeBricks(brokenRatio);
    });
    hudObserver.observe(hud);
  }
  startButton.addEventListener("click", startGame);
  overlayResetButton.addEventListener("click", () => restartGame(true));
  pauseButton.addEventListener("click", togglePause);
  resetButton.addEventListener("click", () => restartGame(true));

  canvas.width = width;
  canvas.height = height;
  updatePlayableBounds();
  makeBricks(); resetBall(); updateHud(); setPauseButton(); requestAnimationFrame(frame);
}
