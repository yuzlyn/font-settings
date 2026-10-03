/** The 漢字字型 / 拉丁文字型 screens: family chain, control cards and the add FAB. */

import { t } from "../i18n.js";
import { formatBytes, normalizeWeight, normalizeWesternSize } from "../module-api.js";
import {
  confirmDialog,
  controlCard,
  el,
  escapeHtml,
  icon,
  wireAppBarScroll,
} from "../ui.js";

const ROLE_COPY = {
  chinese: { titleKey: "chineseFont", familyKey: "editChineseFamily" },
  western: { titleKey: "latinFont", familyKey: "editLatinFamily" },
};

function chainMeta(role, font, index) {
  return t("chainMeta", {
    index: index + 1,
    size: formatBytes(font.size),
    kind: t(font.variable ? "variableFont" : "staticFont"),
  });
}

function shapeFor(index, total) {
  if (total === 1) return "only";
  if (index === 0) return "first";
  if (index === total - 1) return "last";
  return "middle";
}

export function buildRoleScreen(ctx, role) {
  const copy = ROLE_COPY[role];
  let status = ctx.state.status;
  let chain = status ? status.chains[role] : [];
  let hasVariable = chain.some((font) => font.variable);

  const screen = el(`<section class="screen" data-screen="${role}">
    <header class="screen-header">
      <md-icon-button variant="tonal" data-back aria-label="${escapeHtml(t("appTitle"))}">
        ${icon("arrow_back")}
      </md-icon-button>
      <h1 class="screen-title typescale-title-large">${escapeHtml(t(copy.titleKey))}</h1>
    </header>
    <div class="screen-content">
      <h2 class="section-label typescale-title-medium-emphasized">${escapeHtml(t(copy.familyKey))}</h2>
      <div data-progress hidden>
        <md-linear-progress indeterminate></md-linear-progress>
      </div>
      <div data-chain></div>
      <div class="card-stack" data-controls></div>
    </div>
  </section>`);

  screen.querySelector("[data-back]").addEventListener("click", () => ctx.actions.back());

  const chainHost = screen.querySelector("[data-chain]");
  const controlsHost = screen.querySelector("[data-controls]");
  const progressHost = screen.querySelector("[data-progress]");

  let chainSignature = null;
  let controlsSignature = null;

  function renderChain() {
    const signature = chain.map((font) => `${font.name}:${font.size}:${font.variable}`).join(",");
    if (signature === chainSignature) return;
    chainSignature = signature;
    chainHost.textContent = "";
    if (!chain.length) {
      chainHost.append(
        el(`<div class="empty-state">
          ${icon("upload_file")}
          <div class="typescale-title-medium-emphasized">${escapeHtml(t("emptyTitle"))}</div>
          <p class="typescale-body-medium">${escapeHtml(t("emptyHint"))}</p>
          <md-filled-tonal-button data-empty-add>${escapeHtml(t("addFont"))}</md-filled-tonal-button>
        </div>`),
      );
      chainHost.querySelector("[data-empty-add]").addEventListener("click", () => ctx.actions.addFont(role));
      return;
    }
    const group = el('<div class="list-group"></div>');
    chain.forEach((font, index) => {
      const row = el(`<div class="chain-row" data-shape="${shapeFor(index, chain.length)}" data-name="${escapeHtml(font.name)}" data-index="${index}">
        <span class="chain-handle press-scale" role="button" tabindex="0" aria-label="${escapeHtml(t("dragToReorder"))}" title="${escapeHtml(t("dragToReorder"))}">
          ${icon("drag_handle")}
        </span>
        <div class="chain-copy">
          <span class="chain-name">${escapeHtml(font.displayName)}</span>
          <span class="chain-meta">${escapeHtml(chainMeta(role, font, index))}</span>
        </div>
        <md-icon-button size="s" data-detail aria-label="${escapeHtml(t("fontDetail"))}">
          ${icon("more_vert")}
        </md-icon-button>
      </div>`);
      row.querySelector("[data-detail]").addEventListener("click", (event) => {
        event.stopPropagation();
        ctx.actions.openFontDetail(role, font, index, chain.length);
      });
      row.addEventListener("click", () => {
        // A drag that ended just now also fires a click; swallow it so the
        // detail dialog does not pop open right after reordering.
        if (ctx.state.dragMoved) {
          ctx.state.dragMoved = false;
          return;
        }
        ctx.actions.openFontDetail(role, font, index, chain.length);
      });
      const handle = row.querySelector(".chain-handle");
      handle.addEventListener(
        "touchstart",
        (event) => {
          const touch = event.touches[0];
          if (touch) startDrag(ctx, screen, role, index, row, touch.clientY, "touch");
        },
        { passive: true },
      );
      handle.addEventListener("mousedown", (event) => {
        if (event.button !== 0) return;
        startDrag(ctx, screen, role, index, row, event.clientY, "mouse");
      });
      group.append(row);
    });
    chainHost.append(group);
  }

  function renderControls() {
    const signature = `${status ? status.westernSize : 100}|${status ? status.weight[role] : 400}|${hasVariable}`;
    if (signature === controlsSignature) return;
    controlsSignature = signature;
    controlsHost.textContent = "";
    if (role === "western") {
      controlsHost.append(
        controlCard({
          label: t("latinSize"),
          value: status ? status.westernSize : 100,
          min: 20,
          max: 100,
          step: 1,
          format: (value) => `${value} %`,
          onChange: (value) => ctx.actions.setSize(normalizeWesternSize(value)),
        }),
      );
    }
    if (hasVariable) {
      controlsHost.append(
        controlCard({
          label: t("fontWeight"),
          value: status ? status.weight[role] : 400,
          min: 100,
          max: 900,
          step: 50,
          format: (value) => String(value),
          onChange: (value) => ctx.actions.setWeight(role, normalizeWeight(value)),
        }),
      );
    }
  }

  /* The add FAB is anchored to the bottom-right corner of the app column (like
     Google Keep) instead of scrolling away with the font chain: it lives in the
     shell's FAB layer, which only shows it while this screen is on top. */
  const fab = el(`<md-fab size="medium" class="screen-fab" data-fab-owner="${role}" aria-label="${escapeHtml(
    t("addFont"),
  )}">
    ${icon("add", { slot: "icon" })}
  </md-fab>`);
  fab.addEventListener("click", () => ctx.actions.addFont(role));
  const fabLayer = document.querySelector("[data-fab-layer]");
  fabLayer?.querySelector(`[data-fab-owner="${role}"]`)?.remove();
  fabLayer?.append(fab);

  function update(next) {
    status = next.status;
    chain = status ? status.chains[role] : [];
    hasVariable = chain.some((font) => font.variable);
    renderChain();
    renderControls();

    const uploading = next.upload && next.upload.role === role;
    progressHost.hidden = !uploading;
    if (uploading) {
      const indicator = progressHost.querySelector("md-linear-progress");
      if (typeof next.upload.percent === "number") {
        indicator.indeterminate = false;
        indicator.value = next.upload.percent;
      } else {
        indicator.indeterminate = true;
      }
    }
    fab.disabled = Boolean(next.busy);
  }

  update(ctx.state);
  screen.update = update;
  wireAppBarScroll(screen);
  return screen;
}

