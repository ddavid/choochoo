import { useCallback, useMemo, useRef, useState } from "react";
import { Button, Header, Segment } from "semantic-ui-react";
import { GameApi } from "../../../api/game";
import { useSetEditorData } from "../../services/game";
import { SerializedGameData } from "../../../engine/framework/state";
import { MutableAvailableCity } from "../../../engine/state/available_city";
import { SpaceType } from "../../../engine/state/location_type";
import { MutablePlayerData, PlayerColor } from "../../../engine/state/player";
import { LandData } from "../../../engine/state/space";
import { Coordinates } from "../../../utils/coordinates";
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

  // De-urbanize: revert an urbanized city back to a town, return city to available
  const onDeUrbanize = useCallback(
    (coordinates: Coordinates) => {
      const state = JSON.parse(localGameData) as SerializedGameData;
      const gd = { ...state.gameData } as Record<string, unknown>;

      const gridData = gd["grid"] as Array<
        [unknown, Record<string, unknown>]
      >;
      const cities = [
        ...((gd["availableCities"] as MutableAvailableCity[]) ?? []),
      ];

      gd["grid"] = gridData.map(([coordData, spaceData]) => {
        const c = coordData as { q: number; r: number };
        if (Coordinates.from(c).equals(coordinates)) {
          const cityData = spaceData as Record<string, unknown>;
          // Return the city back to available cities
          cities.push({
            color: cityData["color"] as MutableAvailableCity["color"],
            onRoll: cityData["onRoll"] as MutableAvailableCity["onRoll"],
            goods: [], // Goods stay on the town
          });
          // Revert to a town (plain with townName)
          const townData: LandData = {
            type: SpaceType.PLAIN,
            townName: (cityData["name"] as string) ?? undefined,
            goods: cityData["goods"] as LandData["goods"],
          };
          if (cityData["mapSpecific"] != null) {
            (townData as Record<string, unknown>)["mapSpecific"] =
              cityData["mapSpecific"];
          }
          return [coordData, townData];
        }
        return [coordData, spaceData];
      });
      gd["availableCities"] = cities;

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
    <>
      <Header as="h2">Editor Mode</Header>
      <Segment>
        <p>
          Click hexes and connections to edit.
          Click <b>Save Changes</b> to persist, then <b>Start</b> the game when
          ready.
        </p>
      </Segment>
      <EditorPanel
        gameKey={game.gameKey}
        players={players}
        turnOrder={turnOrder}
        roundNumber={roundNumber}
        availableCities={availableCities}
        onPlayerUpdate={onPlayerUpdate}
        onTurnOrderUpdate={onTurnOrderUpdate}
        onRoundUpdate={onRoundUpdate}
        onAvailableCitiesUpdate={onAvailableCitiesUpdate}
        onColorChange={onColorChange}
      />
      <EditorToolbar
        gameData={localGameData}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
      />
      <EditorMap
        game={editedGame}
        players={players}
        availableCities={availableCities}
        onGameDataChange={pushState}
        onUrbanize={onUrbanize}
        onDeUrbanize={onDeUrbanize}
      />
    </>
  );
}

interface EditorToolbarProps {
  gameData: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
}

function EditorToolbar({
  gameData,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: EditorToolbarProps) {
  const { setEditorData, isPending } = useSetEditorData();

  const save = useCallback(() => {
    setEditorData(gameData);
  }, [gameData, setEditorData]);

  return (
    <Segment>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          <Button
            icon="undo"
            size="small"
            compact
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo"
          />
          <Button
            icon="redo"
            size="small"
            compact
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo"
          />
        </div>
        <Button
          primary
          onClick={save}
          disabled={isPending}
          loading={isPending}
        >
          Save Changes
        </Button>
      </div>
    </Segment>
  );
}
