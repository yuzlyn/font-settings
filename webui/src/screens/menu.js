/**
 * Root screen (主頁 / 字型設定): the five-row editing list plus a font preview
 * card, under a top app bar whose trailing power_settings_new button reboots the
 * device and whose leading arrow_back exits the WebUI.
 *
 * The menu has no floating action button: everything it needs is a row in the
 * list. The bottom navigation bar (字型 / 介紹 / 關於) is provided by the shell.
 */

import { t } from "../i18n.js";
import { el, escapeHtml, icon, listGroup, wireAppBarScroll } from "../ui.js";

const AUTHOR_URL = "https://github.com/yuzlyn";

/** The active Chinese font name shown in the preview card. */
function previewFontName(state) {
  const chain = state?.status?.chains?.chinese ?? [];
  const first = chain[0]?.displayName || chain[0]?.name;
  return first || "NotoSans TC";
}

export function buildMenuScreen(ctx) {
  const state = ctx.state;
  const screen = el(`<section class="screen" data-screen="menu">
    <header class="screen-header">
      <md-icon-button variant="tonal" data-back aria-label="${escapeHtml(t("exitWebui"))}">
        ${icon("arrow_back")}
      </md-icon-button>
      <h1 class="screen-title typescale-title-large">${escapeHtml(t("appTitle"))}</h1>
      <span class="spacer"></span>
      <md-icon-button variant="tonal" data-reboot aria-label="${escapeHtml(t("rebootFab"))}">
        ${icon("power_settings_new")}
      </md-icon-button>
    </header>
    <div class="screen-content">
      <h2 class="section-label typescale-title-medium-emphasized">${escapeHtml(t("sectionEdit"))}</h2>
      <div data-edit></div>
      <div class="elevated-card preview-card">
        <div class="preview-media" role="img" aria-label="${escapeHtml(t("fontPreview"))}">
          ${icon("text_fields")}
          <span class="preview-sample" aria-hidden="true">字 Aa 永</span>
        </div>
        <div class="preview-copy">
          <div class="typescale-title-medium-emphasized">${escapeHtml(t("fontPreview"))}</div>
          <div class="typescale-body-medium" data-preview-name></div>
        </div>
      </div>
    </div>
  </section>`);

  screen.querySelector("[data-back]").addEventListener("click", () => {
    if (history.length > 1) history.back();
    else window.close();
  });
  screen.querySelector("[data-reboot]").addEventListener("click", () => ctx.actions.reboot());

  /* ------------------------------------------------------------ edit group */
  const fallbackSwitch = el(`<md-switch ${state.status?.fallback ? "selected" : ""} aria-label="${escapeHtml(
    t("fallbackLabel"),
  )}"></md-switch>`);
  fallbackSwitch.addEventListener("click", (event) => event.stopPropagation());
  fallbackSwitch.addEventListener("change", () => ctx.actions.setFallback(Boolean(fallbackSwitch.selected)));

  const editGroup = listGroup([
    {
      headline: t("authorName"),
      supporting: t("authorSupport"),
      leading: "account_circle",
      leadingFilled: true,
      type: "link",
      onClick: () => window.open(AUTHOR_URL, "_blank", "noopener"),
    },
    {
      headline: t("chineseFont"),
      supporting: t("chineseSupport"),
      leading: "edit",
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
      leading: "sort",
      trailing: fallbackSwitch,
      onClick: () => fallbackSwitch.click(),
    },
  ]);
  screen.querySelector("[data-edit]").append(editGroup);

  const previewName = screen.querySelector("[data-preview-name]");

  function update(next) {
    const value = next.status?.fallback ?? true;
    fallbackSwitch.selected = value;
    previewName.textContent = t("fontPreviewFont", { name: previewFontName(next) });
  }

  update(state);
  screen.update = update;
  wireAppBarScroll(screen);
  return screen;
}
