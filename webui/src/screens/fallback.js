/** Glyph fallback setting screen. */

import { t } from "../i18n.js";
import { el, escapeHtml, icon } from "../ui.js";

export function buildFallbackScreen(ctx) {
  const enabled = ctx.state.status?.fallback ?? true;
  const screen = el(`<section class="screen" data-screen="fallback">
    <header class="screen-header">
      <div class="screen-header-row">
        <md-icon-button variant="tonal" data-back aria-label="${escapeHtml(t("appTitle"))}">
          ${icon("arrow_back")}
        </md-icon-button>
      </div>
      <h1 class="screen-title typescale-headline-medium-emphasized">${escapeHtml(t("fallbackLabel"))}</h1>
    </header>
    <div class="screen-content">
      <div class="role-card">
        <div class="role-card-head">
          <div>
            <div class="typescale-title-medium-emphasized">${escapeHtml(t("fallbackLabel"))}</div>
            <p class="typescale-body-medium" data-state>${escapeHtml(
              enabled ? t("fallbackOnDetail") : t("fallbackOffDetail"),
            )}</p>
          </div>
          <md-switch ${enabled ? "selected" : ""} aria-label="${escapeHtml(t("fallbackLabel"))}"></md-switch>
        </div>
        <p class="typescale-body-medium">${escapeHtml(t("fallbackScreenHint"))}</p>
      </div>
    </div>
  </section>`);

  screen.querySelector("[data-back]").addEventListener("click", () => ctx.actions.back());
  const toggle = screen.querySelector("md-switch");
  toggle.addEventListener("change", () => ctx.actions.setFallback(Boolean(toggle.selected)));

  screen.update = (state) => {
    const value = state.status?.fallback ?? true;
    toggle.selected = value;
    screen.querySelector("[data-state]").textContent = value ? t("fallbackOnDetail") : t("fallbackOffDetail");
  };

  return screen;
}
