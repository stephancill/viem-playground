import React from "react";
import ValueRenderer from "@/lib/valueRenderer";

interface LogEntry {
  key: string;
  value: unknown;
  timestamp: number;
}

interface ConsolePanelProps {
  logs: LogEntry[];
  isVisible?: boolean;
  onClear?: () => void;
}

const ConsolePanel: React.FC<ConsolePanelProps> = ({
  logs,
  isVisible = true,
  onClear,
}) => {
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (!isVisible) return null;

  return (
    <div className="flex flex-col h-full bg-gray-900 text-green-400 font-mono text-sm overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">CONSOLE</span>
          <span className="text-xs text-gray-400">({logs.length} entries)</span>
        </div>
        {onClear && logs.length > 0 && (
          <button
            onClick={onClear}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          >
            Clear
          </button>
        )}
      </div>

      {/* Log entries - Scrollable container */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {logs.length === 0 ? (
          <div className="text-gray-500 italic">
            No logs yet. Run some code to see output here.
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-1 rounded hover:bg-gray-800"
              >
                <span className="text-gray-500 text-xs flex-shrink-0">
                  {formatTimestamp(log.timestamp)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-blue-400 font-semibold">
                      {log.key}:
                    </span>
                    <span className="text-xs text-gray-500">
                      {typeof log.value}
                    </span>
                  </div>
                  <div className="text-green-300 whitespace-pre-wrap break-all">
                    <ValueRenderer value={log.value} variant="full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsolePanel;
