/**
 * CheapTrick - MAIN World Event Listener Discovery & Interceptor Engine
 * Runs at `document_start` in the page's MAIN execution world.
 *
 * Modular internal architecture:
 *  1. ConfigStateModule   - Manages per-domain listener states, settings, and synchronous localStorage cache
 *  2. DiscoveryModule     - Tracks discovered event listener types and batches updates to ISOLATED world
 *  3. InterceptorModule   - Wraps EventTarget.addEventListener/removeEventListener & capture-phase shields
 *  4. InlineHandlerModule - Intercepts `on*` property assignments and scans inline HTML `on*` attributes
 *  5. SpoofModule         - Dynamically spoofs visibilityState, hidden, and hasFocus based on listener state
 *  6. BridgeModule        - Synchronizes live config changes with `content.js` via CustomEvents
 */
(function () {
  if (window.__CHEAPTRICK_MAIN_INITIALIZED__) return;
  window.__CHEAPTRICK_MAIN_INITIALIZED__ = true;

  const BRIDGE_EVENTS = {
    CONFIG_TO_MAIN: "__cheaptrick_config_to_main__",
    DISCOVERED_TO_ISOLATED: "__cheaptrick_discovered_to_isolated__",
    REQUEST_SYNC: "__cheaptrick_request_sync__"
  };

  const LOCAL_CACHE_KEY = "__cheaptrick_domain_cache_v2__";

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

  const MONITORED_ON_PROPERTIES = [
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

  // Preserve native references before any overrides
  const nativeTargetAdd = EventTarget.prototype.addEventListener;
  const nativeTargetRemove = EventTarget.prototype.removeEventListener;
  const nativeWindowAdd = window.addEventListener.bind(window);
  const nativeDocumentAdd = document.addEventListener.bind(document);
  const nativeDispatchEvent = window.dispatchEvent.bind(window);

  // =========================================================================
  // 1. ConfigStateModule
  // =========================================================================
  const ConfigStateModule = (function () {
    const state = {
      listeners: {}, // { [eventName]: boolean } -> true = ON (enabled), false = OFF (blocked)
      settings: {
        defaultNewListenerState: true,
        autoDisableFocusEvents: true,
        spoofVisibilityAndFocus: true,
        interceptInlineHandlers: true,
        debugLog: false
      }
    };

    function loadInitialCache() {
      try {
        const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            if (parsed.listeners && typeof parsed.listeners === "object") {
              state.listeners = { ...parsed.listeners };
            }
            if (parsed.settings && typeof parsed.settings === "object") {
              state.settings = { ...state.settings, ...parsed.settings };
            }
          }
        }
      } catch (_) {
        // Ignore sandboxed iframe / restricted storage errors
      }
    }

    function saveCache() {
      try {
        window.localStorage.setItem(
          LOCAL_CACHE_KEY,
          JSON.stringify({
            listeners: state.listeners,
            settings: state.settings
          })
        );
      } catch (_) {
        // Ignore storage errors
      }
    }

    function applyConfig(payload) {
      if (!payload || typeof payload !== "object") return;
      if (payload.listeners && typeof payload.listeners === "object") {
        state.listeners = { ...state.listeners, ...payload.listeners };
      }
      if (payload.settings && typeof payload.settings === "object") {
        state.settings = { ...state.settings, ...payload.settings };
      }
      saveCache();
    }

    function isEventEnabled(eventName) {
      if (typeof state.listeners[eventName] === "boolean") {
        return state.listeners[eventName];
      }
      if (
        state.settings.autoDisableFocusEvents &&
        FOCUS_VISIBILITY_EVENTS.includes(eventName)
      ) {
        return false;
      }
      return Boolean(state.settings.defaultNewListenerState);
    }

    function ensureInitialEventState(eventName) {
      if (typeof state.listeners[eventName] !== "boolean") {
        state.listeners[eventName] = isEventEnabled(eventName);
      }
    }

    function log(...args) {
      if (state.settings.debugLog) {
        console.log("[ListenerController]", ...args);
      }
    }

    loadInitialCache();

    return {
      state,
      applyConfig,
      isEventEnabled,
      ensureInitialEventState,
      log
    };
  })();

  // =========================================================================
  // 2. DiscoveryModule
  // =========================================================================
  const DiscoveryModule = (function () {
    const discoveredSet = new Set();
    const pendingBatch = new Set();
    let flushTimer = null;

    function isValidEventName(type) {
      if (!type || typeof type !== "string") return false;
      const trimmed = type.trim();
      if (!trimmed) return false;
      if (trimmed.startsWith("__cheaptrick_")) return false;
      return true;
    }

    function flushDiscovered() {
      flushTimer = null;
      if (pendingBatch.size === 0) return;

      const events = Array.from(pendingBatch);
      pendingBatch.clear();

      try {
        nativeDispatchEvent(
          new CustomEvent(BRIDGE_EVENTS.DISCOVERED_TO_ISOLATED, {
            detail: { events }
          })
        );
      } catch (_) {
        // Ignore dispatch failure
      }
    }

    function recordEvent(type, onNewEventCallback) {
      if (!isValidEventName(type)) return;
      const cleanType = type.trim();

      ConfigStateModule.ensureInitialEventState(cleanType);

      if (!discoveredSet.has(cleanType)) {
        discoveredSet.add(cleanType);
        pendingBatch.add(cleanType);
        if (typeof onNewEventCallback === "function") {
          onNewEventCallback(cleanType);
        }
        if (!flushTimer) {
          flushTimer = setTimeout(flushDiscovered, 120);
        }
      }
    }

    function resendAllDiscovered() {
      if (discoveredSet.size === 0) return;
      for (const evt of discoveredSet) {
        pendingBatch.add(evt);
      }
      flushDiscovered();
    }

    return {
      isValidEventName,
      recordEvent,
      resendAllDiscovered
    };
  })();

  // =========================================================================
  // 3. InterceptorModule
  // =========================================================================
  const InterceptorModule = (function () {
    const shieldedEvents = new Set();
    const targetRegistry = new WeakMap();

    function getCaptureFlag(options) {
      if (typeof options === "boolean") return options;
      if (options && typeof options === "object") return Boolean(options.capture);
      return false;
    }

    function getWrapperMap(target, type, capture) {
      let typeMap = targetRegistry.get(target);
      if (!typeMap) {
        typeMap = new Map();
        targetRegistry.set(target, typeMap);
      }
      const key = `${type}::${capture ? "1" : "0"}`;
      let listenerMap = typeMap.get(key);
      if (!listenerMap) {
        listenerMap = new WeakMap();
        typeMap.set(key, listenerMap);
      }
      return listenerMap;
    }

    function ensureCaptureShield(eventName) {
      if (shieldedEvents.has(eventName)) return;
      shieldedEvents.add(eventName);

      const shieldHandler = function (e) {
        if (!ConfigStateModule.isEventEnabled(eventName)) {
          ConfigStateModule.log(`Blocked event (capture shield): ${eventName}`);
          e.stopImmediatePropagation();
          e.stopPropagation();
        }
      };

      nativeWindowAdd(eventName, shieldHandler, true);
      nativeDocumentAdd(eventName, shieldHandler, true);
    }

    function createWrappedListener(type, listener) {
      return function (event) {
        if (!ConfigStateModule.isEventEnabled(type)) {
          ConfigStateModule.log(`Blocked listener execution for: ${type}`);
          if (event && typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
            event.stopPropagation();
          }
          return undefined;
        }
        if (typeof listener === "function") {
          return listener.apply(this, arguments);
        }
        if (listener && typeof listener.handleEvent === "function") {
          return listener.handleEvent.call(listener, event);
        }
        return undefined;
      };
    }

    function hookedAddEventListener(type, listener, options) {
      const eventName = String(type || "");

      if (eventName.startsWith("__cheaptrick_")) {
        return nativeTargetAdd.call(this, type, listener, options);
      }

      if (DiscoveryModule.isValidEventName(eventName)) {
        DiscoveryModule.recordEvent(eventName, ensureCaptureShield);
      }

      if (
        !listener ||
        (typeof listener !== "function" && typeof listener.handleEvent !== "function")
      ) {
        return nativeTargetAdd.call(this, type, listener, options);
      }

      const capture = getCaptureFlag(options);
      const listenerMap = getWrapperMap(this, eventName, capture);
      let wrapped = listenerMap.get(listener);
      if (!wrapped) {
        wrapped = createWrappedListener(eventName, listener);
        listenerMap.set(listener, wrapped);
      }

      return nativeTargetAdd.call(this, type, wrapped, options);
    }

    function hookedRemoveEventListener(type, listener, options) {
      const eventName = String(type || "");
      if (
        !listener ||
        (typeof listener !== "function" && typeof listener.handleEvent !== "function")
      ) {
        return nativeTargetRemove.call(this, type, listener, options);
      }

      const capture = getCaptureFlag(options);
      const listenerMap = getWrapperMap(this, eventName, capture);
      const wrapped = listenerMap.get(listener);

      if (wrapped) {
        return nativeTargetRemove.call(this, type, wrapped, options);
      }
      return nativeTargetRemove.call(this, type, listener, options);
    }

    function init() {
      FOCUS_VISIBILITY_EVENTS.forEach(ensureCaptureShield);

      EventTarget.prototype.addEventListener = hookedAddEventListener;
      EventTarget.prototype.removeEventListener = hookedRemoveEventListener;
      window.addEventListener = hookedAddEventListener;
      window.removeEventListener = hookedRemoveEventListener;
      document.addEventListener = hookedAddEventListener;
      document.removeEventListener = hookedRemoveEventListener;
    }

    return {
      init,
      ensureCaptureShield
    };
  })();

  // =========================================================================
  // 4. InlineHandlerModule
  // =========================================================================
  const InlineHandlerModule = (function () {
    const handlerStorage = new WeakMap();

    function getTargetStore(target) {
      let store = handlerStorage.get(target);
      if (!store) {
        store = {};
        handlerStorage.set(target, store);
      }
      return store;
    }

    function hookOnProperty(protoOrObj, eventName) {
      const propName = `on${eventName}`;
      if (!protoOrObj) return;

      const originalDesc = Object.getOwnPropertyDescriptor(protoOrObj, propName);

      try {
        Object.defineProperty(protoOrObj, propName, {
          configurable: true,
          enumerable: originalDesc ? originalDesc.enumerable : true,
          get() {
            const store = getTargetStore(this);
            if (!ConfigStateModule.isEventEnabled(eventName)) {
              return null;
            }
            if (propName in store) {
              return store[propName];
            }
            return originalDesc && originalDesc.get
              ? originalDesc.get.call(this)
              : null;
          },
          set(fn) {
            const store = getTargetStore(this);
            store[propName] = typeof fn === "function" ? fn : null;

            if (typeof fn === "function") {
              DiscoveryModule.recordEvent(
                eventName,
                InterceptorModule.ensureCaptureShield
              );
            }

            if (originalDesc && originalDesc.set) {
              if (typeof fn === "function") {
                const wrapped = function (event) {
                  if (
                    ConfigStateModule.state.settings.interceptInlineHandlers &&
                    !ConfigStateModule.isEventEnabled(eventName)
                  ) {
                    ConfigStateModule.log(`Blocked inline ${propName}`);
                    if (event && typeof event.stopImmediatePropagation === "function") {
                      event.stopImmediatePropagation();
                      event.stopPropagation();
                    }
                    return undefined;
                  }
                  return fn.apply(this, arguments);
                };
                originalDesc.set.call(this, wrapped);
              } else {
                originalDesc.set.call(this, null);
              }
            }
          }
        });
      } catch (_) {
        // Ignore non-configurable properties
      }
    }

    function scanDOMInlineAttributes() {
      if (!document.documentElement) return;
      const selector = MONITORED_ON_PROPERTIES.map((e) => `[on${e}]`).join(",");
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          for (const evt of MONITORED_ON_PROPERTIES) {
            if (el.hasAttribute(`on${evt}`)) {
              DiscoveryModule.recordEvent(
                evt,
                InterceptorModule.ensureCaptureShield
              );
            }
          }
        });
      } catch (_) {
        // Ignore selector errors
      }
    }

    function init() {
      for (const evt of MONITORED_ON_PROPERTIES) {
        hookOnProperty(window, evt);
        hookOnProperty(document, evt);
        if (typeof HTMLElement !== "undefined" && HTMLElement.prototype) {
          hookOnProperty(HTMLElement.prototype, evt);
        }
      }

      nativeWindowAdd("DOMContentLoaded", scanDOMInlineAttributes, true);
      nativeWindowAdd("load", scanDOMInlineAttributes, true);
    }

    return { init };
  })();

  // =========================================================================
  // 5. SpoofModule
  // =========================================================================
  const SpoofModule = (function () {
    function init() {
      const docProto = Document.prototype;
      const origVisState =
        Object.getOwnPropertyDescriptor(docProto, "visibilityState") ||
        Object.getOwnPropertyDescriptor(document, "visibilityState");
      const origHidden =
        Object.getOwnPropertyDescriptor(docProto, "hidden") ||
        Object.getOwnPropertyDescriptor(document, "hidden");
      const origHasFocus = document.hasFocus
        ? document.hasFocus.bind(document)
        : () => true;

      try {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get() {
            if (
              ConfigStateModule.state.settings.spoofVisibilityAndFocus &&
              !ConfigStateModule.isEventEnabled("visibilitychange")
            ) {
              return "visible";
            }
            return origVisState && origVisState.get
              ? origVisState.get.call(this)
              : "visible";
          }
        });

        Object.defineProperty(document, "hidden", {
          configurable: true,
          get() {
            if (
              ConfigStateModule.state.settings.spoofVisibilityAndFocus &&
              !ConfigStateModule.isEventEnabled("visibilitychange")
            ) {
              return false;
            }
            return origHidden && origHidden.get
              ? origHidden.get.call(this)
              : false;
          }
        });

        Object.defineProperty(document, "hasFocus", {
          configurable: true,
          writable: true,
          value: function () {
            if (
              ConfigStateModule.state.settings.spoofVisibilityAndFocus &&
              !ConfigStateModule.isEventEnabled("blur")
            ) {
              return true;
            }
            return origHasFocus();
          }
        });
      } catch (_) {
        // Ignore descriptor redefine errors
      }
    }

    return { init };
  })();

  // =========================================================================
  // 6. BridgeModule
  // =========================================================================
  const BridgeModule = (function () {
    function init() {
      nativeWindowAdd(BRIDGE_EVENTS.CONFIG_TO_MAIN, (e) => {
        if (e && e.detail) {
          ConfigStateModule.applyConfig(e.detail);
        }
      });

      nativeWindowAdd(BRIDGE_EVENTS.REQUEST_SYNC, () => {
        DiscoveryModule.resendAllDiscovered();
      });
    }

    return { init };
  })();

  // Initialize all MAIN world modules immediately at document_start
  BridgeModule.init();
  InterceptorModule.init();
  InlineHandlerModule.init();
  SpoofModule.init();
})();
