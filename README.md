# Viem Playground

A browser-based playground for TypeScript + viem. Write, run, and inspect Ethereum client code entirely in the browser. No server required.

## Features

- **Monaco Editor**: VSCode-like editing with TypeScript syntax highlighting and autocomplete
- **Viem typings in-editor**: Rich IntelliSense for `viem` and `viem/*` imports
- **In-browser transpile**: `esbuild-wasm` compiles TypeScript to JavaScript on the fly
- **Secure sandbox**: Code runs inside an isolated iframe with ESM and top‑level `await`
- **Auto value logging**: Assignment instrumentation injects `__log(...)` so intermediate values appear automatically
- **Console panel UI**: Structured logs with timestamps and safe value rendering
- **Zero back end**: Everything runs client-side; scripts can be exported for sharing

## Quick Start

### Prerequisites

- Bun 1.1+

### Install

```bash
bun install
```

### Develop

```bash
bun run dev
```

Open the printed local URL (typically `http://localhost:5173`).

### Build

```bash
bun run build
# outputs to ./dist
```

### Preview (serve the production build)

```bash
bun run preview
```

### Lint

```bash
bun run lint
```

## How It Works

- Monaco powers the editor with TypeScript support and ESM + top‑level `await`.
- `esbuild-wasm` compiles TypeScript to JavaScript in-browser.
- A transform injects `__log(...)` after assignments and `console.log(...)` calls so intermediate values appear in the console panel.
- Code executes in an isolated iframe that loads `viem` via CDN and posts structured logs back to the parent.

## Example Script

```ts
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const client = createPublicClient({ chain: mainnet, transport: http() });

const blockNumber = await client.getBlockNumber();
// This assignment will be auto-logged in the console panel.
```

## Project Structure

```text
src/
  components/
    CodeEditor.tsx       # Monaco wrapper
    ConsolePanel.tsx     # Structured logs
    Playground.tsx       # Main layout (editor + console)
    Sandbox.tsx          # Iframe runtime controller
    ui/                  # Reusable UI primitives (shadcn/radix based)
  lib/
    esbuild.ts           # esbuild-wasm init + transform
    utils.ts             # helpers
    valueRenderer.tsx    # safe value formatting for console
```

## Tech Stack

- Build tool: Vite
- Framework: React
- Editor: Monaco
- Transpiler: `esbuild-wasm`
- Storage: IndexedDB (Dexie.js)
- UI: Tailwind, shadcn, Radix primitives
- Ethereum client: `viem`

## Notes & Limitations

- This is a client-only playground; do not paste secrets or private keys
- Network access is dependent on the browser and the provider used by `viem`
- Some Node.js APIs are not available in-browser

## Scripts

- `dev`: start the dev server
- `build`: type-check and build for production (outputs to `dist/`)
- `preview`: preview the production build
- `lint`: run eslint
