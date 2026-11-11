/**
 * CheapTrick - ISOLATED World Content Script Bridge
 * Runs at `document_start` in the ISOLATED world.
 * Bridges `chrome.storage` / `background.js` <-> MAIN world `injected.js`.
 */
(function () {
  if (window.__CHEAPTRICK_ISOLATED_INITIALIZED__) return;
  window.__CHEAPTRICK_ISOLATED_INITIALIZED__ = true;

  const STORAGE_KEYS = {
    DOMAINS_DATA: "domainsData",
    SETTINGS: "extensionSettings"
  };

  const BRIDGE_EVENTS = {
    CONFIG_TO_MAIN: "__cheaptrick_config_to_main__",
    DISCOVERED_TO_ISOLATED: "__cheaptrick_discovered_to_isolated__",
    REQUEST_SYNC: "__cheaptrick_request_sync__"
  };

  const FOCUS_VISIBILITY_EVENTS = [
    "blur",
    "visibilitychange",
    "mouseleave",
    "pagehide",
    "fullscreenchange",
    "webkitfullscreenchange",
    "mozfullscreenchange",
    "MSFullscreenChange"
  ];

  const DEFAULT_SETTINGS = {
    language: "en",
    theme: "light",
    defaultNewListenerState: true,
    autoDisableFocusEvents: true,
    seedFocusEventsOnAdd: false,
    spoofVisibilityAndFocus: true,
    interceptInlineHandlers: true,
    debugLog: false
  };

  function normalizeDomain(raw) {
    if (!raw || typeof raw !== "string") return "";
    return raw
      .trim()
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, "")
      .split("/")[0]
      .trim();
  }

  function findMatchingDomain(hostname, domainsData) {
    if (!hostname || !domainsData) return null;
    const cleanHost = normalizeDomain(hostname);
    if (domainsData[cleanHost]) return cleanHost;

    const sorted = Object.keys(domainsData).sort((a, b) => b.length - a.length);
    for (const domain of sorted) {
      if (cleanHost === domain || cleanHost.endsWith(`.${domain}`)) {
        return domain;
      }
    }
    return null;
  }

  function pushConfigToMain(listeners, settings) {
    window.dispatchEvent(
      new CustomEvent(BRIDGE_EVENTS.CONFIG_TO_MAIN, {
        detail: {
          listeners: listeners || {},
          settings: settings || DEFAULT_SETTINGS
        }
      })
    );
  }

  async function syncFromStorageToMain() {
    try {
      const data = await chrome.storage.local.get({
        [STORAGE_KEYS.DOMAINS_DATA]: {},
        [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS
      });

      const domainsData = data[STORAGE_KEYS.DOMAINS_DATA] || {};
      const settings = {
        ...DEFAULT_SETTINGS,
        ...(data[STORAGE_KEYS.SETTINGS] || {})
      };
      const matchedDomain = findMatchingDomain(
        window.location.hostname,
        domainsData
      );

      if (matchedDomain && domainsData[matchedDomain]) {
        pushConfigToMain(domainsData[matchedDomain].listeners || {}, settings);
      } else {
        pushConfigToMain({}, settings);
      }
    } catch (_) {
      // Extension context may have been invalidated on reload
    }
  }

  /**
   * Persist newly discovered event listeners reported by `injected.js`.
   * Uses background message to serialize writes, with direct storage fallback.
   */
  async function handleDiscoveredEvents(events) {
    if (!Array.isArray(events) || events.length === 0) return;
    const hostname = window.location.hostname;
    if (!hostname) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: "registerDiscoveredEvents",
        hostname,
        events
      });

      if (response && response.domainConfig) {
        pushConfigToMain(response.domainConfig.listeners, response.settings);
      }
    } catch (_) {
      // Fallback: write directly to chrome.storage.local if service worker was asleep
      try {
        const data = await chrome.storage.local.get({
          [STORAGE_KEYS.DOMAINS_DATA]: {},
          [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS
        });
        const domainsData = data[STORAGE_KEYS.DOMAINS_DATA] || {};
        const settings = {
          ...DEFAULT_SETTINGS,
          ...(data[STORAGE_KEYS.SETTINGS] || {})
        };
        const matched = findMatchingDomain(hostname, domainsData);
        if (!matched || !domainsData[matched]) return;

        const entry = domainsData[matched];
        if (!entry.listeners) entry.listeners = {};
        let changed = false;

        for (const rawName of events) {
          const name = String(rawName || "").trim();
          if (!name || name.startsWith("__cheaptrick_")) continue;
          if (typeof entry.listeners[name] !== "boolean") {
            entry.listeners[name] =
              settings.autoDisableFocusEvents &&
              FOCUS_VISIBILITY_EVENTS.includes(name)
                ? false
                : Boolean(settings.defaultNewListenerState);
            changed = true;
          }
        }

        if (changed) {
          await chrome.storage.local.set({
            [STORAGE_KEYS.DOMAINS_DATA]: domainsData
          });
        }
        pushConfigToMain(entry.listeners, settings);
      } catch (__) {
        // Ignore
      }
    }
  }

  // 1. Listen for discovered event listeners from MAIN world `injected.js`
  window.addEventListener(BRIDGE_EVENTS.DISCOVERED_TO_ISOLATED, (e) => {
    if (e && e.detail && Array.isArray(e.detail.events)) {
      handleDiscoveredEvents(e.detail.events);
    }
  });

  // 2. Listen for live storage changes (when user toggles checkboxes or settings in popup)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      if (changes[STORAGE_KEYS.DOMAINS_DATA] || changes[STORAGE_KEYS.SETTINGS]) {
        syncFromStorageToMain();
      }
    }
  });

  // 3. Respond to explicit sync requests from popup/background
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request && request.action === "requestPageEvents") {
      syncFromStorageToMain();
      window.dispatchEvent(new CustomEvent(BRIDGE_EVENTS.REQUEST_SYNC));
      sendResponse({ status: "ok" });
    }
    return false;
  });

  // 4. Initial sync at document_start + request any already-discovered events from MAIN world
  syncFromStorageToMain().then(() => {
    window.dispatchEvent(new CustomEvent(BRIDGE_EVENTS.REQUEST_SYNC));
  });
})();
