(function (root) {
  "use strict";

  const CACHE_KEY = "font-settings.monet-seed.v1";
  const FALLBACK_SEED = "#4f635b";
  const COLOR_TOKENS = {
    background: "background",
    "on-background": "onBackground",
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
    outline: "outline",
    "outline-variant": "outlineVariant",
    shadow: "shadow",
    scrim: "scrim",
    "surface-tint": "surfaceTint",
    "surface-tint-color": "surfaceTint",
    primary: "primary",
    "on-primary": "onPrimary",
    "primary-container": "primaryContainer",
    "on-primary-container": "onPrimaryContainer",
    "inverse-primary": "inversePrimary",
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
    "primary-fixed": "primaryFixed",
    "primary-fixed-dim": "primaryFixedDim",
    "on-primary-fixed": "onPrimaryFixed",
    "on-primary-fixed-variant": "onPrimaryFixedVariant",
    "secondary-fixed": "secondaryFixed",
    "secondary-fixed-dim": "secondaryFixedDim",
    "on-secondary-fixed": "onSecondaryFixed",
    "on-secondary-fixed-variant": "onSecondaryFixedVariant",
    "tertiary-fixed": "tertiaryFixed",
    "tertiary-fixed-dim": "tertiaryFixedDim",
    "on-tertiary-fixed": "onTertiaryFixed",
    "on-tertiary-fixed-variant": "onTertiaryFixedVariant",
  };

  function normalizeSeed(value) {
    const hex = String(value || "").replace(/[^0-9a-f]/gi, "");
    if (hex.length < 6) return null;
    return `#${hex.slice(-6).toLowerCase()}`;
  }

  function readCachedSeed() {
    try {
      return normalizeSeed(root.localStorage.getItem(CACHE_KEY));
    } catch {
      return null;
    }
  }

  function writeCachedSeed(value) {
    try {
      root.localStorage.setItem(CACHE_KEY, value);
    } catch {
      // Some WebViews disable storage for local content; the in-memory seed still works.
    }
  }

  let seed = readCachedSeed() || FALLBACK_SEED;
  let appliedKey = "";

  function applyCurrent(source = "cache") {
    const dark = root.matchMedia("(prefers-color-scheme: dark)").matches;
    const key = `${seed}:${dark ? "dark" : "light"}`;
    if (key === appliedKey) return false;

    const documentRoot = root.document.documentElement;
    documentRoot.style.setProperty("--monet-seed", seed);
    if (root.MaterialKolor) {
      const {
        Hct,
        MaterialDynamicColors,
        SchemeTonalSpot,
        argbFromHex,
        blueFromArgb,
        greenFromArgb,
        redFromArgb,
      } = root.MaterialKolor;
      const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(seed)), dark, 0);
      for (const [token, dynamicName] of Object.entries(COLOR_TOKENS)) {
        const argb = MaterialDynamicColors[dynamicName].getArgb(scheme);
        const rgb = `${redFromArgb(argb)}, ${greenFromArgb(argb)}, ${blueFromArgb(argb)}`;
        documentRoot.style.setProperty(`--mdui-color-${token}`, rgb);
      }
    } else if (root.mdui) {
      root.mdui.setColorScheme(seed);
    }

    appliedKey = key;
    documentRoot.dataset.colorSource = source;
    documentRoot.dataset.monetSeed = seed;
    return true;
  }

  function updateSystemSeed(value) {
    const nextSeed = normalizeSeed(value);
    if (!nextSeed) return false;
    writeCachedSeed(nextSeed);
    if (nextSeed === seed) {
      root.document.documentElement.dataset.colorSource = "monet";
      return false;
    }

    seed = nextSeed;
    appliedKey = "";
    applyCurrent("monet");
    root.dispatchEvent(new CustomEvent("fontsettings-themechange", { detail: { seed } }));
    return true;
  }

  root.FontSettingsTheme = {
    CACHE_KEY,
    FALLBACK_SEED,
    applyCurrent,
    getSeed: () => seed,
    normalizeSeed,
    readCachedSeed,
    updateSystemSeed,
  };

  applyCurrent(readCachedSeed() ? "cache" : "fallback");
})(globalThis);
