const body = document.body;
const themeButton = document.querySelector(".light-switch");
const themeText = document.querySelector(".switch-text");

const readStorage = (key, fallback = null) => {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};

const writeStorage = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* storage can be unavailable */ }
};

const applyTheme = (theme) => {
  const matcha = theme === "matcha";
  body.classList.toggle("matcha-mode", matcha);
  if (themeButton) themeButton.setAttribute("aria-pressed", String(matcha));
  if (themeText) themeText.textContent = matcha ? "红豆模式" : "抹茶模式";
};

applyTheme(readStorage("annie-theme", "redbean"));

themeButton?.addEventListener("click", () => {
  const next = body.classList.contains("matcha-mode") ? "redbean" : "matcha";
  applyTheme(next);
  writeStorage("annie-theme", next);
});

document.querySelectorAll(".oshi-photo").forEach((photo) => {
  photo.addEventListener("error", () => {
    photo.hidden = true;
    photo.parentElement?.classList.add("no-photo");
  });
});

if (matchMedia("(pointer: fine)").matches) {
  window.addEventListener("pointermove", (event) => {
    document.documentElement.style.setProperty("--mouse-x", event.clientX + "px");
    document.documentElement.style.setProperty("--mouse-y", event.clientY + "px");
  }, { passive: true });
}

const filterButtons = document.querySelectorAll("[data-filter]");
const diaryEntries = document.querySelectorAll("[data-entry]");

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    filterButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    diaryEntries.forEach((entry) => {
      entry.hidden = filter !== "all" && entry.dataset.source !== filter;
    });
  });
});

const noticeMonthButtons = document.querySelectorAll(".month-card[data-notice-month]");
const noticeCards = document.querySelectorAll("[data-notice-card]");

noticeCards.forEach((card) => {
  card.addEventListener("click", (event) => {
    if (!event.target.closest("a")) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
});

noticeMonthButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const month = button.dataset.noticeMonth;
    noticeMonthButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    noticeCards.forEach((card) => {
      card.hidden = month !== "all" && card.dataset.noticeMonth !== month;
    });
  });
});

const literaryTabs = document.querySelectorAll("[data-literary-tab]");
const literaryPanels = document.querySelectorAll("[data-literary-panel]");

literaryTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.literaryTab;
    literaryTabs.forEach((item) => {
      const selected = item === tab;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    literaryPanels.forEach((panel) => {
      const selected = panel.dataset.literaryPanel === target;
      panel.hidden = !selected;
      panel.classList.toggle("active", selected);
    });
  });
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const tabs = [...literaryTabs];
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(tabs.indexOf(tab) + direction + tabs.length) % tabs.length];
    next.click();
    next.focus();
  });
});

document.querySelectorAll(".copy-color").forEach((button) => {
  button.addEventListener("click", async () => {
    const color = button.dataset.color;
    const label = button.querySelector("b");
    if (!color || !label) return;
    try {
      await navigator.clipboard.writeText(color);
      label.textContent = "已复制";
    } catch {
      label.textContent = "请长按色值";
    }
    window.setTimeout(() => { label.textContent = "复制色值"; }, 1600);
  });
});

const cheerButton = document.querySelector(".cheer-button");
const cheerLabel = cheerButton?.querySelector(".cheer-label");

const loveHero = document.querySelector(".love-hero");
const homeBento = document.querySelector(".home-bento");
const loveScroll = document.querySelector(".love-scroll");

if (loveHero && homeBento) {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let scrollLocked = false;
  const showPanel = (panel, immediate = false) => {
    const headerHeight = document.querySelector(".site-header")?.offsetHeight ?? 0;
    const top = panel === loveHero ? 0 : Math.max(0, panel.offsetTop - headerHeight);
    if (immediate || reducedMotion.matches) {
      const previousBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, top);
      document.documentElement.style.scrollBehavior = previousBehavior;
    } else {
      window.scrollTo({ top, behavior: "smooth" });
    }
    scrollLocked = true;
    window.setTimeout(() => { scrollLocked = false; }, immediate || reducedMotion.matches ? 50 : 650);
  };

  loveScroll?.addEventListener("click", (event) => {
    event.preventDefault();
    showPanel(homeBento);
  });

  window.addEventListener("wheel", (event) => {
    if (scrollLocked || Math.abs(event.deltaY) < 12 || event.ctrlKey) return;
    const onHero = window.scrollY < loveHero.offsetHeight / 2;
    const onBento = window.scrollY >= loveHero.offsetHeight / 2
      && window.scrollY < loveHero.offsetHeight + homeBento.offsetHeight;
    if (event.deltaY > 0 && onHero) {
      event.preventDefault();
      showPanel(homeBento);
    } else if (event.deltaY < 0 && onBento) {
      event.preventDefault();
      showPanel(loveHero);
    }
  }, { passive: false });

  if (location.hash === "#explore") {
    window.setTimeout(() => showPanel(homeBento, true), 50);
  }
}

cheerButton?.addEventListener("click", () => {
  const particles = ["✦", "♡", "✿", "✧", "·", "✦", "♡"];
  cheerButton.classList.remove("is-sent");
  void cheerButton.offsetWidth;
  cheerButton.classList.add("is-sent");
  if (cheerLabel) cheerLabel.textContent = "应援已送达 ✦";

  particles.forEach((symbol, index) => {
    const particle = document.createElement("i");
    particle.className = "cheer-particle";
    particle.textContent = symbol;
    particle.style.setProperty("--particle-x", `${(index - 3) * 42 + (index % 2 ? 10 : -8)}px`);
    particle.style.setProperty("--particle-y", `${-28 - (index % 3) * 19}px`);
    particle.style.setProperty("--particle-rotate", `${(index - 3) * 28}deg`);
    particle.style.setProperty("--particle-size", `${.75 + (index % 3) * .2}rem`);
    particle.style.setProperty("--particle-color", index % 2 ? "var(--blush)" : "var(--cream)");
    particle.addEventListener("animationend", () => particle.remove(), { once: true });
    cheerButton.append(particle);
  });

  window.clearTimeout(cheerButton.resetTimer);
  cheerButton.resetTimer = window.setTimeout(() => {
    cheerButton.classList.remove("is-sent");
    if (cheerLabel) cheerLabel.textContent = "为安妮应援";
  }, 1400);
});
