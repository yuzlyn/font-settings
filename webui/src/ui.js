/** Small DOM/UI helpers shared by every screen. */

import { t, locale } from "./i18n.js";

export function icon(name, { filled = false, className = "", slot = "" } = {}) {
  return `<md-icon${filled ? ' data-filled="true"' : ""}${className ? ` class="${className}"` : ""}${slot ? ` slot="${slot}"` : ""}>${name}</md-icon>`;
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

/* ----------------------------------------------------------------- snackbar */

let snackbarElement = null;
let snackbarTimer = 0;

function ensureSnackbar() {
  if (snackbarElement && snackbarElement.isConnected) return snackbarElement;
  snackbarElement = el(`<div class="snackbar" role="status" aria-live="polite">
    <span class="snackbar-text typescale-body-medium"></span>
    <button class="snackbar-action typescale-label-large" type="button" hidden></button>
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

/* ------------------------------------------------------------------ dialogs */

/** Opens an `md-dialog` and resolves with the clicked action's value. */
export function openDialog(dialog, { returnValue = "close", validate = null } = {}) {
  return new Promise((resolve) => {
    const onClosed = () => {
      dialog.removeEventListener("closed", onClosed);
      dialog.removeEventListener("click", onClick);
      resolve(dialog.returnValue || returnValue);
    };
    // Material Web only closes the dialog by itself for a `<form method="dialog">`
    // submit, so clicks on the action buttons are wired up here. A `validate`
    // callback can refuse the close (invalid input keeps the dialog open).
    const onClick = (event) => {
      const target = event.target instanceof Element ? event.target.closest("[value]") : null;
      if (!target || !target.closest(".dialog-actions")) return;
      if (validate && validate(target, dialog) === false) return;
      const value = target.getAttribute("value");
      if (value) void dialog.close(value);
    };
    dialog.addEventListener("closed", onClosed);
    dialog.addEventListener("click", onClick);
    dialog.show?.();
    dialog.open = true;
  });
}

export async function confirmDialog({
  headline,
  body,
  confirmLabel = t("save"),
  cancelLabel = t("cancel"),
  destructive = false,
}) {
  const dialog = el(`<md-dialog>
    <div slot="headline" class="typescale-title-large">${escapeHtml(headline)}</div>
    <div slot="content" class="typescale-body-medium">${escapeHtml(body)}</div>
    <div slot="actions" class="dialog-actions">
      <md-text-button value="cancel">${escapeHtml(cancelLabel)}</md-text-button>
      <md-${destructive ? "text" : "filled"}-button value="confirm">${escapeHtml(confirmLabel)}</md-${destructive ? "text" : "filled"}-button>
    </div>
  </md-dialog>`);
  if (destructive) {
    const button = dialog.querySelector('[value="confirm"]');
    button.style.setProperty("--md-text-button-label-text-color", "var(--md-sys-color-error)");
  }
  document.body.append(dialog);
  const result = await openDialog(dialog);
  dialog.remove();
  return result === "confirm";
}

/** Dialog that collects a device file path, with recent paths as suggestions. */
export async function pathDialog({ recent = [], headline = t("addFontFromPath") } = {}) {
  const suggestions = recent
    .map(
      (path) => `<md-list-item type="button" data-path="${escapeHtml(path)}">
        ${icon("schedule", { slot: "start" })}
        <div slot="headline" class="recent-path-text">${escapeHtml(path)}</div>
      </md-list-item>`,
    )
    .join("");
  const dialog = el(`<md-dialog>
    <div slot="headline" class="typescale-title-large">${escapeHtml(headline)}</div>
    <div slot="content" class="dialog-body">
      <p class="typescale-body-medium field-hint">${escapeHtml(t("pathHint"))}</p>
      <md-outlined-text-field label="${escapeHtml(t("pathLabel"))}" value="/sdcard/Download/" clearable></md-outlined-text-field>
      ${
        recent.length
          ? `<div class="typescale-body-medium text-muted">${escapeHtml(t("recentPaths"))}</div>
             <div class="list-group recent-paths">${suggestions}</div>`
          : ""
      }
    </div>
    <div slot="actions" class="dialog-actions">
      <md-text-button value="cancel">${escapeHtml(t("cancel"))}</md-text-button>
      <md-filled-button value="confirm">${escapeHtml(t("importAction"))}</md-filled-button>
    </div>
  </md-dialog>`);
  const field = dialog.querySelector("md-outlined-text-field");
  for (const item of dialog.querySelectorAll("[data-path]")) {
    item.addEventListener("click", () => {
      field.value = item.dataset.path;
    });
  }
  document.body.append(dialog);
  const result = await openDialog(dialog);
  const value = String(field.value || "").trim();
  dialog.remove();
  return result === "confirm" ? value : null;
}

/** Asks how a font should be provided: system picker or a pasted path. */
export async function fontSourceDialog({ recent = [] } = {}) {
  const dialog = el(`<md-dialog>
    <div slot="headline" class="typescale-title-large">${escapeHtml(t("addFontHeadline"))}</div>
    <div slot="content" class="dialog-body">
      <p class="typescale-body-medium field-hint">${escapeHtml(t("emptyHint"))}</p>
      <md-outlined-text-field label="${escapeHtml(t("pathLabel"))}" clearable></md-outlined-text-field>
      ${
        recent.length
          ? `<div class="typescale-body-medium text-muted">${escapeHtml(t("recentPaths"))}</div>
             <div class="list-group recent-paths">${recent
               .map(
                 (path) => `<md-list-item type="button" data-path="${escapeHtml(path)}">
                   ${icon("schedule", { slot: "start" })}
                   <div slot="headline" class="recent-path-text">${escapeHtml(path)}</div>
                 </md-list-item>`,
               )
               .join("")}</div>`
          : ""
      }
    </div>
    <div slot="actions" class="dialog-actions">
      <md-text-button value="cancel">${escapeHtml(t("cancel"))}</md-text-button>
      <md-text-button value="file">${escapeHtml(t("addFontFromFile"))}</md-text-button>
      <md-filled-button value="path">${escapeHtml(t("importAction"))}</md-filled-button>
    </div>
  </md-dialog>`);
  const field = dialog.querySelector("md-outlined-text-field");
  for (const item of dialog.querySelectorAll("[data-path]")) {
    item.addEventListener("click", () => {
      field.value = item.dataset.path;
    });
  }
  document.body.append(dialog);
  const result = await openDialog(dialog);
  const value = String(field.value || "").trim();
  dialog.remove();
  if (result === "file") return { type: "file" };
  if (result === "path") {
    if (!value) return null;
    return { type: "path", path: value };
  }
  return null;
}

/* ----------------------------------------------------------------- app bar */

/**
 * Pins the top app bar to the top of a scrolling screen and switches it to the
 * on-scroll container colour (surface -> surfaceContainer) once content scrolls
 * under it. Called once per screen when it is built.
 */
export function wireAppBarScroll(screen) {
  const header = screen.querySelector(".screen-header");
  if (!header) return;
  const onScroll = () => header.classList.toggle("scrolled", screen.scrollTop > 0);
  screen.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* --------------------------------------------------------------- list items */

/**
 * Builds an M3 Expressive list group: 3dp gaps, 28dp outer corners and 8dp
 * inner corners. Items may carry a tone (colour role) or trailing content.
 */
export function listGroup(items) {
  const group = el('<div class="list-group"></div>');
  items.forEach((item, index) => {
    const shape =
      items.length === 1 ? "only" : index === 0 ? "first" : index === items.length - 1 ? "last" : "middle";
    const tone = item.tone ? ` data-tone="${item.tone}"` : "";
    const supporting = item.supporting
      ? `<div slot="supporting-text" class="typescale-body-medium">${escapeHtml(item.supporting)}</div>`
      : "";
    const leading = item.leading
      ? `<div slot="start" class="list-leading"${item.leadingTone === "plain" ? ' data-tone="plain"' : ""}>${icon(item.leading, { filled: Boolean(item.leadingFilled) })}</div>`
      : "";
    const trailing = item.trailing ?? icon("chevron_right");
    const row = el(`<md-list-item type="${item.type || "button"}" data-shape="${shape}"${tone}${item.disabled ? " disabled" : ""}>
      ${leading}
      <div slot="headline" class="typescale-body-large">${escapeHtml(item.headline)}</div>
      ${supporting}
      <div slot="end" class="list-trailing"></div>
    </md-list-item>`);
    const trailingHost = row.querySelector(".list-trailing");
    if (trailing instanceof Node) trailingHost.append(trailing);
    else trailingHost.innerHTML = String(trailing);
    if (item.onClick) row.addEventListener("click", item.onClick);
    group.append(row);
  });
  return group;
}

/* ----------------------------------------------------------------- sliders */

/** Dialog that collects an exact slider value (the value chip's action). */
export async function valueDialog({ headline, fieldLabel, value, min, max, step, hint }) {
  const dialog = el(`<md-dialog>
    <div slot="headline" class="typescale-title-large">${escapeHtml(headline)}</div>
    <div slot="content" class="dialog-body">
      <p class="typescale-body-medium field-hint">${escapeHtml(hint)}</p>
      <md-outlined-text-field type="number" label="${escapeHtml(fieldLabel)}" value="${escapeHtml(
        String(value),
      )}" min="${min}" max="${max}" step="${step}"></md-outlined-text-field>
    </div>
    <div slot="actions" class="dialog-actions">
      <md-text-button value="cancel">${escapeHtml(t("cancel"))}</md-text-button>
      <md-filled-button value="confirm">${escapeHtml(t("save"))}</md-filled-button>
    </div>
  </md-dialog>`);
  const field = dialog.querySelector("md-outlined-text-field");
  document.body.append(dialog);
  const result = await openDialog(dialog, {
    // Invalid input never saves: the field reports the error and the dialog stays.
    validate: () => {
      const parsed = Number(String(field.value ?? "").trim());
      if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
        field.error = true;
        field.errorText = t("editValueInvalid", { min, max });
        return false;
      }
      field.error = false;
      return true;
    },
  });
  const entered = Number(String(field.value ?? "").trim());
  dialog.remove();
  return result === "confirm" && Number.isFinite(entered) ? entered : null;
}

/**
 * The M3 Expressive control container used by the role screens: a 380x160dp
 * container (surfaceContainer, 28dp corners) that stacks the label row on top
 * and the thick-track slider below it. The label row is a single line: a 28sp
 * headline on the left and a selected value chip that stretches across the
 * remaining width (secondaryContainer fill + leading checkmark). Tapping the
 * chip edits the exact value.
 */
export function controlCard({
  label,
  value,
  min,
  max,
  step,
  format = (next) => String(next),
  onInput,
  onChange,
}) {
  const card = el(`<div class="control-card">
    <div class="control-card-head">
      <span class="control-card-title typescale-headline-medium-emphasized">${escapeHtml(label)}</span>
      <md-filter-chip class="value-chip" selected></md-filter-chip>
    </div>
    <md-slider class="expressive-slider" min="${min}" max="${max}" step="${step}" value="${value}" labeled
      aria-label="${escapeHtml(label)}"></md-slider>
  </div>`);
  const slider = card.querySelector("md-slider");
  const valueChip = card.querySelector(".value-chip");

  const render = (current) => {
    const text = format(current);
    valueChip.setAttribute("label", text);
    valueChip.setAttribute("aria-label", t("editValueAria", { value: text }));
  };

  // The card is inserted into the live document only after this function returns,
  // so the initial value is applied in a microtask: properties set on a detached
  // custom element are dropped when it is upgraded on insertion.
  queueMicrotask(() => render(value));

  valueChip.addEventListener("click", async () => {
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
    slider.value = entered;
    render(entered);
    onInput?.(entered);
    onChange?.(entered);
  });

  slider.addEventListener("input", () => {
    const next = Number(slider.value);
    render(next);
    onInput?.(next);
  });
  slider.addEventListener("change", () => onChange?.(Number(slider.value)));

  /** Pushes a new server value in without notifying the caller. */
  card.setValue = (next) => {
    slider.value = next;
    render(next);
  };
  return card;
}
