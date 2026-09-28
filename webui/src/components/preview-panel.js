/**
 * Preview panel - the reference composition from the spec: a 380x220dp
 * surfaceContainerHigh container with a filled exposed dropdown overlapping its
 * lower edge, drawn in front of the container.
 *
 * The dropdown lists the fonts of the role's chain (previewed from the real
 * font file loaded into the browser) plus the families declared by the device
 * font configuration.
 */

import { t } from "../i18n.js";
import { el, escapeHtml } from "../ui.js";
import { loadPreviewFont } from "../module-api.js";

export function buildPreviewPanel({ role, chain, families, selected, onSelect, onError }) {
  const sample = role === "chinese" ? t("previewSampleChinese") : t("previewSampleLatin");
  const panel = el(`<div class="preview-panel">
    <div class="preview-canvas">
      <div class="preview-sample" data-sample>${escapeHtml(sample)}</div>
    </div>
    <p class="preview-caption typescale-body-medium" data-caption></p>
    <md-filled-select label="${escapeHtml(t("previewFamily"))}" quick></md-filled-select>
  </div>`);

  const select = panel.querySelector("md-filled-select");
  const sampleNode = panel.querySelector("[data-sample]");
  const caption = panel.querySelector("[data-caption]");

  const options = [];
  for (const font of chain) {
    options.push({ value: `chain:${font.name}`, label: font.displayName, kind: "chain", font });
  }
  for (const family of families) {
    options.push({ value: `family:${family.name}`, label: family.name, kind: "family", family });
  }

  if (!options.length) {
    const option = el(`<md-select-option value="">
      <div slot="headline">${escapeHtml(t("previewCaptionEmpty"))}</div>
    </md-select-option>`);
    select.append(option);
    select.disabled = true;
    caption.textContent = t("previewCaptionEmpty");
    return panel;
  }

  for (const option of options) {
    const node = el(`<md-select-option value="${escapeHtml(option.value)}">
      <div slot="headline">${escapeHtml(option.label)}</div>
    </md-select-option>`);
    select.append(node);
  }

  const fallbackStack =
    '"Roboto Flex", system-ui, -apple-system, "Noto Sans CJK SC", "Noto Sans TC", sans-serif';
  const loaded = new Set();

  async function apply(value) {
    const option = options.find((item) => item.value === value) || options[0];
    select.value = option.value;
    if (option.kind === "family") {
      sampleNode.style.fontFamily = `"${option.family.name}", ${fallbackStack}`;
      caption.textContent = t("previewCaptionDevice", { name: option.family.name });
    } else {
      // Load the real font file from the device so the preview is truthful.
      try {
        if (!loaded.has(option.font.name)) {
          option.familyName = await loadPreviewFont(option.font.name);
          loaded.add(option.font.name);
        }
        sampleNode.style.fontFamily = `"${option.familyName}", ${fallbackStack}`;
      } catch (error) {
        onError?.(error);
        sampleNode.style.fontFamily = fallbackStack;
      }
      caption.textContent = t("previewCaptionChain", { name: option.font.displayName });
    }
    onSelect?.(option.value, option);
  }

  select.addEventListener("change", () => apply(select.value));
  apply(selected && options.some((item) => item.value === selected) ? selected : options[0].value);

  return panel;
}
