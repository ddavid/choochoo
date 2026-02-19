import { useCallback } from "react";
import {
  Button,
  Dropdown,
  Header,
  Input,
  Label,
  Segment,
} from "semantic-ui-react";
import { MutableAvailableCity } from "../../../engine/state/available_city";
import { Good, goodToString } from "../../../engine/state/good";
import {
  MutablePlayerData,
  PlayerColor,
  eligiblePlayerColors,
  playerColorToString,
} from "../../../engine/state/player";
import { Username } from "../../components/username";
import { useSetEditorData } from "../../services/game";
import { useEditorContext } from "./editor_context";
import { PlayerColorIndicator } from "../player_stats";
import * as styles from "./editor_panel.module.css";

interface EditorPanelProps {
  gameData: string;
  players: MutablePlayerData[];
  turnOrder: PlayerColor[];
  roundNumber: number;
  availableCities: MutableAvailableCity[];
  canUndo: boolean;
  canRedo: boolean;
  onPlayerUpdate(players: MutablePlayerData[]): void;
  onTurnOrderUpdate(turnOrder: PlayerColor[]): void;
  onRoundUpdate(round: number): void;
  onAvailableCitiesUpdate(cities: MutableAvailableCity[]): void;
  onColorChange(playerIndex: number, newColor: PlayerColor): void;
  onUndo(): void;
  onRedo(): void;
}

export function EditorPanel({
  gameData,
  players,
  turnOrder,
  roundNumber,
  availableCities,
  canUndo,
  canRedo,
  onPlayerUpdate,
  onTurnOrderUpdate,
  onRoundUpdate,
  onAvailableCitiesUpdate,
  onColorChange,
  onUndo,
  onRedo,
}: EditorPanelProps) {
  const { selectedOwner, setOwner } = useEditorContext();
  const { setEditorData, isPending } = useSetEditorData();

  const ownerOptions = [
    { key: "none", text: "Unowned", value: -1 },
    ...players.map((p) => ({
      key: p.color,
      text: playerColorToString(p.color),
      value: p.color,
    })),
  ];

  const save = useCallback(() => {
    setEditorData(gameData);
  }, [gameData, setEditorData]);

  return (
    <div className={styles.editorPanel}>
      <Segment>
        <div className={styles.topActions}>
          <div className={styles.ownerSelector}>
            <Label>Owner:</Label>
            <Dropdown
              selection
              compact
              options={ownerOptions}
              value={selectedOwner ?? -1}
              onChange={(_, data) => {
                const val = data.value as number;
                setOwner(val === -1 ? undefined : (val as PlayerColor));
              }}
            />
          </div>
          <div className={styles.undoRedo}>
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
        </div>
      </Segment>

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
          cities={availableCities}
          onUpdate={onAvailableCitiesUpdate}
        />
      </Segment>

      <Button
        primary
        fluid
        onClick={save}
        disabled={isPending}
        loading={isPending}
      >
        Save Changes
      </Button>
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
  cities: MutableAvailableCity[];
  onUpdate(cities: MutableAvailableCity[]): void;
}

function AvailableCitiesEditor({
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

  const cityColorLabel = (color: MutableAvailableCity["color"]): string => {
    if (Array.isArray(color)) {
      return color.map(goodToString).join("/");
    }
    return goodToString(color);
  };

  return (
    <div>
      {cities.map((city, index) => (
        <div key={index} className={styles.availableCity}>
          <div className={styles.availableCityHeader}>
            <Label size="small">{cityColorLabel(city.color)}</Label>
            <span className={styles.availableCityGoods}>
              {city.goods.length === 0 && <span>No goods</span>}
              {city.goods.map((good, gi) => (
                <Label
                  key={gi}
                  size="mini"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    const newCities = [...cities];
                    const newGoods = [...city.goods];
                    newGoods.splice(gi, 1);
                    newCities[index] = { ...city, goods: newGoods };
                    onUpdate(newCities);
                  }}
                >
                  {goodToString(good)} x
                </Label>
              ))}
            </span>
            <Dropdown
              icon="plus"
              className="icon mini"
              button
              compact
              options={goodOptions}
              onChange={(_, data) => {
                const newCities = [...cities];
                newCities[index] = {
                  ...city,
                  goods: [...city.goods, data.value as Good],
                };
                onUpdate(newCities);
              }}
              selectOnBlur={false}
              value={undefined}
            />
          </div>
        </div>
      ))}
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
        <Dropdown
          inline
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
