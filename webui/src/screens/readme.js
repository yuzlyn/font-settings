/**
 * Intro tab (介紹): a structured, localised overview of the module. Content is
 * typographic — section cards, bullet/step lists and a monospace recovery
 * command — so it reads like a README rather than a settings page.
 */

import { t } from "../i18n.js";
import { el, escapeHtml, icon, listGroup, wireAppBarScroll } from "../ui.js";

const TELEGRAM_URL = "https://t.me/fontsettings";
const QQ_URL = "mqqapi://card/show_pslcard?src_type=internal&version=1&uin=1082347624&card_type=group&source=qrcode";
const REPO_URL = "https://github.com/yuzlyn/font-settings";

/** Splits an i18n multi-line string into a list of `<li>` entries. */
function listItems(key, ordered = false) {
  const lines = String(t(key) || "").split("\n").filter(Boolean);
  const items = lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  return `<ul class="readme-list"${ordered ? ' data-ordered="true"' : ""}>${items}</ul>`;
}

function section(titleKey, bodyHtml) {
  return `<section class="readme-section">
    <h2 class="t-title">${escapeHtml(t(titleKey))}</h2>
    ${bodyHtml}
  </section>`;
}

export function buildReadmeScreen(ctx) {
  const screen = el(`<section class="screen" data-screen="readme">
    <header class="app-bar">
      <span class="app-emblem" aria-hidden="true">${icon("menu_book")}</span>
      <h1 class="app-bar-title">${escapeHtml(t("navIntro"))}</h1>
    </header>

    <div class="screen-content readme">
      <div class="hero">
        <h2 class="hero-title t-headline">Font Settings</h2>
        <p class="hero-sub t-body">${escapeHtml(t("readmeTagline"))}</p>
      </div>
      ${section("readmeFeaturesTitle", listItems("readmeFeatures"))}
      ${section("readmeCompatTitle", listItems("readmeCompat"))}
      ${section("readmeInstallTitle", listItems("readmeInstall", true))}
      ${section("readmeEmojiTitle", listItems("readmeEmoji"))}
      <section class="readme-section">
        <h2 class="t-title">${escapeHtml(t("readmeRecoveryTitle"))}</h2>
        <p class="t-body" style="margin:0">${escapeHtml(t("readmeRecovery"))}</p>
        <pre class="readme-code">${escapeHtml(t("readmeRecoveryCode"))}</pre>
      </section>
      <div data-links></div>
    </div>
  </section>`);

  const links = listGroup([
    {
      headline: t("sourceRepository"),
      supporting: t("repoAddress"),
      leading: "folder_open",
      onClick: () => window.open(REPO_URL, "_blank", "noopener"),
    },
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
  ]);
  screen.querySelector("[data-links]").append(links);

  screen.update = () => {};
  wireAppBarScroll(screen);
  return screen;
}
