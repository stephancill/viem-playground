import { useState, useEffect } from "react";
import Playground from "./components/Playground";
import { Sidebar } from "./components/Sidebar";
import { Button } from "./components/ui/button";
import { Library } from "lucide-react";
import type { StoredScript } from "./lib/abiDatabase";
import { scriptDb } from "./lib/abiDatabase";

function App() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [abiRefreshKey, setAbiRefreshKey] = useState(0);
  const [currentScript, setCurrentScript] = useState<StoredScript | null>(null);

  // Load saved script on app initialization
  useEffect(() => {
    const loadSavedScript = async () => {
      try {
        const savedId = localStorage.getItem(
          "viem-playground-current-script-id"
        );
        if (savedId) {
          const scriptId = parseInt(savedId, 10);
          const script = await scriptDb.scripts.get(scriptId);
          if (script) {
            setCurrentScript(script);
          }
        }
      } catch (error) {
        console.error("Failed to load saved script on app start:", error);
      }
    };

    loadSavedScript();
  }, []);

  const handleABIChange = () => {
    setAbiRefreshKey((prev) => prev + 1);
  };

  const handleScriptLoad = (script: StoredScript) => {
    setCurrentScript(script);
    setShowSidebar(false);
  };

  const handleScriptCreate = (script: StoredScript) => {
    setCurrentScript(script);
    setShowSidebar(false);
  };

  return (
    <div className="h-screen flex">
      {/* Main Playground */}
      <div className="flex-1 min-w-0">
        <Playground
          abiRefreshKey={abiRefreshKey}
          currentScript={currentScript}
        />
      </div>

      {/* Sidebar */}
      <Sidebar
        open={showSidebar}
        onOpenChange={setShowSidebar}
        onScriptLoad={handleScriptLoad}
        onScriptCreate={handleScriptCreate}
        onABIChange={handleABIChange}
        currentScript={currentScript}
      />

      {/* Toggle Sidebar Button */}
      <Button
        onClick={() => setShowSidebar(!showSidebar)}
        className="fixed top-4 right-4 z-50"
        variant="outline"
        size="icon"
        title="Open Library"
      >
        <Library className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default App;
