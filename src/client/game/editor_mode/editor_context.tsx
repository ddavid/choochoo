import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { PlayerColor } from "../../../engine/state/player";

export enum EditorTool {
  TILE = "tile",
  GOOD = "good",
  CONNECTION = "connection",
  ERASER = "eraser",
}

interface EditorContextValue {
  currentTool: EditorTool;
  setTool(tool: EditorTool): void;
  selectedOwner: PlayerColor | undefined;
  setOwner(owner: PlayerColor | undefined): void;
}

const EditorContext = createContext<EditorContextValue | undefined>(undefined);

export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (ctx == null) {
    throw new Error("useEditorContext must be used within EditorContextProvider");
  }
  return ctx;
}

interface EditorContextProviderProps {
  children: ReactNode;
}

export function EditorContextProvider({ children }: EditorContextProviderProps) {
  const [currentTool, setTool] = useState<EditorTool>(EditorTool.TILE);
  const [selectedOwner, setOwner] = useState<PlayerColor | undefined>(undefined);

  return (
    <EditorContext.Provider value={{ currentTool, setTool, selectedOwner, setOwner }}>
      {children}
    </EditorContext.Provider>
  );
}
