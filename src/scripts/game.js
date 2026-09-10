const canvas = document.querySelector("#breakout-game");

if (canvas) {
  const ctx = canvas.getContext("2d");
  const overlay = document.querySelector("[data-game-overlay]");
  const overlayKicker = document.querySelector("[data-overlay-kicker]");
  const overlayTitle = document.querySelector("[data-overlay-title]");
  const overlayCopy = document.querySelector("[data-overlay-copy]");
  const startButton = document.querySelector("[data-game-start]");
  const pauseButton = document.querySelector("[data-game-pause]");
  const resetButton = document.querySelector("[data-game-reset]");
  const scoreText = document.querySelector("[data-game-score]");
  const bestText = document.querySelector("[data-game-best]");
  const livesText = document.querySelector("[data-game-lives]");
  const statusText = document.querySelector("[data-game-status]");

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const dogImage = new Image();
  dogImage.src = canvas.dataset.dogSrc;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const palette = {
    red: "#9b2a2c",
    redLight: "#d86e71",
    green: "#b7ba6b",
    greenLight: "#dce09c"
  };

  const paddle = { x: WIDTH / 2 - 74, y: 622, width: 148, height: 17, speed: 720 };
  const ball = { x: WIDTH / 2, y: paddle.y - 27, vx: 305, vy: -420, radius: 24, angle: 0 };
  const keys = { left: false, right: false };
  let bricks = [];
  let state = "idle";
  let score = 0;
  let lives = 3;
  let best = Number.parseInt(readGameStorage("annie-pome-break-best", "0"), 10) || 0;
  let lastTime = performance.now();

  function readGameStorage(key, fallback) {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  }

  function writeGameStorage(key, value) {
    try { localStorage.setItem(key, value); } catch { /* local scores are optional */ }
  }

  function makeBricks() {
    const rows = 5;
    const columns = 8;
    const gap = 12;
    const side = 66;
    const width = (WIDTH - side * 2 - gap * (columns - 1)) / columns;
    const height = 34;
    const top = 76;
    bricks = [];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        bricks.push({
          x: side + column * (width + gap),
          y: top + row * (height + gap),
          width,
          height,
          color: (row + column) % 2 === 0 ? palette.red : palette.green,
          light: (row + column) % 2 === 0 ? palette.redLight : palette.greenLight,
          alive: true
        });
      }
    }
  }

  function resetBall(direction = Math.random() > .5 ? 1 : -1) {
    paddle.x = WIDTH / 2 - paddle.width / 2;
    ball.x = paddle.x + paddle.width / 2;
    ball.y = paddle.y - ball.radius - 4;
    ball.vx = 305 * direction;
    ball.vy = -420;
    ball.angle = 0;
  }

  function updateHud() {
    scoreText.textContent = String(score).padStart(4, "0");
    bestText.textContent = String(best).padStart(4, "0");
    livesText.textContent = Array.from({ length: Math.max(0, lives) }, () => "♥").join(" ") || "—";
    livesText.setAttribute("aria-label", `剩余${Math.max(0, lives)}次机会`);
  }

  function showOverlay(kicker, title, copy, action) {
    overlayKicker.textContent = kicker;
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    startButton.firstChild.textContent = action + " ";
    overlay.hidden = false;
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function setStatus(message) {
    statusText.textContent = message;
  }

  function startGame() {
    if (state === "won" || state === "over") {
      score = 0;
      lives = 3;
      makeBricks();
      resetBall();
    }
    if (state === "paused") {
      state = "playing";
      pauseButton.textContent = "暂停";
      hideOverlay();
      setStatus("继续游戏");
      return;
    }
    if (state === "idle" || state === "ready" || state === "won" || state === "over") {
      state = "playing";
      hideOverlay();
      pauseButton.disabled = false;
      setStatus("小博美出发！");
    }
    updateHud();
  }

  function restartGame() {
    score = 0;
    lives = 3;
    state = "idle";
    makeBricks();
    resetBall();
    pauseButton.disabled = true;
    pauseButton.textContent = "暂停";
    updateHud();
    showOverlay("READY?", "接住小博美", "方向键、A / D 或手指拖动挡板", "开始游戏");
    setStatus("等待开始");
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      pauseButton.textContent = "继续";
      showOverlay("PAUSED", "休息一下", "准备好后继续清理砖块", "继续游戏");
      setStatus("游戏暂停");
    } else if (state === "paused") {
      startGame();
    }
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
      pauseButton.disabled = true;
      showOverlay("GAME OVER", "本轮结束", `得分 ${score}，再陪小博美玩一局吧`, "再来一局");
      setStatus(`本轮得分 ${score}`);
      return;
    }
    state = "ready";
    resetBall();
    showOverlay("ONE MORE!", "小博美回来了", `还剩 ${lives} 次机会`, "继续游戏");
    setStatus(`还剩 ${lives} 次机会`);
  }

  function completeGame() {
    state = "won";
    pauseButton.disabled = true;
    showOverlay("CLEAR!", "全部击破", `得分 ${score}，小博美完成任务`, "再玩一次");
    setStatus("全部砖块已清空");
  }

  function update(step) {
    if (keys.left) paddle.x -= paddle.speed * step;
    if (keys.right) paddle.x += paddle.speed * step;
    paddle.x = Math.max(20, Math.min(WIDTH - paddle.width - 20, paddle.x));

    if (state === "idle" || state === "ready") {
      ball.x = paddle.x + paddle.width / 2;
      ball.y = paddle.y - ball.radius - 4;
      return;
    }
    if (state !== "playing") return;

    const substeps = Math.max(1, Math.ceil(step / .009));
    const slice = step / substeps;
    for (let i = 0; i < substeps; i += 1) {
      ball.x += ball.vx * slice;
      ball.y += ball.vy * slice;
      if (!reducedMotion.matches) ball.angle += slice * 3.8;

      if (ball.x - ball.radius <= 14) {
        ball.x = 14 + ball.radius;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x + ball.radius >= WIDTH - 14) {
        ball.x = WIDTH - 14 - ball.radius;
        ball.vx = -Math.abs(ball.vx);
      }

      if (ball.y - ball.radius <= 14) {
        ball.y = 14 + ball.radius;
        ball.vy = Math.abs(ball.vy);
      }

      if (ball.vy > 0 && circleHitsRect(paddle)) {
        ball.y = paddle.y - ball.radius - 1;
        const speed = Math.min(610, Math.hypot(ball.vx, ball.vy) + 7);
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
        if (score > best) {
          best = score;
          writeGameStorage("annie-pome-break-best", String(best));
        }
        updateHud();
        if (bricks.every((item) => !item.alive)) completeGame();
        break;
      }

      if (ball.y - ball.radius > HEIGHT) {
        loseLife();
        break;
      }
      if (state !== "playing") break;
    }
  }

  function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawBoard() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    background.addColorStop(0, "#151022");
    background.addColorStop(1, "#090713");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.035)";
    ctx.lineWidth = 1;
    for (let x = 20; x < WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }
    for (let y = 20; y < HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }
    ctx.restore();

    for (const brick of bricks) {
      if (!brick.alive) continue;
      ctx.save();
      ctx.shadowColor = brick.color;
      ctx.shadowBlur = 15;
      roundedRect(brick.x, brick.y, brick.width, brick.height, 5);
      ctx.fillStyle = brick.color;
      ctx.fill();
      ctx.shadowBlur = 0;
      roundedRect(brick.x + 4, brick.y + 4, brick.width - 8, 5, 2);
      ctx.fillStyle = brick.light;
      ctx.globalAlpha = .64;
      ctx.fill();
      ctx.restore();
    }

    const matchaMode = document.body.classList.contains("matcha-mode");
    const paddleColor = matchaMode ? palette.green : palette.red;
    const paddleLight = matchaMode ? palette.greenLight : palette.redLight;
    ctx.save();
    ctx.shadowColor = paddleColor;
    ctx.shadowBlur = 22;
    roundedRect(paddle.x, paddle.y, paddle.width, paddle.height, 8);
    ctx.fillStyle = paddleColor;
    ctx.fill();
    ctx.shadowBlur = 0;
    roundedRect(paddle.x + 9, paddle.y + 3, paddle.width - 18, 4, 2);
    ctx.fillStyle = paddleLight;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.angle);
    ctx.shadowColor = "rgba(255,255,255,.45)";
    ctx.shadowBlur = 14;
    if (dogImage.complete && dogImage.naturalWidth) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(dogImage, -31, -31, 62, 62);
    } else {
      ctx.font = "48px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🐶", 0, 1);
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,.11)";
    ctx.lineWidth = 2;
    ctx.strokeRect(13, 13, WIDTH - 26, HEIGHT - 26);
  }

  function frame(now) {
    const step = Math.min((now - lastTime) / 1000, .034);
    lastTime = now;
    update(step);
    drawBoard();
    requestAnimationFrame(frame);
  }

  function movePaddleWithPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * WIDTH / rect.width;
    paddle.x = Math.max(20, Math.min(WIDTH - paddle.width - 20, x - paddle.width / 2));
  }

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" || event.buttons) event.preventDefault();
    movePaddleWithPointer(event);
  });
  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    movePaddleWithPointer(event);
    if (state === "idle" || state === "ready") startGame();
  });

  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keys.left = true;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keys.right = true;
    if ((event.key === " " || event.key === "Enter") && (state === "idle" || state === "ready")) startGame();
    if ((event.key.toLowerCase() === "p" || event.key === "Escape") && (state === "playing" || state === "paused")) togglePause();
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keys.left = false;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keys.right = false;
  });
  window.addEventListener("blur", () => {
    keys.left = false;
    keys.right = false;
    if (state === "playing") togglePause();
  });

  startButton.addEventListener("click", startGame);
  pauseButton.addEventListener("click", togglePause);
  resetButton.addEventListener("click", restartGame);
  document.querySelector("[data-theme-toggle]")?.addEventListener("click", (event) => {
    const matcha = document.body.classList.toggle("matcha-mode");
    event.currentTarget.setAttribute("aria-pressed", String(matcha));
  });

  makeBricks();
  resetBall();
  updateHud();
  requestAnimationFrame(frame);
}
