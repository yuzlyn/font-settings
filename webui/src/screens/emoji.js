/**
 * Emoji settings screen: a master switch for overriding the system Emoji font,
 * a source picker (bottom sheet) and a preview card.
 *
 * The switch maps onto the module's emoji mode (off = system default, on = the
 * chosen source); picking 自訂檔案 starts the normal upload flow. Everything
 * reads from and writes back to the real device state through the bridge.
 */

import { t } from "../i18n.js";
import { EMOJI_PRESETS, formatBytes } from "../module-api.js";
import { createSwitch, el, escapeHtml, icon, sheet, wireAppBarScroll } from "../ui.js";

const OPTION_ORDER = ["default", "google", "blobmoji", "ios", "facebook", "custom"];

/** A stable fallback when the module has not reported its status yet. */
function emojiState(state) {
  return state?.status?.emoji ?? {
    mode: "default",
    target: "",
    customSize: 0,
    customName: "",
    availability: { default: true, ios: true, google: true, blobmoji: true, facebook: true, custom: true },
  };
}

function presetName(preset) {
  return preset.nameKey ? t(preset.nameKey) : preset.name;
}

function presetDetail(preset, emoji) {
  if (preset.mode === "custom") {
    if (emoji.customSize > 0) return `${emoji.customName || t("emojiCustomName")} · ${formatBytes(emoji.customSize)}`;
    return t("chooseTtfOrOtf");
  }
  const detail = preset.detailKey ? t(preset.detailKey) : preset.detail;
  const available = emoji.availability?.[preset.mode] !== false;
  return available ? detail : `${detail}${t("emojiMissing")}`;
}

function targetText(emoji) {
  const mode = emoji.mode || "default";
  if (mode === "default") return t("emojiDefaultDetail");
  if (mode === "custom") {
    if (emoji.customSize > 0) {
      return `${t("emojiCustomName")} · ${emoji.customName || t("emojiTargetUnknown")} · ${formatBytes(emoji.customSize)}`;
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
    if (emoji.availability?.[mode] !== false) return mode;
  }
  return "google";
}

function currentName(emoji) {
  const preset = EMOJI_PRESETS.find((item) => item.mode === (emoji.mode || "default"));
  return preset ? presetName(preset) : t("emojiDefaultName");
}

export function buildEmojiScreen(ctx) {
  let current = emojiState(ctx.state);

  const screen = el(`<section class="screen" data-screen="emoji">
    <header class="app-bar">
      <button class="icon-btn" type="button" data-back aria-label="${escapeHtml(t("appTitle"))}">
        ${icon("arrow_back")}
      </button>
      <h1 class="app-bar-title">${escapeHtml(t("emojiTitle"))}</h1>
    </header>

    <div class="screen-content">
      <div class="hero">
        <h2 class="hero-title t-headline">${escapeHtml(t("emojiSettings"))}</h2>
        <p class="hero-sub t-body">${escapeHtml(t("emojiScreenHint"))}</p>
      </div>

      <section class="card" data-tone="container">
        <div class="card-head">
          <div class="card-copy">
            <h3 class="card-title t-title">${escapeHtml(t("emojiOverride"))}</h3>
            <span class="t-support">${escapeHtml(t("emojiSupport"))}</span>
          </div>
          <span data-enable></span>
        </div>
        <button class="select-row" type="button" data-source>
          <span class="select-copy">
            <span class="select-label">${escapeHtml(t("emojiSourceLabel"))}</span>
            <span class="select-value" data-source-name></span>
          </span>
          ${icon("arrow_drop_down")}
        </button>
      </section>

      <section class="card" data-tone="container">
        <div class="preview-canvas">
          <div class="preview-sample" aria-hidden="true">😀 🎉 🚀 ❤️ ✨</div>
        </div>
        <div class="card-copy">
          <h3 class="card-title t-title">${escapeHtml(t("emojiPreview"))}</h3>
          <span class="t-support" data-target></span>
        </div>
      </section>
    </div>
  </section>`);

  screen.querySelector("[data-back]").addEventListener("click", () => ctx.actions.back());

  const switchEl = createSwitch({
    selected: false,
    ariaLabel: t("emojiEnableAria"),
    onChange: (selected) => {
      if (selected) {
        const chosen = current.mode && current.mode !== "default" ? current.mode : defaultSelection(current);
        ctx.actions.setEmoji(chosen);
      } else {
        ctx.actions.setEmoji("default");
      }
    },
  });
  screen.querySelector("[data-enable]").append(switchEl);

  const sourceButton = screen.querySelector("[data-source]");
  const sourceName = screen.querySelector("[data-source-name]");
  const targetHost = screen.querySelector("[data-target]");

  sourceButton.addEventListener("click", async () => {
    if (sourceButton.disabled) return;
    const options = OPTION_ORDER.map((mode) => {
      const preset = EMOJI_PRESETS.find((item) => item.mode === mode);
      if (!preset) return null;
      return {
        value: mode,
        label: presetName(preset),
        supporting: presetDetail(preset, current),
        emoji: preset.preview,
        disabled: mode !== "default" && mode !== "custom" && current.availability?.[mode] === false,
      };
    }).filter(Boolean);

    const picked = await sheet({
      title: t("emojiSourceLabel"),
      options,
      value: current.mode || "default",
    });
    if (!picked) return;
    sourceName.textContent = options.find((option) => option.value === picked)?.label || "";
    ctx.actions.setEmoji(picked);
  });

  function render(next) {
    const active = next.mode !== "default" && Boolean(next.mode);
    switchEl.selected = active;
    sourceName.textContent = currentName(next);
    targetHost.textContent = targetText(next);
  }

  let signature = null;
  function update(nextState) {
    const next = emojiState(nextState);
    const sig = `${next.mode}|${next.target}|${next.customSize}|${next.customName}|${JSON.stringify(next.availability)}`;
    if (sig === signature) return;
    signature = sig;
    current = next;
    render(next);
    const busy = Boolean(nextState.busy);
    switchEl.disabled = busy;
    sourceButton.disabled = busy;
  }

  update(ctx.state);
  screen.update = update;
  wireAppBarScroll(screen);
  return screen;
}
