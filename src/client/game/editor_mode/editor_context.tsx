import { createContext, ReactNode, useContext, useState } from "react";
import { PlayerColor } from "../../../engine/state/player";

interface EditorContextValue {
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
  const [selectedOwner, setOwner] = useState<PlayerColor | undefined>(undefined);

  return (
    <EditorContext.Provider value={{ selectedOwner, setOwner }}>
      {children}
    </EditorContext.Provider>
  );
}
