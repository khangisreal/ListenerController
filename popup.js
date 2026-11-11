/**
 * CheapTrick - Popup Controller (ES Module)
 * Connects UI events with the storage module, i18n, theme switcher, and background service worker.
 */

import { STORAGE_KEYS } from "./config/settings.js";
import {
  migrateLegacyStorage,
  getState,
  addDomain,
  removeDomain,
  setDomainExpanded,
  setEventListenerState,
  setAllListenersForDomain,
  updateSettings
} from "./modules/storage.js";
import {
  applyThemeAndTranslations,
  renderDomainBoxes,
  renderSettingsPanel
} from "./modules/ui.js";

// Apply cached theme synchronously on frame 0 so opening the popup never flashes or animates from light to dark
try {
  const cachedTheme = localStorage.getItem("__cheaptrick_ui_theme__");
  if (cachedTheme === "dark" || cachedTheme === "light") {
    document.body.setAttribute("data-theme", cachedTheme);
  }
} catch (_) {}

document.addEventListener("DOMContentLoaded", async () => {
  const headerTitle = document.getElementById("headerTitle");
  const domainInput = document.getElementById("domainInput");
  const addBtn = document.getElementById("addBtn");
  const domainList = document.getElementById("domainList");
  const domainListBox = document.getElementById("domainListBox");
  const langToggleBtn = document.getElementById("langToggleBtn");
  const langCode = document.getElementById("langCode");
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const settingsToggleBtn = document.getElementById("settingsToggleBtn");
  const settingsPanel = document.getElementById("settingsPanel");

  function notifyDomainsUpdated(domainsData) {
    const domains = Object.keys(domainsData || {});
    chrome.runtime.sendMessage({ action: "updateDomains", domains }).catch(() => {});
  }

  async function refreshUI() {
    const { domainsData, settings } = await getState();

    applyThemeAndTranslations({
      settings,
      headerTitleEl: headerTitle,
      domainInputEl: domainInput,
      addBtnEl: addBtn,
      langToggleBtnEl: langToggleBtn,
      langCodeEl: langCode,
      themeToggleBtnEl: themeToggleBtn,
      settingsToggleBtnEl: settingsToggleBtn
    });

    renderDomainBoxes({
      domainListEl: domainList,
      domainListBoxEl: domainListBox,
      domainsData,
      settings,
      onToggleExpand: async (domain, expanded) => {
        await setDomainExpanded(domain, expanded);
        if (expanded) {
          chrome.runtime.sendMessage({ action: "syncOpenTabs" }).catch(() => {});
        }
        await refreshUI();
      },
      onDeleteDomain: async (domain) => {
        const updatedDomains = await removeDomain(domain);
        notifyDomainsUpdated(updatedDomains);
        await refreshUI();
      },
      onToggleListener: async (domain, eventName, isEnabled) => {
        await setEventListenerState(domain, eventName, isEnabled);
        await refreshUI();
      },
      onToggleAllListeners: async (domain, isEnabled) => {
        await setAllListenersForDomain(domain, isEnabled);
        await refreshUI();
      }
    });

    renderSettingsPanel(settingsPanel, settings, async (partialSettings) => {
      await updateSettings(partialSettings);
      await refreshUI();
    });
  }

  async function handleAddDomain() {
    const rawValue = domainInput.value;
    const { added, domainsData } = await addDomain(rawValue);
    if (added) {
      domainInput.value = "";
      notifyDomainsUpdated(domainsData);
      await refreshUI();
    } else if (rawValue.trim()) {
      domainInput.select();
    }
  }

  addBtn.addEventListener("click", handleAddDomain);

  domainInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddDomain();
    }
  });

  // Language Switcher (VI <-> EN)
  langToggleBtn.addEventListener("click", async () => {
    const { settings } = await getState();
    const nextLang = settings.language === "en" ? "vi" : "en";
    await updateSettings({ language: nextLang });
    await refreshUI();
  });

  // Light / Dark Mode Switcher (enable smooth CSS transition only on user click)
  themeToggleBtn.addEventListener("click", async () => {
    document.body.classList.add("theme-animate");
    const { settings } = await getState();
    const nextTheme = settings.theme === "dark" ? "light" : "dark";
    await updateSettings({ theme: nextTheme });
    await refreshUI();
  });

  // Settings Panel Toggle
  settingsToggleBtn.addEventListener("click", () => {
    const isOpen = settingsPanel.classList.toggle("open");
    settingsToggleBtn.classList.toggle("active", isOpen);
  });

  // Live-update popup UI when websites discover new event listeners in the background
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName === "local" &&
      (changes[STORAGE_KEYS.DOMAINS_DATA] || changes[STORAGE_KEYS.SETTINGS])
    ) {
      refreshUI();
    }
  });

  // Initialize state and request active tabs to flush any discovered listeners
  await migrateLegacyStorage();
  await refreshUI();
  chrome.runtime.sendMessage({ action: "syncOpenTabs" }).catch(() => {});
});
