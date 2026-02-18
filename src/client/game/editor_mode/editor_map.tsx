import { useCallback, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Label,
  Modal,
  ModalContent,
  ModalHeader,
} from "semantic-ui-react";
import { GameApi } from "../../../api/game";
import { Space } from "../../../engine/map/grid";
import { City } from "../../../engine/map/city";
import { Land, calculateTrackInfo } from "../../../engine/map/location";
import { Good, goodToString } from "../../../engine/state/good";
import { Direction, TileData, TileType } from "../../../engine/state/tile";
import { SerializedGameData } from "../../../engine/framework/state";
import { Coordinates } from "../../../utils/coordinates";
import { ClickTarget } from "../../grid/click_target";
import { HexGrid } from "../../grid/hex_grid";
import {
  GameContextProvider,
  useGameKey,
  useGrid,
  useViewSettings,
} from "../../utils/injection_context";
import { EditorTool, useEditorContext } from "./editor_context";
import { EditorTileDialog } from "./editor_tile_dialog";
import { CityData } from "../../../engine/state/space";

interface EditorMapProps {
  game: GameApi;
  onGameDataChange(newGameData: string): void;
}

export function EditorMap({ game, onGameDataChange }: EditorMapProps) {
  if (game.gameData == null) return null;

  return (
    <GameContextProvider game={game}>
      <InternalEditorMap game={game} onGameDataChange={onGameDataChange} />
    </GameContextProvider>
  );
}

function InternalEditorMap({ game, onGameDataChange }: EditorMapProps) {
  const { currentTool, selectedOwner } = useEditorContext();
  const grid = useGrid();
  const mapSettings = useViewSettings();
  const gameKey = useGameKey();

  // Tile dialog state
  const [tileDialogCoords, setTileDialogCoords] = useState<Coordinates | undefined>(undefined);
  const [tileDialogSpace, setTileDialogSpace] = useState<Space | undefined>(undefined);

  // Good dialog state
  const [goodDialogCoords, setGoodDialogCoords] = useState<Coordinates | undefined>(undefined);
  const [goodDialogCity, setGoodDialogCity] = useState<CityData | undefined>(undefined);

  // Helper to parse, modify, and re-serialize game data
  const updateState = useCallback(
    (updater: (state: SerializedGameData) => SerializedGameData) => {
      if (game.gameData == null) return;
      const parsed = JSON.parse(game.gameData) as SerializedGameData;
      const updated = updater(parsed);
      onGameDataChange(JSON.stringify(updated));
    },
    [game.gameData, onGameDataChange],
  );

  const updateGridSpace = useCallback(
    (
      coords: Coordinates,
      updater: (space: Record<string, unknown>) => Record<string, unknown>,
    ) => {
      updateState((state) => {
        const gridData = state.gameData["grid"] as Array<
          [unknown, Record<string, unknown>]
        >;
        const newGridData = gridData.map(([coordData, spaceData]) => {
          const c = coordData as { q: number; r: number };
          if (Coordinates.from(c).equals(coords)) {
            return [coordData, updater({ ...spaceData })];
          }
          return [coordData, spaceData];
        });
        return {
          ...state,
          gameData: { ...state.gameData, grid: newGridData },
        };
      });
    },
    [updateState],
  );

  const updateConnections = useCallback(
    (
      updater: (
        conns: Array<Record<string, unknown>>,
      ) => Array<Record<string, unknown>>,
    ) => {
      updateState((state) => {
        const conns = (state.gameData["interCityConnections"] ??
          []) as Array<Record<string, unknown>>;
        return {
          ...state,
          gameData: {
            ...state.gameData,
            interCityConnections: updater([...conns]),
          },
        };
      });
    },
    [updateState],
  );

  const onClick = useCallback(
    (space: Space, good?: Good) => {
      switch (currentTool) {
        case EditorTool.TILE:
          if (space instanceof Land) {
            setTileDialogCoords(space.coordinates);
            setTileDialogSpace(space);
          }
          break;
        case EditorTool.GOOD:
          if (space instanceof City) {
            setGoodDialogCoords(space.coordinates);
            setGoodDialogCity(space.data as CityData);
          }
          break;
        case EditorTool.ERASER:
          if (space instanceof Land && space.data.tile != null) {
            updateGridSpace(space.coordinates, (s) => ({
              ...s,
              tile: undefined,
            }));
          } else if (space instanceof City && good != null) {
            updateGridSpace(space.coordinates, (s) => {
              const goods = (s["goods"] as Good[]) ?? [];
              const idx = goods.indexOf(good);
              if (idx >= 0) {
                const newGoods = [...goods];
                newGoods.splice(idx, 1);
                return { ...s, goods: newGoods };
              }
              return s;
            });
          }
          break;
        case EditorTool.CONNECTION:
          break;
      }
    },
    [currentTool, updateGridSpace],
  );

  const onClickInterCity = useCallback(
    (id: string) => {
      if (currentTool === EditorTool.CONNECTION) {
        updateConnections((conns) =>
          conns.map((c) =>
            c["id"] === id ? { ...c, owner: { color: selectedOwner } } : c,
          ),
        );
      } else if (currentTool === EditorTool.ERASER) {
        updateConnections((conns) =>
          conns.map((c) =>
            c["id"] === id ? { ...c, owner: undefined } : c,
          ),
        );
      }
    },
    [currentTool, selectedOwner, updateConnections],
  );

  const onTileSelect = useCallback(
    (tileType: TileType, orientation: Direction) => {
      if (tileDialogCoords == null) return;
      const tile: TileData = {
        tileType,
        orientation,
        owners: calculateTrackInfo({
          tileType,
          orientation,
          owners: [],
        }).map(() => selectedOwner),
      };
      updateGridSpace(tileDialogCoords, (s) => ({ ...s, tile }));
      setTileDialogCoords(undefined);
      setTileDialogSpace(undefined);
    },
    [tileDialogCoords, selectedOwner, updateGridSpace],
  );

  const clickTargets = useMemo(
    () =>
      new Set([
        ClickTarget.LAND,
        ClickTarget.TOWN,
        ClickTarget.CITY,
        ClickTarget.GOOD,
        ClickTarget.INTER_CITY_CONNECTION,
      ]),
    [],
  );

  return (
    <>
      <HexGrid
        id="editor-map"
        onClick={onClick}
        onClickInterCity={onClickInterCity}
        fullMapVersion={true}
        rotation={mapSettings.rotation}
        grid={grid}
        gameKey={gameKey}
        clickTargets={clickTargets}
      />
      <EditorTileDialog
        coordinates={tileDialogCoords}
        space={tileDialogSpace}
        settings={mapSettings}
        owner={selectedOwner}
        onSelect={onTileSelect}
        onCancel={() => {
          setTileDialogCoords(undefined);
          setTileDialogSpace(undefined);
        }}
      />
      <EditorGoodDialog
        coordinates={goodDialogCoords}
        cityData={goodDialogCity}
        onAdd={(good) => {
          if (goodDialogCoords == null) return;
          updateGridSpace(goodDialogCoords, (s) => {
            const goods = (s["goods"] as Good[]) ?? [];
            return { ...s, goods: [...goods, good] };
          });
        }}
        onRemove={(good) => {
          if (goodDialogCoords == null) return;
          updateGridSpace(goodDialogCoords, (s) => {
            const goods = (s["goods"] as Good[]) ?? [];
            const idx = goods.lastIndexOf(good);
            if (idx >= 0) {
              const newGoods = [...goods];
              newGoods.splice(idx, 1);
              return { ...s, goods: newGoods };
            }
            return s;
          });
        }}
        onToggleUrbanized={(urbanized) => {
          if (goodDialogCoords == null) return;
          updateGridSpace(goodDialogCoords, (s) => ({
            ...s,
            urbanized: urbanized || undefined,
          }));
          // Update local dialog state too
          if (goodDialogCity) {
            setGoodDialogCity({ ...goodDialogCity, urbanized } as CityData);
          }
        }}
        onClose={() => {
          setGoodDialogCoords(undefined);
          setGoodDialogCity(undefined);
        }}
      />
    </>
  );
}

