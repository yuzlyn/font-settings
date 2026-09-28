/**
 * Preview panel - the reference composition from the spec: a 380x220dp
 * surfaceContainerHigh container with a filled exposed dropdown overlapping its
 * lower edge, drawn in front of the container.
 *
 * The dropdown lists the font families that exist for this role (the module's
 * chain plus the system default). Selecting one only switches the caption and
 * the sample stack - nothing is downloaded from the device, so the panel can
 * never stall the WebUI (loading a 10 MB CJK font into a WebView froze the
 * whole page in earlier builds).
 */

import { t } from "../i18n.js";
import { el, escapeHtml } from "../ui.js";
import { formatBytes } from "../module-api.js";

const APP_STACK =
  '"Roboto Flex", system-ui, -apple-system, "Noto Sans CJK SC", "Noto Sans CJK TC", "Noto Sans SC", sans-serif';

export function buildPreviewPanel({ role, chain, selected, onSelect }) {
  const sample = role === "chinese" ? t("previewSampleChinese") : t("previewSampleLatin");
  const panel = el(`<div class="preview-panel">
    <div class="preview-canvas">
      <div class="preview-sample" data-sample style="font-family: ${escapeHtml(APP_STACK)}">${escapeHtml(sample)}</div>
      <p class="preview-caption typescale-body-medium" data-caption></p>
    </div>
    <md-filled-select label="${escapeHtml(t("previewFamily"))}" quick></md-filled-select>
  </div>`);

  const select = panel.querySelector("md-filled-select");
  const caption = panel.querySelector("[data-caption]");

  const options = [
    { value: "system", label: t("previewSystemDefault"), kind: "system" },
    ...chain.map((font, index) => ({
      value: `chain:${font.name}`,
      label: font.displayName,
      kind: "chain",
      font,
      index,
    })),
  ];

  for (const option of options) {
    select.append(
      el(`<md-select-option value="${escapeHtml(option.value)}">
        <div slot="headline">${escapeHtml(option.label)}</div>
      </md-select-option>`),
    );
  }

  function describe(option) {
    if (option.kind === "system") {
      return t("previewCaptionSystem");
    }
    const parts = [
      `#${option.index + 1}`,
      formatBytes(option.font.size),
      t(option.font.variable ? "variableFont" : "staticFont"),
    ];
    return t("previewCaptionChain", { name: option.label, meta: parts.join(" · ") });
  }

  function apply(value, { notify = false } = {}) {
    const option = options.find((item) => item.value === value) || options[0];
    select.value = option.value;
    caption.textContent = describe(option);
    if (notify) onSelect?.(option.value);
  }

  select.addEventListener("change", () => apply(select.value, { notify: true }));
  const initial = options.some((item) => item.value === selected) ? selected : options[0].value;
  apply(initial);

  panel.setOptions = (nextSelected) => apply(nextSelected);
  return panel;
}