/* --------------------------------------------------------------- reordering */

function startDrag(ctx, screen, role, index, row, clientY, type) {
  if (ctx.state.busy) return;
  const rect = row.getBoundingClientRect();
  const state = {
    role,
    index,
    row,
    grabOffsetY: clientY - rect.top,
    originalTop: rect.top,
    height: rect.height,
    moved: false,
    dy: 0,
    raf: 0,
  };
  ctx.state.dragState = state;
  ctx.state.dragMoved = false;
  row.classList.add("chain-dragging");

  function onMove(y) {
    state.dy = y - state.grabOffsetY - state.originalTop;
    if (Math.abs(state.dy) > 4) state.moved = true;
    if (!state.raf) {
      state.raf = requestAnimationFrame(() => {
        state.raf = 0;
        row.style.transform = `translateY(${state.dy}px)`;
      });
    }
  }

  function cleanup() {
    if (state.raf) cancelAnimationFrame(state.raf);
    if (type === "mouse") {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    } else {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    }
    ctx.state.dragState = null;
    row.style.transform = "";
    row.classList.remove("chain-dragging");
  }

  async function finish(y) {
    cleanup();
    const centerY = y - state.grabOffsetY + state.height / 2;
    const container = row.parentElement;
    const rows = [...container.querySelectorAll(".chain-row")].filter((item) => item !== row);
    let target = 0;
    for (const item of rows) {
      const itemRect = item.getBoundingClientRect();
      if (centerY > itemRect.top + itemRect.height / 2) target += 1;
    }
    if (!state.moved || target === index) return;
    ctx.state.dragMoved = true;
    await ctx.actions.reorder(role, index, target);
  }

  function onMouseMove(event) {
    onMove(event.clientY);
  }
  function onMouseUp(event) {
    finish(event.clientY);
  }
  function onTouchMove(event) {
    // preventDefault here (not on touchstart) reliably stops the WebView from
    // taking over the gesture as a scroll and cancelling the drag.
    event.preventDefault();
    onMove(event.touches[0].clientY);
  }
  function onTouchEnd(event) {
    const touch = event.changedTouches[0];
    finish(touch ? touch.clientY : state.originalTop + state.grabOffsetY);
  }

  if (type === "mouse") {
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  } else {
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
  }
}

