/**
 * 介紹 (README) screen: a structured, localised overview of the module under a
 * top app bar whose menu icon opens the navigation drawer.
 */

import { t } from "../i18n.js";
import { el, escapeHtml, listGroup, wireAppBarScroll } from "../ui.js";

const TELEGRAM_URL = "https://t.me/fontsettings";
const QQ_URL = "mqqapi://card/show_pslcard?src_type=internal&version=1&uin=1082347624&card_type=group&source=qrcode";
const REPO_URL = "https://github.com/yuzlyn/font-settings";

/** Splits an i18n multi-line string into a list of `<li>` entries. */
function listItems(key, ordered = false) {
  const lines = String(t(key) || "").split("\n").filter(Boolean);
  const tag = ordered ? "ol" : "ul";
  const items = lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  return `<${tag} class="readme-list">${items}</${tag}>`;
}

function section(titleKey, bodyHtml) {
  return `<section class="readme-section">
    <h2 class="typescale-title-medium-emphasized">${escapeHtml(t(titleKey))}</h2>
    ${bodyHtml}
  </section>`;
}

export function buildReadmeScreen(ctx) {
  const screen = el(`<section class="screen" data-screen="readme">
    <header class="screen-header screen-header--title-only">
      <h1 class="screen-title typescale-title-large">${escapeHtml(t("readmeTitle"))}</h1>
    </header>
    <div class="screen-content readme-content">
      <p class="readme-tagline typescale-body-medium">${escapeHtml(t("readmeTagline"))}</p>
      ${section("readmeFeaturesTitle", listItems("readmeFeatures"))}
      ${section("readmeCompatTitle", listItems("readmeCompat"))}
      ${section("readmeInstallTitle", listItems("readmeInstall", true))}
      ${section("readmeEmojiTitle", listItems("readmeEmoji"))}
      <section class="readme-section">
        <h2 class="typescale-title-medium-emphasized">${escapeHtml(t("readmeRecoveryTitle"))}</h2>
        <p class="typescale-body-medium">${escapeHtml(t("readmeRecovery"))}</p>
        <pre class="readme-code">${escapeHtml(t("readmeRecoveryCode"))}</pre>
      </section>
      <section class="readme-section">
        <h2 class="typescale-title-medium-emphasized">${escapeHtml(t("readmeLinksTitle"))}</h2>
        <div data-links></div>
      </section>
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
      leading: "supervisor_account",
      onClick: () => window.open(TELEGRAM_URL, "_blank", "noopener"),
    },
    {
      headline: t("qqGroup"),
      supporting: t("qqNumber"),
      leading: "person_add",
      onClick: () => window.open(QQ_URL, "_blank", "noopener"),
    },
  ]);
  screen.querySelector("[data-links]").append(links);

  screen.update = () => {};
  wireAppBarScroll(screen);
  return screen;
}
