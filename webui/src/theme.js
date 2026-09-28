/**
 * Dynamic colour for the WebUI.
 *
 * A user accent colour is taken from the system (Android Monet palette exposed
 * through the module bridge) or from an explicit override (?seed=RRGGBB, or a
 * value the user picked earlier). A full Material 3 scheme is generated from
 * that seed with Material Color Utilities. When no accent colour is available
 * the stylesheet's documented Purple fallback scheme stays in place untouched,
 * so every role resolves to the specified hex value.
 */

const SEED_CACHE_KEY = "font-settings.theme-seed.v2";
const FALLBACK_SEED = "#6750a4";

/** Roles that the UI (and Material Web) consume. */
const TOKEN_MAP = {
  primary: "primary",
  "on-primary": "onPrimary",
  "primary-container": "primaryContainer",
  "on-primary-container": "onPrimaryContainer",
  "primary-fixed": "primaryFixed",
  "primary-fixed-dim": "primaryFixedDim",
  "on-primary-fixed": "onPrimaryFixed",
  "on-primary-fixed-variant": "onPrimaryFixedVariant",
  secondary: "secondary",
  "on-secondary": "onSecondary",
  "secondary-container": "secondaryContainer",
  "on-secondary-container": "onSecondaryContainer",
  tertiary: "tertiary",
  "on-tertiary": "onTertiary",
  "tertiary-container": "tertiaryContainer",
  "on-tertiary-container": "onTertiaryContainer",
  error: "error",
  "on-error": "onError",
  "error-container": "errorContainer",
  "on-error-container": "onErrorContainer",
  surface: "surface",
  "surface-dim": "surfaceDim",
  "surface-bright": "surfaceBright",
  "surface-container-lowest": "surfaceContainerLowest",
  "surface-container-low": "surfaceContainerLow",
  "surface-container": "surfaceContainer",
  "surface-container-high": "surfaceContainerHigh",
  "surface-container-highest": "surfaceContainerHighest",
  "on-surface": "onSurface",
  "surface-variant": "surfaceVariant",
  "on-surface-variant": "onSurfaceVariant",
  "inverse-surface": "inverseSurface",
  "inverse-on-surface": "inverseOnSurface",
  "inverse-primary": "inversePrimary",
  outline: "outline",
  "outline-variant": "outlineVariant",
  scrim: "scrim",
  shadow: "shadow",
  "surface-tint": "surfaceTint",
};

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set();
let appliedKey = "";
let seed = readStoredSeed();

function normalizeSeed(value) {
  const hex = String(value ?? "").replace(/[^0-9a-f]/gi, "");
  if (hex.length < 6) return null;
  return `#${hex.slice(-6).toLowerCase()}`;
}

function readStoredSeed() {
  try {
    const override = normalizeSeed(new URLSearchParams(location.search).get("seed"));
    if (override) {
      localStorage.setItem(SEED_CACHE_KEY, override);
      return override;
    }
    return normalizeSeed(localStorage.getItem(SEED_CACHE_KEY));
  } catch {
    return null;
  }
}

function storeSeed(value) {
  try {
    if (value) localStorage.setItem(SEED_CACHE_KEY, value);
    else localStorage.removeItem(SEED_CACHE_KEY);
  } catch {
    // Storage can be unavailable for local content; the in-memory seed still works.
  }
}

function clearScheme() {
  const style = document.documentElement.style;
  for (const token of Object.keys(TOKEN_MAP)) {
    style.removeProperty(`--md-sys-color-${token}`);
  }
}

function applyScheme(scheme, utils) {
  const style = document.documentElement.style;
  for (const [token, dynamicName] of Object.entries(TOKEN_MAP)) {
    const dynamic = utils.MaterialDynamicColors[dynamicName];
    if (!dynamic) continue;
    const argb = dynamic.getArgb(scheme);
    const r = utils.redFromArgb(argb);
    const g = utils.greenFromArgb(argb);
    const b = utils.blueFromArgb(argb);
    style.setProperty(`--md-sys-color-${token}`, `rgb(${r}, ${g}, ${b})`);
  }
}

/** Applies the current seed (or the stylesheet fallback) for the active mode. */
export function applyTheme({ notify = false } = {}) {
  const dark = darkQuery.matches;
  const key = `${seed ?? "fallback"}:${dark ? "dark" : "light"}`;
  if (key === appliedKey) return false;
  appliedKey = key;

  const root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";

  const utils = globalThis.MaterialKolor;
  if (!seed || !utils) {
    clearScheme();
    root.dataset.colorSource = seed ? "seed-static" : "fallback";
    root.dataset.themeSeed = seed ?? FALLBACK_SEED;
  } else {
    const scheme = new utils.SchemeTonalSpot(utils.Hct.fromInt(utils.argbFromHex(seed)), dark, 0);
    applyScheme(scheme, utils);
    root.dataset.colorSource = "accent";
    root.dataset.themeSeed = seed;
  }

  if (notify) {
    for (const listener of listeners) listener(getThemeState());
  }
  return true;
}

/** Updates the seed from the system accent colour reported by the device. */
export function updateAccentSeed(value) {
  const next = normalizeSeed(value);
  if (!next) {
    // No system accent colour: keep whatever override we already have.
    return false;
  }
  if (next === seed) {
    document.documentElement.dataset.colorSource = "accent";
    return false;
  }
  seed = next;
  storeSeed(next);
  appliedKey = "";
  applyTheme({ notify: true });
  return true;
}

export function getThemeState() {
  return {
    seed: seed ?? FALLBACK_SEED,
    dynamic: Boolean(seed && globalThis.MaterialKolor),
    mode: darkQuery.matches ? "dark" : "light",
  };
}

export function onThemeChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function watchSystemTheme() {
  const handler = () => {
    appliedKey = "";
    applyTheme({ notify: true });
  };
  darkQuery.addEventListener("change", handler);
  return () => darkQuery.removeEventListener("change", handler);
}

applyTheme();
