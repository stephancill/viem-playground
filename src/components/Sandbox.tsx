import React, { useRef, useEffect, useState } from "react";
import type { LogEntry } from "./Playground";

interface SandboxProps {
  code: string;
  onLog: (log: LogEntry) => void;
  onError: (error: Error) => void;
}

const Sandbox: React.FC<SandboxProps> = ({ code, onLog, onError }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDoc) return;

    // Create the iframe content with viem and our runtime
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Sandbox</title>
          <script crossorigin src="https://esm.sh/viem@2.37.5"></script>
        </head>
        <body>
          <div id="root"></div>
          <script type="module">
            // Make viem available globally
            window.viem = window.viem || {};

            // Set up logging
            window.__logs = [];
            window.__log = function(key, value) {
              const log = { key, value, timestamp: Date.now() };
              window.__logs.push(log);
              // Send log to parent
              window.parent.postMessage({
                type: 'LOG',
                payload: log
              }, '*');
            };

            // Set up input function (placeholder for now)
            window.getInput = async function(key) {
              return null;
            };

            // Signal ready
            window.parent.postMessage({ type: 'READY' }, '*');
          </script>
        </body>
      </html>
    `;

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // Listen for messages from the iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;

      switch (event.data.type) {
        case "READY":
          setIsReady(true);
          break;
        case "LOG":
          onLog(event.data.payload);
          break;
        case "ERROR":
          onError(new Error(event.data.payload));
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [onLog, onError]);

  // Execute code when it changes and iframe is ready
  useEffect(() => {
    if (!isReady || !code || !iframeRef.current) return;

    const iframe = iframeRef.current;
    const iframeWin = iframe.contentWindow;

    if (!iframeWin) return;

    try {
      // Create a script element and execute the code
      const script = iframeWin.document.createElement("script");
      script.type = "module";
      script.textContent = code;
      iframeWin.document.body.appendChild(script);
    } catch (error) {
      onError(error as Error);
    }
  }, [code, isReady, onLog, onError]);

  return (
    <iframe
      ref={iframeRef}
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        backgroundColor: "transparent",
      }}
      sandbox="allow-scripts allow-same-origin"
      title="Code Sandbox"
    />
  );
};

export default Sandbox;
