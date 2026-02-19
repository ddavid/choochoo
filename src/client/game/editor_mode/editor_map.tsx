import { useCallback, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Label,
  Modal,
  ModalActions,
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
import { MutableAvailableCity } from "../../../engine/state/available_city";
import {
  PlayerColor,
  playerColorToString,
} from "../../../engine/state/player";
import { Coordinates } from "../../../utils/coordinates";
import { ClickTarget } from "../../grid/click_target";
import { HexGrid } from "../../grid/hex_grid";
import {
  GameContextProvider,
  useGameKey,
  useGrid,
  useViewSettings,
} from "../../utils/injection_context";
import { useEditorContext } from "./editor_context";
import { EditorTileDialog } from "./editor_tile_dialog";
import { CityData } from "../../../engine/state/space";

interface EditorMapProps {
  game: GameApi;
  availableCities: MutableAvailableCity[];
  onGameDataChange(newGameData: string): void;
  onUrbanize(coordinates: Coordinates, cityIndex: number): void;
}

export function EditorMap(props: EditorMapProps) {
  if (props.game.gameData == null) return null;

  return (
    <GameContextProvider game={props.game}>
      <InternalEditorMap {...props} />
    </GameContextProvider>
  );
}

function InternalEditorMap({
  game,
  availableCities,
  onGameDataChange,
  onUrbanize,
}: EditorMapProps) {
  const { selectedOwner } = useEditorContext();
  const grid = useGrid();
  const mapSettings = useViewSettings();
  const gameKey = useGameKey();

  // Tile dialog state
  const [tileDialogCoords, setTileDialogCoords] = useState<
    Coordinates | undefined
  >(undefined);
  const [tileDialogSpace, setTileDialogSpace] = useState<Space | undefined>(
    undefined,
  );

  // Good/city dialog state
  const [goodDialogCoords, setGoodDialogCoords] = useState<
    Coordinates | undefined
  >(undefined);
  const [goodDialogCity, setGoodDialogCity] = useState<CityData | undefined>(
    undefined,
  );

  // Town dialog state (for towns: offers tile or urbanize)
  const [townDialogCoords, setTownDialogCoords] = useState<
    Coordinates | undefined
  >(undefined);
  const [townDialogSpace, setTownDialogSpace] = useState<Space | undefined>(
    undefined,
  );

  // Existing-tile dialog state (replace or erase)
  const [tileActionCoords, setTileActionCoords] = useState<
    Coordinates | undefined
  >(undefined);
  const [tileActionSpace, setTileActionSpace] = useState<Space | undefined>(
    undefined,
  );

  // Connection dialog state
  const [connectionId, setConnectionId] = useState<string | undefined>(
    undefined,
  );

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

  // Context-sensitive click handler
  const onClick = useCallback(
    (space: Space, _good?: Good) => {
      if (space instanceof City) {
        setGoodDialogCoords(space.coordinates);
        setGoodDialogCity(space.data as CityData);
      } else if (space instanceof Land) {
        if (space.hasTile()) {
          setTileActionCoords(space.coordinates);
          setTileActionSpace(space);
        } else if (space.hasTown()) {
          setTownDialogCoords(space.coordinates);
          setTownDialogSpace(space);
        } else {
          setTileDialogCoords(space.coordinates);
          setTileDialogSpace(space);
        }
      }
    },
    [],
  );

  const onClickInterCity = useCallback((id: string) => {
    setConnectionId(id);
  }, []);

  const onTileSelect = useCallback(
    (tileType: TileType, orientation: Direction) => {
      const coords = tileDialogCoords;
      if (coords == null) return;
      const tile: TileData = {
        tileType,
        orientation,
        owners: calculateTrackInfo({
          tileType,
          orientation,
          owners: [],
        }).map(() => selectedOwner),
      };
      updateGridSpace(coords, (s) => ({ ...s, tile }));
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
          if (goodDialogCity) {
            setGoodDialogCity({ ...goodDialogCity, urbanized } as CityData);
          }
        }}
        onClose={() => {
          setGoodDialogCoords(undefined);
          setGoodDialogCity(undefined);
        }}
      />
      <TownDialog
        coordinates={townDialogCoords}
        space={townDialogSpace}
        availableCities={availableCities}
        onPlaceTile={() => {
          setTileDialogCoords(townDialogCoords);
          setTileDialogSpace(townDialogSpace);
          setTownDialogCoords(undefined);
          setTownDialogSpace(undefined);
        }}
        onUrbanize={(cityIndex) => {
          if (townDialogCoords == null) return;
          onUrbanize(townDialogCoords, cityIndex);
          setTownDialogCoords(undefined);
          setTownDialogSpace(undefined);
        }}
        onClose={() => {
          setTownDialogCoords(undefined);
          setTownDialogSpace(undefined);
        }}
      />
      <TileActionDialog
        coordinates={tileActionCoords}
        onReplace={() => {
          setTileDialogCoords(tileActionCoords);
          setTileDialogSpace(tileActionSpace);
          setTileActionCoords(undefined);
          setTileActionSpace(undefined);
        }}
        onErase={() => {
          if (tileActionCoords != null) {
            updateGridSpace(tileActionCoords, (s) => ({
              ...s,
              tile: undefined,
            }));
          }
          setTileActionCoords(undefined);
          setTileActionSpace(undefined);
        }}
        onClose={() => {
          setTileActionCoords(undefined);
          setTileActionSpace(undefined);
        }}
      />
      <ConnectionDialog
        connectionId={connectionId}
        currentOwner={selectedOwner}
        onSetOwner={(owner) => {
          if (connectionId == null) return;
          const id = connectionId;
          updateConnections((conns) =>
            conns.map((c) =>
              c["id"] === id
                ? { ...c, owner: owner != null ? { color: owner } : undefined }
                : c,
            ),
          );
          setConnectionId(undefined);
        }}
        onClose={() => setConnectionId(undefined)}
      />
    </>
  );
}

