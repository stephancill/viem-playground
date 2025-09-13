import React, { useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import * as monaco from "monaco-editor";

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  height?: string;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  height = "400px",
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

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
    });

    const viemDtsFiles: Record<string, string> = (import.meta as any).glob(
      "/node_modules/viem/_types/**/*.d.ts",
      { as: "raw", eager: true }
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
      { as: "raw", eager: true }
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
    ).glob("/node_modules/viem/_types/**/index.ts", { as: "raw", eager: true });
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
      as: "raw",
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
  };

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
          quickSuggestions: true,
          parameterHints: {
            enabled: true,
          },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: "on",
          tabCompletion: "on",
        }}
        theme="vs-dark"
      />
    </div>
  );
};

export default CodeEditor;
