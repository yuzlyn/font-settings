/**
 * Fonts tab (字型設定): the live preview of the active chains above the list of
 * editing destinations, under a large app bar whose actions exit the WebUI and
 * restart the device.
 *
 * The screen patches itself in place: `update(state)` only rewrites text and the
 * fallback switch, never the list structure.
 */

import { t } from "../i18n.js";
import { createSwitch, el, escapeHtml, icon, listGroup, wireAppBarScroll } from "../ui.js";

const SAMPLE = "永字八法 Aa 0123";

/** Names of the chains, or a "system default" notice when a chain is empty. */
function chainNames(state) {
  const chinese = state?.status?.chains?.chinese ?? [];
  const western = state?.status?.chains?.western ?? [];
  return {
    chinese: chinese[0]?.displayName || "",
    western: western[0]?.displayName || "",
    count: chinese.length + western.length,
  };
}

export function buildMenuScreen(ctx) {
  const state = ctx.state;

  const screen = el(`<section class="screen" data-screen="menu">
    <header class="app-bar" data-app-bar>
      <span class="app-emblem" aria-hidden="true">${icon("text_fields")}</span>
      <h1 class="app-bar-title">${escapeHtml(t("appTitle"))}</h1>
      <span class="spacer"></span>
      <button class="icon-btn" type="button" data-exit aria-label="${escapeHtml(t("exitWebui"))}">
        ${icon("logout")}
      </button>
      <button class="icon-btn" type="button" data-reboot aria-label="${escapeHtml(t("rebootFab"))}">
        ${icon("power_settings_new")}
      </button>
    </header>

    <div class="screen-content">
      <div class="hero">
        <div class="hero-eyebrow">
          <span class="t-label">Font Settings</span>
          <span class="t-label" data-version></span>
        </div>
        <h2 class="hero-title t-display">${escapeHtml(t("appTitle"))}</h2>
        <p class="hero-sub t-body">${escapeHtml(t("heroSubtitle"))}</p>
        <div class="chip-row" data-chips>
          <span class="chip" data-tone="primary">
            ${icon("bolt")}<span data-bridge></span>
          </span>
          <span class="chip" data-count></span>
          <span class="chip" data-tone="secondary" data-pending hidden>
            ${icon("autorenew")}<span>${escapeHtml(t("statusPending"))}</span>
          </span>
        </div>
      </div>

      <section class="card preview" data-tone="container">
        <div class="card-head">
          <div class="card-copy">
            <h3 class="card-title t-title">${escapeHtml(t("fontPreview"))}</h3>
            <span class="t-support" data-preview-caption></span>
          </div>
        </div>
        <div class="preview-canvas">
          <div class="preview-sample" aria-hidden="true">${SAMPLE}</div>
        </div>
        <div class="preview-meta">
          <div class="preview-meta-row">
            <span class="preview-meta-label t-support">${escapeHtml(t("chineseRole"))}</span>
            <span class="preview-meta-value" data-chinese></span>
          </div>
          <div class="preview-meta-row">
            <span class="preview-meta-label t-support">${escapeHtml(t("latinRole"))}</span>
            <span class="preview-meta-value" data-western></span>
          </div>
        </div>
      </section>

      <div>
        <h3 class="section-title">${escapeHtml(t("sectionEdit"))}</h3>
        <div data-edit></div>
      </div>
    </div>
  </section>`);

  screen.querySelector("[data-exit]").addEventListener("click", () => {
    if (history.length > 1) history.back();
    else window.close();
  });
  screen.querySelector("[data-reboot]").addEventListener("click", () => ctx.actions.reboot());

  const fallbackSwitch = createSwitch({
    selected: Boolean(state.status?.fallback),
    ariaLabel: t("fallbackLabel"),
    onChange: (selected) => ctx.actions.setFallback(selected),
  });

  const editGroup = listGroup([
    {
      headline: t("chineseFont"),
      supporting: t("chineseSupport"),
      leading: "translate",
      onClick: () => ctx.actions.navigate("chinese", { direction: "right" }),
    },
    {
      headline: t("latinFont"),
      supporting: t("latinSupport"),
      leading: "language",
      onClick: () => ctx.actions.navigate("latin", { direction: "right" }),
    },
    {
      headline: t("emojiSettings"),
      supporting: t("emojiSupport"),
      leading: "mood",
      onClick: () => ctx.actions.navigate("emoji", { direction: "right" }),
    },
    {
      headline: t("fallbackLabel"),
      supporting: t("fallbackSupport"),
      leading: "call_split",
      trailing: fallbackSwitch,
    },
  ]);

  // Tapping anywhere on the fallback row toggles it, but a tap on the switch
  // itself must not be applied twice (it would toggle back).
  const fallbackRow = editGroup.lastElementChild;
  fallbackRow.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest(".switch")) return;
    fallbackSwitch.click();
  });

  screen.querySelector("[data-edit]").append(editGroup);

  const versionHost = screen.querySelector("[data-version]");
  const bridgeHost = screen.querySelector("[data-bridge]");
  const countChip = screen.querySelector("[data-count]");
  const pendingChip = screen.querySelector("[data-pending]");
  const caption = screen.querySelector("[data-preview-caption]");
  const chineseHost = screen.querySelector("[data-chinese]");
  const westernHost = screen.querySelector("[data-western]");

  function update(next) {
    const names = chainNames(next);
    fallbackSwitch.selected = Boolean(next.status?.fallback);

    versionHost.textContent = next.moduleVersion || "";
    bridgeHost.textContent = t(ctx.actions.bridgeLabelKey());

    if (names.count > 0) {
      countChip.hidden = false;
      countChip.textContent = t("fontCountUnitCount", { count: names.count });
    } else {
      countChip.hidden = true;
    }

    pendingChip.hidden = !next.status?.pendingReboot;

    caption.textContent = t("fontPreviewFont", { name: names.chinese || t("fontCountEmpty") });
    chineseHost.textContent = names.chinese || t("fontCountEmpty");
    westernHost.textContent = names.western || t("fontCountEmpty");
  }

  update(state);
  screen.update = update;
  wireAppBarScroll(screen);
  return screen;
}
