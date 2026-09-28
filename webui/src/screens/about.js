/**
 * 關於 screen: the five-row about list (system status, groups, repository,
 * support) under a top app bar whose menu icon opens the navigation drawer.
 */

import { t } from "../i18n.js";
import { el, escapeHtml, icon, listGroup, openDialog, wireAppBarScroll } from "../ui.js";

const TELEGRAM_URL = "https://t.me/fontsettings";
const QQ_URL = "mqqapi://card/show_pslcard?src_type=internal&version=1&uin=1082347624&card_type=group&source=qrcode";
const REPO_URL = "https://github.com/yuzlyn/font-settings";

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
    <header class="screen-header screen-header--title-only">
      <h1 class="screen-title typescale-title-large">${escapeHtml(t("aboutTitle"))}</h1>
    </header>
    <div class="screen-content">
      <div data-about></div>
    </div>
  </section>`);

  const about = listGroup([
    {
      headline: t("systemStatus"),
      supporting: statusSupporting(state),
      leading: "settings",
      onClick: () => openStatusDialog(ctx),
    },
    {
      headline: t("tgGroup"),
      supporting: "t.me/fontsettings",
      leading: "supervisor_account",
      onClick: () => window.open(TELEGRAM_URL, "_blank", "noopener"),
    },
    {
      headline: t("qqGroup"),
      supporting: t("qqNumber"),
      leading: "person_add",
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
  ]);
  screen.querySelector("[data-about]").append(about);

  function update(next) {
    const supporting = about.querySelectorAll("md-list-item")[0]?.querySelector('[slot="supporting-text"]');
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
  const dialog = el(`<md-dialog>
    <div slot="headline" class="typescale-title-large">${escapeHtml(t("statusTitle"))}</div>
    <div slot="content" class="dialog-body">
      <div class="status-line">
        ${icon("settings")}
        <span class="typescale-body-medium">${escapeHtml(t("statusModule"))}</span>
        <span class="spacer"></span>
        <span class="typescale-body-large">${escapeHtml(state.moduleVersion || "—")}</span>
      </div>
      <div class="status-line">
        ${icon("text_fields")}
        <span class="typescale-body-medium">${escapeHtml(t("fontDetailKind"))}</span>
        <span class="spacer"></span>
        <span class="typescale-body-large">${escapeHtml(
          status
            ? t("statusPreviewFonts", {
                chinese: status.chains.chinese.length,
                western: status.chains.western.length,
              })
            : t("statusLoading"),
        )}</span>
      </div>
      <div class="status-line">
        ${icon("autorenew")}
        <span class="typescale-body-medium">${escapeHtml(t("statusPending"))}</span>
        <span class="spacer"></span>
        <span class="typescale-body-large">${escapeHtml(
          status ? (status.pendingReboot ? t("enabled") : t("statusSynced")) : "—",
        )}</span>
      </div>
      <div class="status-line">
        ${icon("warning")}
        <span class="typescale-body-medium">${escapeHtml(conflicts)}</span>
      </div>
    </div>
    <div slot="actions" class="dialog-actions">
      <md-text-button value="refresh">${escapeHtml(t("refresh"))}</md-text-button>
      <md-filled-tonal-button value="reboot">${escapeHtml(t("rebootFab"))}</md-filled-tonal-button>
      <md-filled-button value="close">${escapeHtml(t("close"))}</md-filled-button>
    </div>
  </md-dialog>`);
  document.body.append(dialog);
  const result = await openDialog(dialog);
  dialog.remove();
  if (result === "refresh") await ctx.actions.refresh();
  else if (result === "reboot") await ctx.actions.reboot();
}
