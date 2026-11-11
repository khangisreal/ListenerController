/**
 * Popup UI Module
 * Renders domain boxes, collapsible event listener lists, settings controls,
 * and handles Language (EN/VI) + Light/Dark Mode theme updates.
 */

import { FOCUS_VISIBILITY_EVENTS, I18N } from "../config/settings.js";

/**
 * Get the active translation dictionary ("en" default, or "vi").
 */
export function getDict(settings) {
  const lang = settings && settings.language === "vi" ? "vi" : "en";
  return I18N[lang];
}

/**
 * Create SVG chevron arrow icon for the domain box side toggle.
 */
function createArrowSvg() {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const polyline = document.createElementNS(svgNS, "polyline");
  polyline.setAttribute("points", "9 18 15 12 9 6");
  svg.appendChild(polyline);
  return svg;
}

/**
 * Create Sun SVG (shown in Dark Mode to switch to Light) or Moon SVG (shown in Light Mode to switch to Dark).
 */
function createThemeIconSvg(theme) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  if (theme === "dark") {
    // Sun icon
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "12");
    circle.setAttribute("r", "5");
    svg.appendChild(circle);

    const rays = [
      ["12", "1", "12", "3"],
      ["12", "21", "12", "23"],
      ["4.22", "4.22", "5.64", "5.64"],
      ["18.36", "18.36", "19.78", "19.78"],
      ["1", "12", "3", "12"],
      ["21", "12", "23", "12"],
      ["4.22", "19.78", "5.64", "18.36"],
      ["18.36", "5.64", "19.78", "4.22"]
    ];
    rays.forEach(([x1, y1, x2, y2]) => {
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      svg.appendChild(line);
    });
  } else {
    // Moon icon
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z");
    svg.appendChild(path);
  }

  return svg;
}

/**
 * Apply active Theme (Light/Dark) and Language (EN/VI) to static header & form controls.
 */
export function applyThemeAndTranslations({
  settings,
  headerTitleEl,
  domainInputEl,
  addBtnEl,
  langToggleBtnEl,
  langCodeEl,
  themeToggleBtnEl,
  settingsToggleBtnEl
}) {
  const lang = settings && settings.language === "vi" ? "vi" : "en";
  const theme = settings && settings.theme === "dark" ? "dark" : "light";
  const t = I18N[lang];

  try {
    localStorage.setItem("__cheaptrick_ui_theme__", theme);
    localStorage.setItem("__cheaptrick_ui_lang__", lang);
  } catch (_) {}

  document.documentElement.lang = lang;
  document.body.setAttribute("data-theme", theme);

  if (headerTitleEl) headerTitleEl.textContent = t.headerTitle;
  if (domainInputEl) domainInputEl.placeholder = t.domainPlaceholder;
  if (addBtnEl) addBtnEl.textContent = t.addBtn;

  if (langCodeEl) {
    langCodeEl.textContent = lang.toUpperCase();
  }
  if (langToggleBtnEl) {
    langToggleBtnEl.title = t.langBtnTitle;
  }

  if (themeToggleBtnEl) {
    themeToggleBtnEl.innerHTML = "";
    themeToggleBtnEl.appendChild(createThemeIconSvg(theme));
    themeToggleBtnEl.title =
      theme === "dark" ? t.themeBtnTitleDark : t.themeBtnTitleLight;
  }

  if (settingsToggleBtnEl) {
    settingsToggleBtnEl.title = t.settingsBtnTitle;
  }
}

/**
 * Sort event listener names so focus/visibility events appear at the top,
 * followed by alphabetical order.
 */
function sortEventNames(eventNames) {
  return [...eventNames].sort((a, b) => {
    const aFocus = FOCUS_VISIBILITY_EVENTS.includes(a);
    const bFocus = FOCUS_VISIBILITY_EVENTS.includes(b);
    if (aFocus && !bFocus) return -1;
    if (!aFocus && bFocus) return 1;
    return a.localeCompare(b);
  });
}

/**
 * Render all domain boxes and their pop-down event listener lists.
 * Preserves scroll positions for both the outer domain list box and inner event listener lists.
 */
