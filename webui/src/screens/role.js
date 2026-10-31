/** The 漢字字型 / 拉丁文字型 screens: fallback chain, control cards and the add FAB. */

import { t } from "../i18n.js";
import { formatBytes, normalizeWeight, normalizeWesternSize } from "../module-api.js";
import {
  confirmDialog,
  controlCard,
  el,
  escapeHtml,
  icon,
  openDialog,
  wireAppBarScroll,
} from "../ui.js";

const ROLE_COPY = {
  chinese: { titleKey: "chineseFont", familyKey: "editChineseFamily" },
  western: { titleKey: "latinFont", familyKey: "editLatinFamily" },
};

function chainMeta(font, index) {
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
    <header class="app-bar">
      <button class="icon-btn" type="button" data-back aria-label="${escapeHtml(t("appTitle"))}">
        ${icon("arrow_back")}
      </button>
      <h1 class="app-bar-title">${escapeHtml(t(copy.titleKey))}</h1>
      <span class="spacer"></span>
      <span class="chip" data-count hidden></span>
    </header>

    <div class="screen-content">
      <div class="hero">
        <h2 class="hero-title t-headline">${escapeHtml(t(copy.titleKey))}</h2>
        <p class="hero-sub t-body">${escapeHtml(t("chainHint"))}</p>
      </div>

      <div class="progress-wrap" data-progress hidden>
        <div class="progress" data-indeterminate="true"><span class="progress-bar"></span></div>
        <span class="t-support" data-progress-text></span>
      </div>

      <div data-chain></div>

      <div data-controls-wrap hidden>
        <h3 class="section-title">${escapeHtml(t("sectionAdjust"))}</h3>
        <div class="card-stack" data-controls></div>
      </div>
    </div>
  </section>`);

  screen.querySelector("[data-back]").addEventListener("click", () => ctx.actions.back());

  const chainHost = screen.querySelector("[data-chain]");
  const controlsHost = screen.querySelector("[data-controls]");
  const controlsWrap = screen.querySelector("[data-controls-wrap]");
  const progressHost = screen.querySelector("[data-progress]");
  const progressText = screen.querySelector("[data-progress-text]");
  const countChip = screen.querySelector("[data-count]");

  let chainSignature = null;
  let controlsSignature = null;

  function renderChain() {
    const signature = chain.map((font) => `${font.name}:${font.size}:${font.variable}`).join(",");
    if (signature === chainSignature) return;
    chainSignature = signature;
    chainHost.textContent = "";

    if (!chain.length) {
      const empty = el(`<div class="empty-state">
        ${icon("upload_file")}
        <span class="t-title">${escapeHtml(t("emptyTitle"))}</span>
        <p class="t-support">${escapeHtml(t("emptyHint"))}</p>
        <button class="btn" type="button" data-variant="tonal" data-empty-add>
          ${icon("add")}${escapeHtml(t("addFont"))}
        </button>
      </div>`);
      empty.querySelector("[data-empty-add]").addEventListener("click", () => ctx.actions.addFont(role));
      chainHost.append(empty);
      return;
    }

    const group = el('<div class="list-group"></div>');
    chain.forEach((font, index) => {
      const row = el(`<div class="chain-row" data-shape="${shapeFor(index, chain.length)}" data-name="${escapeHtml(
        font.name,
      )}" data-index="${index}" role="button" tabindex="0">
        <span class="chain-index" aria-hidden="true">${index + 1}</span>
        <span class="chain-copy">
          <span class="chain-name">${escapeHtml(font.displayName)}</span>
          <span class="chain-meta">${escapeHtml(chainMeta(font, index))}</span>
        </span>
        <span class="chain-handle press-scale" role="button" tabindex="0" aria-label="${escapeHtml(
          t("dragToReorder"),
        )}">
          ${icon("drag_indicator")}
        </span>
        <button class="icon-btn" type="button" data-detail aria-label="${escapeHtml(t("fontDetail"))}">
          ${icon("more_vert")}
        </button>
      </div>`);

      const openDetail = () => ctx.actions.openFontDetail(role, font, index, chain.length);
      row.querySelector("[data-detail]").addEventListener("click", (event) => {
        event.stopPropagation();
        openDetail();
      });
      row.addEventListener("click", (event) => {
        if (event.target instanceof Element && event.target.closest(".chain-handle")) return;
        // A drag that ended just now also fires a click; swallow it so the
        // detail dialog does not pop open right after reordering.
        if (ctx.state.dragMoved) {
          ctx.state.dragMoved = false;
          return;
        }
        openDetail();
      });
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (event.target !== row) return;
        event.preventDefault();
        openDetail();
      });

      const handle = row.querySelector(".chain-handle");
      handle.addEventListener(
        "touchstart",
        (event) => {
          const touch = event.touches[0];
          if (touch) startDrag(ctx, role, index, row, touch.clientY, "touch");
        },
        { passive: true },
      );
      handle.addEventListener("mousedown", (event) => {
        if (event.button !== 0) return;
        startDrag(ctx, role, index, row, event.clientY, "mouse");
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
    controlsWrap.hidden = !(role === "western" || hasVariable);

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

  /* The add FAB lives in the shell's FAB layer so it stays pinned to the
     bottom-right corner while the chain scrolls. */
  const fab = el(`<button class="fab" type="button" data-fab-owner="${role}" aria-label="${escapeHtml(t("addFont"))}">
    ${icon("add")}
  </button>`);
  fab.addEventListener("click", () => ctx.actions.addFont(role));
  const fabLayer = document.querySelector("[data-fab-layer]");
  fabLayer?.querySelector(`[data-fab-owner="${role}"]`)?.remove();
  fabLayer?.append(fab);

  function update(next) {
    status = next.status;
    chain = status ? status.chains[role] : [];
    hasVariable = chain.some((font) => font.variable);

    countChip.hidden = chain.length === 0;
    countChip.textContent = t("fontCountUnitCount", { count: chain.length });

    renderChain();
    renderControls();

    const uploading = next.upload && next.upload.role === role;
    progressHost.hidden = !uploading;
    if (uploading) {
      const indicator = progressHost.querySelector(".progress");
      const bar = progressHost.querySelector(".progress-bar");
      if (typeof next.upload.percent === "number") {
        indicator.dataset.indeterminate = "false";
        bar.style.width = `${Math.round(next.upload.percent * 100)}%`;
        progressText.textContent = t("uploadProgress", { percent: Math.round(next.upload.percent * 100) });
      } else {
        indicator.dataset.indeterminate = "true";
        bar.style.width = "";
        progressText.textContent = t("readingFile");
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

function startDrag(ctx, role, index, row, clientY, type) {
  if (ctx.state.busy) return;
  const rect = row.getBoundingClientRect();
  const state = {
    index,
    row,
    grabOffsetY: clientY - rect.top,
    originalTop: rect.top,
    height: rect.height,
    moved: false,
    raf: 0,
  };
  ctx.state.dragState = state;
  ctx.state.dragMoved = false;
  row.classList.add("chain-dragging");

  function onMove(y) {
    const dy = y - state.grabOffsetY - state.originalTop;
    if (Math.abs(dy) > 4) state.moved = true;
    if (!state.raf) {
      state.raf = requestAnimationFrame(() => {
        state.raf = 0;
        row.style.transform = `translateY(${dy}px)`;
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
  const row = (label, value) => `<div class="status-line">
    <span class="t-support">${escapeHtml(label)}</span>
    <span class="status-value">${escapeHtml(value)}</span>
  </div>`;

  const result = await openDialog({
    title: t("fontDetail"),
    body: [
      row(t("fontDetailFile"), font.displayName),
      row(t("fontDetailSize"), formatBytes(font.size)),
      row(t("fontDetailKind"), t(font.variable ? "variableFont" : "staticFont")),
      row(t("fontDetailSlot"), `#${index + 1} / ${total}`),
    ].join(""),
    actions: [
      { value: "cancel", label: t("close"), variant: "text" },
      { value: "remove", label: t("removeFont"), variant: "text", tone: "danger" },
      { value: "replace", label: t("replaceFont"), variant: "filled" },
    ],
    stacked: true,
  });

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
