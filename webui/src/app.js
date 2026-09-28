/**
 * Font Settings WebUI - Material 3 Expressive application shell.
 *
 * Screens: 字型設定 (menu), 中文字型, 西文字型, Emoji 設定.
 * Screen transitions use the standard motion scheme: the Chinese screen slides
 * in from the right, the Latin screen from the left, and going back replays
 * the entry animation in reverse (including the system back gesture).
 */

import "./material.js";

import { applyTheme, getThemeState, onThemeChange, updateAccentSeed, watchSystemTheme } from "./theme.js";
import { describeError, locale, t } from "./i18n.js";
import { exec, hasKsuBridge, parseProperties, readDeviceFile } from "./bridge.js";
import {
  abortUpload,
  EMOJI_PRESETS,
  getModuleDir,
  getStatus,
  healModulePermissions,
  normalizeWeight,
  normalizeWesternSize,
  rebootDevice,
  removeFont as removeFontCommand,
  reorderFonts,
  resolveModuleDir,
  setEmojiMode,
  setFallback as setFallbackCommand,
  setWeight as setWeightCommand,
  setWesternSize,
  uploadRoleBytes,
  uploadRoleFont,
} from "./module-api.js";
import {
  getRecentPaths,
  getState,
  logActivity,
  rememberPath,
  setState,
  stateKeys,
} from "./store.js";
import {
  confirmDialog,
  fontSourceDialog,
  showMessage,
  hideMessage,
  pathDialog,
} from "./ui.js";
import { buildMenuScreen, openStatusDialog } from "./screens/menu.js";
import { buildEmojiScreen } from "./screens/emoji.js";
import { buildRoleScreen, openFontDetailDialog } from "./screens/role.js";

const stackHost = document.querySelector("[data-screen-stack]");
const bootProgress = document.querySelector("[data-boot-progress]");

const state = {
  status: null,
  statusStamp: 0,
  cachedStatus: false,
  error: null,
  busy: false,
  upload: null,
  moduleVersion: "",
  theme: getThemeState(),
  dragState: null,
};

const screens = {
  menu: { id: "menu", build: () => buildMenuScreen(ctx) },
  chinese: { id: "chinese", build: () => buildRoleScreen(ctx, "chinese") },
  latin: { id: "latin", build: () => buildRoleScreen(ctx, "western") },
  emoji: { id: "emoji", build: () => buildEmojiScreen(ctx) },
};

const navigationStack = [];
const screenCache = new Map();

/* ----------------------------------------------------------------- router */

function opposite(direction) {
  return direction === "left" ? "right" : "left";
}

function renderScreen(id, { entering = null, leaving = null, direction = "right", replay = true } = {}) {
  const definition = screens[id];
  if (!definition) return null;
  const cached = screenCache.get(id);
  const element = cached ? cached.element : definition.build();
  screenCache.set(id, { element, stamp: state.statusStamp });
  if (entering) element.classList.add(`screen-enter-from-${entering}`);
  // A cached screen may still be hidden from an earlier transition.
  element.hidden = false;
  if (!element.isConnected) stackHost.append(element);

  if (leaving === null) {
    element.classList.add("screen-active");
    return element;
  }

  if (!replay) {
    element.classList.add("screen-active");
    return element;
  }

  const incoming = element;
  const outgoing = leaving;
  requestAnimationFrame(() => {
    incoming.classList.add("screen-active");
    incoming.classList.remove(`screen-enter-from-${entering}`);
    if (outgoing) {
      outgoing.classList.remove("screen-active");
      outgoing.classList.add(`screen-leave-to-${direction}`);
      outgoing.addEventListener(
        "transitionend",
        () => {
          outgoing.hidden = true;
          outgoing.classList.remove(`screen-leave-to-${direction}`);
        },
        { once: true },
      );
      window.setTimeout(() => {
        outgoing.hidden = true;
        outgoing.classList.remove(`screen-leave-to-${direction}`);
      }, 600);
    }
  });
  return element;
}

function navigate(id, { direction = "right", push = true } = {}) {
  const current = navigationStack.at(-1);
  if (current?.id === id) return;
  navigationStack.push({ id, direction });
  const outgoing = current ? screenCache.get(current.id)?.element : null;
  const element = renderScreen(id, { entering: direction, leaving: outgoing, direction: opposite(direction) });
  element?.update?.(state);
  if (push) {
    try {
      history.pushState({ screenId: id }, "", `#${id}`);
    } catch {
      // history may be unavailable in some hosts; navigation still works.
    }
  }
}