/* ----------------------------------------------------------- detail dialog */

export async function openFontDetailDialog(ctx, role, font, index, total) {
  const dialog = el(`<md-dialog>
    <div slot="headline" class="typescale-title-large">${escapeHtml(t("fontDetail"))}</div>
    <div slot="content" class="dialog-body">
      <div class="status-line"><span class="typescale-body-medium">${escapeHtml(t("fontDetailFile"))}</span><span class="spacer"></span><span class="typescale-body-large">${escapeHtml(font.displayName)}</span></div>
      <div class="status-line"><span class="typescale-body-medium">${escapeHtml(t("fontDetailSize"))}</span><span class="spacer"></span><span class="typescale-body-large">${escapeHtml(formatBytes(font.size))}</span></div>
      <div class="status-line"><span class="typescale-body-medium">${escapeHtml(t("fontDetailKind"))}</span><span class="spacer"></span><span class="typescale-body-large">${escapeHtml(t(font.variable ? "variableFont" : "staticFont"))}</span></div>
      <div class="status-line"><span class="typescale-body-medium">${escapeHtml(t("fontDetailSlot"))}</span><span class="spacer"></span><span class="typescale-body-large">#${index + 1} / ${total}</span></div>
    </div>
    <div slot="actions" class="dialog-actions">
      <md-text-button value="replace">${escapeHtml(t("replaceFont"))}</md-text-button>
      <md-text-button value="remove" class="danger">${escapeHtml(t("removeFont"))}</md-text-button>
      <md-filled-button value="close">${escapeHtml(t("close"))}</md-filled-button>
    </div>
  </md-dialog>`);
  const removeButton = dialog.querySelector('[value="remove"]');
  removeButton.style.setProperty("--md-text-button-label-text-color", "var(--md-sys-color-error)");
  document.body.append(dialog);
  const { openDialog } = await import("../ui.js");
  const result = await openDialog(dialog);
  dialog.remove();
  if (result === "remove") {
    const confirmed = await confirmDialog({
      headline: t("deleteDialogHeadline"),
      body: t("deleteDialogBody", { name: font.displayName }),
      confirmLabel: t("deleteConfirm"),
      destructive: true,
    });
    if (confirmed) await ctx.actions.removeFont(role, font);
  } else if (result === "replace") {
    await ctx.actions.replaceFont(role, font);
  }
}
