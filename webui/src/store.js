/**
 * Persistent local storage for the WebUI.
 *
 * The fonts themselves live on the device (managed by the module), but every
 * piece of state the *user* creates in the browser - recent import paths, the
 * preview selection, cached device data and an activity log - is stored in
 * IndexedDB and survives reloads. localStorage is used as a fallback when
 * IndexedDB is unavailable (some WebViews restrict it for local content).
 */

const DB_NAME = "font-settings-webui";
const DB_VERSION = 1;
const STORE = "state";
const FALLBACK_PREFIX = "font-settings.state.";

let dbPromise = null;

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function readFallback(key) {
  try {
    const raw = localStorage.getItem(FALLBACK_PREFIX + key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeFallback(key, value) {
  try {
    if (value === undefined) localStorage.removeItem(FALLBACK_PREFIX + key);
    else localStorage.setItem(FALLBACK_PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore: the caller keeps an in-memory copy anyway.
  }
}

export async function getState(key, fallback = undefined) {
  const db = await openDatabase();
  if (!db) {
    const value = readFallback(key);
    return value === undefined ? fallback : value;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result === undefined ? fallback : request.result);
    request.onerror = () => resolve(fallback);
  });
}

export async function setState(key, value) {
  const db = await openDatabase();
  if (!db) {
    writeFallback(key, value);
    return value;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => {
      writeFallback(key, value);
      resolve(value);
    };
    tx.onabort = () => {
      writeFallback(key, value);
      resolve(value);
    };
  });
}

/** Remembers an imported font path, newest first, without duplicates. */
export async function rememberPath(path, limit = 8) {
  const value = String(path || "").trim();
  if (!value) return [];
  const list = await getState("recentPaths", []);
  const next = [value, ...list.filter((item) => item !== value)].slice(0, limit);
  await setState("recentPaths", next);
  return next;
}

export async function getRecentPaths() {
  const list = await getState("recentPaths", []);
  return Array.isArray(list) ? list : [];
}

/** Appends an entry to the on-device activity log kept in the browser. */
export async function logActivity(entry) {
  const list = await getState("activity", []);
  const next = [{ at: Date.now(), ...entry }, ...(Array.isArray(list) ? list : [])].slice(0, 50);
  await setState("activity", next);
  return next;
}

export async function getActivity() {
  const list = await getState("activity", []);
  return Array.isArray(list) ? list : [];
}

export const stateKeys = {
  preview: (role) => `preview.${role}`,
  families: "deviceFamilies",
  status: "statusCache",
  lastScreen: "lastScreen",
  installState: "installState",
};
