/**
 * ListenerController - Background Service Worker (ES Module)
 * Manages dynamic content script registration (MAIN + ISOLATED worlds)
 * and coordinates storage updates for discovered event listeners.
 */

import {
  migrateLegacyStorage,
  getState,
  registerDiscoveredEvents,
  findMatchingDomain
} from "./modules/storage.js";

// Serialize storage mutations to avoid race conditions when multiple events arrive rapidly
let writeQueue = Promise.resolve();
function enqueueWrite(taskFn) {
  writeQueue = writeQueue.then(taskFn, taskFn);
  return writeQueue;
}

/**
 * Build safe script IDs for chrome.scripting.registerContentScripts
 */
function sanitizeId(domain, index, world) {
  const safeDomain = domain.replace(/[^a-z0-9._-]/gi, "_");
  return `ct_${world}_${index}_${safeDomain}`;
}

/**
 * Dynamically register both MAIN world (`injected.js`) and ISOLATED world (`content.js`)
 * content scripts at `document_start` for all configured domains.
 */
export async function updateContentScripts(domains) {
  try {
    const registered = await chrome.scripting.getRegisteredContentScripts();
    const registeredIds = registered.map((s) => s.id);

    if (registeredIds.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: registeredIds });
    }

    const validDomains = (domains || []).filter(Boolean);
    if (validDomains.length === 0) return;

    const scripts = [];
    validDomains.forEach((domain, index) => {
      const matches = [`*://*.${domain}/*`, `*://${domain}/*`];

      // 1. MAIN world script: hooks addEventListener, inline handlers, and visibility APIs at document_start
      scripts.push({
        id: sanitizeId(domain, index, "main"),
        matches,
        js: ["injected.js"],
        runAt: "document_start",
        world: "MAIN"
      });

      // 2. ISOLATED world script: bridges chrome.storage <-> MAIN world
      scripts.push({
        id: sanitizeId(domain, index, "isolated"),
        matches,
        js: ["content.js"],
        runAt: "document_start",
        world: "ISOLATED"
      });
    });

    await chrome.scripting.registerContentScripts(scripts);
    console.log("[ListenerController] Updated registered domain scripts:", validDomains);

    // Also ensure any already-open tabs matching the configured domains have the scripts injected
    await injectIntoMatchingOpenTabs(validDomains);
  } catch (err) {
    console.error("[ListenerController] Error updating content scripts:", err);
  }
}

/**
 * If the user adds a domain while a tab for that website is already open,
 * inject `injected.js` and `content.js` (idempotent due to guard flags) and trigger a sync.
 */
async function injectIntoMatchingOpenTabs(domains) {
  if (!domains || domains.length === 0) return;
  try {
    const domainsMap = {};
    domains.forEach((d) => {
      domainsMap[d] = true;
    });

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id || !tab.url || !/^https?:\/\//i.test(tab.url)) continue;
      try {
        const urlObj = new URL(tab.url);
        const matched = findMatchingDomain(urlObj.hostname, domainsMap);
        if (!matched) continue;

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["injected.js"],
          world: "MAIN"
        });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
          world: "ISOLATED"
        });
        chrome.tabs.sendMessage(tab.id, { action: "requestPageEvents" }).catch(() => {});
      } catch (_) {
        // Ignore restricted tabs
      }
    }
  } catch (_) {
    // Ignore tab query errors
  }
}

/**
 * Initialize storage migration and register scripts on startup/install.
 */
async function initializeExtension() {
  const { domainsData } = await migrateLegacyStorage();
  const domains = Object.keys(domainsData || {});
  await updateContentScripts(domains);
}

chrome.runtime.onInstalled.addListener(() => {
  initializeExtension();
});

chrome.runtime.onStartup.addListener(() => {
  initializeExtension();
});

// Listen for messages from popup.js and content.js
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (!request || !request.action) return false;

  if (request.action === "updateDomains") {
    getState()
      .then(({ domainsData }) => {
        const domains = request.domains || Object.keys(domainsData || {});
        return updateContentScripts(domains);
      })
      .then(() => sendResponse({ status: "ok" }))
      .catch((err) => sendResponse({ status: "error", message: String(err) }));
    return true;
  }

  if (request.action === "registerDiscoveredEvents") {
    enqueueWrite(() =>
      registerDiscoveredEvents(request.hostname, request.events)
    )
      .then((result) => sendResponse({ status: "ok", ...result }))
      .catch((err) => sendResponse({ status: "error", message: String(err) }));
    return true;
  }

  if (request.action === "syncOpenTabs") {
    getState()
      .then(({ domainsData }) =>
        injectIntoMatchingOpenTabs(Object.keys(domainsData || {}))
      )
      .then(() => sendResponse({ status: "ok" }))
      .catch(() => sendResponse({ status: "ok" }));
    return true;
  }

  return false;
});
