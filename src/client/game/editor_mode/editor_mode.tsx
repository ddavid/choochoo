import { useCallback, useMemo, useRef, useState } from "react";
import { Header, Segment } from "semantic-ui-react";
import { GameApi } from "../../../api/game";
import { SerializedGameData } from "../../../engine/framework/state";
import { MutableAvailableCity } from "../../../engine/state/available_city";
import { SpaceType } from "../../../engine/state/location_type";
import { MutablePlayerData, PlayerColor } from "../../../engine/state/player";
import { Coordinates } from "../../../utils/coordinates";
import { EditorContextProvider } from "./editor_context";
import { EditorMap } from "./editor_map";
import { EditorPanel } from "./editor_panel";

interface EditorModeProps {
  game: GameApi;
}

export function EditorMode({ game }: EditorModeProps) {
  // Undo/redo history
  const historyRef = useRef<string[]>(
    game.gameData != null ? [game.gameData] : [],
  );
  const [historyIndex, setHistoryIndex] = useState(0);

  const localGameData =
    historyRef.current.length > 0
      ? historyRef.current[historyIndex]
      : undefined;

  // Push a new state onto the history (truncates any redo states)
  const pushState = useCallback(
    (newData: string) => {
      const newHistory = historyRef.current.slice(0, historyIndex + 1);
      newHistory.push(newData);
      historyRef.current = newHistory;
      setHistoryIndex(newHistory.length - 1);
    },
    [historyIndex],
  );

  // Keep in sync when server pushes updates
  useMemo(() => {
    if (game.gameData != null && game.gameData !== localGameData) {
      historyRef.current = [game.gameData];
      setHistoryIndex(0);
    }
  }, [game.gameData]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyRef.current.length - 1;
  const onUndo = useCallback(() => {
    if (historyIndex > 0) setHistoryIndex(historyIndex - 1);
  }, [historyIndex]);
  const onRedo = useCallback(() => {
    if (historyIndex < historyRef.current.length - 1)
      setHistoryIndex(historyIndex + 1);
  }, [historyIndex]);

  if (localGameData == null) return null;

  const parsed = JSON.parse(localGameData) as SerializedGameData;
  const players = (parsed.gameData["players"] as MutablePlayerData[]) ?? [];
  const turnOrder = (parsed.gameData["turnOrder"] as PlayerColor[]) ?? [];
  const roundNumber = (parsed.gameData["roundNumber"] as number) ?? 1;
  const availableCities =
    (parsed.gameData["availableCities"] as MutableAvailableCity[]) ?? [];

  const updateField = useCallback(
    (field: string, value: unknown) => {
      const state = JSON.parse(localGameData) as SerializedGameData;
      pushState(
        JSON.stringify({
          ...state,
          gameData: { ...state.gameData, [field]: value },
        }),
      );
    },
    [localGameData, pushState],
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

  // Change player color: update players, turnOrder, grid tile owners,
  // and inter-city connection owners.
  const onColorChange = useCallback(
    (playerIndex: number, newColor: PlayerColor) => {
      const state = JSON.parse(localGameData) as SerializedGameData;
      const gd = { ...state.gameData } as Record<string, unknown>;

      const oldPlayers = gd["players"] as MutablePlayerData[];
      const oldColor = oldPlayers[playerIndex].color;
      if (oldColor === newColor) return;

      // Update players
      const newPlayers = oldPlayers.map((p, i) =>
        i === playerIndex ? { ...p, color: newColor } : p,
      );
      gd["players"] = newPlayers;

      // Update turnOrder
      const oldTurnOrder = (gd["turnOrder"] as PlayerColor[]) ?? [];
      gd["turnOrder"] = oldTurnOrder.map((c) =>
        c === oldColor ? newColor : c,
      );

      // Update grid tile owners
      const gridData = gd["grid"] as Array<
        [unknown, Record<string, unknown>]
      >;
      if (gridData) {
        gd["grid"] = gridData.map(([coord, space]) => {
          const tile = space["tile"] as
            | { owners?: (PlayerColor | undefined)[] }
            | undefined;
          if (tile?.owners) {
            return [
              coord,
              {
                ...space,
                tile: {
                  ...tile,
                  owners: tile.owners.map((o) =>
                    o === oldColor ? newColor : o,
                  ),
                },
              },
            ];
          }
          return [coord, space];
        });
      }

      // Update inter-city connection owners
      const conns = gd["interCityConnections"] as
        | Array<Record<string, unknown>>
        | undefined;
      if (conns) {
        gd["interCityConnections"] = conns.map((c) => {
          const owner = c["owner"] as
            | { color?: PlayerColor }
            | undefined;
          if (owner?.color === oldColor) {
            return { ...c, owner: { ...owner, color: newColor } };
          }
          return c;
        });
      }

      pushState(JSON.stringify({ ...state, gameData: gd }));
    },
    [localGameData, pushState],
  );

  // Urbanize: replace town with city, remove from available cities
  const onUrbanize = useCallback(
    (coordinates: Coordinates, cityIndex: number) => {
      const state = JSON.parse(localGameData) as SerializedGameData;
      const gd = { ...state.gameData } as Record<string, unknown>;

      const cities = [
        ...((gd["availableCities"] as MutableAvailableCity[]) ?? []),
      ];
      const city = cities[cityIndex];
      if (city == null) return;

      // Remove from available
      cities.splice(cityIndex, 1);
      gd["availableCities"] = cities;

      // Replace the land space with a city
      const gridData = gd["grid"] as Array<
        [unknown, Record<string, unknown>]
      >;
      gd["grid"] = gridData.map(([coordData, spaceData]) => {
        const c = coordData as { q: number; r: number };
        if (Coordinates.from(c).equals(coordinates)) {
          const townName = (spaceData["townName"] as string) ?? "Town";
          const townGoods =
            (spaceData["goods"] as unknown[]) ?? [];
          return [
            coordData,
            {
              type: SpaceType.CITY,
              name: townName,
              color: city.color,
              goods: [...city.goods, ...townGoods],
              urbanized: true,
              onRoll: city.onRoll,
              mapSpecific: spaceData["mapSpecific"],
            },
          ];
        }
        return [coordData, spaceData];
      });

      pushState(JSON.stringify({ ...state, gameData: gd }));
    },
    [localGameData, pushState],
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
          Click hexes and connections to edit. Choose an owner for placed items.
          Click <b>Save Changes</b> to persist, then <b>Start</b> the game when
          ready.
        </p>
      </Segment>
      <EditorPanel
        gameData={localGameData}
        players={players}
        turnOrder={turnOrder}
        roundNumber={roundNumber}
        availableCities={availableCities}
        canUndo={canUndo}
        canRedo={canRedo}
        onPlayerUpdate={onPlayerUpdate}
        onTurnOrderUpdate={onTurnOrderUpdate}
        onRoundUpdate={onRoundUpdate}
        onAvailableCitiesUpdate={onAvailableCitiesUpdate}
        onColorChange={onColorChange}
        onUndo={onUndo}
        onRedo={onRedo}
      />
      <EditorMap
        game={editedGame}
        availableCities={availableCities}
        onGameDataChange={pushState}
        onUrbanize={onUrbanize}
      />
    </EditorContextProvider>
  );
}
