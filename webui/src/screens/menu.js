/** Root screen (字型設定): sectioned navigation list with the reboot FAB. */

import { t } from "../i18n.js";
import { el, escapeHtml, icon, listGroup, openDialog } from "../ui.js";

const AUTHOR_URL = "https://github.com/yuzlyn";
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

export function buildMenuScreen(ctx) {
  const state = ctx.state;
  const screen = el(`<section class="screen" data-screen="menu">
    <header class="screen-header">
      <div class="screen-header-row">
        <md-icon-button variant="tonal" data-back aria-label="${escapeHtml(t("close"))}">
          ${icon("arrow_back")}
        </md-icon-button>
      </div>
      <h1 class="screen-title typescale-headline-medium-emphasized">${escapeHtml(t("appTitle"))}</h1>
    </header>
    <div class="screen-content">
      <h2 class="section-label typescale-title-medium-emphasized">${escapeHtml(t("sectionEdit"))}</h2>
      <div data-edit></div>
      <h2 class="section-label typescale-title-medium-emphasized">${escapeHtml(t("sectionAbout"))}</h2>
      <div class="about-group" data-about></div>
    </div>
  </section>`);

  screen.querySelector("[data-back]").addEventListener("click", () => {
    if (history.length > 1) history.back();
    else window.close();
  });

  /* ------------------------------------------------------------ edit group */
  const editGroup = listGroup([
    {
      headline: t("authorName"),
      supporting: t("authorSupport"),
      leading: "account_circle",
      leadingFilled: true,
      tone: "primary-container",
      type: "link",
      onClick: () => window.open(AUTHOR_URL, "_blank", "noopener"),
    },
    {
      headline: t("chineseFont"),
      supporting: t("chineseSupport"),
      leading: "edit",
      onClick: () => ctx.actions.navigate("chinese", { direction: "right" }),
    },
    {
      headline: t("latinFont"),
      supporting: t("latinSupport"),
      leading: "language",
      onClick: () => ctx.actions.navigate("latin", { direction: "left" }),
    },
    {
      headline: t("emojiSettings"),
      supporting: t("emojiSupport"),
      leading: "mood",
      onClick: () => ctx.actions.navigate("emoji", { direction: "right" }),
    },
    {
      headline: t("fallbackLabel"),
      supporting: state.status?.fallback ? t("fallbackOnDetail") : t("fallbackOffDetail"),
      leading: "sort",
      onClick: () => ctx.actions.navigate("fallback", { direction: "right" }),
    },
  ]);
  screen.querySelector("[data-edit]").append(editGroup);

  /* ----------------------------------------------------------- about group */
  const aboutGroup = el('<div class="list-group"></div>');
  const about = listGroup([
    {
      headline: t("systemStatus"),
      supporting: statusSupporting(state),
      leading: "settings",
      onClick: () => ctx.actions.openStatusDialog(),
    },
    {
      headline: t("tgGroup"),
      supporting: "t.me/fontsettings",
      leading: "person_add",
      onClick: () => window.open(TELEGRAM_URL, "_blank", "noopener"),
    },
    {
      headline: t("qqGroup"),
      supporting: t("qqNumber"),
      leading: "supervisor_account",
      onClick: () => window.open(QQ_URL, "_blank", "noopener"),
    },
    {
      headline: t("sourceRepository"),
      supporting: t("repoAddress"),
      leading: "info",
      onClick: () => window.open(REPO_URL, "_blank", "noopener"),
    },
    {
      headline: t("donateAuthor"),
      supporting: t("donateSupport"),
      leading: "favorite",
      onClick: () => window.open("donate.html", "_blank", "noopener"),
    },
  ]);
  aboutGroup.append(about);

  /* The spec places the reboot FAB inside the About group, middle right, drawn
     in front of the list. */
  const fab = el(`<md-fab size="medium" class="fab-in-group" aria-label="${escapeHtml(t("rebootFab"))}">
    ${icon("power_settings_new")}
  </md-fab>`);
  fab.addEventListener("click", () => ctx.actions.reboot());
  aboutGroup.append(fab);
  screen.querySelector("[data-about]").append(aboutGroup);

  screen.update = (next) => {
    const row = about.querySelector("md-list-item");
    const supporting = row?.querySelector('[slot="supporting-text"]');
    if (supporting) supporting.textContent = statusSupporting(next);
  };

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
      <div class="status-line">
        ${icon("palette")}
        <span class="typescale-body-medium">${escapeHtml(t("accentLabel"))}</span>
        <span class="spacer"></span>
        <span class="typescale-body-large">${escapeHtml(
          state.theme?.dynamic ? t("accentDynamic") : t("accentFallback"),
        )}</span>
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
