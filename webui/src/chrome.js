/**
 * App chrome shared by the shell: the M3 navigation bar (字型 / 介紹 / 關於).
 *
 * It is not a screen: it lives in the shell as a sibling of the screen stack
 * (like the FAB layer) so it never scrolls away.
 */

import { t } from "./i18n.js";
import { el, escapeHtml, icon } from "./ui.js";

export const TAB_IDS = ["menu", "readme", "about"];

const NAV_ITEMS = [
  { id: "menu", icon: "text_fields", labelKey: "navFonts" },
  { id: "readme", icon: "list", labelKey: "navIntro" },
  { id: "about", icon: "info", labelKey: "navAbout" },
];

/** Builds the shared navigation bar and wires its items to tab switching. */
export function buildNavBar(ctx) {
  const bar = el(`<nav class="nav-bar" data-nav-bar aria-label="${escapeHtml(t("appTitle"))}">
    ${NAV_ITEMS.map(
      (item) => `<button class="nav-item" data-nav="${item.id}" aria-label="${escapeHtml(t(item.labelKey))}">
        <span class="nav-indicator" aria-hidden="true"></span>
        ${icon(item.icon)}
        <span class="nav-label">${escapeHtml(t(item.labelKey))}</span>
      </button>`,
    ).join("")}
  </nav>`);
  for (const button of bar.querySelectorAll(".nav-item")) {
    button.addEventListener("click", () => ctx.actions.switchTab(button.dataset.nav));
  }
  return bar;
}

/** Shows the bar only on a top-level tab and marks the active destination. */
export function syncNavBar(bar, activeScreen) {
  if (!bar) return;
  const isTab = TAB_IDS.includes(activeScreen);
  bar.dataset.visible = String(isTab);
  for (const button of bar.querySelectorAll(".nav-item")) {
    button.classList.toggle("selected", isTab && button.dataset.nav === activeScreen);
  }
}
