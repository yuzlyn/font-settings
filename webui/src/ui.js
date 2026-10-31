/**
 * Presentation helpers for the Material 3 Expressive WebUI.
 *
 * The whole component layer lives here: icons, list groups, the switch, slider
 * cards, dialogs, the bottom sheet and the snackbar. Nothing depends on a
 * component runtime, so the page behaves the same in the KernelSU WebView, the
 * module's own localhost server and a normal desktop browser.
 */

import { t, locale } from "./i18n.js";

/* ------------------------------------------------------------------ basics */

export function icon(name, { filled = false, className = "" } = {}) {
  return `<span class="icon${filled ? " icon--filled" : ""}${className ? ` ${className}` : ""}" aria-hidden="true">${name}</span>`;
}

export function el(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

export function formatNumber(value) {
  return new Intl.NumberFormat(locale).format(Number(value) || 0);
}

/* --------------------------------------------------------------- snackbar */

let snackbarElement = null;
let snackbarTimer = 0;

function ensureSnackbar() {
  if (snackbarElement && snackbarElement.isConnected) return snackbarElement;
  snackbarElement = el(`<div class="snackbar" role="status" aria-live="polite">
    <span class="snackbar-text"></span>
    <button class="snackbar-action" type="button" hidden></button>
  </div>`);
  document.body.append(snackbarElement);
  return snackbarElement;
}

export function showMessage(message, { actionLabel = "", onAction = null, timeout = 4000 } = {}) {
  const element = ensureSnackbar();
  element.querySelector(".snackbar-text").textContent = String(message ?? "");
  const action = element.querySelector(".snackbar-action");
  action.hidden = !actionLabel;
  action.textContent = actionLabel;
  action.onclick = () => {
    hideMessage();
    onAction?.();
  };
  element.dataset.open = "true";
  window.clearTimeout(snackbarTimer);
  if (timeout > 0) snackbarTimer = window.setTimeout(hideMessage, timeout);
}

export function hideMessage() {
  if (snackbarElement) snackbarElement.dataset.open = "false";
}

/* ----------------------------------------------------------------- overlays */

const CLOSE_MS = 220;

/**
 * Mounts a scrim + panel, resolves with whatever `close()` is called with.
 * Escape and a tap on the scrim both dismiss (value `null`).
 */
function present({ variant = "center", html, onReady }) {
  return new Promise((resolve) => {
    const scrim = el(`<div class="scrim" data-variant="${variant}" role="presentation">${html}</div>`);
    document.body.append(scrim);

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKey);
      scrim.dataset.open = "false";
      window.setTimeout(() => {
        scrim.remove();
        resolve(value);
      }, CLOSE_MS);
    };
    const onKey = (event) => {
      if (event.key === "Escape") finish(null);
    };
    scrim.addEventListener("click", (event) => {
      if (event.target === scrim) finish(null);
    });
    document.addEventListener("keydown", onKey);

    requestAnimationFrame(() => {
      scrim.dataset.open = "true";
    });
    onReady?.({ scrim, close: finish });
  });
}

