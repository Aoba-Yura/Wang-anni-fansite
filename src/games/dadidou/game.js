(() => {
  "use strict";

  const GAME_VERSION = "1.0.1";
  const DURATION = 60000;
  const EXIT_MS = 150;
  const HIT_MS = 190;
  const HIT_GAP_MS = 150;
  const MISS_GAP_MS = 110;
  const KEYPAD_TO_HOLE = [6, 7, 8, 3, 4, 5, 0, 1, 2];

  const shell = document.getElementById("gameShell");
  const playfield = document.getElementById("playfield");
  const grid = document.getElementById("burrowGrid");
  const holes = [...document.querySelectorAll(".burrow")];
  const targetStage = document.getElementById("redbeanStage");
  const targetNode = document.getElementById("redbeanTarget");
  const feedbackLayer = document.getElementById("feedbackLayer");
  const startPanel = document.getElementById("startPanel");
  const resultPanel = document.getElementById("resultPanel");
  const startButton = document.getElementById("startButton");
  const replayButton = document.getElementById("replayButton");
  const pauseButton = document.getElementById("pauseButton");
  const resumeButton = document.getElementById("resumeButton");
  const quitButton = document.getElementById("quitButton");
  const pauseVeil = document.getElementById("pauseVeil");
  const countdown = document.getElementById("countdown");
  const hammer = document.getElementById("toyHammer");
  const timeValue = document.getElementById("timeValue");
  const scoreValue = document.getElementById("scoreValue");
  const comboText = document.getElementById("comboText");
  const liveRegion = document.getElementById("liveRegion");

  let audioContext = null;
  let phase = "ready";
  let runToken = 0;
  let rafId = 0;
  let startAt = 0;
  let pausedAt = 0;
  let nextSpawnAt = 0;
  let activeTarget = null;
  let targetSerial = 0;
  let opportunitiesShown = 0;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let hits = 0;
  let emptyStrikes = 0;
  let holeBag = [];
  let lastHole = -1;
  let inputLockedUntil = 0;
  let hammerHideTimer = 0;

  function ensureAudio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
  }

  function tone(frequency, duration, type = "sine", gain = 0.045) {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.18, audioContext.currentTime + duration);
    volume.gain.setValueAtTime(gain, audioContext.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(volume).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  }

  function dwellFor(now) {
    const elapsed = now - startAt;
    if (elapsed < 20000) return 1050;
    if (elapsed < 45000) return 920;
    return 820;
  }

  function multiplierFor(value) {
    if (value >= 20) return 1.5;
    if (value >= 10) return 1.25;
    if (value >= 5) return 1.1;
    return 1;
  }

  function refillHoleBag() {
    holeBag = holes.map((_, index) => index);
    for (let i = holeBag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [holeBag[i], holeBag[j]] = [holeBag[j], holeBag[i]];
    }
    if (holeBag[0] === lastHole && holeBag.length > 1) {
      [holeBag[0], holeBag[1]] = [holeBag[1], holeBag[0]];
    }
  }

  function chooseHole() {
    if (!holeBag.length) refillHoleBag();
    let choice = holeBag.findIndex(index => index !== lastHole && gridDistance(index, lastHole) <= 2);
    if (choice < 0) choice = holeBag.findIndex(index => index !== lastHole);
    if (choice < 0) choice = 0;
    const index = holeBag.splice(choice, 1)[0];
    lastHole = index;
    return index;
  }

  function gridDistance(a, b) {
    if (a < 0 || b < 0) return 0;
    return Math.abs(Math.floor(a / 3) - Math.floor(b / 3)) + Math.abs((a % 3) - (b % 3));
  }

  function updateCombo() {
    if (phase !== "playing" || combo < 2) {
      comboText.textContent = "";
      return;
    }
    const multiplier = multiplierFor(combo);
    comboText.textContent = multiplier > 1 ? `连中${combo} · ×${multiplier}` : `连中${combo}`;
  }

  function updateTargetPosition() {
    if (!activeTarget) return;
    const fieldRect = playfield.getBoundingClientRect();
    const holeRect = holes[activeTarget.index].getBoundingClientRect();
    targetStage.style.setProperty("--stage-x", `${holeRect.left - fieldRect.left + holeRect.width / 2}px`);
    targetStage.style.setProperty("--stage-y", `${holeRect.bottom - fieldRect.top - holeRect.height * 0.14}px`);
  }

  function revealTarget(now) {
    if (activeTarget) return;
    const index = chooseHole();
    const vermilion = (opportunitiesShown + 1) % 10 === 0;
    activeTarget = {
      id: ++targetSerial,
      index,
      vermilion,
      state: "hittable",
      expiresAt: now + dwellFor(now),
      removeAt: Infinity
    };
    opportunitiesShown += 1;
    holes[index].classList.add("current");
    targetStage.classList.add("active");
    targetNode.disabled = false;
    targetNode.className = `redbean-target entering hittable${vermilion ? " vermilion" : ""}`;
    updateTargetPosition();
  }

  function beginTargetExit(now, wasHit) {
    if (!activeTarget || activeTarget.state !== "hittable") return;
    activeTarget.state = wasHit ? "hit" : "exiting";
    activeTarget.removeAt = now + (wasHit ? HIT_MS : EXIT_MS);
    targetNode.disabled = true;
    targetNode.className = `redbean-target ${wasHit ? "hit" : "exiting"}${activeTarget.vermilion ? " vermilion" : ""}`;
    if (!wasHit) {
      combo = 0;
      updateCombo();
    }
  }

  function clearTarget(now) {
    if (!activeTarget) return;
    const gap = activeTarget.state === "hit" ? HIT_GAP_MS : MISS_GAP_MS;
    holes[activeTarget.index].classList.remove("current");
    activeTarget = null;
    targetStage.classList.remove("active");
    targetNode.disabled = true;
    targetNode.className = "redbean-target";
    nextSpawnAt = now + gap;
  }

  function clearAllTargets() {
    holes.forEach(hole => hole.classList.remove("current"));
    activeTarget = null;
    targetStage.classList.remove("active");
    targetNode.disabled = true;
    targetNode.className = "redbean-target";
  }

  function placeHammer(x, y, strike = false, temporary = false) {
    hammer.style.left = `${x}px`;
    hammer.style.top = `${y}px`;
    hammer.classList.add("visible");
    if (strike) {
      hammer.classList.remove("bonk");
      void hammer.offsetWidth;
      hammer.classList.add("bonk");
    }
    if (temporary) {
      clearTimeout(hammerHideTimer);
      hammerHideTimer = setTimeout(() => hammer.classList.remove("visible"), 200);
    }
  }

  function addInkFeedback(clientX, clientY, points = 0) {
    const rect = playfield.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const wave = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    wave.setAttribute("viewBox", "0 0 100 60");
    wave.setAttribute("class", `ink-feedback${points ? "" : " miss"}`);
    wave.style.left = `${x}px`;
    wave.style.top = `${y}px`;
    wave.innerHTML = '<path d="M5 31C19 8 79 4 95 30C79 50 23 55 5 31"/><path d="M18 31C34 17 68 16 84 30C67 43 35 45 18 31"/>';
    feedbackLayer.appendChild(wave);
    wave.addEventListener("animationend", () => wave.remove(), { once: true });
    if (!points) return;
    const label = document.createElement("b");
    label.className = "float-score";
    label.textContent = `+${points}`;
    label.style.left = `${x + 30}px`;
    label.style.top = `${y - 24}px`;
    feedbackLayer.appendChild(label);
    label.addEventListener("animationend", () => label.remove(), { once: true });
  }

  function missStrike(x, y) {
    emptyStrikes += 1;
    combo = 0;
    updateCombo();
    addInkFeedback(x, y);
    tone(145, .07, "triangle", .022);
  }

  function strikeHole(index, x, y) {
    if (phase !== "playing" || pausedAt) return;
    const now = performance.now();
    if (now < inputLockedUntil) return;
    inputLockedUntil = now + 55;
    if (!activeTarget || activeTarget.index !== index || activeTarget.state !== "hittable") {
      missStrike(x, y);
      return;
    }

    hits += 1;
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    const base = activeTarget.vermilion ? 300 : 100;
    const points = Math.round(base * multiplierFor(combo));
    score += points;
    scoreValue.textContent = String(score);
    updateCombo();
    addInkFeedback(x, y, points);
    tone(activeTarget.vermilion ? 610 : 430, activeTarget.vermilion ? .16 : .1, "sine", .05);
    if (activeTarget.vermilion) {
      setTimeout(() => tone(790, .12, "sine", .035), 50);
      liveRegion.textContent = `朱红红豆，加${points}分`;
    } else {
      liveRegion.textContent = `命中，加${points}分`;
    }
    beginTargetExit(now, true);
  }

  playfield.addEventListener("pointerdown", event => {
    if (phase !== "playing" || pausedAt) return;
    event.preventDefault();
    ensureAudio();
    const x = event.clientX;
    const y = event.clientY;
    placeHammer(x, y - 8, true, event.pointerType !== "mouse");
    const targetHit = event.target.closest("#redbeanTarget");
    if (targetHit && activeTarget) {
      strikeHole(activeTarget.index, x, y - 4);
      return;
    }
    missStrike(x, y);
  });

  document.addEventListener("pointermove", event => {
    if (phase === "playing" && !pausedAt && event.pointerType === "mouse") {
      placeHammer(event.clientX, event.clientY);
    }
  }, { passive: true });

  document.addEventListener("pointerleave", () => hammer.classList.remove("visible"));
  window.addEventListener("resize", updateTargetPosition, { passive: true });

  function showCount(value, token) {
    return new Promise(resolve => {
      if (token !== runToken) return resolve();
      countdown.textContent = value;
      countdown.classList.remove("show");
      void countdown.offsetWidth;
      countdown.classList.add("show");
      tone(value === "开始" ? 650 : 330, .16, "sine", .04);
      setTimeout(resolve, 690);
    });
  }

  async function beginCountdown() {
    const token = ++runToken;
    ensureAudio();
    startPanel.classList.remove("is-visible");
    resultPanel.classList.remove("is-visible");
    pauseVeil.classList.remove("show");
    resetRound();
    phase = "countdown";
    for (const value of ["三", "二", "一", "开始"]) {
      await showCount(value, token);
      if (token !== runToken || document.hidden) return;
    }
    countdown.classList.remove("show");
    startRound();
  }

  function resetRound() {
    cancelAnimationFrame(rafId);
    clearAllTargets();
    feedbackLayer.replaceChildren();
    shell.classList.remove("rush");
    score = 0;
    combo = 0;
    maxCombo = 0;
    hits = 0;
    emptyStrikes = 0;
    opportunitiesShown = 0;
    targetSerial = 0;
    holeBag = [];
    lastHole = -1;
    inputLockedUntil = 0;
    pausedAt = 0;
    timeValue.textContent = "60";
    scoreValue.textContent = "0";
    updateCombo();
  }

  function startRound() {
    phase = "playing";
    startAt = performance.now();
    nextSpawnAt = startAt + 500;
    rafId = requestAnimationFrame(loop);
  }

  function loop(now) {
    if (phase !== "playing") return;
    if (pausedAt) {
      rafId = requestAnimationFrame(loop);
      return;
    }
    const elapsed = now - startAt;
    const remaining = Math.max(0, DURATION - elapsed);
    timeValue.textContent = String(Math.ceil(remaining / 1000));
    shell.classList.toggle("rush", remaining <= 5000);

    if (activeTarget?.state === "hittable" && now >= activeTarget.expiresAt) {
      beginTargetExit(now, false);
    }
    if (activeTarget && activeTarget.state !== "hittable" && now >= activeTarget.removeAt) {
      clearTarget(now);
    }
    if (!activeTarget && remaining > 450 && now >= nextSpawnAt) {
      revealTarget(now);
    }

    if (remaining <= 0) {
      finishRound();
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function setPaused(value) {
    if (phase !== "playing") return;
    if (value && !pausedAt) {
      pausedAt = performance.now();
      pauseVeil.classList.add("show");
      hammer.classList.remove("visible");
      liveRegion.textContent = "游戏已暂停";
      return;
    }
    if (!value && pausedAt) {
      const delta = performance.now() - pausedAt;
      startAt += delta;
      nextSpawnAt += delta;
      if (activeTarget) {
        activeTarget.expiresAt += delta;
        if (Number.isFinite(activeTarget.removeAt)) activeTarget.removeAt += delta;
      }
      pausedAt = 0;
      pauseVeil.classList.remove("show");
      liveRegion.textContent = "继续游戏";
    }
  }

  function quitToStart() {
    runToken += 1;
    phase = "ready";
    resetRound();
    pauseVeil.classList.remove("show");
    resultPanel.classList.remove("is-visible");
    startPanel.classList.add("is-visible");
    hammer.classList.remove("visible");
  }

  function finishRound() {
    phase = "ended";
    cancelAnimationFrame(rafId);
    clearAllTargets();
    shell.classList.remove("rush");
    timeValue.textContent = "0";
    hammer.classList.remove("visible");
    tone(500, .18, "sine", .045);
    setTimeout(() => tone(710, .23, "sine", .045), 100);

    const foundRate = opportunitiesShown ? Math.round((hits / opportunitiesShown) * 100) : 0;
    const strikeTotal = hits + emptyStrikes;
    const accuracy = strikeTotal ? Math.round((hits / strikeTotal) * 100) : 0;
    const oldBest = Number(localStorage.getItem("dadidou-best-v3") || 0);
    const best = Math.max(oldBest, score);
    localStorage.setItem("dadidou-best-v3", String(best));

    document.getElementById("resultTitle").textContent = "本局结束";
    document.getElementById("finalScore").textContent = String(score);
    document.getElementById("foundValue").textContent = `${hits} / ${opportunitiesShown}`;
    document.getElementById("accuracyValue").textContent = `${accuracy}%`;
    document.getElementById("maxComboValue").textContent = String(maxCombo);
    document.getElementById("bestScoreValue").textContent = String(best);
    liveRegion.textContent = `游戏结束，${score}分，命中${hits}次`;
    setTimeout(() => resultPanel.classList.add("is-visible"), 260);
  }

  document.addEventListener("keydown", event => {
    if (phase === "ready" && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      startButton.click();
      return;
    }
    if (phase === "ended" && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      replayButton.click();
      return;
    }
    if (phase === "playing" && (event.key === "Escape" || event.key.toLowerCase() === "p")) {
      event.preventDefault();
      setPaused(!pausedAt);
      return;
    }
    const key = Number(event.key);
    if (phase === "playing" && !pausedAt && key >= 1 && key <= 9) {
      const holeIndex = KEYPAD_TO_HOLE[key - 1];
      const hole = holes[holeIndex];
      const rect = hole.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height * .55;
      placeHammer(x, y, true, true);
      strikeHole(holeIndex, x, y);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return;
    if (phase === "countdown") {
      runToken += 1;
      phase = "ready";
      countdown.classList.remove("show");
      startPanel.classList.add("is-visible");
      return;
    }
    if (phase === "playing") setPaused(true);
  });

  startButton.addEventListener("click", beginCountdown);
  replayButton.addEventListener("click", beginCountdown);
  pauseButton.addEventListener("click", () => setPaused(true));
  resumeButton.addEventListener("click", () => setPaused(false));
  quitButton.addEventListener("click", quitToStart);
})();
