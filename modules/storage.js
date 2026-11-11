/**
 * Storage Module
 * Handles all state persistence for domains, discovered event listeners, and settings.
 */

import {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  FOCUS_VISIBILITY_EVENTS
} from "../config/settings.js";

/**
 * Normalize raw user input (URL or hostname) into a clean domain string.
 * e.g. "https://www.Example.com/exam/123" -> "example.com"
 */
export function normalizeDomain(rawInput) {
  if (!rawInput || typeof rawInput !== "string") return "";
  return rawInput
    .trim()
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .split("/")[0]
    .split("?")[0]
    .split("#")[0]
    .trim();
}

/**
 * Match a page's hostname (e.g. "app.example.com") to a configured domain (e.g. "example.com").
 */
export function findMatchingDomain(hostname, domainsData) {
  if (!hostname || !domainsData) return null;
  const cleanHost = normalizeDomain(hostname);
  const configuredDomains = Object.keys(domainsData);

  if (domainsData[cleanHost]) {
    return cleanHost;
  }

  // Sort by length descending so more specific subdomains match first
  const sorted = configuredDomains.sort((a, b) => b.length - a.length);
  for (const domain of sorted) {
    if (cleanHost === domain || cleanHost.endsWith(`.${domain}`)) {
      return domain;
    }
  }
  return null;
}

/**
 * Determine initial ON/OFF state for a newly discovered event listener based on settings.
 * Returns true for ON (enabled) and false for OFF (disabled).
 */
export function getInitialEventState(eventName, settings) {
  if (settings.autoDisableFocusEvents && FOCUS_VISIBILITY_EVENTS.includes(eventName)) {
    return false;
  }
  return Boolean(settings.defaultNewListenerState);
}

/**
 * Migrate legacy v1.0 `disabledDomains` array from chrome.storage.sync if present.
 */
export async function migrateLegacyStorage() {
  try {
    const localData = await chrome.storage.local.get([
      STORAGE_KEYS.DOMAINS_DATA,
      STORAGE_KEYS.SETTINGS
    ]);

    const settings = {
      ...DEFAULT_SETTINGS,
      ...(localData[STORAGE_KEYS.SETTINGS] || {})
    };

    let domainsData = localData[STORAGE_KEYS.DOMAINS_DATA];

    if (!domainsData) {
      domainsData = {};
      const syncData = await chrome.storage.sync.get({
        [STORAGE_KEYS.LEGACY_DOMAINS]: []
      });
      const legacyDomains = syncData[STORAGE_KEYS.LEGACY_DOMAINS] || [];

      for (const rawDomain of legacyDomains) {
        const domain = normalizeDomain(rawDomain);
        if (domain && !domainsData[domain]) {
          domainsData[domain] = createDomainEntry(settings);
        }
      }

      await chrome.storage.local.set({
        [STORAGE_KEYS.DOMAINS_DATA]: domainsData,
        [STORAGE_KEYS.SETTINGS]: settings
      });
    } else if (!localData[STORAGE_KEYS.SETTINGS]) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SETTINGS]: settings
      });
    }

    return { domainsData, settings };
  } catch (err) {
    console.error("[ListenerController] Storage migration error:", err);
    return { domainsData: {}, settings: { ...DEFAULT_SETTINGS } };
  }
}

/**
 * Create a fresh domain entry structure.
 */
export function createDomainEntry(settings = DEFAULT_SETTINGS) {
  const listeners = {};
  if (settings.seedFocusEventsOnAdd) {
    for (const evt of FOCUS_VISIBILITY_EVENTS) {
      listeners[evt] = getInitialEventState(evt, settings);
    }
  }
  return {
    listeners,
    expanded: false,
    addedAt: Date.now()
  };
}

/**
 * Get all domains data and settings.
 */
