import React, { useRef, useEffect, useMemo } from "react";
import Editor from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { formatHoverMarkdown } from "@/lib/valueRenderer";

interface CodeEditorLogEntry {
  key: string;
  value: unknown;
  timestamp: number;
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  height?: string;
  logs?: CodeEditorLogEntry[];
  showInlineLogs?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  height = "400px",
  logs = [],
  showInlineLogs = true,
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);

  // Compute latest value per key for concise rendering
  const latestByKey = useMemo(() => {
    const map = new Map<string, CodeEditorLogEntry>();
    for (const entry of logs) {
      const existing = map.get(entry.key);
      if (!existing || existing.timestamp < entry.timestamp)
        map.set(entry.key, entry);
    }
    return map;
  }, [logs]);

  // Handle window resize for responsive editor
  useEffect(() => {
    const handleResize = () => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleEditorDidMount = (
    editor: monaco.editor.IStandaloneCodeEditor,
    monacoInstance: typeof monaco
  ) => {
    editorRef.current = editor;

    // Ensure models sync eagerly so diagnostics apply immediately
    monacoInstance.languages.typescript.typescriptDefaults.setEagerModelSync(
      true
    );

    // Configure Monaco for TS: enable top-level await + ESM + Node-like resolution
    monacoInstance.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monacoInstance.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution:
        monacoInstance.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monacoInstance.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      esModuleInterop: true,
      jsx: monacoInstance.languages.typescript.JsxEmit.React,
      reactNamespace: "React",
      allowJs: true,
      // Make libs modern so TS allows top-level await in modules
      lib: ["es2022", "dom"],
      // Help TS resolve bare specifiers via virtual node_modules files we add below
      baseUrl: "file:///",
      paths: {
        viem: ["node_modules/viem/index.d.ts"],
        "viem/*": ["node_modules/viem/*/index.d.ts"],
      },
      typeRoots: ["node_modules/@types"],
      // Enhanced options for auto-imports
      allowSyntheticDefaultImports: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: false,
      // Enable better import resolution
      allowImportingTsExtensions: true,
      noImplicitAny: false,
    });

    // Configure editor options for better auto-import experience
    monacoInstance.languages.typescript.typescriptDefaults.setEagerModelSync(true);
    monacoInstance.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: false,
    });

    // Extract viem functions dynamically from type definitions with correct import paths
    const extractViemFunctions = () => {
      const functionMap = new Map<string, string>(); // function name -> import path
      
      // Get all the viem type files we've loaded
      const viemTypeFiles = [
        ...Object.keys(viemDtsFiles),
        ...Object.keys(viemTsFiles),
        ...Object.keys(viemSubmoduleIndexFiles),
        ...Object.keys(viemSubmoduleIndexDtsFiles)
      ];

      // Extract function names from type definitions with their import paths
      viemTypeFiles.forEach(filePath => {
        const content = viemDtsFiles[filePath] || viemTsFiles[filePath] || 
                       viemSubmoduleIndexFiles[filePath] || viemSubmoduleIndexDtsFiles[filePath];
        
        if (content) {
          // Determine the import path based on file location
          let importPath = 'viem'; // default to main viem
          
          if (filePath.includes('/_types/')) {
            // Extract submodule from path like /_types/accounts/index.d.ts
            const submoduleMatch = filePath.match(/\/_types\/([^\/]+)\//);
            if (submoduleMatch) {
              const submodule = submoduleMatch[1];
              importPath = `viem/${submodule}`;
            }
          }

          // Match function declarations and exports
          const functionMatches = content.match(/(?:export\s+)?(?:declare\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g);
          if (functionMatches) {
            functionMatches.forEach(match => {
              const funcName = match.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/)?.[1];
              if (funcName) {
                functionMap.set(funcName, importPath);
              }
            });
          }

          // Match exported const functions
          const constFunctionMatches = content.match(/export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g);
          if (constFunctionMatches) {
            constFunctionMatches.forEach(match => {
              const funcName = match.match(/export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/)?.[1];
              if (funcName) {
                functionMap.set(funcName, importPath);
              }
            });
          }

          // Match export statements
          const exportMatches = content.match(/export\s*{\s*([^}]+)\s*}/g);
          if (exportMatches) {
            exportMatches.forEach(match => {
              const exports = match.match(/export\s*{\s*([^}]+)\s*}/)?.[1];
              if (exports) {
                const exportNames = exports.split(',').map(name => name.trim().split(' as ')[0].trim());
                exportNames.forEach(name => {
                  if (name && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
                    functionMap.set(name, importPath);
                  }
                });
              }
            });
          }
        }
      });

      return functionMap;
    };

    // Configure Monaco to show import suggestions for global functions
    monacoInstance.languages.registerCompletionItemProvider('typescript', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        // Get viem functions with their correct import paths
        const viemFunctionMap = extractViemFunctions();
        const suggestions: monaco.languages.CompletionItem[] = [];

        viemFunctionMap.forEach((importPath, funcName) => {
          if (funcName.toLowerCase().includes(word.word.toLowerCase())) {
            suggestions.push({
              label: funcName,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: funcName,
              range: range,
              detail: `viem function (from ${importPath})`,
              documentation: `Import from '${importPath}': import { ${funcName} } from '${importPath}'`,
              additionalTextEdits: [{
                range: {
                  startLineNumber: 1,
                  startColumn: 1,
                  endLineNumber: 1,
                  endColumn: 1,
                },
                text: `import { ${funcName} } from '${importPath}';\n`
              }]
            });
          }
        });

        return { suggestions };
      }
    });

    const viemDtsFiles: Record<string, string> = (import.meta as any).glob(
      "/node_modules/viem/_types/**/*.d.ts",
      { query: "?raw", import: "default", eager: true }
    );
    for (const [path, source] of Object.entries(viemDtsFiles)) {
      monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
        source as string,
        `file://${path}`
      );
    }

    // Also include the TypeScript sources so module paths like 'viem/chains' resolve fully
    const viemTsFiles: Record<string, string> = (import.meta as any).glob(
      "/node_modules/viem/_types/**/*.ts",
      { query: "?raw", import: "default", eager: true }
    );
    for (const [path, source] of Object.entries(viemTsFiles)) {
      monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
        source as string,
        `file://${path}`
      );
      // Mirror to .js path so ESM-style '.js' imports inside types resolve in Monaco
      if (path.endsWith(".ts")) {
        const jsMirror = path.replace(/\.ts$/, ".js");
        monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
          source as string,
          `file://${jsMirror}`
        );
      }
    }

    // Create lightweight entry points that re-export the real type trees.
    // These align with imports like `import {...} from 'viem'` and 'viem/chains'
    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
      "export * from './_types/index.d.ts';\n",
      "file:///node_modules/viem/index.d.ts"
    );
    // Generate wrappers for every subpath that has an index.ts under _types
    const viemSubmoduleIndexFiles: Record<string, string> = (
      import.meta as any
    ).glob("/node_modules/viem/_types/**/index.ts", {
      query: "?raw",
      import: "default",
      eager: true,
    });
    Object.keys(viemSubmoduleIndexFiles).forEach((absPath) => {
      const prefix = "/node_modules/viem/_types/";
      const suffix = "/index.ts";
      if (!absPath.startsWith(prefix) || !absPath.endsWith(suffix)) return;
      const subpath = absPath.slice(
        prefix.length,
        absPath.length - suffix.length
      ); // e.g., 'actions/public'
      const wrapperUri = `file:///node_modules/viem/${subpath}/index.d.ts`;
      const reexport = `export * from '../_types/${subpath}/index.ts';\n`;
      monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
        reexport,
        wrapperUri
      );
    });

    // Also generate wrappers for subpaths that only have index.d.ts (e.g., chains)
    const viemSubmoduleIndexDtsFiles: Record<string, string> = (
      import.meta as any
    ).glob("/node_modules/viem/_types/**/index.d.ts", {
      query: "?raw",
      import: "default",
      eager: true,
    });
    Object.keys(viemSubmoduleIndexDtsFiles).forEach((absPath) => {
      const prefix = "/node_modules/viem/_types/";
      const suffix = "/index.d.ts";
      if (!absPath.startsWith(prefix) || !absPath.endsWith(suffix)) return;
      const subpath = absPath.slice(
        prefix.length,
        absPath.length - suffix.length
      ); // e.g., 'chains'
      const wrapperUri = `file:///node_modules/viem/${subpath}/index.d.ts`;
      const reexport = `export * from '../_types/${subpath}/index.d.ts';\n`;
      monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
        reexport,
        wrapperUri
      );
    });

    // Add runtime helpers only
    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
      `declare global { function __log(key: string, value: any): void; function getInput(key: string): Promise<any>; } export {};`,
      "file:///types/runtime-globals.d.ts"
    );

    // Create dynamic global viem declarations based on extracted functions
    const createGlobalViemDeclarations = () => {
      const functionMap = extractViemFunctions();
      const globalDeclarations = Array.from(functionMap.keys()).map(func => 
        `function ${func}(...args: any[]): any;`
      ).join('\n        ');
      
      return `declare global {
        ${globalDeclarations}
      } export {};`;
    };

    // Add dynamic global viem declarations for auto-import suggestions
    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
      createGlobalViemDeclarations(),
      "file:///types/viem-globals.d.ts"
    );

    // Configure additional editor features for better auto-import experience
    // Note: setIncludePackageJsonAutoImports is not available in this Monaco version
    
    // Add some common Node.js types for better auto-imports
    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
      `declare module 'fs' { export * from 'node:fs'; }`,
      "file:///node_modules/@types/node/fs.d.ts"
    );
    
    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
      `declare module 'path' { export * from 'node:path'; }`,
      "file:///node_modules/@types/node/path.d.ts"
    );
  };

  // Locate a reasonable line for a variable key in the current source
  const findLineForKey = (source: string, key: string): number | null => {
    if (!key) return null;
    const lines = source.split(/\n/);
    const escaped = key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const declRegex = new RegExp(
      String.raw`\b(?:const|let|var)\b[^\n;]*\b${escaped}\b\s*=`,
      "i"
    );
    const assignRegex = new RegExp(String.raw`\b${escaped}\b\s*=`, "i");
    let candidate: number | null = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (declRegex.test(line) || assignRegex.test(line)) candidate = i + 1;
    }
    if (candidate) return candidate;
    // fallback: first mention
    const wordRegex = new RegExp(String.raw`\b${escaped}\b`, "i");
    for (let i = 0; i < lines.length; i++) {
      if (wordRegex.test(lines[i])) return i + 1;
    }
    return null;
  };

  // Update glyph margin markers when code/logs change
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    // Remove previous decorations
    decorationsRef.current = model.deltaDecorations(decorationsRef.current, []);

    if (!showInlineLogs || latestByKey.size === 0) return;

    const decorations: monaco.editor.IModelDeltaDecoration[] = [];

    for (const [key, entry] of latestByKey.entries()) {
      const lineNumber = findLineForKey(model.getValue(), key);
      if (!lineNumber) continue;

      const hover = formatHoverMarkdown(entry.value);

      decorations.push({
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: "inline-log-glyph",
          glyphMarginHoverMessage: [{ value: `**${key}**` }, { value: hover }],
        },
      });
    }

    decorationsRef.current = model.deltaDecorations(
      decorationsRef.current,
      decorations
    );
  }, [value, latestByKey, showInlineLogs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const editor = editorRef.current;
      if (!editor) return;
      const model = editor.getModel();
      if (!model) return;
      try {
        decorationsRef.current = model.deltaDecorations(
          decorationsRef.current,
          []
        );
      } catch {}
    };
  }, []);

  return (
    <div className="h-full border border-gray-300 rounded-lg overflow-hidden">
      <Editor
        height={height || "100%"}
        language="typescript"
        value={value}
        onChange={onChange}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          roundedSelection: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: "on",
          tabSize: 2,
          folding: true,
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          glyphMargin: true,
          contextmenu: true,
          mouseWheelZoom: true,
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false,
          },
          parameterHints: {
            enabled: true,
          },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: "on",
          tabCompletion: "on",
          // Auto-import configuration
          suggest: {
            showKeywords: true,
            showSnippets: true,
            showFunctions: true,
            showConstructors: true,
            showFields: true,
            showVariables: true,
            showClasses: true,
            showStructs: true,
            showInterfaces: true,
            showModules: true,
            showProperties: true,
            showEvents: true,
            showOperators: true,
            showUnits: true,
            showValues: true,
            showConstants: true,
            showEnums: true,
            showEnumMembers: true,
            showColors: true,
            showFiles: true,
            showReferences: true,
            showFolders: true,
            showTypeParameters: true,
            showIssues: true,
            showUsers: true,
            showWords: true,
            insertMode: "insert",
            filterGraceful: true,
            showIcons: true,
            localityBonus: true,
            shareSuggestSelections: false,
            snippetsPreventQuickSuggestions: true,
            showMethods: true,
          },
        }}
        theme="vs-dark"
      />
    </div>
  );
};

export default CodeEditor;
