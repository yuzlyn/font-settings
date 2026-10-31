/**
 * About tab (關於): module status, the author, community links and the exit row.
 * The status row opens a dialog with the live counters reported by the module.
 */

import { t } from "../i18n.js";
import { el, escapeHtml, icon, listGroup, openDialog, wireAppBarScroll } from "../ui.js";

const TELEGRAM_URL = "https://t.me/fontsettings";
const QQ_URL = "mqqapi://card/show_pslcard?src_type=internal&version=1&uin=1082347624&card_type=group&source=qrcode";
const REPO_URL = "https://github.com/yuzlyn/font-settings";
const AUTHOR_URL = "https://github.com/yuzlyn";

function statusSupporting(state) {
  if (state.error) return t("connectionFailed");
  if (!state.status) return t("statusLoading");
  const { targets, pendingReboot } = state.status;
  const adapted = t("statusAdapted", { western: targets.western, chinese: targets.chinese });
  return pendingReboot ? `${adapted} · ${t("statusPending")}` : adapted;
}

export function buildAboutScreen(ctx) {
  const state = ctx.state;

  const screen = el(`<section class="screen" data-screen="about">
    <header class="app-bar">
      <span class="app-emblem" aria-hidden="true">${icon("info")}</span>
      <h1 class="app-bar-title">${escapeHtml(t("aboutTitle"))}</h1>
    </header>

    <div class="screen-content">
      <div class="hero">
        <h2 class="hero-title t-headline">${escapeHtml(t("aboutTitle"))}</h2>
        <p class="hero-sub t-body">${escapeHtml(t("aboutSubtitle"))}</p>
      </div>
      <div data-about></div>
      <div data-links></div>
    </div>
  </section>`);

  const about = listGroup([
    {
      headline: t("systemStatus"),
      supporting: statusSupporting(state),
      leading: "monitor_heart",
      onClick: () => openStatusDialog(ctx),
    },
    {
      headline: t("authorName"),
      supporting: t("authorSupport"),
      leading: "account_circle",
      leadingFilled: true,
      onClick: () => window.open(AUTHOR_URL, "_blank", "noopener"),
    },
  ]);

  const links = listGroup([
    {
      headline: t("tgGroup"),
      supporting: "t.me/fontsettings",
      leading: "forum",
      onClick: () => window.open(TELEGRAM_URL, "_blank", "noopener"),
    },
    {
      headline: t("qqGroup"),
      supporting: t("qqNumber"),
      leading: "group_add",
      onClick: () => window.open(QQ_URL, "_blank", "noopener"),
    },
    {
      headline: t("sourceRepository"),
      supporting: t("repoAddress"),
      leading: "folder_open",
      onClick: () => window.open(REPO_URL, "_blank", "noopener"),
    },
    {
      headline: t("donateAuthor"),
      supporting: t("donateSupport"),
      leading: "favorite",
      onClick: () => window.open("donate.html", "_blank", "noopener"),
    },
    {
      headline: t("exitWebui"),
      supporting: t("exitSupport"),
      leading: "logout",
      onClick: () => {
        if (history.length > 1) history.back();
        else window.close();
      },
    },
  ]);

  screen.querySelector("[data-about]").append(about);
  screen.querySelector("[data-links]").append(links);

  function update(next) {
    const supporting = about.querySelector(".list-supporting");
    if (supporting) supporting.textContent = statusSupporting(next);
  }

  update(state);
  screen.update = update;
  wireAppBarScroll(screen);
  return screen;
}

/** Status dialog with live module counters and quick actions. */
export async function openStatusDialog(ctx) {
  const state = ctx.state;
  const status = state.status;
  const conflicts = status?.conflicts?.length
    ? t("statusConflicts", { modules: status.conflicts.join("、") })
    : t("statusNoConflicts");

  const row = (label, value) => `<div class="status-line">
    <span class="t-support">${escapeHtml(label)}</span>
    <span class="status-value">${escapeHtml(value)}</span>
  </div>`;

  const result = await openDialog({
    title: t("statusTitle"),
    body: [
      row(t("statusModule"), state.moduleVersion || "—"),
      row(
        t("statusChainLabel"),
        status
          ? t("statusChainValue", {
              chinese: status.chains.chinese.length,
              western: status.chains.western.length,
            })
          : t("statusLoading"),
      ),
      row(t("statusPending"), status ? (status.pendingReboot ? t("enabled") : t("statusSynced")) : "—"),
      `<div class="status-row">${icon("warning")}<span class="t-support">${escapeHtml(conflicts)}</span></div>`,
    ].join(""),
    actions: [
      { value: "refresh", label: t("refresh"), variant: "text" },
      { value: "reboot", label: t("rebootFab"), variant: "tonal" },
      { value: "close", label: t("close"), variant: "filled" },
    ],
    stacked: true,
  });

  if (result === "refresh") await ctx.actions.refresh();
  else if (result === "reboot") await ctx.actions.reboot();
}
