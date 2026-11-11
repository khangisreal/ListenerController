/**
 * Centralized Configuration, Default Settings & Internationalization (EN / VI)
 * Easier to maintain, extend, and control extension behavior in one place.
 */

export const STORAGE_KEYS = {
  DOMAINS_DATA: "domainsData",       // Map: { [domain]: { listeners: { [eventName]: boolean }, expanded: boolean, addedAt: number } }
  SETTINGS: "extensionSettings",     // Extension-wide user settings
  LEGACY_DOMAINS: "disabledDomains"  // Legacy v1.0 key in chrome.storage.sync for automatic migration
};

export const BRIDGE_EVENTS = {
  CONFIG_TO_MAIN: "__cheaptrick_config_to_main__",
  DISCOVERED_TO_ISOLATED: "__cheaptrick_discovered_to_isolated__",
  REQUEST_SYNC: "__cheaptrick_request_sync__"
};

export const LOCAL_CACHE_KEY = "__cheaptrick_domain_cache_v2__";

/**
 * Focus, visibility, and anti-leave events that the original extension targeted.
 * Used when "autoDisableFocusEvents" setting is enabled.
 */
export const FOCUS_VISIBILITY_EVENTS = [
  "blur",
  "visibilitychange",
  "mouseleave",
  "pagehide",
  "fullscreenchange",
  "webkitfullscreenchange",
  "mozfullscreenchange",
  "MSFullscreenChange"
];

/**
 * Common inline `on*` event properties monitored on window, document, and elements.
 */
export const MONITORED_ON_PROPERTIES = [
  "blur",
  "focus",
  "visibilitychange",
  "fullscreenchange",
  "webkitfullscreenchange",
  "mouseleave",
  "mouseout",
  "pagehide",
  "beforeunload",
  "unload",
  "contextmenu",
  "copy",
  "cut",
  "paste",
  "selectstart",
  "keydown",
  "keyup",
  "keypress",
  "click",
  "dblclick",
  "mousedown",
  "mouseup",
  "mousemove",
  "wheel",
  "scroll",
  "resize"
];

/**
 * Default user-configurable settings.
 * Note on listener state:
 *   true  (checked)   = Event listener is ON  (active / allowed to fire)
 *   false (unchecked) = Event listener is OFF (blocked / prevented from firing)
 */
export const DEFAULT_SETTINGS = {
  // UI Language: "en" (English - default) or "vi" (Vietnamese)
  language: "en",

  // UI Theme: "light" or "dark"
  theme: "light",

  // Default state when a new event listener is discovered on a website:
  // true = ON (enabled), false = OFF (disabled)
  defaultNewListenerState: true,

  // Automatically turn OFF focus/visibility events (blur, visibilitychange, etc.) when discovered
  autoDisableFocusEvents: true,

  // Pre-seed focus/visibility events into a domain box when a domain is first added
  seedFocusEventsOnAdd: false,

  // Spoof document.visibilityState, document.hidden, and document.hasFocus() when visibility/blur events are OFF
  spoofVisibilityAndFocus: true,

  // Also detect and control inline `on*` property handlers (e.g., window.onblur = ...)
  interceptInlineHandlers: true,

  // Log blocked/discovered events in the page console
  debugLog: false
};

/**
 * Bilingual translations (Vietnamese & English)
 */
export const I18N = {
  vi: {
    headerTitle: "Danh sách URL",
    domainPlaceholder: "Ví dụ: example.com",
    addBtn: "Thêm URL",
    deleteBtn: "Xóa",
    allOnBtn: "Bật hết",
    allOffBtn: "Tắt hết",
    listenersHeader: (count) => `EventListeners (${count})`,
    emptyDomains: "Chưa có domain nào. Nhập domain ở trên để bắt đầu.",
    emptyListeners: "Chưa có eventlistener nào. Hãy truy cập vào website này để tự động thu thập danh sách.",
    toggleExpandTitle: "Nhấn để đóng/mở danh sách EventListeners",
    badgeTitle: (enabled, total) => `${enabled} đang bật / ${total} eventlisteners đã phát hiện`,
    checkboxOnTitle: "Đang bật (ON) - Bỏ tích để chặn",
    checkboxOffTitle: "Đang tắt (OFF) - Tích để bật lại",
    langBtnTitle: "Chuyển ngôn ngữ: Tiếng Việt / English",
    themeBtnTitleLight: "Chuyển sang giao diện Tối (Dark Mode)",
    themeBtnTitleDark: "Chuyển sang giao diện Sáng (Light Mode)",
    settingsBtnTitle: "Mở/Đóng Cài đặt",
    settingsTitle: "Cài đặt",
    settingsLabels: {
      defaultNewListenerState: "Mặc định bật (ON) event mới phát hiện",
      autoDisableFocusEvents: "Tự động tắt (OFF) các event chuyển tab/blur",
      seedFocusEventsOnAdd: "Thêm sẵn nhóm event blur/visibility khi tạo domain",
      spoofVisibilityAndFocus: "Giả lập trang luôn hiển thị (visibilityState & hasFocus)",
      interceptInlineHandlers: "Kiểm soát cả thuộc tính inline (onblur, oncopy...)",
      debugLog: "Ghi log trong Console khi chặn event"
    }
  },
  en: {
    headerTitle: "URL List",
    domainPlaceholder: "e.g. example.com",
    addBtn: "Add URL",
    deleteBtn: "Delete",
    allOnBtn: "All On",
    allOffBtn: "All Off",
    listenersHeader: (count) => `EventListeners (${count})`,
    emptyDomains: "No domains added yet. Enter a domain above to get started.",
    emptyListeners: "No event listeners gathered yet. Visit this website to detect them automatically.",
    toggleExpandTitle: "Click to expand/collapse EventListeners list",
    badgeTitle: (enabled, total) => `${enabled} enabled / ${total} detected event listeners`,
    checkboxOnTitle: "Enabled (ON) - Uncheck to block",
    checkboxOffTitle: "Blocked (OFF) - Check to enable",
    langBtnTitle: "Switch language: English / Tiếng Việt",
    themeBtnTitleLight: "Switch to Dark Mode",
    themeBtnTitleDark: "Switch to Light Mode",
    settingsBtnTitle: "Toggle Settings",
    settingsTitle: "Settings",
    settingsLabels: {
      defaultNewListenerState: "Default new discovered events to ON",
      autoDisableFocusEvents: "Auto turn OFF tab-switch / blur events",
      seedFocusEventsOnAdd: "Pre-populate blur/visibility events when adding domain",
      spoofVisibilityAndFocus: "Spoof active page state (visibilityState & hasFocus)",
      interceptInlineHandlers: "Control inline handlers (onblur, oncopy...)",
      debugLog: "Log blocked events in browser Console"
    }
  }
};

export const UI_CONFIG = {
  DOMAIN_LIST_MAX_HEIGHT: "260px",
  EVENT_LIST_MAX_HEIGHT: "150px",
  DISCOVERY_DEBOUNCE_MS: 150
};