function goBack() {
  const current = navigationStack.at(-1);
  // Back always lands on the menu: a secondary screen must never be a dead end
  // (the app used to restore the last screen, leaving the stack with a single
  // entry so the back button and gesture just closed the WebUI).
  if (current && current.id !== "menu") {
    const outgoing = screenCache.get(current.id)?.element;
    navigationStack.length = 0;
    navigationStack.push({ id: "menu", direction: "right" });
    const incoming = renderScreen("menu", { entering: "left", leaving: outgoing, direction: "right" });
    incoming?.update?.(state);
    try {
      history.replaceState({ screenId: "menu" }, "", "#menu");
    } catch {
      // ignore
    }
    return;
  }
}

/**
 * Pushes the latest state into the visible screen. Screens patch themselves in
 * place (they must never be re-created here, or the transition stack would
 * accumulate duplicate elements).
 */
function refreshScreens() {
  const top = navigationStack.at(-1);
  if (!top) return;
  screenCache.get(top.id)?.element?.update?.(state);
}

/* ---------------------------------------------------------------- actions */

async function refresh({ silent = false } = {}) {
  try {
    const status = await getStatus();
    state.status = status;
    state.error = null;
    state.cachedStatus = false;
    state.statusStamp += 1;
    if (!silent) hideMessage();
  } catch (error) {
    // A stale modules_update directory (or an installer that skipped the
    // permission step) makes every command fail; repair and retry once.
    if (/Permission denied|can't execute|not found/i.test(String(error?.message || ""))) {
      try {
        await healModulePermissions();
        const status = await getStatus();
        state.status = status;
        state.error = null;
        state.statusStamp += 1;
        refreshScreens();
        bootProgress?.classList.add("hidden");
        return;
      } catch {
        // fall through to the error state below
      }
    }
    state.error = error;
    showMessage(hasKsuBridge ? describeError(error) : t("connectionHint"), {
      actionLabel: t("retryConnection"),
      onAction: () => refresh(),
    });
  } finally {
    refreshScreens();
    bootProgress?.classList.add("hidden");
  }
}

async function requestFilePicker(accept) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.hidden = true;
    document.body.append(input);

    let settled = false;
    let opened = false;
    let hardTimer = 0;
    const cleanUp = () => {
      window.clearTimeout(probeTimer);
      window.clearTimeout(hardTimer);
      document.removeEventListener("visibilitychange", onSignal);
      input.removeEventListener("change", onChange);
      input.removeEventListener("cancel", onCancel);
    };
    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanUp();
      input.remove();
      resolve(result);
    };
    const onSignal = () => {
      opened = true;
    };
    const onChange = () => {
      const [file] = input.files || [];
      finish(file ? { file } : null);
    };
    const onCancel = () => finish(null);
    const probeTimer = window.setTimeout(() => {
      // Hosts without a WebChromeClient file chooser never respond at all.
      if (!opened && hasKsuBridge) finish({ unavailable: true });
    }, 1000);

    input.addEventListener("change", onChange);
    input.addEventListener("cancel", onCancel);
    document.addEventListener("visibilitychange", onSignal);
    input.click();

    hardTimer = window.setTimeout(() => finish(null), 180000);
  });
}

async function uploadFile(role, file, { slotName = null, progressRole = role } = {}) {
  state.busy = true;
  state.upload = { role: progressRole, percent: 0 };
  refreshScreens();
  try {
    await uploadRoleFont(role, file, {
      slotName,
      onProgress: (fraction) => {
        state.upload = { role: progressRole, percent: fraction };
        refreshScreens();
      },
    });
    await rememberPath(file.name);
    await logActivity({ kind: slotName ? "replace" : "add", role, name: file.name, size: file.size });
    showMessage(
      t(slotName ? "savedFont" : "savedFont", {
        role: t(role === "emoji" ? "emojiSettings" : role === "chinese" ? "chineseRole" : "latinRole"),
      }),
    );
    await refresh({ silent: true });
  } catch (error) {
    try {
      await abortUpload(role);
    } catch {
      // the upload may not have started yet
    }
    showMessage(describeError(error));
  } finally {
    state.busy = false;
    state.upload = null;
    refreshScreens();
  }
}

