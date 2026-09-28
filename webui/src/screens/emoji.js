/** Emoji mapping screen. */

import { t } from "../i18n.js";
import { EMOJI_PRESETS, formatBytes } from "../module-api.js";
import { el, escapeHtml, icon, showMessage } from "../ui.js";

function presetLabel(preset) {
  return preset.nameKey ? t(preset.nameKey) : preset.name;
}

function presetDetail(preset, emojiState) {
  if (preset.mode === "default") return t("emojiDefaultDetail");
  if (preset.mode === "custom") {
    if (emojiState.customSize > 0) {
      return `${emojiState.customName || t("emojiCustomName")} · ${formatBytes(emojiState.customSize)}`;
    }
    return t("chooseTtfOrOtf");
  }
  const available = emojiState.availability[preset.mode];
  return available ? preset.detail : `${preset.detail}${t("emojiMissing")}`;
}

export function buildEmojiScreen(ctx) {
  const state = ctx.state;
  const emojiState = state.status?.emoji ?? {
    mode: "default",
    availability: { default: true, custom: true },
    customSize: 0,
    customName: "",
    target: "",
  };

  const screen = el(`<section class="screen" data-screen="emoji">
    <header class="screen-header">
      <div class="screen-header-row">
        <md-icon-button variant="tonal" data-back aria-label="${escapeHtml(t("appTitle"))}">
          ${icon("arrow_back")}
        </md-icon-button>
      </div>
      <h1 class="screen-title typescale-headline-medium-emphasized">${escapeHtml(t("emojiSettings"))}</h1>
    </header>
    <div class="screen-content">
      <p class="typescale-body-medium">${escapeHtml(t("emojiScreenHint"))}</p>
      <div data-presets></div>
      <p class="typescale-body-medium text-muted" data-target></p>
    </div>
  </section>`);

  screen.querySelector("[data-back]").addEventListener("click", () => ctx.actions.back());

  const group = el('<div class="list-group"></div>');
  screen.querySelector("[data-presets]").append(group);
  const target = screen.querySelector("[data-target]");

  let signature = null;

  function update(state) {
    const current = state.status?.emoji ?? emojiState;
    const next = `${current.mode}|${current.customSize}|${current.target}|${JSON.stringify(current.availability)}`;
    if (next === signature) return;
    signature = next;
    group.textContent = "";
    EMOJI_PRESETS.forEach((preset, index) => {
      const available = preset.mode === "custom" ? true : current.availability[preset.mode] !== false;
      const selected = current.mode === preset.mode;
      const row = el(`<md-list-item type="button" data-shape="${
        index === 0 ? "first" : index === EMOJI_PRESETS.length - 1 ? "last" : "middle"
      }" ${available ? "" : "disabled"}>
        <div slot="headline" class="typescale-body-large">${escapeHtml(presetLabel(preset))}</div>
        <div slot="supporting-text" class="typescale-body-medium">${escapeHtml(presetDetail(preset, current))}</div>
        <div slot="end" class="list-trailing">
          <span class="emoji-preview-icon" aria-hidden="true">${preset.preview}</span>
          ${selected ? icon("check", { filled: true }) : ""}
        </div>
      </md-list-item>`);
      row.addEventListener("click", () => ctx.actions.setEmoji(preset.mode));
      group.append(row);
    });
    target.textContent = t("emojiTarget", {
      target: current.target || t("emojiTargetUnknown"),
    });
  }

  update(ctx.state);
  screen.update = update;
  return screen;
}

/** Small helper used by the Emoji flow to report a missing custom file. */
export function reportEmojiEmpty() {
  showMessage(t("emojiCustomEmpty"));
}