function actionsHtml(actions) {
  return actions
    .map((action) => {
      const attrs = [
        `data-action="${escapeHtml(action.value)}"`,
        action.variant && action.variant !== "text" ? `data-variant="${action.variant}"` : 'data-variant="text"',
        action.tone ? `data-tone="${action.tone}"` : "",
        action.primary ? 'data-primary="true"' : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button class="btn" type="button" ${attrs}>${escapeHtml(action.label)}</button>`;
    })
    .join("");
}

/** Resolves with the clicked action's value, or null when dismissed. */
export function openDialog({
  title,
  body,
  actions,
  variant = "center",
  stacked = false,
  onReady,
  validate,
}) {
  return present({
    variant,
    html: `<div class="dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <h2 class="dialog-title t-headline-small">${escapeHtml(title)}</h2>
      <div class="dialog-body">${body}</div>
      <div class="dialog-actions"${stacked ? ' data-stacked="true"' : ""}>${actionsHtml(actions)}</div>
    </div>`,
    onReady: ({ scrim, close }) => {
      scrim.querySelector(".dialog-actions").addEventListener("click", (event) => {
        const button = event.target instanceof Element ? event.target.closest("[data-action]") : null;
        if (!button) return;
        const value = button.dataset.action;
        if (value === "cancel") {
          close(null);
          return;
        }
        if (validate && validate(value, scrim) === false) return;
        close(value);
      });
      onReady?.({ scrim, close });
    },
  });
}

export async function confirmDialog({
  headline,
  body,
  confirmLabel = t("save"),
  cancelLabel = t("cancel"),
  destructive = false,
}) {
  const result = await openDialog({
    title: headline,
    body: `<p class="t-body" style="margin:0">${escapeHtml(body)}</p>`,
    actions: [
      { value: "cancel", label: cancelLabel, variant: "text" },
      {
        value: "confirm",
        label: confirmLabel,
        variant: destructive ? "text" : "filled",
        tone: destructive ? "danger" : "",
      },
    ],
  });
  return result === "confirm";
}

/** Text field markup shared by the path and value dialogs. */
function fieldHtml({ label, value = "", type = "text", hint = "", invalid = false, errorText = "" }) {
  return `<label class="field">
    <span class="field-label t-support">${escapeHtml(label)}</span>
    <input class="field-input" type="${type}" value="${escapeHtml(value)}" ${type === "number" ? 'inputmode="numeric"' : 'inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false"'}>
    <span class="field-error t-support" ${invalid ? "" : "hidden"}>${escapeHtml(errorText)}</span>
    ${hint ? `<span class="field-hint t-support">${escapeHtml(hint)}</span>` : ""}
  </label>`;
}

/** Dialog that collects a device file path, with recent paths as suggestions. */
export async function pathDialog({ recent = [], headline = t("addFontFromPath") } = {}) {
  let entered = "";
  const suggestions = recent
    .map(
      (path) => `<button class="option-row" type="button" data-path="${escapeHtml(path)}">
        ${icon("schedule")}
        <span class="option-copy"><span class="option-label">${escapeHtml(path)}</span></span>
      </button>`,
    )
    .join("");
  const result = await openDialog({
    title: headline,
    body: `<p class="field-hint t-body">${escapeHtml(t("pathHint"))}</p>
      ${fieldHtml({ label: t("pathLabel"), value: "/sdcard/Download/" })}
      ${recent.length ? `<p class="field-hint t-support" style="margin:0">${escapeHtml(t("recentPaths"))}</p><div class="list-group">${suggestions}</div>` : ""}`,
    actions: [
      { value: "cancel", label: t("cancel"), variant: "text" },
      { value: "confirm", label: t("importAction"), variant: "filled" },
    ],
    validate: (value, scrim) => {
      if (value !== "confirm") return true;
      const input = scrim.querySelector(".field-input");
      entered = String(input?.value || "").trim();
      const invalid = !entered.startsWith("/");
      input.dataset.invalid = String(invalid);
      const error = scrim.querySelector(".field-error");
      error.hidden = !invalid;
      error.textContent = t("pathInvalid");
      return !invalid;
    },
    onReady: ({ scrim }) => {
      const input = scrim.querySelector(".field-input");
      for (const row of scrim.querySelectorAll("[data-path]")) {
        row.addEventListener("click", () => {
          input.value = row.dataset.path;
          input.focus();
        });
      }
      window.setTimeout(() => {
        input.focus();
        input.setSelectionRange(0, 0);
      }, 120);
    },
  });
  return result === "confirm" && entered ? entered : null;
}

/** Asks how a font should be provided: system picker or a pasted path. */
export async function fontSourceDialog({ recent = [] } = {}) {
  let entered = "";
  const result = await openDialog({
    title: t("addFontHeadline"),
    body: `<p class="field-hint t-body">${escapeHtml(t("fontSourceHint"))}</p>
      ${fieldHtml({ label: t("pathLabel") })}
      ${recent.length ? `<p class="field-hint t-support" style="margin:0">${escapeHtml(t("recentPaths"))}</p><div class="list-group">${recent
        .map(
          (path) => `<button class="option-row" type="button" data-path="${escapeHtml(path)}">
            ${icon("schedule")}
            <span class="option-copy"><span class="option-label">${escapeHtml(path)}</span></span>
          </button>`,
        )
        .join("")}</div>` : ""}`,
    actions: [
      { value: "cancel", label: t("cancel"), variant: "text" },
      { value: "file", label: t("addFontFromFile"), variant: "text" },
      { value: "path", label: t("importAction"), variant: "filled" },
    ],
    validate: (value, scrim) => {
      if (value !== "path") return true;
      const input = scrim.querySelector(".field-input");
      entered = String(input?.value || "").trim();
      if (entered.startsWith("/")) return true;
      input.dataset.invalid = "true";
      const error = scrim.querySelector(".field-error");
      error.hidden = false;
      error.textContent = t("pathInvalid");
      return false;
    },
    onReady: ({ scrim }) => {
      const input = scrim.querySelector(".field-input");
      for (const row of scrim.querySelectorAll("[data-path]")) {
        row.addEventListener("click", () => {
          input.value = row.dataset.path;
        });
      }
    },
  });
  if (result === "file") return { type: "file" };
  if (result === "path" && entered) return { type: "path", path: entered };
  return null;
}

/* ------------------------------------------------------------ bottom sheet */

/**
 * Modal bottom sheet used for source/selection pickers.
 * Resolves with the selected option value, or null when dismissed.
 */
export function sheet({ title, options, value = null, body = "" }) {
  const rows = options
    .map((option) => {
      const selected = option.value === value;
      return `<button class="option-row" type="button" data-value="${escapeHtml(
        option.value,
      )}" aria-selected="${selected}" ${option.disabled ? "disabled" : ""}>
        ${option.emoji ? `<span class="option-emoji" aria-hidden="true">${option.emoji}</span>` : option.icon ? icon(option.icon) : ""}
        <span class="option-copy">
          <span class="option-label">${escapeHtml(option.label)}</span>
          ${option.supporting ? `<span class="option-supporting">${escapeHtml(option.supporting)}</span>` : ""}
        </span>
        ${selected ? icon("check") : ""}
      </button>`;
    })
    .join("");

  return present({
    variant: "bottom",
    html: `<div class="sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <span class="sheet-handle" aria-hidden="true"></span>
      <h2 class="sheet-title t-headline-small">${escapeHtml(title)}</h2>
      <div class="sheet-body">${body}${rows}</div>
    </div>`,
    onReady: ({ scrim, close }) => {
      scrim.querySelector(".sheet-body").addEventListener("click", (event) => {
        const row = event.target instanceof Element ? event.target.closest("[data-value]") : null;
        if (!row || row.disabled) return;
        close(row.dataset.value);
      });
    },
  });
}

/* -------------------------------------------------------------- app bar */

/**
 * Pins the top app bar to a scrolling screen and reveals its compact title once
 * the hero headline scrolls under it.
 */
export function wireAppBarScroll(screen) {
  const bar = screen.querySelector(".app-bar");
  if (!bar) return;
  const sync = () => {
    bar.dataset.scrolled = String(screen.scrollTop > 8);
  };
  screen.addEventListener("scroll", sync, { passive: true });
  sync();
}

/* -------------------------------------------------------------- list groups */

/**
 * Segmented M3 Expressive list: 3dp gaps, 28dp outer corners and 8dp inner
 * corners. Items may carry a tone, a supporting line and trailing content.
 */
export function listGroup(items) {
  const group = el('<div class="list-group"></div>');
  items.forEach((item, index) => {
    const shape =
      items.length === 1 ? "only" : index === 0 ? "first" : index === items.length - 1 ? "last" : "middle";
    const tone = item.tone ? ` data-tone="${item.tone}"` : "";
    const interactive = Boolean(item.onClick);
    const row = el(`<div class="list-item"${interactive ? ' role="button" tabindex="0"' : ""} data-shape="${shape}"${tone}${item.disabled ? ' aria-disabled="true"' : ""}>
      ${item.leading ? `<span class="list-leading">${icon(item.leading, { filled: Boolean(item.leadingFilled) })}</span>` : ""}
      <span class="list-body">
        <span class="list-headline">${escapeHtml(item.headline)}</span>
        ${item.supporting ? `<span class="list-supporting">${escapeHtml(item.supporting)}</span>` : ""}
      </span>
      <span class="list-trailing"></span>
    </div>`);
    const trailingHost = row.querySelector(".list-trailing");
    if (item.trailing instanceof Node) trailingHost.append(item.trailing);
    else trailingHost.innerHTML = item.trailing ?? icon("chevron_right");
    if (item.onClick) {
      row.addEventListener("click", item.onClick);
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        item.onClick(event);
      });
    }
    group.append(row);
  });
  return group;
}

/* ------------------------------------------------------------------ switch */

/**
 * M3 switch. `selected` is written silently by screen updates; a user tap
 * dispatches change, which is what the screens listen to.
 */
export function createSwitch({ selected = false, ariaLabel = "", onChange = null } = {}) {
  const button = el(`<button class="switch" type="button" role="switch" aria-checked="false" aria-label="${escapeHtml(
    ariaLabel,
  )}">
    <span class="switch-thumb">${icon("check")}</span>
  </button>`);

  const render = (value) => {
    button.dataset.selected = String(Boolean(value));
    button.setAttribute("aria-checked", String(Boolean(value)));
  };
  render(selected);

  Object.defineProperty(button, "selected", {
    get: () => button.dataset.selected === "true",
    set: (value) => render(value),
    configurable: true,
  });

  button.addEventListener("click", () => {
    if (button.disabled) return;
    render(!button.selected);
    onChange?.(button.selected);
    button.dispatchEvent(new Event("change"));
  });
  return button;
}

/* ----------------------------------------------------------------- dialogs */

/** Dialog that collects an exact slider value (the value chip's action). */
export async function valueDialog({ headline, fieldLabel, value, min, max, step, hint }) {
  let entered = Number(value);
  const result = await openDialog({
    title: headline,
    body: `<p class="field-hint t-body">${escapeHtml(hint)}</p>
      ${fieldHtml({ label: fieldLabel, value: String(value), type: "number" })}`,
    actions: [
      { value: "cancel", label: t("cancel"), variant: "text" },
      { value: "confirm", label: t("save"), variant: "filled" },
    ],
    validate: (action, scrim) => {
      if (action !== "confirm") return true;
      const input = scrim.querySelector(".field-input");
      const parsed = Number(String(input.value ?? "").trim());
      const invalid = !Number.isFinite(parsed) || parsed < min || parsed > max;
      input.dataset.invalid = String(invalid);
      const error = scrim.querySelector(".field-error");
      error.hidden = !invalid;
      error.textContent = t("editValueInvalid", { min, max });
      if (!invalid) entered = parsed;
      return !invalid;
    },
    onReady: ({ scrim }) => {
      const input = scrim.querySelector(".field-input");
      window.setTimeout(() => {
        input.focus();
        input.select();
      }, 120);
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        scrim.querySelector('[data-action="confirm"]')?.click();
      });
    },
  });
  return result === "confirm" ? entered : null;
}

/* ------------------------------------------------------------- control card */

/**
 * M3 Expressive control container: a 28dp surface-container-low card with the
 * label and value chip on top and the thick slider below.
 */
export function controlCard({ label, value, min, max, step, format = (next) => String(next), onInput, onChange }) {
  const start = Math.min(max, Math.max(min, Number(value) || min));
  const card = el(`<div class="control-card">
    <div class="control-head">
      <h3 class="control-title t-headline-small">${escapeHtml(label)}</h3>
      <button class="value-chip" type="button" aria-label="${escapeHtml(t("editValueAria", { value: format(start) }))}">
        ${icon("check")}<span class="value-text">${escapeHtml(format(start))}</span>
      </button>
    </div>
    <input class="slider" type="range" min="${min}" max="${max}" step="${step}" value="${start}" aria-label="${escapeHtml(label)}">
  </div>`);

  const slider = card.querySelector(".slider");
  const chip = card.querySelector(".value-chip");
  const text = card.querySelector(".value-text");

  const paint = (next) => {
    const ratio = max === min ? 0 : (next - min) / (max - min);
    slider.style.setProperty("--fill", `${(ratio * 100).toFixed(2)}%`);
    text.textContent = format(next);
    chip.setAttribute("aria-label", t("editValueAria", { value: format(next) }));
  };
  paint(start);

  chip.addEventListener("click", async () => {
    const entered = await valueDialog({
      headline: t("editValueHeadline"),
      fieldLabel: label,
      value: Number(slider.value),
      min,
      max,
      step,
      hint: t("editValueHint", { min, max }),
    });
    if (entered === null) return;
    slider.value = String(entered);
    paint(entered);
    onInput?.(entered);
    onChange?.(entered);
  });

  slider.addEventListener("input", () => {
    const next = Number(slider.value);
    paint(next);
    onInput?.(next);
  });
  slider.addEventListener("change", () => onChange?.(Number(slider.value)));

  card.setValue = (next) => {
    slider.value = String(next);
    paint(Number(next));
  };
  card.setDisabled = (disabled) => {
    slider.disabled = Boolean(disabled);
    chip.disabled = Boolean(disabled);
  };
  return card;
}
