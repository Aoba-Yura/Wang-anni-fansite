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
  if (themeText) themeText.innerHTML = matcha ? '<b>红豆模式</b><small lang="ja">小豆モード</small>' : '<b>抹茶模式</b><small lang="ja">抹茶モード</small>';
};

applyTheme(readStorage("annie-theme", "redbean"));

themeButton?.addEventListener("click", () => {
  const next = body.classList.contains("matcha-mode") ? "redbean" : "matcha";
  applyTheme(next);
  writeStorage("annie-theme", next);
});

const disclaimerDialog = document.querySelector("[data-disclaimer-dialog]");
const disclaimerOpen = document.querySelector("[data-disclaimer-open]");
const disclaimerClose = document.querySelector("[data-disclaimer-close]");
const disclaimerTitle = document.querySelector("[data-disclaimer-title]");
const disclaimerTabs = [...document.querySelectorAll("[data-disclaimer-tab]")];
const disclaimerPanels = [...document.querySelectorAll("[data-disclaimer-panel]")];
const disclaimerTitles = { zh: "免责声明", ja: "免責事項", en: "Disclaimer" };

const selectDisclaimerLanguage = (language, focus = false) => {
  if (disclaimerTitle) disclaimerTitle.textContent = disclaimerTitles[language] ?? disclaimerTitles.zh;
  disclaimerTabs.forEach((tab) => {
    const selected = tab.dataset.disclaimerTab === language;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
  disclaimerPanels.forEach((panel) => {
    panel.hidden = panel.dataset.disclaimerPanel !== language;
  });
};

disclaimerOpen?.addEventListener("click", () => {
  if (typeof disclaimerDialog?.showModal === "function") disclaimerDialog.showModal();
});

disclaimerClose?.addEventListener("click", () => disclaimerDialog?.close());
disclaimerDialog?.addEventListener("click", (event) => {
  if (event.target === disclaimerDialog) disclaimerDialog.close();
});

disclaimerTabs.forEach((tab) => {
  tab.addEventListener("click", () => selectDisclaimerLanguage(tab.dataset.disclaimerTab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = disclaimerTabs.indexOf(tab);
    const next = event.key === "Home" ? 0
      : event.key === "End" ? disclaimerTabs.length - 1
      : (current + (event.key === "ArrowRight" ? 1 : -1) + disclaimerTabs.length) % disclaimerTabs.length;
    selectDisclaimerLanguage(disclaimerTabs[next].dataset.disclaimerTab, true);
  });
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

const diaryList = document.querySelector("[data-diary-list]");
if (diaryList) {
  const countLabel = document.querySelector("[data-diary-count]");
  const platformNames = { weibo: "微博", bilibili: "哔哩哔哩", haokan: "好看视频", official: "官方记录" };
  const platformNamesJa = { weibo: "Weibo", bilibili: "ビリビリ", haokan: "動画", official: "公式記録" };
  const kindNamesJa = { "原创短引": "本人投稿・抜粋", "原创视频": "本人動画", "官方提及": "公式言及", "官方记录": "公式記録", "官方视频": "公式動画", "视频记录": "動画記録", "现场视频": "ライブ映像", "视频合集": "動画まとめ" };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  const renderDiary = (items) => {
    countLabel.textContent = items.length;
    diaryList.innerHTML = items.map((item, index) => {
      const date = new Date(`${item.date}T00:00:00`);
      const year = date.getFullYear();
      const monthDay = `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
      return `<article class="diary-entry" data-entry data-source="${escapeHtml(item.platform)}">
        <div class="entry-date"><time datetime="${escapeHtml(item.date)}">${year}<br><b>${monthDay}</b></time><span>${escapeHtml(platformNames[item.platform] || item.platform)}<small lang="ja">${escapeHtml(platformNamesJa[item.platform] || "")}</small></span></div>
        <div class="entry-copy"><p class="entry-tag">${escapeHtml(item.tag)} · <span>${escapeHtml(item.kind || "公开记录")}<small lang="ja">${escapeHtml(kindNamesJa[item.kind] || "公開記録")}</small></span></p><h2>${escapeHtml(item.title)}</h2>${item.excerpt ? `<blockquote>“${escapeHtml(item.excerpt)}”</blockquote>` : ""}<a href="${escapeHtml(item.source)}" target="_blank" rel="noreferrer"><span>查看原动态</span><small lang="ja">元の投稿を見る</small> ↗</a></div>
      </article>`;
    }).join("");
  };
  const loadDiary = () => {
    const embedded = document.querySelector("#diary-data");
    if (embedded?.textContent) return Promise.resolve(JSON.parse(embedded.textContent));
    return fetch("../data/diary.json").then((response) => {
      if (!response.ok) throw new Error("diary data unavailable");
      return response.json();
    });
  };
  loadDiary().then((items) => {
    items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    renderDiary(items);
    document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => { const selected = item === button; item.classList.toggle("active", selected); item.setAttribute("aria-pressed", String(selected)); });
      document.querySelectorAll("[data-entry]").forEach((entry) => { entry.hidden = filter !== "all" && entry.dataset.source !== filter; });
    }));
  }).catch(() => { diaryList.innerHTML = '<p class="source-note">日志资料暂时无法载入。<small lang="ja">日記データを読み込めませんでした。</small></p>'; });
}

const noticeList = document.querySelector("[data-notice-list]");
if (noticeList) {
  const monthList = document.querySelector("[data-notice-months]");
  const updated = document.querySelector("[data-notice-updated]");
  const escapeNotice = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
  const embedded = document.querySelector("#notice-data");
  const loadNotices = embedded?.textContent
    ? Promise.resolve(JSON.parse(embedded.textContent))
    : fetch("../data/notices.json").then((response) => response.json());

  loadNotices.then((data) => {
    const items = [...data.items].sort((a, b) => b.date.localeCompare(a.date));
    const months = [...new Set(items.map((item) => item.date.slice(0, 7)))];
    monthList.innerHTML = `<button class="month-card active" type="button" data-notice-month="all" aria-pressed="true"><b>ALL</b><span>全部<small lang="ja">すべて</small></span></button>${months.map((month) => {
      const [year, number] = month.split("-");
      return `<button class="month-card" type="button" data-notice-month="${month}" aria-pressed="false"><b>${number}</b><span>${year} · ${monthNames[Number(number) - 1]}<small lang="ja">${Number(number)}月</small></span></button>`;
    }).join("")}`;
    noticeList.innerHTML = items.map((item) => {
      const classes = ["notice-card", `notice-card--${item.theme || "paper"}`, item.size ? `notice-card--${item.size}` : "", item.tilt ? `notice-card--tilt-${item.tilt}` : ""].filter(Boolean).join(" ");
      return `<article class="${classes}" data-notice-card data-notice-month="${item.date.slice(0, 7)}"><i class="pushpin" aria-hidden="true"></i><div class="notice-card-top"><span class="notice-label">${escapeNotice(item.label)}${item.labelJa ? `<small lang="ja">${escapeNotice(item.labelJa)}</small>` : ""}</span><time datetime="${escapeNotice(item.date)}">${escapeNotice(item.displayDate || item.date.replaceAll("-", "."))}</time></div><h3>${escapeNotice(item.title)}</h3><p>${escapeNotice(item.body)}</p>${item.href ? `<a href="${escapeNotice(item.href)}"><span>${escapeNotice(item.linkLabel || "查看详情 ↗")}</span></a>` : ""}${item.signature ? `<span class="notice-signature">${escapeNotice(item.signature)}</span>` : ""}${item.stamp ? `<span class="notice-stamp">${escapeNotice(item.stamp)}</span>` : ""}${item.doodle ? `<span class="notice-doodle" aria-hidden="true">${escapeNotice(item.doodle)}</span>` : ""}</article>`;
    }).join("");
    if (updated) updated.innerHTML = `最后更新：${String(data.updated || "").replaceAll("-", ".")} <small lang="ja">最終更新</small>`;

    const buttons = [...document.querySelectorAll(".month-card[data-notice-month]")];
    const cards = [...document.querySelectorAll("[data-notice-card]")];
    buttons.forEach((button) => button.addEventListener("click", () => {
      const month = button.dataset.noticeMonth;
      buttons.forEach((item) => { const selected = item === button; item.classList.toggle("active", selected); item.setAttribute("aria-pressed", String(selected)); });
      cards.forEach((card) => { card.hidden = month !== "all" && card.dataset.noticeMonth !== month; });
    }));
  }).catch(() => { noticeList.innerHTML = '<p class="source-note">公告暂时无法载入。<small lang="ja">お知らせを読み込めませんでした。</small></p>'; });
}

const literaryTabsRoot = document.querySelector("[data-literary-tabs]");
const literaryPanelsRoot = document.querySelector("[data-literary-panels]");

if (literaryTabsRoot && literaryPanelsRoot) {
  const escapeLiterary = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  const renderLiterary = ({ items }) => {
    literaryTabsRoot.innerHTML = items.map((item, index) => `<button class="${index === 0 ? "active" : ""}" id="${escapeLiterary(item.id)}-tab" type="button" role="tab" aria-selected="${index === 0}" aria-controls="${escapeLiterary(item.id)}-panel" ${index === 0 ? "" : 'tabindex="-1"'} data-literary-tab="${escapeLiterary(item.id)}"><span>${String(index + 1).padStart(2, "0")}</span><b>${escapeLiterary(item.tabTitle)}</b><small lang="ja">${escapeLiterary(item.tabTitleJa)}</small></button>`).join("");
    literaryPanelsRoot.innerHTML = items.map((item, index) => {
      const copyClass = item.kind === "prose" ? "prose-text" : "poem-text";
      const copy = item.paragraphs.map((lines) => `<p>${lines.map(escapeLiterary).join("<br>")}</p>`).join("");
      const links = (item.links || []).map((link) => `<a href="${escapeLiterary(link.href)}" target="_blank" rel="noreferrer">${escapeLiterary(link.label)}</a>`).join("　");
      const footer = `${escapeLiterary(item.footerLabel)}${item.footerLabelJa ? ` <small lang="ja">${escapeLiterary(item.footerLabelJa)}</small>` : ""}${escapeLiterary(item.footerText || (item.footerLabel?.endsWith("：") ? "" : "："))}${links}`;
      return `<article class="literary-panel ${index === 0 ? "active" : ""} ${item.id === "bangs" ? "bangs-panel" : ""}" id="${escapeLiterary(item.id)}-panel" role="tabpanel" aria-labelledby="${escapeLiterary(item.id)}-tab" data-literary-panel="${escapeLiterary(item.id)}" ${index === 0 ? "" : "hidden"}><div class="work-meta"><span>${escapeLiterary(item.meta)} <small lang="ja">${escapeLiterary(item.metaJa)}</small></span><time datetime="${escapeLiterary(item.date)}">${escapeLiterary(item.date.replaceAll("-", "."))}</time></div><h2${index === 0 ? ' id="literary-title"' : ""}>${escapeLiterary(item.title)}</h2>${item.kind === "poem" ? `<div class="poem-layout"><div class="${copyClass}"${item.language ? ` lang="${escapeLiterary(item.language)}"` : ""}>${copy}</div></div>` : `<div class="${copyClass}">${copy}</div>`}<p class="inspiration">${footer}</p></article>`;
    }).join("");

    const literaryTabs = [...literaryTabsRoot.querySelectorAll("[data-literary-tab]")];
    const literaryPanels = [...literaryPanelsRoot.querySelectorAll("[data-literary-panel]")];
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
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const current = literaryTabs.indexOf(tab);
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? literaryTabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + literaryTabs.length) % literaryTabs.length;
        literaryTabs[nextIndex].click();
        literaryTabs[nextIndex].focus();
      });
    });
  };
  const embedded = document.querySelector("#hymn-data");
  const loadHymns = embedded?.textContent
    ? Promise.resolve(JSON.parse(embedded.textContent))
    : fetch("../data/hymns.json").then((response) => {
        if (!response.ok) throw new Error("hymn data unavailable");
        return response.json();
      });
  loadHymns.then(renderLiterary).catch(() => {
    literaryPanelsRoot.innerHTML = '<p class="source-note">安妮颂暂时无法载入。<small lang="ja">賛歌を読み込めませんでした。</small></p>';
  });
}

document.querySelectorAll(".copy-color").forEach((button) => {
  button.addEventListener("click", async () => {
    const color = button.dataset.color;
    const label = button.querySelector("b");
    if (!color || !label) return;
    try {
      await navigator.clipboard.writeText(color);
      label.innerHTML = '已复制<small lang="ja">コピー済み</small>';
    } catch {
      label.innerHTML = '请长按色值<small lang="ja">長押ししてください</small>';
    }
    window.setTimeout(() => { label.innerHTML = '复制色值<small lang="ja">色コードをコピー</small>'; }, 1600);
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
  if (cheerLabel) cheerLabel.innerHTML = '应援已送达 ✦<small lang="ja">応援を届けました</small>';

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
    if (cheerLabel) cheerLabel.innerHTML = '为安妮应援<small lang="ja">安妮を応援する</small>';
  }, 1400);
});