// --- Dialogs ---

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
      <ModalHeader>Edit {cityData?.name ?? "city"}</ModalHeader>
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

interface TownDialogProps {
  coordinates: Coordinates | undefined;
  space: Space | undefined;
  availableCities: MutableAvailableCity[];
  onPlaceTile(): void;
  onUrbanize(cityIndex: number): void;
  onClose(): void;
}

function TownDialog({
  coordinates,
  space,
  availableCities,
  onPlaceTile,
  onUrbanize,
  onClose,
}: TownDialogProps) {
  const isOpen = coordinates != null && space != null;
  const townName = space instanceof Land ? space.name() : undefined;

  const cityColorLabel = (color: MutableAvailableCity["color"]): string => {
    if (Array.isArray(color)) {
      return color.map(goodToString).join("/");
    }
    return goodToString(color);
  };

  return (
    <Modal closeIcon open={isOpen} onClose={onClose} size="small">
      <ModalHeader>{townName ?? "Town"}</ModalHeader>
      <ModalContent>
        <div style={{ marginBottom: "16px" }}>
          <Button primary onClick={onPlaceTile}>
            Place tile
          </Button>
        </div>
        {availableCities.length > 0 && (
          <div>
            <Label>Urbanize with available city:</Label>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                marginTop: "8px",
              }}
            >
              {availableCities.map((city, index) => (
                <Button
                  key={index}
                  size="small"
                  onClick={() => onUrbanize(index)}
                >
                  {cityColorLabel(city.color)} ({city.goods.length} goods)
                </Button>
              ))}
            </div>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}

interface TileActionDialogProps {
  coordinates: Coordinates | undefined;
  onReplace(): void;
  onErase(): void;
  onClose(): void;
}

function TileActionDialog({
  coordinates,
  onReplace,
  onErase,
  onClose,
}: TileActionDialogProps) {
  return (
    <Modal closeIcon open={coordinates != null} onClose={onClose} size="mini">
      <ModalHeader>Tile</ModalHeader>
      <ModalActions>
        <Button onClick={onReplace}>Replace</Button>
        <Button negative onClick={onErase}>
          Erase
        </Button>
      </ModalActions>
    </Modal>
  );
}

interface ConnectionDialogProps {
  connectionId: string | undefined;
  currentOwner: PlayerColor | undefined;
  onSetOwner(owner: PlayerColor | undefined): void;
  onClose(): void;
}

function ConnectionDialog({
  connectionId,
  currentOwner,
  onSetOwner,
  onClose,
}: ConnectionDialogProps) {
  return (
    <Modal
      closeIcon
      open={connectionId != null}
      onClose={onClose}
      size="mini"
    >
      <ModalHeader>Connection</ModalHeader>
      <ModalContent>
        <p>
          Set owner to current selection (
          {currentOwner != null
            ? playerColorToString(currentOwner)
            : "unowned"}
          )?
        </p>
      </ModalContent>
      <ModalActions>
        <Button primary onClick={() => onSetOwner(currentOwner)}>
          Set owner
        </Button>
        <Button onClick={() => onSetOwner(undefined)}>Clear owner</Button>
      </ModalActions>
    </Modal>
  );
}
