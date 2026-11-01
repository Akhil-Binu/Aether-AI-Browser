# Aether AI Browser

<div align="center">

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-31.0-47848F?style=flat-square&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)

**A next-generation, high-performance desktop web browser with native AI copilot, isolated WebContentsView architecture, vertical workspaces, and built-in tracker protection.**

[Architecture](#-system-architecture) • [Features](#-core-capabilities) • [Security Model](#-security--sandboxing) • [Getting Started](#-getting-started) • [Shortcuts](#-keyboard-shortcuts)

</div>

---

## 🌟 Overview

**Aether AI Browser** is engineered from the ground up to reimagine how users interact with the web. By fusing native Chromium tab virtualization with local and cloud LLM execution, Aether transforms passive web browsing into an active, intelligent workspace.

Unlike traditional extensions that introduce DOM overhead and security vulnerabilities, Aether’s AI copilot operates within an **isolated execution world (`worldId: 999`)**—extracting clean semantic page structure and streaming real-time summaries, action items, and question answering directly in the browser chrome.

---

## 📐 System Architecture

Aether strictly enforces three-tier process separation utilizing Electron’s modern `BaseWindow` and `WebContentsView` APIs:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            MAIN PROCESS (Node.js Core)                           │
│  ┌─────────────────────────┐  ┌──────────────────────────┐  ┌─────────────────┐  │
│  │ Tab & Layout Manager    │  │ AdBlocker & Privacy      │  │ AI Engine & IPC │  │
│  │ (WebContentsView Pool)  │  │ (session.webRequest)     │  │ (Streaming LLM) │  │
│  └────────────┬────────────┘  └────────────┬─────────────┘  └────────┬────────┘  │
└───────────────┼────────────────────────────┼─────────────────────────┼───────────┘
                │ IPC via ContextBridge      │ Network Interception    │ Extracted DOM
┌───────────────▼────────────────────────────┴─────────────────────────┼───────────┐
│ RENDERER PROCESS (Sandboxed Browser Chrome Shell)                    │           │
│  ┌───────────────────────┐  ┌──────────────────────┐  ┌────────────┐ │           │
│  │ Vertical Tab Bar      │  │ Omnibox (Cmd/Ctrl+L) │  │ AI Copilot │ │           │
│  │ & Workspaces          │  │ & Search Engine      │  │ Side-Panel │ │           │
│  └───────────────────────┘  └──────────────────────┘  └────────────┘ │           │
└──────────────────────────────────────────────────────────────────────┼───────────┘
                                                                       │
┌──────────────────────────────────────────────────────────────────────▼───────────┐
│ TAB CONTENT PROCESSES (Isolated Native Chromium Renderers)                       │
│  ┌───────────────────────────┐  ┌───────────────────────────┐                    │
│  │ Tab 1: WebContentsView    │  │ Tab 2: WebContentsView    │  ...               │
│  │ Partition: persist:work   │  │ Partition: in-memory      │                    │
│  └───────────────────────────┘  └───────────────────────────┘                    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Core Capabilities

### 1. Context-Aware AI Copilot
- **Semantic DOM Extraction**: Bypasses ads, tracking pixels, scripts, and styling to read clean content blocks without triggering page repaints.
- **Real-Time Streaming**: Directly streams insights, executive summaries, and Q&A via native SSE connections to Google Gemini / OpenAI.
- **One-Click Action Chips**: Instant triggers for *Executive Summary*, *Action Item Extraction*, and *Conceptual Simplification*.
- **Token Budgeting**: Intelligent content chunking ensuring requests stay within low-latency token budgets.

### 2. Vertical Workspaces & Tab Virtualization
- **Workspace Partitioning**: Distinct container sessions (`Personal`, `Work`, `Research`, `Incognito`) with independent cookies and storage partitions.
- **Pinned Tabs**: Compact grid view for permanent tabs.
- **WebContentsView Management**: Unattached tab views are safely detached from the host frame, drastically reducing GPU and compositor overhead.

### 3. Smart Omnibox & Command Palette
- **Unified Address Bar**: Smart URL parsing, protocol auto-upgrade to HTTPS, and instant DuckDuckGo search fallback.
- **Local History Indexing**: High-speed local history search suggestions.
- **Command Palette (`Cmd/Ctrl + K`)**: Keyboard-driven launcher to jump between tabs, trigger AI functions, or switch workspaces.

### 4. Built-in Privacy Shield
- **Declarative Network Filtering**: Proactively cancels outbound requests to ad networks, cross-site trackers, and telemetry beacons.
- **Client Telemetry Stripping**: Removes invasive tracking headers (`X-Client-Data`, `Sec-CH-UA-Full-Version-List`) and broadcasts `DNT` (Do Not Track) and `Sec-GPC` (Global Privacy Control).

---

## 🛡️ Security & Sandboxing

Aether adheres to strict browser security best practices:

| Layer | Security Enforcement |
| :--- | :--- |
| **Browser Shell UI** | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. Hardened Content Security Policy (`CSP`). |
| **Tab Isolation** | Web pages run in unprivileged native renderer processes with zero exposure to `window.browserAPI` or Node.js primitives. |
| **AI DOM Reading** | Script execution is restricted to `executeJavaScriptInIsolatedWorld(999)`, guaranteeing web scripts cannot intercept or alter AI payloads. |
| **Secret Protection** | API keys reside securely within the Main process and are never broadcasted to the DOM. |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v20.x or higher
- npm v10.x or higher

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Akhil-Binu/Aether-AI-Browser.git
   cd Aether-AI-Browser
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set your AI API Key** *(Optional)*:
   ```bash
   # Windows (PowerShell)
   $env:GEMINI_API_KEY="your-gemini-api-key"

   # macOS / Linux
   export GEMINI_API_KEY="your-gemini-api-key"
   ```
   *(You can also configure the key inside the browser UI via the Copilot settings drawer).*

4. **Build the application**:
   ```bash
   npm run build
   ```

5. **Run Aether**:
   ```bash
   npm start
   ```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + K` / `Cmd + K` | Open Universal Command Palette |
| `Ctrl + L` / `Cmd + L` | Focus Omnibox (Address Bar) |
| `Ctrl + T` / `Cmd + T` | Open New Tab |
| `Ctrl + W` / `Cmd + W` | Close Active Tab |
| `Ctrl + R` / `Cmd + R` | Reload Active Tab |
| `Alt + ←` / `Cmd + [` | Navigate Back |
| `Alt + →` / `Cmd + ]` | Navigate Forward |

---

## 📁 Repository Structure

```
Aether-AI-Browser/
├── .github/
│   ├── workflows/ci.yml         # Multi-OS Build & Lint CI
│   └── ISSUE_TEMPLATE/          # Bug report & feature request templates
├── src/
│   ├── main/
│   │   ├── index.ts             # Electron lifecycle & IPC registration
│   │   ├── tab-manager.ts       # WebContentsView coordinator & layout
│   │   ├── adblocker.ts         # Privacy & network request filter
│   │   ├── ai-service.ts        # DOM extraction & streaming LLM client
│   │   └── types.ts             # Main process shared data structures
│   ├── preload/
│   │   └── shell-preload.ts     # Type-safe ContextBridge IPC definition
│   └── renderer/
│       ├── index.html           # Shell UI HTML entry with strict CSP
│       └── src/
│           ├── main.tsx         # React bootstrap
│           ├── App.tsx          # Master shell coordinator
│           ├── index.css        # Tailwind directives & styles
│           └── components/
│               ├── Omnibox.tsx          # Address bar with history autocomplete
│               ├── VerticalTabs.tsx     # Arc-style vertical tabs & workspaces
│               ├── CopilotPanel.tsx     # Streaming AI chat & analysis panel
│               └── CommandPalette.tsx   # Cmd+K quick launcher
├── vite.config.ts               # Vite configuration for React UI
├── tsconfig.json                # Renderer TypeScript config
├── tsconfig.electron.json       # Electron Main TypeScript config
├── tailwind.config.js           # Tailwind design tokens
├── package.json                 # Project dependencies & build scripts
└── LICENSE                      # MIT License
```

---

## 🤝 Contributing

Contributions are what make the open-source community an amazing place to learn, inspire, and create. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and development workflow.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

<div align="center">
  <b>Built by <a href="https://github.com/Akhil-Binu">Akhil Binu</a></b>
</div>
