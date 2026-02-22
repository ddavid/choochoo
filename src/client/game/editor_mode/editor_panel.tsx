import { useCallback, useMemo, useState } from "react";
import {
  Button,
  Dropdown,
  Header,
  Input,
  Label,
  Segment,
} from "semantic-ui-react";
import { City } from "../../../engine/map/city";
import { Grid } from "../../../engine/map/grid";
import { MutableAvailableCity } from "../../../engine/state/available_city";
import { Good, goodToString } from "../../../engine/state/good";
import { SpaceType } from "../../../engine/state/location_type";
import {
  MutablePlayerData,
  PlayerColor,
  eligiblePlayerColors,
  playerColorToString,
} from "../../../engine/state/player";
import { GameKey } from "../../../api/game_key";
import { MapRegistry } from "../../../maps/registry";
import { Coordinates } from "../../../utils/coordinates";
import { Username } from "../../components/username";
import { HexGrid } from "../../grid/hex_grid";
import { PlayerColorIndicator } from "../player_stats";
import * as styles from "./editor_panel.module.css";

interface EditorPanelProps {
  gameKey: GameKey;
  players: MutablePlayerData[];
  turnOrder: PlayerColor[];
  roundNumber: number;
  availableCities: MutableAvailableCity[];
  onPlayerUpdate(players: MutablePlayerData[]): void;
  onTurnOrderUpdate(turnOrder: PlayerColor[]): void;
  onRoundUpdate(round: number): void;
  onAvailableCitiesUpdate(cities: MutableAvailableCity[]): void;
  onColorChange(playerIndex: number, newColor: PlayerColor): void;
}

export function EditorPanel({
  gameKey,
  players,
  turnOrder,
  roundNumber,
  availableCities,
  onPlayerUpdate,
  onTurnOrderUpdate,
  onRoundUpdate,
  onAvailableCitiesUpdate,
  onColorChange,
}: EditorPanelProps) {
  return (
    <div className={styles.editorPanel}>
      <Segment>
        <Header as="h3">Game Settings</Header>
        <NumberField
          label="Round"
          value={roundNumber}
          onChange={onRoundUpdate}
          min={1}
        />
      </Segment>

      <Segment>
        <Header as="h3">Turn Order</Header>
        <TurnOrderEditor
          turnOrder={turnOrder}
          players={players}
          onTurnOrderUpdate={onTurnOrderUpdate}
        />
      </Segment>

      <Segment>
        <Header as="h3">Players</Header>
        {players.map((player, index) => (
          <PlayerEditor
            key={player.color}
            player={player}
            usedColors={players.map((p) => p.color)}
            onChange={(updated) => {
              const newPlayers = [...players];
              newPlayers[index] = updated;
              onPlayerUpdate(newPlayers);
            }}
            onColorChange={(newColor) => onColorChange(index, newColor)}
          />
        ))}
      </Segment>

      <Segment>
        <Header as="h3">
          Available Cities ({availableCities.length})
        </Header>
        <AvailableCitiesEditor
          gameKey={gameKey}
          cities={availableCities}
          onUpdate={onAvailableCitiesUpdate}
        />
      </Segment>
    </div>
  );
}

interface TurnOrderEditorProps {
  turnOrder: PlayerColor[];
  players: MutablePlayerData[];
  onTurnOrderUpdate(turnOrder: PlayerColor[]): void;
}

