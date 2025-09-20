import React, { useState, useCallback, useEffect } from "react";
import { transpileCode } from "../lib/esbuild";
import CodeEditor from "./CodeEditor";
import ConsolePanel from "./ConsolePanel";
import { Play, Square, RotateCcw } from "lucide-react";
import { abiDb, scriptDb } from "@/lib/abiDatabase";
import type { StoredScript } from "@/lib/abiDatabase";

export interface LogEntry {
  key: string;
  value: unknown;
  timestamp: number;
  source?: "console" | "inline" | "system";
  // For console logs
  formatted?: string;
  args?: unknown[];
}

interface PlaygroundProps {
  abiRefreshKey?: number;
  currentScript?: StoredScript | null;
}

// Session storage keys
const CURRENT_SCRIPT_KEY = "viem-playground-current-script";
const CURRENT_SCRIPT_ID_KEY = "viem-playground-current-script-id";

const getDefaultCode = () => `import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

// Create a public client for Ethereum mainnet
const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// Get some values
const blockNumber = await client.getBlockNumber();
const chainId = await client.getChainId();
const gasPrice = await client.getGasPrice();

console.log('Latest block:', blockNumber);
console.log('Chain ID:', chainId);
console.log('Gas Price:', gasPrice);
`;

// Helper functions for session storage
const saveCurrentScript = (code: string) => {
  try {
    localStorage.setItem(CURRENT_SCRIPT_KEY, code);
  } catch (error) {
    console.error("Failed to save current script:", error);
  }
};

const loadCurrentScript = (): string => {
  try {
    return localStorage.getItem(CURRENT_SCRIPT_KEY) || getDefaultCode();
  } catch (error) {
    console.error("Failed to load current script:", error);
    return getDefaultCode();
  }
};

const saveCurrentScriptId = (scriptId: number | null) => {
  try {
    if (scriptId === null) {
      localStorage.removeItem(CURRENT_SCRIPT_ID_KEY);
    } else {
      localStorage.setItem(CURRENT_SCRIPT_ID_KEY, scriptId.toString());
    }
  } catch (error) {
    console.error("Failed to save current script ID:", error);
  }
};

const loadCurrentScriptId = (): number | null => {
  try {
    const id = localStorage.getItem(CURRENT_SCRIPT_ID_KEY);
    return id ? parseInt(id, 10) : null;
  } catch (error) {
    console.error("Failed to load current script ID:", error);
    return null;
  }
};

