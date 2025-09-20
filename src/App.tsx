import { useState } from "react";
import Playground from "./components/Playground";
import { ABIManager } from "./components/ABIManager";

function App() {
  const [showABIManager, setShowABIManager] = useState(false);
  const [abiRefreshKey, setAbiRefreshKey] = useState(0);

  const handleABIChange = () => {
    setAbiRefreshKey((prev) => prev + 1);
  };

  const toggleABIManager = () => {
    setShowABIManager(!showABIManager);
  };

  return (
    <div className="h-screen flex">
      {/* Main Playground */}
      <div className="flex-1 min-w-0">
        <Playground abiRefreshKey={abiRefreshKey} />
      </div>

      {/* ABI Manager Sidebar */}
      {showABIManager && (
        <div className="w-96 h-full border-l border-gray-200 bg-white overflow-hidden shadow-xl">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold">ABI Library</h2>
            <button
              onClick={() => setShowABIManager(false)}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
          </div>
          <div className="h-full overflow-y-auto">
            <ABIManager onABIChange={handleABIChange} />
          </div>
        </div>
      )}

      {/* Toggle ABI Manager Button */}
      <button
        onClick={toggleABIManager}
        className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        title="Toggle ABI Library"
      >
        📚
      </button>
    </div>
  );
}

export default App;