async function importFromPath(role, path) {
  const value = String(path || "").trim();
  if (!value.startsWith("/") || /[\r\n]/.test(value)) {
    showMessage(t("pathInvalid"));
    return;
  }
  state.busy = true;
  state.upload = { role, percent: undefined };
  refreshScreens();
  try {
    showMessage(t("readingFile"), { timeout: 0 });
    // Chunked read: a single base64 of a 10 MB font froze the WebView.
    const bytes = await readDeviceFile(value, {
      onProgress: (fraction) => {
        state.upload = { role, percent: fraction * 0.5 };
        refreshScreens();
      },
    });
    const size = bytes.byteLength;
    const name = value.split("/").pop() || "font.ttf";
    await rememberPath(value);
    await logActivity({ kind: "import", role, name, size });
    await uploadRoleBytes(role, name, bytes, {
      onProgress: (fraction) => {
        state.upload = { role, percent: 0.5 + fraction * 0.5 };
        refreshScreens();
      },
    });
    showMessage(
      t("savedFont", {
        role: t(role === "emoji" ? "emojiSettings" : role === "chinese" ? "chineseRole" : "latinRole"),
      }),
    );
    await refresh({ silent: true });
  } catch (error) {
    try {
      await abortUpload(role);
    } catch {
      // ignore
    }
    showMessage(error?.message === "pathNotFound" ? t("pathNotFound") : describeError(error));
  } finally {
    state.busy = false;
    state.upload = null;
    refreshScreens();
    void moduleDir;
  }
}

async function addFont(role) {
  if (state.busy) return;
  const recent = await getRecentPaths();
  const choice = await fontSourceDialog({ recent });
  if (!choice) return;
  if (choice.type === "file") {
    const picked = await requestFilePicker(".ttf,font/ttf");
    if (picked?.unavailable) {
      showMessage(t("pickerUnavailable"));
      const path = await pathDialog({ recent });
      if (path) await importFromPath(role, path);
      return;
    }
    if (picked?.file) await uploadFile(role, picked.file);
    return;
  }
  await importFromPath(role, choice.path);
}

async function replaceFont(role, font) {
  const picked = await requestFilePicker(role === "emoji" ? ".ttf,.otf,font/ttf,font/otf" : ".ttf,font/ttf");
  if (picked?.unavailable) {
    showMessage(t("pickerUnavailable"));
    const path = await pathDialog({ recent: await getRecentPaths() });
    if (path) await importFromPath(role, path);
    return;
  }
  if (role === "emoji") {
    if (picked?.file) await uploadFile("emoji", picked.file, { progressRole: "emoji" });
    return;
  }
  if (picked?.file) await uploadFile(role, picked.file, { slotName: font.name });
}

async function removeFont(role, font) {
  state.busy = true;
  refreshScreens();
  try {
    await removeFontCommand(role, font.name);
    await logActivity({ kind: "remove", role, name: font.displayName });
    showMessage(t("removedFont"));
    await refresh({ silent: true });
  } catch (error) {
    showMessage(describeError(error));
  } finally {
    state.busy = false;
    refreshScreens();
  }
}

async function reorder(role, from, to) {
  const chain = state.status?.chains[role] ?? [];
  if (!chain.length) return;
  const names = chain.map((font) => font.name);
  const [moved] = names.splice(from, 1);
  names.splice(to, 0, moved);
  state.busy = true;
  try {
    await reorderFonts(role, names);
    await logActivity({ kind: "reorder", role, name: moved, to });
    showMessage(t("reordered"));
    await refresh({ silent: true });
  } catch (error) {
    showMessage(describeError(error));
  } finally {
    state.busy = false;
  }
}

async function setWeight(role, weight) {
  try {
    await setWeightCommand(role, normalizeWeight(weight));
    showMessage(t("savedWeight", { weight: normalizeWeight(weight) }));
    await refresh({ silent: true });
  } catch (error) {
    showMessage(describeError(error));
  }
}

async function setSize(size) {
  try {
    await setWesternSize(size);
    await refresh({ silent: true });
    showMessage(t("savedSize", { size: normalizeWesternSize(size) }));
  } catch (error) {
    showMessage(describeError(error));
  }
}