export function renderDomainBoxes({
  domainListEl,
  domainListBoxEl,
  domainsData,
  settings,
  onToggleExpand,
  onDeleteDomain,
  onToggleListener,
  onToggleAllListeners
}) {
  const t = getDict(settings);

  // Record current scroll positions before re-render
  const outerScrollTop = domainListBoxEl ? domainListBoxEl.scrollTop : 0;
  const innerScrollMap = {};
  domainListEl.querySelectorAll(".listener-list[data-domain]").forEach((listEl) => {
    innerScrollMap[listEl.dataset.domain] = listEl.scrollTop;
  });

  domainListEl.innerHTML = "";
  const domains = Object.keys(domainsData || {});

  if (domains.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "empty-domains";
    emptyDiv.textContent = t.emptyDomains;
    domainListEl.appendChild(emptyDiv);
    return;
  }

  domains.forEach((domain) => {
    const entry = domainsData[domain] || { listeners: {}, expanded: false };
    const listenersMap = entry.listeners || {};
    const eventNames = sortEventNames(Object.keys(listenersMap));
    const totalCount = eventNames.length;
    const enabledCount = eventNames.filter((name) => listenersMap[name] !== false).length;
    const isExpanded = Boolean(entry.expanded);

    // 1. Domain Box container
    const li = document.createElement("li");
    li.className = "domain-box";

    // 2. Domain Header Row
    const header = document.createElement("div");
    header.className = "domain-header";

    const leftGroup = document.createElement("div");
    leftGroup.className = "domain-left";
    leftGroup.title = t.toggleExpandTitle;

    const arrowBtn = document.createElement("button");
    arrowBtn.type = "button";
    arrowBtn.className = `arrow-btn${isExpanded ? " expanded" : ""}`;
    arrowBtn.setAttribute("aria-label", "Toggle event listeners list");
    arrowBtn.appendChild(createArrowSvg());

    const domainTitle = document.createElement("span");
    domainTitle.className = "domain-name";
    domainTitle.textContent = domain;

    const countBadge = document.createElement("span");
    countBadge.className = "listener-count-badge";
    countBadge.textContent = `${enabledCount}/${totalCount}`;
    countBadge.title = t.badgeTitle(enabledCount, totalCount);

    leftGroup.appendChild(arrowBtn);
    leftGroup.appendChild(domainTitle);
    leftGroup.appendChild(countBadge);

    leftGroup.addEventListener("click", () => {
      onToggleExpand(domain, !isExpanded);
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "del-btn";
    delBtn.textContent = t.deleteBtn;
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onDeleteDomain(domain);
    });

    header.appendChild(leftGroup);
    header.appendChild(delBtn);
    li.appendChild(header);

    // 3. Pop-down Event Listeners Dropdown
    const dropdown = document.createElement("div");
    dropdown.className = `listener-dropdown${isExpanded ? " expanded" : ""}`;

    if (totalCount === 0) {
      const emptyListeners = document.createElement("div");
      emptyListeners.className = "empty-listeners";
      emptyListeners.textContent = t.emptyListeners;
      dropdown.appendChild(emptyListeners);
    } else {
      // Quick toolbar with All On / All Off
      const toolbar = document.createElement("div");
      toolbar.className = "listener-toolbar";

      const labelSpan = document.createElement("span");
      labelSpan.textContent = t.listenersHeader(totalCount);

      const bulkActions = document.createElement("div");
      bulkActions.className = "bulk-actions";

      const allOnBtn = document.createElement("button");
      allOnBtn.type = "button";
      allOnBtn.className = "mini-btn";
      allOnBtn.textContent = t.allOnBtn;
      allOnBtn.addEventListener("click", () => onToggleAllListeners(domain, true));

      const allOffBtn = document.createElement("button");
      allOffBtn.type = "button";
      allOffBtn.className = "mini-btn";
      allOffBtn.textContent = t.allOffBtn;
      allOffBtn.addEventListener("click", () => onToggleAllListeners(domain, false));

      bulkActions.appendChild(allOnBtn);
      bulkActions.appendChild(allOffBtn);
      toolbar.appendChild(labelSpan);
      toolbar.appendChild(bulkActions);
      dropdown.appendChild(toolbar);

      // Scrollable Event Listeners List: [eventlistener name] [checkmark box for on/off]
      const listenerUl = document.createElement("ul");
      listenerUl.className = "listener-list";
      listenerUl.dataset.domain = domain;

      eventNames.forEach((evtName) => {
        const isEnabled = listenersMap[evtName] !== false;

        const itemLi = document.createElement("li");
        itemLi.className = "listener-item";

        const label = document.createElement("label");
        label.className = "listener-label";

        const nameSpan = document.createElement("span");
        nameSpan.className = `listener-name${isEnabled ? "" : " is-off"}`;
        nameSpan.textContent = evtName;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "listener-checkbox";
        checkbox.checked = isEnabled;
        checkbox.title = isEnabled ? t.checkboxOnTitle : t.checkboxOffTitle;

        checkbox.addEventListener("change", () => {
          onToggleListener(domain, evtName, checkbox.checked);
        });

        label.appendChild(nameSpan);
        label.appendChild(checkbox);
        itemLi.appendChild(label);
        listenerUl.appendChild(itemLi);
      });

      dropdown.appendChild(listenerUl);
    }

    li.appendChild(dropdown);
    domainListEl.appendChild(li);
  });

  // Restore scroll positions
  if (domainListBoxEl) {
    domainListBoxEl.scrollTop = outerScrollTop;
  }
  domainListEl.querySelectorAll(".listener-list[data-domain]").forEach((listEl) => {
    const savedScroll = innerScrollMap[listEl.dataset.domain];
    if (typeof savedScroll === "number") {
      listEl.scrollTop = savedScroll;
    }
  });
}

/**
 * Render the modular Settings panel controls in the active language.
 */
export function renderSettingsPanel(settingsContainer, settings, onChangeSetting) {
  if (!settingsContainer) return;
  const t = getDict(settings);

  const settingKeys = [
    "defaultNewListenerState",
    "autoDisableFocusEvents",
    "seedFocusEventsOnAdd",
    "spoofVisibilityAndFocus",
    "interceptInlineHandlers",
    "debugLog"
  ];

  settingsContainer.innerHTML = "";

  const title = document.createElement("div");
  title.className = "settings-title";
  title.textContent = t.settingsTitle;
  settingsContainer.appendChild(title);

  settingKeys.forEach((key) => {
    const row = document.createElement("div");
    row.className = "setting-row";

    const id = `setting_${key}`;
    const labelEl = document.createElement("label");
    labelEl.setAttribute("for", id);
    labelEl.textContent = t.settingsLabels[key];

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = id;
    checkbox.className = "listener-checkbox";
    checkbox.checked = Boolean(settings[key]);

    checkbox.addEventListener("change", () => {
      onChangeSetting({ [key]: checkbox.checked });
    });

    row.appendChild(labelEl);
    row.appendChild(checkbox);
    settingsContainer.appendChild(row);
  });
}
