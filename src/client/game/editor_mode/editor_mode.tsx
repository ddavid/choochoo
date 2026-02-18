import { useCallback, useMemo, useState } from "react";
import { Header, Segment } from "semantic-ui-react";
import { GameApi } from "../../../api/game";
import { SerializedGameData } from "../../../engine/framework/state";
import { MutableAvailableCity } from "../../../engine/state/available_city";
import { MutablePlayerData, PlayerColor } from "../../../engine/state/player";
import { EditorContextProvider } from "./editor_context";
import { EditorMap } from "./editor_map";
import { EditorPanel } from "./editor_panel";

interface EditorModeProps {
  game: GameApi;
}

export function EditorMode({ game }: EditorModeProps) {
  const [localGameData, setLocalGameData] = useState<string | undefined>(
    game.gameData,
  );

  // Keep local state in sync when the server pushes updates
  useMemo(() => {
    setLocalGameData(game.gameData);
  }, [game.gameData]);

  if (localGameData == null) return null;

  const parsed = JSON.parse(localGameData) as SerializedGameData;
  const players = (parsed.gameData["players"] as MutablePlayerData[]) ?? [];
  const turnOrder = (parsed.gameData["turnOrder"] as PlayerColor[]) ?? [];
  const roundNumber = (parsed.gameData["roundNumber"] as number) ?? 1;
  const availableCities =
    (parsed.gameData["availableCities"] as MutableAvailableCity[]) ?? [];

  const updateField = useCallback(
    (field: string, value: unknown) => {
      setLocalGameData((prev) => {
        if (prev == null) return prev;
        const state = JSON.parse(prev) as SerializedGameData;
        return JSON.stringify({
          ...state,
          gameData: { ...state.gameData, [field]: value },
        });
      });
    },
    [],
  );

  const onPlayerUpdate = useCallback(
    (newPlayers: MutablePlayerData[]) => updateField("players", newPlayers),
    [updateField],
  );
  const onTurnOrderUpdate = useCallback(
    (newOrder: PlayerColor[]) => updateField("turnOrder", newOrder),
    [updateField],
  );
  const onRoundUpdate = useCallback(
    (newRound: number) => updateField("roundNumber", newRound),
    [updateField],
  );
  const onAvailableCitiesUpdate = useCallback(
    (newCities: MutableAvailableCity[]) =>
      updateField("availableCities", newCities),
    [updateField],
  );

  // Build a game object with local edits for the map to render
  const editedGame = useMemo(
    (): GameApi => ({ ...game, gameData: localGameData }),
    [game, localGameData],
  );

  return (
    <EditorContextProvider>
      <Header as="h2">Editor Mode</Header>
      <Segment>
        <p>
          Place tiles, goods, and connections on the map. Choose an owner for
          placed items. Edit player stats below. Click <b>Save Changes</b> to
          persist, then <b>Start</b> the game when ready.
        </p>
      </Segment>
      <EditorPanel
        gameData={localGameData}
        players={players}
        turnOrder={turnOrder}
        roundNumber={roundNumber}
        availableCities={availableCities}
        onPlayerUpdate={onPlayerUpdate}
        onTurnOrderUpdate={onTurnOrderUpdate}
        onRoundUpdate={onRoundUpdate}
        onAvailableCitiesUpdate={onAvailableCitiesUpdate}
      />
      <EditorMap game={editedGame} onGameDataChange={setLocalGameData} />
    </EditorContextProvider>
  );
}
