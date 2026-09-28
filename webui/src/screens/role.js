/** The Chinese / Latin role screens: family chain, sliders and the add FAB. */

import { t } from "../i18n.js";
import { formatBytes, normalizeWeight, normalizeWesternSize } from "../module-api.js";
import { buildPreviewPanel } from "../components/preview-panel.js";
import {
  confirmDialog,
  el,
  escapeHtml,
  icon,
  listGroup,
  showMessage,
  sliderRow,
} from "../ui.js";

const ROLE_COPY = {
  chinese: { titleKey: "chineseFont", sample: "chinese" },
  western: { titleKey: "latinFont", sample: "western" },
};

function chainMeta(role, font, index, total) {
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
      <div class="screen-header-row">
        <md-icon-button variant="tonal" data-back aria-label="${escapeHtml(t("appTitle"))}">
          ${icon("arrow_back")}
        </md-icon-button>
      </div>
      <h1 class="screen-title typescale-headline-medium-emphasized">${escapeHtml(t(copy.titleKey))}</h1>
    </header>
    <div class="screen-content">
      <h2 class="section-label typescale-title-medium-emphasized">${escapeHtml(t("editFamily"))}</h2>
      <div data-preview></div>
      <div data-progress hidden>
        <md-linear-progress indeterminate></md-linear-progress>
      </div>
      <div data-chain></div>
      <div data-sliders></div>
    </div>
    <div data-fab></div>
  </section>`);

  screen.querySelector("[data-back]").addEventListener("click", () => ctx.actions.back());

  const previewHost = screen.querySelector("[data-preview]");
  const chainHost = screen.querySelector("[data-chain]");
  const sliderHost = screen.querySelector("[data-sliders]");
  const progressHost = screen.querySelector("[data-progress]");
  const fabHost = screen.querySelector("[data-fab]");

  let previewSignature = null;
  let chainSignature = null;
  let sliderSignature = null;

  function renderPreview() {
    const selected = ctx.state.preview[role];
    const signature = `${chain.map((font) => `${font.name}:${font.size}`).join(",")}|${selected}`;
    if (signature === previewSignature) return;
    previewSignature = signature;
    previewHost.textContent = "";
    previewHost.append(
      buildPreviewPanel({
        role,
        chain,
        selected,
        onSelect: (value) => ctx.actions.selectPreview(role, value),
      }),
    );
  }

  function renderChain() {
    const signature = chain.map((font) => `${font.name}:${font.size}:${font.variable}`).join(",");
    if (signature === chainSignature) return;
    chainSignature = signature;
    chainHost.textContent = "";
    if (!chain.length) {
      chainHost.append(
        el(`<div class="empty-state">
          ${icon("font_download")}
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
        <div class="list-leading" data-tone="plain">${icon(role === "chinese" ? "text_fields" : "language")}</div>
        <div class="chain-copy">
          <span class="chain-name">${escapeHtml(font.displayName)}</span>
          <span class="chain-meta">${escapeHtml(chainMeta(role, font, index, chain.length))}</span>
        </div>
        <md-icon-button size="s" class="chain-handle press-scale" aria-label="${escapeHtml(t("dragToReorder"))}" title="${escapeHtml(t("dragToReorder"))}">
          ${icon("drag_handle")}
        </md-icon-button>
        <md-icon-button size="s" data-detail aria-label="${escapeHtml(t("fontDetail"))}">
          ${icon("more_vert")}
        </md-icon-button>
      </div>`);
      row.querySelector("[data-detail]").addEventListener("click", (event) => {
        event.stopPropagation();
        ctx.actions.openFontDetail(role, font, index, chain.length);
      });
      row.addEventListener("click", () => ctx.actions.openFontDetail(role, font, index, chain.length));
      row.querySelector(".chain-handle").addEventListener("pointerdown", (event) =>
        startDrag(ctx, screen, role, index, row, event),
      );
      group.append(row);
    });
    chainHost.append(group);
  }

  function renderSliders() {
    const signature = `${status ? status.westernSize : 100}|${status ? status.weight[role] : 400}|${hasVariable}`;
    if (signature === sliderSignature) return;
    sliderSignature = signature;
    sliderHost.textContent = "";
    if (role === "western") {
      const row = sliderRow({
        label: t("latinSize"),
        value: status ? status.westernSize : 100,
        min: 20,
        max: 100,
        step: 1,
        format: (value) => `${value}%`,
        onChange: (value) => ctx.actions.setSize(normalizeWesternSize(value)),
      });
      row.classList.add("role-card");
      sliderHost.append(row);
    }
    if (hasVariable) {
      const row = sliderRow({
        label: t("fontWeight"),
        value: status ? status.weight[role] : 400,
        min: 100,
        max: 900,
        step: 50,
        format: (value) => String(value),
        onChange: (value) => ctx.actions.setWeight(role, normalizeWeight(value)),
      });
      row.classList.add("role-card");
      sliderHost.append(row);
    }
  }

  const fab = el(`<md-fab size="medium" class="fab-floating" aria-label="${escapeHtml(t("addFont"))}">
    ${icon("add")}
  </md-fab>`);
  fab.addEventListener("click", () => ctx.actions.addFont(role));
  fabHost.append(fab);

  function update(next) {
    status = next.status;
    chain = status ? status.chains[role] : [];
    hasVariable = chain.some((font) => font.variable);
    renderPreview();
    renderChain();
    renderSliders();

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
  return screen;
}

/* --------------------------------------------------------------- reordering */

function startDrag(ctx, screen, role, index, row, event) {
  if (ctx.state.busy) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const rect = row.getBoundingClientRect();
  const state = {
    role,
    index,
    row,
    pointerId: event.pointerId,
    grabOffsetY: event.clientY - rect.top,
    originalTop: rect.top,
    height: rect.height,
    moved: false,
  };
  ctx.state.dragState = state;
  row.classList.add("chain-dragging");
  event.currentTarget.setPointerCapture(event.pointerId);

  const onMove = (moveEvent) => {
    if (moveEvent.pointerId !== state.pointerId) return;
    const dy = moveEvent.clientY - state.grabOffsetY - state.originalTop;
    if (Math.abs(dy) > 4) state.moved = true;
    row.style.transform = `translateY(${dy}px)`;
    moveEvent.preventDefault();
  };

  const onUp = async (upEvent) => {
    if (upEvent.pointerId !== state.pointerId) return;
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onCancel);
    ctx.state.dragState = null;
    row.style.transform = "";
    row.classList.remove("chain-dragging");
    const centerY = upEvent.clientY - state.grabOffsetY + state.height / 2;
    const container = row.parentElement;
    const rows = [...container.querySelectorAll(".chain-row")].filter((item) => item !== row);
    let target = 0;
    for (const item of rows) {
      const itemRect = item.getBoundingClientRect();
      if (centerY > itemRect.top + itemRect.height / 2) target += 1;
    }
    if (!state.moved || target === index) return;
    await ctx.actions.reorder(role, index, target);
    screen.remove();
  };

  const onCancel = (cancelEvent) => {
    if (cancelEvent.pointerId !== state.pointerId) return;
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onCancel);
    ctx.state.dragState = null;
    row.style.transform = "";
    row.classList.remove("chain-dragging");
  };

  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onCancel);
  event.preventDefault();
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
      <md-text-button value="details">${escapeHtml(t("previewShowIn"))}</md-text-button>
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
  } else if (result === "details") {
    await ctx.actions.selectPreview(role, `chain:${font.name}`);
    showMessage(t("previewCaptionChain", { name: font.displayName }));
  }
}
