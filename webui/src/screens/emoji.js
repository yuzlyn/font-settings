/**
 * Emoji settings screen: an elevated "Emoji 設定" card (enable switch + outlined
 * source dropdown) above an elevated preview card, under the shared top app bar.
 *
 * The switch is a master toggle that maps onto the module's emoji mode (off =
 * system default, on = the font chosen in the dropdown); picking "自訂檔案"
 * opens the upload flow. Everything reads from and writes back to the real
 * device state via the module bridge.
 */

import { t } from "../i18n.js";
import { EMOJI_PRESETS, formatBytes } from "../module-api.js";
import { el, escapeHtml, icon, wireAppBarScroll } from "../ui.js";

/** A stable fallback when the module has not reported its status yet. */
function emojiState(state) {
  return state?.status?.emoji ?? {
    mode: "default",
    availability: { ios: true, google: true, blobmoji: true, facebook: true },
    customSize: 0,
    customName: "",
    target: "",
  };
}

function presetName(preset) {
  return preset.nameKey ? t(preset.nameKey) : preset.name;
}

/** The preset order: the spec's system / Google / Blobmoji first. */
const OPTION_ORDER = ["default", "google", "blobmoji", "ios", "facebook", "custom"];

function targetText(emoji) {
  const mode = emoji.mode || "default";
  if (mode === "default") return t("emojiDefaultDetail");
  if (mode === "custom") {
    if (emoji.customSize > 0) {
      return `${t("emojiCustomName")} · ${emoji.customName || t("emojiTargetUnknown")} · ${formatBytes(
        emoji.customSize,
      )}`;
    }
    return t("chooseTtfOrOtf");
  }
  const preset = EMOJI_PRESETS.find((item) => item.mode === mode);
  const name = preset ? presetName(preset) : mode;
  return t("emojiTarget", { target: emoji.target ? `${name}（${emoji.target}）` : name });
}

/** First available built-in preset, used when the switch is turned on blindly. */
function defaultSelection(emoji) {
  for (const mode of OPTION_ORDER) {
    if (mode === "default" || mode === "custom") continue;
    if (emoji.availability[mode] !== false) return mode;
  }
  return "google";
}

export function buildEmojiScreen(ctx) {
  let current = emojiState(ctx.state);

  const screen = el(`<section class="screen" data-screen="emoji">
    <header class="screen-header">
      <md-icon-button variant="tonal" data-back aria-label="${escapeHtml(t("appTitle"))}">
        ${icon("arrow_back")}
      </md-icon-button>
      <h1 class="screen-title typescale-title-large">${escapeHtml(t("emojiTitle"))}</h1>
    </header>
    <div class="screen-content">
      <div class="elevated-card emoji-settings-card">
        <div class="emoji-settings-head">
          <div class="emoji-settings-copy">
            <div class="typescale-title-medium-emphasized">${escapeHtml(t("emojiSettings"))}</div>
            <div class="typescale-body-medium">${escapeHtml(t("emojiScreenHint"))}</div>
          </div>
          <md-switch data-enable aria-label="${escapeHtml(t("emojiEnableAria"))}"></md-switch>
        </div>
        <md-outlined-select class="emoji-select" data-mode label="${escapeHtml(t("emojiSelectLabel"))}">
          <md-icon slot="leading-icon">tag_faces</md-icon>
          <md-icon slot="trailing-icon">arrow_drop_down</md-icon>
          ${OPTION_ORDER.map((mode) => {
            const preset = EMOJI_PRESETS.find((item) => item.mode === mode);
            if (!preset) return "";
            return `<md-select-option value="${mode}"><div slot="headline">${escapeHtml(
              presetName(preset),
            )}</div></md-select-option>`;
          }).join("")}
        </md-outlined-select>
      </div>
      <div class="elevated-card emoji-preview-card">
        <div class="emoji-preview-media" role="img" aria-label="${escapeHtml(t("emojiPreview"))}">
          ${icon("insert_emoticon")}
          <span class="emoji-preview-sample" aria-hidden="true">😀🎉🚀❤️✨</span>
        </div>
        <div class="emoji-preview-copy">
          <div class="typescale-title-medium-emphasized">${escapeHtml(t("emojiPreview"))}</div>
          <div class="typescale-body-medium" data-target></div>
        </div>
      </div>
    </div>
  </section>`);

  screen.querySelector("[data-back]").addEventListener("click", () => ctx.actions.back());

  const switchEl = screen.querySelector("[data-enable]");
  const select = screen.querySelector("[data-mode]");
  const targetHost = screen.querySelector("[data-target]");

  function render(next) {
    current = next;
    targetHost.textContent = targetText(next);
    const active = next.mode !== "default" && Boolean(next.mode);
    switchEl.selected = active;
    select.value = next.mode || "default";
    for (const option of select.querySelectorAll("md-select-option")) {
      const preset = EMOJI_PRESETS.find((item) => item.mode === option.value);
      if (preset && preset.mode !== "default" && preset.mode !== "custom") {
        option.disabled = next.availability[preset.mode] === false;
      }
    }
  }

  /* The switch flips between "system default" and the chosen source. */
  switchEl.addEventListener("click", (event) => event.stopPropagation());
  switchEl.addEventListener("change", () => {
    if (switchEl.selected) {
      const chosen = select.value && select.value !== "default" ? select.value : defaultSelection(current);
      ctx.actions.setEmoji(chosen);
    } else {
      ctx.actions.setEmoji("default");
    }
  });

  /* Picking a source applies it; "自訂檔案" opens the upload flow instead. */
  select.addEventListener("change", () => {
    const next = select.value;
    if (next === "custom") {
      select.value = current.mode || "default";
      ctx.actions.setEmoji("custom");
      return;
    }
    ctx.actions.setEmoji(next);
  });

  let signature = null;
  function update(nextState) {
    const next = emojiState(nextState);
    const sig = `${next.mode}|${next.target}|${next.customSize}|${JSON.stringify(next.availability)}`;
    if (sig === signature) return;
    signature = sig;
    render(next);
    const busy = Boolean(nextState.busy);
    switchEl.disabled = busy;
    select.disabled = busy;
  }

  screen.update = update;
  wireAppBarScroll(screen);
  return screen;
}
