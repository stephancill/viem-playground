# 📝 Project Plan: Viem Playground (Vite, Client-Only)

## 🎯 Goals

- Browser-based playground for **TypeScript + viem**.
- Show **intermediate values automatically**.
- Allow **saving scripts + widgets** locally (IndexedDB/LocalStorage).
- Support **UI widgets** (inputs, sliders, buttons, selects) that bind to script variables.
- Let users **pin scripts as widgets** to a dashboard.
- No backend, no server — everything runs in-browser.

---

## 🏗️ Architecture

### Core Components

1. **Editor**

   - Use **Monaco Editor** (same as VSCode).
   - TS syntax highlighting + autocomplete.

2. **Runtime Execution**

   - **`esbuild-wasm`** → transpile TypeScript to JavaScript inside browser.
   - Evaluate code in an **iframe sandbox** (prevents leaking globals).

3. **Instrumentation (logging intermediate values)**

   - Add an **esbuild plugin** that rewrites assignments to log values. Example:

     ```ts
     const block = await client.getBlockNumber();
     ```

     becomes:

     ```ts
     const block = await client.getBlockNumber();
     __log("block", block);
     ```

   - `__log` pushes data to a **log panel UI**.

4. **Widgets**

   - Define widget schema:

     ```ts
     type Widget =
       | {
           type: "slider";
           key: string;
           label: string;
           min: number;
           max: number;
           step?: number;
           defaultValue?: number;
         }
       | { type: "text"; key: string; label: string; defaultValue?: string }
       | {
           type: "select";
           key: string;
           label: string;
           options: string[];
           defaultValue?: string;
         }
       | { type: "button"; key: string; label: string };
     ```

   - Provide runtime API:

     ```ts
     const val = await getInput("blockNumber");
     ```

     → `getInput` resolves widget state from UI panel.

5. **Persistence**

   - Use **IndexedDB (via Dexie.js)** or **LocalStorage** to save scripts + widgets.
   - Export/import JSON for sharing.

6. **Dashboard (Pinning)**

   - Scripts can be **pinned** → dashboard view shows widgets + outputs, no editor.
   - Layout stored locally.

---

## 🔄 User Flows

1. **Write + Run a Script**

   - User writes code in Monaco editor.
   - Click “Run” → code transpiled with esbuild → executed in iframe → logs appear in panel.

2. **Add Widgets**

   - User configures widget (via UI form).
   - Script calls `getInput("key")`.
   - When executed, `getInput` pulls live widget value.

3. **Save Script**

   - Scripts stored locally (IndexedDB).
   - Users can export as JSON to share.

4. **Pin as Widget**

   - Pin script to dashboard.
   - Dashboard shows UI widgets + live outputs.

---

## 📅 Implementation Roadmap

### Phase 1 – Playground Shell (1–2 weeks) (Done)

- Scaffold Vite + React project.
- Add Monaco editor.
- Add esbuild-wasm transpilation + iframe execution.
- Implement `__log` → console panel.

### Phase 1 Implementation Details

- **Project scaffold**

  - Vite + React + TypeScript setup
  - Tailwind-based layout and styling

- **Editor**

  - Monaco Editor with TypeScript configured
  - Sensible editor options (word wrap, auto layout, resize handling)
  - TypeScript config for top‑level await & Node-style resolution
    - Module ESNext, target ES2020, libs ["es2022", "dom"]
    - Module resolution NodeJs, baseUrl `file:///`, path mapping for `viem` and `viem/*`
    - Eager model sync enabled so diagnostics refresh immediately
  - Viem typings wired into Monaco
    - Loaded `viem/_types/**/*.d.ts` as extra libs
    - Mirrored `viem/_types/**/*.ts` to virtual `.js` paths so ESM-style imports in types resolve
    - Generated virtual wrappers: `file:///node_modules/viem/<subpath>/index.d.ts` re-export `_types/<subpath>/index`
    - Fallback ambient shims for `viem` and `viem/chains` if type loading fails

- **Execution sandbox**

  - Secure iframe-based runtime
  - Injects a runtime script per run and isolates side effects
  - Loads user code as ESM (`<script type="module">`) so top‑level `await` works

- **Instrumentation**

  - Regex-based code transform that auto-injects `__log(...)` after assignments and `console.log(...)`
  - Structured log events posted from iframe to parent

- **Console UI**

  - Tailwind-only console panel with scrollable log list
  - Clear / error banner
  - Timestamped, typed entries with safe value formatting

- **Controls & UX**

  - Run/Stop/Reset + log clear
  - Responsive split layout (editor left, console right)

- **Viem integration**
  - Sandbox loads `viem` via CDN (`https://esm.sh/viem@<version>`) in the iframe
  - Editor provides full viem typings through Monaco extraLibs and virtual wrappers
  - Default sample script fetches `blockNumber`, `chainId`, `gasPrice` on mainnet

### Phase 2 – Widgets (1–2 weeks)

- Create widget schema + React components (Slider, Text, Select, Button).
- Implement `getInput(key)` in runtime.
- Add widget editor (UI for adding/editing widgets).

### Phase 3 – Persistence (1 week)

- Store scripts + widgets in IndexedDB (Dexie.js).
- Implement save/load UI.
- Add export/import JSON.

### Phase 4 – Dashboard & Pinning (1–2 weeks)

- Create dashboard view.
- Allow pinning scripts.
- Render pinned scripts as widgets-only.

### Phase 5 – Polish (ongoing)

- Dark/light theme.
- Better error handling in logs.
- Share script via URL (encode JSON → base64).

---

## 🛠️ Tech Stack Summary

- **Build Tool**: Vite
- **Framework**: React
- **Editor**: Monaco Editor
- **Transpiler**: esbuild-wasm
- **Storage**: IndexedDB (Dexie.js)
- **Sandbox**: iframe for safe execution
- **State/UI**: Zustand or Redux (lightweight state mgmt)

We also use bun, shadcn ui components, and tailwindcss. Never start the dev server yourself. Run bun run build if you want to see if the project builds.

---

✅ With this approach:

- Everything runs in-browser (fast, no server).
- Users can still share/export scripts (JSON).
- Pinning/dashboard makes it feel like **ObservableHQ + Streamlit, but for Viem**.

---

Would you like me to also draft a **starter project structure (file tree + minimal code skeleton)** so your developer has a jumpstart with Vite + Monaco + esbuild-wasm wired up?