export async function getState() {
  const data = await chrome.storage.local.get({
    [STORAGE_KEYS.DOMAINS_DATA]: {},
    [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS
  });

  return {
    domainsData: data[STORAGE_KEYS.DOMAINS_DATA] || {},
    settings: { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.SETTINGS] || {}) }
  };
}

/**
 * Add a new domain to the list.
 */
export async function addDomain(rawDomain) {
  const domain = normalizeDomain(rawDomain);
  if (!domain) return { added: false, domain: "" };

  const { domainsData, settings } = await getState();
  if (domainsData[domain]) {
    return { added: false, domain, domainsData };
  }

  domainsData[domain] = createDomainEntry(settings);
  await chrome.storage.local.set({ [STORAGE_KEYS.DOMAINS_DATA]: domainsData });
  return { added: true, domain, domainsData };
}

/**
 * Remove a domain from the list.
 */
export async function removeDomain(domain) {
  const { domainsData } = await getState();
  if (domainsData[domain]) {
    delete domainsData[domain];
    await chrome.storage.local.set({ [STORAGE_KEYS.DOMAINS_DATA]: domainsData });
  }
  return domainsData;
}

/**
 * Toggle or set the expanded UI state for a domain box.
 */
export async function setDomainExpanded(domain, expanded) {
  const { domainsData } = await getState();
  if (!domainsData[domain]) return domainsData;

  domainsData[domain].expanded = Boolean(expanded);
  await chrome.storage.local.set({ [STORAGE_KEYS.DOMAINS_DATA]: domainsData });
  return domainsData;
}

/**
 * Toggle a single event listener ON (true) or OFF (false) for a specific domain.
 */
export async function setEventListenerState(domain, eventName, isEnabled) {
  const { domainsData } = await getState();
  if (!domainsData[domain]) return domainsData;

  if (!domainsData[domain].listeners) {
    domainsData[domain].listeners = {};
  }
  domainsData[domain].listeners[eventName] = Boolean(isEnabled);

  await chrome.storage.local.set({ [STORAGE_KEYS.DOMAINS_DATA]: domainsData });
  return domainsData;
}

/**
 * Set all discovered event listeners for a domain to ON (true) or OFF (false).
 */
export async function setAllListenersForDomain(domain, isEnabled) {
  const { domainsData } = await getState();
  if (!domainsData[domain] || !domainsData[domain].listeners) return domainsData;

  const enabled = Boolean(isEnabled);
  for (const eventName of Object.keys(domainsData[domain].listeners)) {
    domainsData[domain].listeners[eventName] = enabled;
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.DOMAINS_DATA]: domainsData });
  return domainsData;
}

/**
 * Merge newly discovered event listener names reported from a visited website into storage.
 * Preserves existing user on/off choices for already-known event names.
 */
export async function registerDiscoveredEvents(domain, eventNames = []) {
  if (!domain || !Array.isArray(eventNames) || eventNames.length === 0) {
    return { updated: false };
  }

  const { domainsData, settings } = await getState();
  const matchedDomain = findMatchingDomain(domain, domainsData);
  if (!matchedDomain || !domainsData[matchedDomain]) {
    return { updated: false };
  }

  const entry = domainsData[matchedDomain];
  if (!entry.listeners) {
    entry.listeners = {};
  }

  let hasNew = false;
  for (const rawName of eventNames) {
    const name = String(rawName || "").trim();
    if (!name || name.startsWith("__cheaptrick_")) continue;

    if (typeof entry.listeners[name] !== "boolean") {
      entry.listeners[name] = getInitialEventState(name, settings);
      hasNew = true;
    }
  }

  if (hasNew) {
    await chrome.storage.local.set({ [STORAGE_KEYS.DOMAINS_DATA]: domainsData });
  }

  return {
    updated: hasNew,
    domain: matchedDomain,
    domainConfig: entry,
    settings
  };
}

/**
 * Update extension settings.
 */
export async function updateSettings(partialSettings) {
  const { settings } = await getState();
  const updated = { ...settings, ...partialSettings };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
  return updated;
}