function TurnOrderEditor({
  turnOrder,
  players,
  onTurnOrderUpdate,
}: TurnOrderEditorProps) {
  const playerByColor = new Map(players.map((p) => [p.color, p]));

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const newOrder = [...turnOrder];
    [newOrder[index - 1], newOrder[index]] = [
      newOrder[index],
      newOrder[index - 1],
    ];
    onTurnOrderUpdate(newOrder);
  };

  const moveDown = (index: number) => {
    if (index >= turnOrder.length - 1) return;
    const newOrder = [...turnOrder];
    [newOrder[index], newOrder[index + 1]] = [
      newOrder[index + 1],
      newOrder[index],
    ];
    onTurnOrderUpdate(newOrder);
  };

  return (
    <div>
      {turnOrder.map((color, index) => {
        const player = playerByColor.get(color);
        return (
          <div key={color} className={styles.turnOrderRow}>
            <span className={styles.turnOrderIndex}>{index + 1}.</span>
            <PlayerColorIndicator playerColor={color} currentTurn={false} />
            {player && <Username userId={player.playerId} />}
            <span className={styles.turnOrderButtons}>
              <Button
                icon="arrow up"
                size="mini"
                compact
                disabled={index === 0}
                onClick={() => moveUp(index)}
              />
              <Button
                icon="arrow down"
                size="mini"
                compact
                disabled={index === turnOrder.length - 1}
                onClick={() => moveDown(index)}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface AvailableCitiesEditorProps {
  gameKey: GameKey;
  cities: MutableAvailableCity[];
  onUpdate(cities: MutableAvailableCity[]): void;
}

function AvailableCitiesEditor({
  gameKey,
  cities,
  onUpdate,
}: AvailableCitiesEditorProps) {
  const allGoods = [
    Good.RED,
    Good.BLUE,
    Good.PURPLE,
    Good.YELLOW,
    Good.BLACK,
    Good.WHITE,
  ];

  const goodOptions = allGoods.map((g) => ({
    key: g,
    text: goodToString(g),
    value: g,
  }));

  return (
    <div className={styles.availableCityList}>
      {cities.map((city, index) => (
        <AvailableCityHex
          key={index}
          gameKey={gameKey}
          city={city}
          goodOptions={goodOptions}
          onRemoveGood={(gi) => {
            const newCities = [...cities];
            const newGoods = [...city.goods];
            newGoods.splice(gi, 1);
            newCities[index] = { ...city, goods: newGoods };
            onUpdate(newCities);
          }}
          onAddGood={(good) => {
            const newCities = [...cities];
            newCities[index] = {
              ...city,
              goods: [...city.goods, good],
            };
            onUpdate(newCities);
          }}
        />
      ))}
    </div>
  );
}

interface AvailableCityHexProps {
  gameKey: GameKey;
  city: MutableAvailableCity;
  goodOptions: Array<{ key: Good; text: string; value: Good }>;
  onRemoveGood(goodIndex: number): void;
  onAddGood(good: Good): void;
}

function AvailableCityHex({
  gameKey,
  city,
  goodOptions,
  onRemoveGood,
  onAddGood,
}: AvailableCityHexProps) {
  const mapSettings = MapRegistry.singleton.get(gameKey);
  const [removing, setRemoving] = useState(false);

  const cityGrid = useMemo(() => {
    const newCity = new City(Coordinates.from({ q: 0, r: 0 }), {
      type: SpaceType.CITY,
      name: "",
      color: city.color,
      goods: city.goods,
      urbanized: true,
      onRoll: city.onRoll,
    });
    return Grid.fromSpaces(mapSettings, [newCity], []);
  }, [city, mapSettings]);

  return (
    <div className={styles.availableCityItem}>
      <HexGrid grid={cityGrid} />
      <div className={styles.availableCityActions}>
        <Button
          icon="minus"
          size="mini"
          compact
          color={removing ? "red" : undefined}
          onClick={() => setRemoving(!removing)}
          disabled={city.goods.length === 0}
        />
        <Dropdown
          trigger={<Button icon="plus" size="mini" compact />}
          options={goodOptions}
          onChange={(_, data) => onAddGood(data.value as Good)}
          selectOnBlur={false}
          icon={null}
          pointing="top left"
        />
      </div>
      {removing && city.goods.length > 0 && (
        <div className={styles.removableGoods}>
          {city.goods.map((good, gi) => (
            <Label
              key={gi}
              size="mini"
              color="red"
              basic
              style={{ cursor: "pointer" }}
              onClick={() => {
                onRemoveGood(gi);
                if (city.goods.length <= 1) setRemoving(false);
              }}
            >
              {goodToString(good)}
            </Label>
          ))}
        </div>
      )}
    </div>
  );
}

interface PlayerEditorProps {
  player: MutablePlayerData;
  usedColors: PlayerColor[];
  onChange(player: MutablePlayerData): void;
  onColorChange(newColor: PlayerColor): void;
}

function PlayerEditor({ player, usedColors, onChange, onColorChange }: PlayerEditorProps) {
  const update = (field: keyof MutablePlayerData, value: number) => {
    onChange({ ...player, [field]: value });
  };

  const colorOptions = eligiblePlayerColors
    .filter((c) => c === player.color || !usedColors.includes(c))
    .map((c) => ({
      key: c,
      text: playerColorToString(c),
      value: c,
    }));

  return (
    <div className={styles.playerEditor}>
      <div className={styles.playerHeader}>
        <PlayerColorIndicator playerColor={player.color} currentTurn={false} />
        <Dropdown
          selection
          compact
          options={colorOptions}
          value={player.color}
          onChange={(_, data) => onColorChange(data.value as PlayerColor)}
        />
        <Username userId={player.playerId} />
      </div>
      <div className={styles.playerFields}>
        <NumberField
          label="Money"
          value={player.money}
          onChange={(v) => update("money", v)}
        />
        <NumberField
          label="Income"
          value={player.income}
          onChange={(v) => update("income", v)}
        />
        <NumberField
          label="Shares"
          value={player.shares}
          onChange={(v) => update("shares", v)}
        />
        <NumberField
          label="Loco"
          value={player.locomotive}
          onChange={(v) => update("locomotive", v)}
          min={1}
        />
      </div>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange(value: number): void;
  min?: number;
}

function NumberField({ label, value, onChange, min }: NumberFieldProps) {
  return (
    <Input
      label={label}
      type="number"
      size="mini"
      value={value}
      min={min ?? 0}
      onChange={(_, data) => onChange(parseInt(data.value) || 0)}
      className={styles.numberField}
    />
  );
}
