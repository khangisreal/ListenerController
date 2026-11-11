> [!CAUTION]
> **ListenerController** is intended for educational, debugging, and testing purposes. Always respect website terms of service. The only official place to download ListenerController is this GitHub repository.

<p align="center">
  <img src="https://github.com/user-attachments/assets/51249b27-db2b-4344-9665-f121b5d9c74b" width="300" alt="output-onlinepngtools" />
</p>

<h1 align="center">ListenerController</h1>

<p align="center">
  <img src="https://img.shields.io/badge/release-v2.0.0--alpha-blue" alt="Release v2.0.0-alpha" />
  <img src="https://img.shields.io/badge/manifest-v3-success" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/platform-Chromium-orange" alt="Platform Chromium" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-GPLv3-red" alt="License GPLv3" /></a>
</p>

**ListenerController** is a lightweight, modular browser extension that automatically detects all active `EventListeners` on any website and lets you turn each one **ON** or **OFF** in real time.

If you find any bugs or have feature requests, please [open an issue](../../issues) in this repository.

> [!NOTE]
> ListenerController is built on **Manifest V3** and works on all modern **Chromium-based browsers**, including Google Chrome, Microsoft Edge, Brave, Opera, and Vivaldi.

---

## Features

- **Automatic EventListener Discovery**
  - Detects and lists every event listener registered by a website (`click`, `keydown`, `blur`, `visibilitychange`, `mouseleave`, `copy`, `paste`, `contextmenu`, `scroll`, etc.)
  - Captures listeners attached via `EventTarget.prototype.addEventListener`, `window`, `document`, inline `on*` properties, and HTML `[on*]` attributes
- **Real-Time Per-Domain Toggle Control**
  - Expandable domain boxes with individual `[eventlistener name] [checkbox]` switches
  - Toggle any event listener **ON** (allowed) or **OFF** (blocked) live without refreshing the page
  - Quick **All On** and **All Off** bulk actions for each website
- **Focus & Visibility State Protection**
  - Automatically blocks tab-switch and focus-loss events (`blur`, `visibilitychange`, `mouseleave`, `pagehide`, `fullscreenchange`) by default
  - Dynamically spoofs `document.visibilityState`, `document.hidden`, and `document.hasFocus()` when visibility/blur listeners are turned OFF
- **Customizable Popup UI**
  - Instant **English (`EN`) / Vietnamese (`VI`)** language switcher (`🌐`)
  - **Light Mode / Dark Mode** theme toggle (`🌙` / `☀️`) with smooth transitions
  - Dual independent scrollable containers for both the domain list and each domain's event listener list
- **Built-in Settings Panel (`⚙`)**
  - Configure default state (`ON`/`OFF`) for newly discovered events, automatic focus-event blocking, page state spoofing, inline handler interception, and console debug logging

---

## How It Works

Websites use **EventListeners** to track what you do on a page—such as clicking a button, copying text, or switching to another tab. **ListenerController** sits between the website and your browser in 3 simple steps:

1. **Add a Domain**: Open the extension popup, type a website domain (e.g., `example.com`), and click **Add URL**.
2. **Visit the Website**: When you enter that website, the extension automatically scans and collects all `EventListeners` the site uses into that domain's box.
3. **Toggle Events ON or OFF**: Click the arrow (`▶`) next to the domain to open its event list:
   - **Checked (`ON`)**: The event works normally.
   - **Unchecked (`OFF`)**: The event is blocked immediately—no page reload needed.

---

## Installation

1. Download or clone this repository to your computer (or download the latest release `.zip` and extract it).
2. Open your Chromium browser and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** in the top-left corner and select the extension folder.
5. Pin **ListenerController** to your browser toolbar for quick access.

---

## Project Structure

```text
ListenerController/
├── manifest.json          # Chrome Extension Manifest V3 (v2.0.0)
├── icon.png               # Extension icon
├── popup.html             # Popup UI layout
├── popup.css              # Light/Dark themes, animations & scrollable containers
├── popup.js               # Popup controller
├── background.js          # Service worker managing dynamic MAIN/ISOLATED scripts
├── content.js             # ISOLATED world storage & messaging bridge
├── injected.js            # MAIN world EventListener discovery & interceptor engine
├── config/
│   └── settings.js        # Centralized settings, monitored events & EN/VI i18n
└── modules/
    ├── storage.js         # Storage CRUD, domain matching & state migration
    └── ui.js              # DOM rendering for domain boxes, listeners & settings
```
