import React, { useState, useEffect } from "react";
import { scriptDb } from "@/lib/abiDatabase";
import type { StoredScript } from "@/lib/abiDatabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2 } from "lucide-react";

interface ScriptManagerProps {
  onScriptLoad?: (script: StoredScript) => void;
  onScriptCreate?: (script: StoredScript) => void;
  currentScript?: StoredScript | null;
}

export const ScriptManager: React.FC<ScriptManagerProps> = ({
  onScriptLoad,
  onScriptCreate,
  currentScript,
}) => {
  const [scripts, setScripts] = useState<StoredScript[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newScript, setNewScript] = useState({
    name: "",
    description: "",
  });

  useEffect(() => {
    loadScripts();
  }, []);

  const loadScripts = async () => {
    const allScripts = await scriptDb.scripts.toArray();
    setScripts(allScripts);
  };

  const handleCreateScript = async () => {
    if (!newScript.name.trim()) return;

    const script: StoredScript = {
      name: newScript.name.trim(),
      content: "",
      description: newScript.description.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await scriptDb.scripts.add(script);

    setNewScript({ name: "", description: "" });
    setShowCreateDialog(false);
    await loadScripts();
    onScriptCreate?.(script);
  };

  const handleLoadScript = async (script: StoredScript) => {
    onScriptLoad?.(script);
  };

  const handleDeleteScript = async (id: number) => {
    if (confirm("Are you sure you want to delete this script?")) {
      await scriptDb.scripts.delete(id);
      await loadScripts();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="text-lg font-semibold">Scripts</h3>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Script
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Script</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newScript.name}
                  onChange={(e) =>
                    setNewScript({ ...newScript, name: e.target.value })
                  }
                  className="col-span-3"
                  placeholder="My Script"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Input
                  id="description"
                  value={newScript.description}
                  onChange={(e) =>
                    setNewScript({ ...newScript, description: e.target.value })
                  }
                  className="col-span-3"
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateScript}
                disabled={!newScript.name.trim()}
              >
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {scripts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No scripts yet.</p>
              <p className="text-xs">
                Create your first script to get started.
              </p>
            </div>
          ) : (
            scripts.map((script) => (
              <div
                key={script.id}
                className={`p-3 border rounded-lg transition-colors hover:bg-muted/50 cursor-pointer ${
                  currentScript?.id === script.id
                    ? "bg-primary/10 border-primary"
                    : ""
                }`}
                onClick={() => handleLoadScript(script)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {script.name}
                    </div>
                    {script.description && (
                      <div className="text-xs text-muted-foreground mt-1 truncate">
                        {script.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      Updated {script.updatedAt.toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteScript(script.id!);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
