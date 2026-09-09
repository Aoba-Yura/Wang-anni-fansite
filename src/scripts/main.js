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

const noticeMonthButtons = document.querySelectorAll("[data-notice-month]");
const noticeCards = document.querySelectorAll("[data-notice-card]");

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
const cheerCount = document.querySelector(".cheer-count");
let cheers = Number.parseInt(readStorage("annie-cheers", "0"), 10) || 0;

if (cheerCount) cheerCount.textContent = "♡ " + String(cheers).padStart(3, "0");

cheerButton?.addEventListener("click", () => {
  cheers += 1;
  writeStorage("annie-cheers", String(cheers));
  if (cheerCount) cheerCount.textContent = "♥ " + String(cheers).padStart(3, "0");
  cheerButton.animate(
    [
      { transform: "translateY(0) scale(1)" },
      { transform: "translateY(-3px) scale(1.025)" },
      { transform: "translateY(0) scale(1)" }
    ],
    { duration: 280, easing: "ease-out" }
  );
});