const Playground: React.FC<PlaygroundProps> = ({
  abiRefreshKey = 0,
  currentScript = null,
}) => {
  const VERBOSE_LOGS = false;

  // Initialize code from script library or session storage
  const [code, setCode] = useState(() => {
    if (currentScript?.content) {
      return currentScript.content;
    }
    return loadCurrentScript();
  });

  // Load saved script ID on initialization
  const [savedScriptId, setSavedScriptId] = useState<number | null>(() => {
    return loadCurrentScriptId();
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInlineLogs] = useState(true);

  const handleLog = useCallback((log: LogEntry) => {
    setLogs((prev) => [...prev, log]);
  }, []);

  // Handle script loading - prioritize script library over session storage
  useEffect(() => {
    const loadScriptContent = async () => {
      if (currentScript) {
        // Current script from props takes priority
        setCode(currentScript.content);
        saveCurrentScriptId(currentScript.id || null);
      } else if (savedScriptId && !currentScript) {
        // Load saved script from database if we have an ID but no current script
        try {
          const script = await scriptDb.scripts.get(savedScriptId);
          if (script) {
            setCode(script.content);
          } else {
            // Script no longer exists, clear the saved ID
            setSavedScriptId(null);
            saveCurrentScriptId(null);
            setCode(getDefaultCode());
          }
        } catch (error) {
          console.error("Failed to load saved script:", error);
          setSavedScriptId(null);
          saveCurrentScriptId(null);
          setCode(getDefaultCode());
        }
      } else {
        // No script selected, use session storage or default
        setCode(getDefaultCode());
      }
    };

    loadScriptContent();
  }, [currentScript, savedScriptId]);

  // Auto-save script content when it changes
  useEffect(() => {
    if (currentScript && code !== currentScript.content) {
      const saveScript = async () => {
        try {
          await scriptDb.scripts.update(currentScript.id!, {
            content: code,
            updatedAt: new Date(),
          });
        } catch (error) {
          console.error("Failed to save script:", error);
        }
      };
      saveScript();
    }
  }, [code, currentScript]);

  // Auto-save to session storage for unsaved changes (when no script is selected)
  useEffect(() => {
    if (!currentScript) {
      saveCurrentScript(code);
    }
  }, [code, currentScript]);

  const handleError = useCallback((error: Error) => {
    setError(error.message);
    setIsRunning(false);
  }, []);

  const handleRun = async () => {
    if (isRunning) return;

    setIsRunning(true);
    setLogs([]);
    setError(null);

    try {
      if (VERBOSE_LOGS)
        handleLog({ key: "run", value: "Started", timestamp: Date.now() });

      // For now, let's use a simpler approach that works with the iframe sandbox
      // We'll improve this later with proper bundling

      // Transpile user code (TypeScript) to JavaScript via esbuild
      const compiledUserCode = await transpileCode(code);

      // Extract declared variable names from the original user code only
      const extractUserVarNames = (src: string): Set<string> => {
        const names = new Set<string>();
        try {
          // Simple declarations: const/let/var foo = ...
          const declRegex =
            /\b(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g;
          let m: RegExpExecArray | null;
          while ((m = declRegex.exec(src))) {
            names.add(m[1]);
          }
          // Destructuring: const { a, b: c } = ...  -> capture a and c
          const destrRegex = /\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*[^;\n]+/g;
          let dm: RegExpExecArray | null;
          while ((dm = destrRegex.exec(src))) {
            const inner = dm[1];
            inner
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .forEach((piece) => {
                // handle aliases like b: c
                const alias = piece.split(":").map((x) => x.trim());
                const name = alias[1] || alias[0];
                if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) names.add(name);
              });
          }
        } catch (_) {}
        return names;
      };

      const userVarNames = Array.from(extractUserVarNames(code));

      // Instrument the compiled JS, but only for variables declared in the user's source
      let instrumentedCode = compiledUserCode;
      if (userVarNames.length > 0) {
        const nameAlternation = userVarNames
          .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|");
        const declAssignRe = new RegExp(
          String.raw`(\b(?:const|let|var)\s+(${nameAlternation})\s*=\s*[^;]+;)`,
          "g"
        );
        instrumentedCode = instrumentedCode.replace(
          declAssignRe,
          (_m, stmt, varName) => `${stmt}\n__log("${varName}", ${varName});`
        );

        // Destructuring declarations: only log variables in our set
        const destrRe = new RegExp(
          String.raw`(\b(?:const|let|var)\s*\{\s*([^}]+)\s*\}\s*=\s*[^;]+;)`,
          "g"
        );
        instrumentedCode = instrumentedCode.replace(
          destrRe,
          (_m, stmt, vars) => {
            const candidates = String(vars)
              .split(",")
              .map((v) => v.trim())
              .map((piece) => {
                const alias = piece.split(":").map((x) => x.trim());
                return alias[1] || alias[0];
              })
              .filter(
                (v) =>
                  /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(v) &&
                  userVarNames.includes(v)
              );
            const logs = candidates
              .map((n) => `__log("${n}", ${n});`)
              .join("\n");
            return logs ? `${stmt}\n${logs}` : stmt;
          }
        );
      }

      // Convert console.log(...) to structured logs with args preserved
      instrumentedCode = instrumentedCode.replace(
        /console\.log\(([^)]*)\);?/g,
        '__log("console", [ $1 ]);'
      );

      // Get ABIs for runtime injection
      const globalABIs: Record<string, any[]> = {};
      const storedABIs = await abiDb.abis.toArray();
      storedABIs.forEach((abi) => {
        globalABIs[abi.name] = abi.abi;
      });

      // Create the runtime prelude code (no viem wait needed when bundling)
      const runtimeCode = `
        // Set up logging first
        window.__logs = window.__logs || [];
        window.__safeSerialize = function(value) {
          const maxDepth = 3;
          const seen = new WeakSet();
          const inner = (val, depth) => {
            if (depth > maxDepth) return '[MaxDepth]';
            const type = typeof val;
            if (val === null || type === 'string' || type === 'number' || type === 'boolean') return val;
            if (type === 'bigint') return { __type: 'bigint', value: val.toString() };
            if (type === 'function') return { __type: 'function', name: val.name || 'anonymous' };
            if (type === 'symbol') return { __type: 'symbol', value: String(val) };
            if (val instanceof Error) return { __type: 'Error', name: val.name, message: val.message, stack: val.stack };
            if (val instanceof Date) return { __type: 'Date', value: val.toISOString() };
            if (Array.isArray(val)) return val.map((item) => inner(item, depth + 1));
            if (val && type === 'object') {
              if (seen.has(val)) return '[Circular]';
              seen.add(val);
              const out = {};
              try {
                const keys = Object.keys(val).slice(0, 50);
                for (const key of keys) {
                  try {
                    out[key] = inner(val[key], depth + 1);
                  } catch (e) {
                    out[key] = '[Unserializable]';
                  }
                }
              } catch (_) {
                return String(val);
              }
              return out;
            }
            try { return JSON.parse(JSON.stringify(val)); } catch (_) { return String(val); }
          };
          return inner(value, 0);
        };
        // Basic console format substitution similar to DevTools
        window.__formatConsole = function(args) {
          try {
            if (!args || args.length === 0) return '';
            const [first, ...rest] = args;
            if (typeof first !== 'string') return null;
            let i = 0;
            const out = first.replace(/%[sdifoOc]/g, (match) => {
              const next = rest[i++];
              switch (match) {
                case '%s': return String(next);
                case '%d':
                case '%i': return Number(next).toString();
                case '%f': return Number(next).toString();
                case '%o':
                case '%O': return (typeof next === 'object') ? JSON.stringify(next) : String(next);
                case '%c': return '';
                default: return match;
              }
            });
            const remaining = rest.slice(i).map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' ');
            return remaining ? (out + ' ' + remaining) : out;
          } catch (_) { return null; }
        };

        window.__log = function(key, value) {
          const isConsole = key === 'console';
          const rawArgs = isConsole && Array.isArray(value) ? value : undefined;
          const formatted = isConsole ? window.__formatConsole(rawArgs) : undefined;
          const safeValue = window.__safeSerialize(value);
          const safeArgs = rawArgs ? rawArgs.map(window.__safeSerialize) : undefined;
          const log = { key, value: safeValue, timestamp: Date.now(), source: isConsole ? 'console' : 'inline', formatted, args: safeArgs };
          window.__logs.push(log);
          window.parent.postMessage({ type: 'LOG', payload: log }, '*');
          // Avoid noisy console mirroring for internal keys
          if (!['script','viem','user-code','success'].includes(key)) {
            try { console.log(key + ':', value); } catch (_) {}
          }
        };

        // Forward runtime errors to the parent so they appear in the UI
        window.addEventListener('error', (event) => {
          try {
            const message = (event && (event.error && event.error.message)) || event.message || 'Script error';
            window.parent.postMessage({ type: 'ERROR', payload: message }, '*');
          } catch (_) {}
        });
        window.addEventListener('unhandledrejection', (event) => {
          try {
            const reason = event && event.reason;
            const message = (reason && (reason.message || String(reason))) || 'Unhandled promise rejection';
            window.parent.postMessage({ type: 'ERROR', payload: message }, '*');
          } catch (_) {}
        });

        window.__log('script', 'Runtime prelude ready');
      `;

      // Execute in iframe context with proper setup
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.sandbox = "allow-scripts allow-same-origin";

      // Set up iframe with basic HTML first; we'll load our local shim next
      iframe.srcdoc = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Sandbox</title>
          </head>
          <body>
            <div id="root"></div>
          </body>
        </html>
      `;

      let iframeLoadTimeoutId: number | undefined;
      const iframeLoadPromise = new Promise<void>((resolve, reject) => {
        iframe.onload = () => {
          if (VERBOSE_LOGS)
            handleLog({
              key: "iframe",
              value: "Iframe loaded successfully",
              timestamp: Date.now(),
            });
          try {
            const iframeDoc =
              iframe.contentDocument || iframe.contentWindow?.document;
            if (!iframeDoc) {
              handleLog({
                key: "error",
                value: "Could not access iframe document",
                timestamp: Date.now(),
              });
              reject(new Error("Could not access iframe document"));
              return;
            }

            // Inject runtime prelude (classic script)
            const prelude = iframeDoc.createElement("script");
            prelude.type = "text/javascript";
            prelude.textContent = runtimeCode;
            iframeDoc.body.appendChild(prelude);

            // Inject global ABIs before user code
            const globalABIsScript = iframeDoc.createElement("script");
            globalABIsScript.type = "text/javascript";
            globalABIsScript.textContent = `
              window.__globalABIs = ${JSON.stringify(globalABIs)};
              // Make ABIs available globally
              Object.entries(window.__globalABIs).forEach(([name, abi]) => {
                window[name] = abi;
              });
            `;
            iframeDoc.body.appendChild(globalABIsScript);

            // Inject user bundle as ESM (supports top-level await). It will execute immediately.
            const userModule = iframeDoc.createElement("script");
            userModule.type = "module";
            userModule.textContent = instrumentedCode;
            iframeDoc.body.appendChild(userModule);

            if (VERBOSE_LOGS)
              handleLog({
                key: "iframe",
                value: "Runtime prelude + user module added",
                timestamp: Date.now(),
              });

            try {
              if (iframeLoadTimeoutId) clearTimeout(iframeLoadTimeoutId);
            } catch (_) {}
            resolve();
          } catch (error) {
            handleLog({
              key: "error",
              value: `Iframe setup error: ${error}`,
              timestamp: Date.now(),
            });
            reject(error);
          }
        };

        iframe.onerror = () => {
          handleLog({
            key: "error",
            value: "Iframe failed to load",
            timestamp: Date.now(),
          });
          reject(new Error("Failed to load iframe"));
        };

        // Timeout after 5 seconds for iframe loading (viem loading happens separately)
        iframeLoadTimeoutId = window.setTimeout(() => {
          handleLog({
            key: "error",
            value: "Iframe load timeout",
            timestamp: Date.now(),
          });
          reject(new Error("Iframe load timeout"));
        }, 5000);
      });

      if (VERBOSE_LOGS)
        handleLog({
          key: "iframe",
          value: "Iframe added to DOM",
          timestamp: Date.now(),
        });
      document.body.appendChild(iframe);
      await iframeLoadPromise;

      // Listen for messages from iframe
      const messageHandler = (event: MessageEvent) => {
        if (event.source !== iframe.contentWindow) return;

        if (event.data.type === "LOG") {
          const log = event.data.payload as LogEntry;
          const internalKeys = new Set([
            "run",
            "script",
            "viem",
            "user-code",
            "success",
            "iframe",
            "error",
          ]);
          if (internalKeys.has(log.key)) return;
          handleLog(log);
        } else if (event.data.type === "ERROR") {
          handleError(new Error(event.data.payload));
        }
      };

      window.addEventListener("message", messageHandler);

      // Clean up after execution
      setTimeout(() => {
        window.removeEventListener("message", messageHandler);
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        setIsRunning(false);
      }, 8000); // Allow 8 seconds for execution
    } catch (err) {
      console.error("Execution error:", err);
      handleError(err as Error);
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    setError(null);
  };

  const handleClearLogs = () => {
    setLogs([]);
    setError(null);
  };

  const handleReset = () => {
    if (currentScript) {
      setCode(currentScript.content);
    } else {
      setCode(getDefaultCode());
      // Clear session storage when resetting to default
      saveCurrentScript(getDefaultCode());
    }
    setLogs([]);
    setError(null);
    setIsRunning(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Viem Playground</h1>
          {currentScript ? (
            <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded">
              {currentScript.name}
            </div>
          ) : (
            <div className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded border border-amber-200">
              Unsaved Changes
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={16} />
              {isRunning ? "Running..." : "Run"}
            </button>
            {isRunning && (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Square size={16} />
                Stop
              </button>
            )}
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-2">
            <div className="text-red-600 font-semibold">Error:</div>
            <div className="text-red-800">{error}</div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
        {/* Editor panel */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
          <div className="flex-shrink-0 p-2 bg-gray-100 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-700">Editor</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              key={abiRefreshKey}
              value={code}
              onChange={(value) => setCode(value || "")}
              height="100%"
              logs={logs.filter((l) => l.source === "inline")}
              showInlineLogs={showInlineLogs}
            />
          </div>
        </div>

        {/* Console panel */}
        <div className="w-full md:w-96 h-64 md:h-auto flex flex-col overflow-hidden border-t md:border-t-0 md:border-l border-gray-200 flex-shrink-0">
          <ConsolePanel
            logs={logs.filter((l) => l.source === "console")}
            onClear={handleClearLogs}
          />
        </div>
      </div>
    </div>
  );
};

export default Playground;