interface EditorGoodDialogProps {
  coordinates: Coordinates | undefined;
  cityData: CityData | undefined;
  onAdd(good: Good): void;
  onRemove(good: Good): void;
  onToggleUrbanized(urbanized: boolean): void;
  onClose(): void;
}

function EditorGoodDialog({
  coordinates,
  cityData,
  onAdd,
  onRemove,
  onToggleUrbanized,
  onClose,
}: EditorGoodDialogProps) {
  const allGoods = [
    Good.RED,
    Good.BLUE,
    Good.PURPLE,
    Good.YELLOW,
    Good.BLACK,
    Good.WHITE,
  ];

  const isOpen = coordinates != null && cityData != null;

  return (
    <Modal closeIcon open={isOpen} onClose={onClose} size="small">
      <ModalHeader>Edit goods on {cityData?.name ?? "city"}</ModalHeader>
      <ModalContent>
        <div style={{ marginBottom: "12px" }}>
          <Checkbox
            label="Urbanized"
            checked={cityData?.urbanized ?? false}
            onChange={(_, data) => onToggleUrbanized(!!data.checked)}
          />
        </div>
        <div>
          <Label>Current goods:</Label>
          <div style={{ margin: "8px 0" }}>
            {cityData?.goods.map((good, idx) => (
              <Label
                key={idx}
                size="small"
                style={{ cursor: "pointer" }}
                onClick={() => onRemove(good)}
              >
                {goodToString(good)} x
              </Label>
            ))}
            {(cityData?.goods.length ?? 0) === 0 && <span>None</span>}
          </div>
        </div>
        <div style={{ marginTop: "12px" }}>
          <Label>Add good:</Label>
          <div
            style={{
              display: "flex",
              gap: "4px",
              marginTop: "4px",
              flexWrap: "wrap",
            }}
          >
            {allGoods.map((good) => (
              <Button key={good} size="small" onClick={() => onAdd(good)}>
                {goodToString(good)}
              </Button>
            ))}
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
