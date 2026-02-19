import { useMemo, useReducer } from "react";
import {
  Button,
  Dropdown,
  Label,
  Modal,
  ModalContent,
  ModalHeader,
} from "semantic-ui-react";
import { rotateDirectionClockwise } from "../../../engine/map/direction";
import { Space } from "../../../engine/map/grid";
import { calculateTrackInfo, trackEquals } from "../../../engine/map/location";
import { isTownTile } from "../../../engine/map/tile";
import { SpaceType } from "../../../engine/state/location_type";
import {
  allTileTypes,
  Direction,
  TileData,
  TileType,
} from "../../../engine/state/tile";
import { PlayerColor } from "../../../engine/state/player";
import { MapViewSettings } from "../../../maps/view_settings";
import { Coordinates } from "../../../utils/coordinates";
import { ModifiedSpace } from "../../grid/building_dialog";

interface OwnerOption {
  key: string | number;
  text: string;
  value: number;
}

interface EditorTileDialogProps {
  coordinates: Coordinates | undefined;
  space: Space | undefined;
  settings: MapViewSettings;
  owner: PlayerColor | undefined;
  ownerOptions: OwnerOption[];
  onOwnerChange(value: number): void;
  onSelect(tileType: TileType, orientation: Direction): void;
  onCancel(): void;
}

interface TileOption {
  tileType: TileType;
  orientation: Direction;
  tile: TileData;
}

export function EditorTileDialog({
  coordinates,
  space,
  settings,
  owner,
  ownerOptions,
  onOwnerChange,
  onSelect,
  onCancel,
}: EditorTileDialogProps) {
  const [direction, rotate] = useReducer(
    (prev: Direction, _: object) => rotateDirectionClockwise(prev),
    Direction.TOP,
  );

  const options = useMemo(() => {
    if (coordinates == null || space == null) return [];
    const isLand = space.data.type !== SpaceType.CITY;
    if (!isLand) return [];

    const hasTown = "townName" in space.data && space.data.townName != null;
    const results: TileOption[] = [];
    for (const tileType of allTileTypes) {
      const isTown = isTownTile(tileType);
      if (hasTown !== isTown) continue;
      for (const orientation of [direction]) {
        const tile: TileData = {
          tileType,
          orientation,
          owners: calculateTrackInfo({ tileType, orientation, owners: [] }).map(
            () => owner,
          ),
        };
        results.push({ tileType, orientation, tile });
      }
    }

    // Filter duplicates by track layout
    return results.filter((opt1, index) => {
      const info1 = calculateTrackInfo(opt1.tile);
      return !results.slice(index + 1).some((opt2) => {
        const info2 = calculateTrackInfo(opt2.tile);
        return (
          info1.length === info2.length &&
          info1.every((t1) => info2.some((t2) => trackEquals(t1, t2)))
        );
      });
    });
  }, [coordinates, space, direction, owner]);

  const isOpen = coordinates != null && space != null && options.length > 0;

  return (
    <Modal closeIcon open={isOpen} onClose={onCancel}>
      <ModalHeader>Select a tile to place</ModalHeader>
      <ModalContent>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          <Label>Owner:</Label>
          <Dropdown
            selection
            compact
            options={ownerOptions}
            value={owner ?? -1}
            onChange={(_, data) => onOwnerChange(data.value as number)}
          />
          <Button primary onClick={rotate}>
            Rotate
          </Button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
          {options.map((opt, index) => (
            <div
              key={index}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(opt.tileType, opt.orientation)}
            >
              {space && (
                <ModifiedSpace
                  space={space}
                  tile={opt.tile}
                  settings={settings}
                />
              )}
            </div>
          ))}
        </div>
      </ModalContent>
    </Modal>
  );
}
