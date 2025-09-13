import * as esbuild from "esbuild-wasm";
import type { Plugin } from "esbuild-wasm";

let esbuildInitialized = false;

export const initializeEsbuild = async (): Promise<void> => {
  if (esbuildInitialized) return;

  try {
    await esbuild.initialize({
      wasmURL: "https://esm.sh/esbuild-wasm@0.25.9/esbuild.wasm",
      worker: true,
    });
    esbuildInitialized = true;
  } catch (error) {
    console.error("Failed to initialize esbuild:", error);
    throw error;
  }
};

// Minimal HTTP/ESM CDN resolver for browser builds
function httpPlugin(cdnBase: string = "https://esm.sh/"): Plugin {
  return {
    name: "http-plugin",
    setup(build) {
      // Resolve absolute URLs
      build.onResolve({ filter: /^(https?:)?\/\// }, (args) => {
        return { path: args.path, namespace: "http-url" };
      });
      // Resolve absolute paths relative to importer origin (e.g., "/pkg@version/file.js" returned by CDNs)
      build.onResolve({ filter: /^\// }, (args) => {
        const base =
          args.importer && /^https?:/.test(args.importer)
            ? args.importer
            : cdnBase;
        const url = new URL(args.path, base);
        return { path: url.toString(), namespace: "http-url" };
      });
      // Resolve relative paths from a fetched URL
      build.onResolve({ filter: /^\.\.?(\/|$)/ }, (args) => {
        const importer = args.importer;
        const url = new URL(args.path, importer);
        return { path: url.toString(), namespace: "http-url" };
      });
      // Resolve bare specifiers via CDN (exclude entry and already-handled cases)
      build.onResolve({ filter: /.*/ }, (args) => {
        const p = args.path;
        if (
          p === "<stdin>" ||
          p.startsWith("\0") ||
          p.startsWith("/") ||
          p.startsWith(".") ||
          /^https?:\/\//.test(p)
        ) {
          return; // let esbuild handle or other resolvers catch
        }
        // Prefer CDN pre-bundled entries for viem and subpaths to reduce graph
        if (p === "viem" || p.startsWith("viem/")) {
          return {
            path: `${cdnBase}${p}?bundle&target=es2022`,
            namespace: "http-url",
          };
        }
        return { path: cdnBase + p, namespace: "http-url" };
      });
      // Load fetched contents
      build.onLoad({ filter: /.*/, namespace: "http-url" }, async (args) => {
        const res = await fetch(args.path);
        if (!res.ok) throw new Error(`Failed to fetch ${args.path}`);
        const contents = await res.text();
        let loader: esbuild.Loader = "js";
        if (args.path.endsWith(".ts")) loader = "ts";
        else if (args.path.endsWith(".tsx")) loader = "tsx";
        else if (args.path.endsWith(".mjs")) loader = "js";
        else if (args.path.endsWith(".cjs")) loader = "js";
        else if (args.path.endsWith(".json")) loader = "json";
        // Provide a resolveDir so further relative imports are resolved against this URL
        const resolveDir = new URL("./", args.path).toString();
        return { contents, loader, resolveDir } as any;
      });
    },
  };
}

export const transpileCode = async (code: string): Promise<string> => {
  await initializeEsbuild();

  try {
    const stdinPlugin: Plugin = {
      name: "stdin-plugin",
      setup(build) {
        // Provide a virtual entry module backed by `code`
        build.onResolve({ filter: /^stdin-entry$/ }, () => ({
          path: "stdin-entry",
          namespace: "stdin",
        }));
        build.onLoad({ filter: /^stdin-entry$/, namespace: "stdin" }, () => ({
          contents: code,
          loader: "ts",
          resolveDir: "/",
          pluginData: {},
        }));
      },
    };

    const result = await esbuild.build({
      entryPoints: ["stdin-entry"],
      bundle: true,
      write: false,
      format: "esm",
      target: "esnext",
      plugins: [stdinPlugin, httpPlugin()],
      outdir: "out",
      entryNames: "app",
      absWorkingDir: "/",
      define: {
        // Make sure global is available
        global: "globalThis",
      },
      platform: "browser",
    });

    if (result.outputFiles && result.outputFiles.length > 0) {
      const primary =
        result.outputFiles.find((f) => /\/?out\/app\.js$/.test(f.path)) ||
        result.outputFiles.find((f) => f.path.endsWith(".js"));
      if (primary) return primary.text;
    }

    throw new Error("No output generated");
  } catch (error) {
    console.error("Transpilation error:", error);
    throw error;
  }
};

// Create a bundled version with viem included
export const createRuntimeBundle = async (
  userCode: string
): Promise<string> => {
  await initializeEsbuild();

  const runtimeCode = `
    // Runtime globals
    window.__logs = [];
    window.__log = function(key, value) {
      window.__logs.push({ key, value, timestamp: Date.now() });
      console.log(key + ':', value);
    };

    window.getInput = async function(key) {
      // This will be implemented when we add widget support
      return null;
    };

    // User code
    ${userCode}
  `;

  try {
    const result = await esbuild.build({
      bundle: true,
      write: false,
      format: "iife",
      target: "es2020",
      outfile: "runtime.js",
      stdin: {
        contents: runtimeCode,
        resolveDir: "/",
        sourcefile: "runtime.tsx",
        loader: "tsx",
      },
      define: {
        global: "globalThis",
      },
    });

    if (result.outputFiles && result.outputFiles.length > 0) {
      const primary =
        result.outputFiles.find((f) => f.path.endsWith("runtime.js")) ||
        result.outputFiles[0];
      return primary.text;
    }

    throw new Error("No runtime bundle generated");
  } catch (error) {
    console.error("Runtime bundle error:", error);
    throw error;
  }
};