async function setFallback(enabled) {
  try {
    await setFallbackCommand(enabled);
    await refresh({ silent: true });
    showMessage(t("savedFallback", { status: t(enabled ? "enabled" : "disabled") }));
  } catch (error) {
    showMessage(describeError(error));
  }
}

async function setEmoji(mode) {
  if (mode === "custom") {
    const recent = await getRecentPaths();
    const choice = await fontSourceDialog({ recent });
    if (!choice) return;
    if (choice.type === "file") {
      const picked = await requestFilePicker(".ttf,.otf,font/ttf,font/otf");
      if (picked?.unavailable) {
        showMessage(t("pickerUnavailable"));
        const path = await pathDialog({ recent });
        if (path) await importFromPath("emoji", path);
        return;
      }
      if (picked?.file) await uploadFile("emoji", picked.file, { progressRole: "emoji" });
      return;
    }
    await importFromPath("emoji", choice.path);
    return;
  }
  state.busy = true;
  try {
    await setEmojiMode(mode);
    await logActivity({ kind: "emoji", name: mode });
    showMessage(t("savedEmoji"));
    await refresh({ silent: true });
  } catch (error) {
    showMessage(describeError(error));
  } finally {
    state.busy = false;
  }
}

async function reboot() {
  const confirmed = await confirmDialog({
    headline: t("rebootDialogHeadline"),
    body: t("rebootDialogBody"),
    confirmLabel: t("rebootConfirm"),
  });
  if (!confirmed) return;
  try {
    await rebootDevice();
  } catch (error) {
    showMessage(describeError(error));
  }
}

const ctx = {
  state,
  t,
  actions: {
    navigate,
    back: goBack,
    refresh,
    addFont,
    replaceFont,
    removeFont,
    reorder,
    setWeight,
    setSize,
    setFallback,
    setEmoji,
    reboot,
    bridgeLabelKey: () => (hasKsuBridge ? "connectedKsu" : "connectedLocal"),
    openStatusDialog: () => openStatusDialog(ctx),
    openFontDetail: (role, font, index, total) => openFontDetailDialog(ctx, role, font, index, total),
    describe: describeError,
  },
};

// Exposed for the headless checks in webui/tests (read-only inspection).
globalThis.FontSettingsDebug = { state, ctx, screens: () => [...document.querySelectorAll('section.screen')].map((s) => s.dataset.screen) };

/* -------------------------------------------------------------------- boot */

async function boot() {
  applyTheme();
  watchSystemTheme();
  onThemeChange((theme) => {
    state.theme = theme;
  });

  const cachedStatus = await getState(stateKeys.status, null);
  if (cachedStatus?.status) {
    state.status = cachedStatus.status;
    state.cachedStatus = true;
  }

  document.documentElement.lang = locale;
  document.title = t("appTitle");

  // Always start on the menu: restoring the last screen made secondary screens
  // the root of the navigation stack, so back had nothing to return to.
  const initial = "menu";
  navigationStack.push({ id: initial, direction: "right" });
  try {
    history.replaceState({ screenId: initial }, "", `#${initial}`);
  } catch {
    // ignore
  }
  renderScreen(initial, { direction: "right", leaving: null });

  window.addEventListener("popstate", () => {
    // On a secondary screen the back gesture returns to the menu; on the menu it
    // is left to the host so the WebUI can be closed as usual.
    if (navigationStack.at(-1)?.id !== "menu") goBack();
  });

  // Live data: module version and the system accent colour.
  void (async () => {
    try {
      const [settings, versionLine] = await Promise.all([
        exec("settings get secure theme_customization_overlay_packages").catch(() => ""),
        exec(`grep '^version=' '${await getModuleDir()}/module.prop'`).catch(() => ""),
      ]);
      const start = settings.indexOf("{");
      if (start >= 0) {
        const parsed = JSON.parse(settings.slice(start));
        updateAccentSeed(
          parsed["android.theme.customization.system_palette"] ||
            parsed["android.theme.customization.accent_color"],
        );
        state.theme = getThemeState();
      }
      const values = parseProperties(versionLine);
      if (values.version) state.moduleVersion = values.version;
    } catch {
      // accent colour and version are cosmetic; ignore failures
    }
    refreshScreens();
  })();

  await refresh();
  await setState(stateKeys.status, { at: Date.now(), status: state.status });
}

void boot();

/* Emoji preset list is exported for potential reuse in tests. */
export { EMOJI_PRESETS };
