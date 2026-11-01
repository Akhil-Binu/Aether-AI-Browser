# Contributing to Aether AI Browser

Thank you for your interest in contributing to **Aether AI Browser**! We are committed to building an ultra-fast, privacy-first, AI-native desktop web browser.

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Git**

### Installation

1. Fork the repository and clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Aether-AI-Browser.git
   cd Aether-AI-Browser
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your API key (optional, for live AI streaming):
   ```bash
   export GEMINI_API_KEY="your-gemini-api-key"
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Launch the application:
   ```bash
   npm start
   ```

---

## 📐 Architecture Principles

Before submitting code, ensure your changes adhere to our core architectural boundaries:

1. **Strict Process Isolation**:
   - Web pages run inside native `WebContentsView` instances with `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false`.
   - Never inject Node.js bindings or IPC bridges into untrusted web page contexts.

2. **Isolated World DOM Extraction**:
   - The AI Copilot only reads the page DOM via `executeJavaScriptInIsolatedWorld(999)`.
   - Stripped elements must never leak arbitrary script execution to the main process.

3. **Typed ContextBridge**:
   - All IPC channels between the React UI shell and Electron Main process must be declared and typed in `src/preload/shell-preload.ts`.

---

## 📝 Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new feature (e.g., `feat: add tab audio muting toggle`)
- `fix:` A bug fix (e.g., `fix: address bar focus retention on navigation`)
- `perf:` Performance improvements
- `refactor:` Code changes that neither fix bugs nor add features
- `docs:` Documentation updates
- `chore:` Build process or dependency changes

---

## 📄 Pull Request Process

1. Create a feature branch (`git checkout -b feat/your-feature-name`).
2. Verify all type checks and builds pass:
   ```bash
   npm run lint
   npm run build
   ```
3. Commit your changes with a conventional commit message.
4. Push to your fork and submit a Pull Request describing your changes, motivation, and any testing performed.
