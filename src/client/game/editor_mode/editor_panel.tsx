import { useCallback, useState } from "react";
import {
  Button,
  Dropdown,
  Header,
  Icon,
  Input,
  Label,
  Segment,
} from "semantic-ui-react";
import { Good, goodToString } from "../../../engine/state/good";
import {
  MutablePlayerData,
  PlayerColor,
  playerColorToString,
} from "../../../engine/state/player";
import { SerializedGameData } from "../../../engine/framework/state";
import { Username } from "../../components/username";
import { useSetEditorData } from "../../services/game";
import { EditorTool, useEditorContext } from "./editor_context";
import { PlayerColorIndicator } from "../player_stats";
import * as styles from "./editor_panel.module.css";

interface EditorPanelProps {
  gameData: string;
  players: MutablePlayerData[];
  bag: Good[];
  onPlayerUpdate(players: MutablePlayerData[]): void;
  onBagUpdate(bag: Good[]): void;
}

export function EditorPanel({
  gameData,
  players,
  bag,
  onPlayerUpdate,
  onBagUpdate,
}: EditorPanelProps) {
  const { currentTool, setTool, selectedOwner, setOwner } = useEditorContext();
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
        <Header as="h3">Editor Tools</Header>
        <Button.Group fluid>
          <Button
            active={currentTool === EditorTool.TILE}
            onClick={() => setTool(EditorTool.TILE)}
            icon
            labelPosition="left"
          >
            <Icon name="road" />
            Tile
          </Button>
          <Button
            active={currentTool === EditorTool.GOOD}
            onClick={() => setTool(EditorTool.GOOD)}
            icon
            labelPosition="left"
          >
            <Icon name="cube" />
            Good
          </Button>
          <Button
            active={currentTool === EditorTool.CONNECTION}
            onClick={() => setTool(EditorTool.CONNECTION)}
            icon
            labelPosition="left"
          >
            <Icon name="linkify" />
            Link
          </Button>
          <Button
            active={currentTool === EditorTool.ERASER}
            onClick={() => setTool(EditorTool.ERASER)}
            icon
            labelPosition="left"
          >
            <Icon name="eraser" />
            Erase
          </Button>
        </Button.Group>

        <div className={styles.ownerSelector}>
          <Label>Owner:</Label>
          <Dropdown
            selection
            options={ownerOptions}
            value={selectedOwner ?? -1}
            onChange={(_, data) => {
              const val = data.value as number;
              setOwner(val === -1 ? undefined : (val as PlayerColor));
            }}
          />
        </div>
      </Segment>

      <Segment>
        <Header as="h3">Players</Header>
        {players.map((player, index) => (
          <PlayerEditor
            key={player.color}
            player={player}
            onChange={(updated) => {
              const newPlayers = [...players];
              newPlayers[index] = updated;
              onPlayerUpdate(newPlayers);
            }}
          />
        ))}
      </Segment>

      <Segment>
        <Header as="h3">Bag ({bag.length} cubes)</Header>
        <BagSummary bag={bag} />
        <GoodAdder bag={bag} onBagUpdate={onBagUpdate} />
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

interface PlayerEditorProps {
  player: MutablePlayerData;
  onChange(player: MutablePlayerData): void;
}

function PlayerEditor({ player, onChange }: PlayerEditorProps) {
  const update = (field: keyof MutablePlayerData, value: number) => {
    onChange({ ...player, [field]: value });
  };

  return (
    <div className={styles.playerEditor}>
      <div className={styles.playerHeader}>
        <PlayerColorIndicator playerColor={player.color} currentTurn={false} />
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

function BagSummary({ bag }: { bag: Good[] }) {
  const counts = new Map<Good, number>();
  for (const good of bag) {
    counts.set(good, (counts.get(good) ?? 0) + 1);
  }
  return (
    <div className={styles.bagSummary}>
      {[Good.RED, Good.BLUE, Good.PURPLE, Good.YELLOW, Good.BLACK, Good.WHITE]
        .filter((g) => (counts.get(g) ?? 0) > 0)
        .map((good) => (
          <Label key={good} size="small">
            {goodToString(good)}: {counts.get(good) ?? 0}
          </Label>
        ))}
    </div>
  );
}

interface GoodAdderProps {
  bag: Good[];
  onBagUpdate(bag: Good[]): void;
}

function GoodAdder({ bag, onBagUpdate }: GoodAdderProps) {
  const goodOptions = [
    Good.RED,
    Good.BLUE,
    Good.PURPLE,
    Good.YELLOW,
    Good.BLACK,
    Good.WHITE,
  ].map((g) => ({
    key: g,
    text: goodToString(g),
    value: g,
  }));

  const [selectedGood, setSelectedGood] = useState<Good>(Good.RED);

  return (
    <div className={styles.goodAdder}>
      <Dropdown
        selection
        compact
        options={goodOptions}
        value={selectedGood}
        onChange={(_, data) => setSelectedGood(data.value as Good)}
      />
      <Button
        size="small"
        onClick={() => onBagUpdate([...bag, selectedGood])}
      >
        Add to bag
      </Button>
      <Button
        size="small"
        onClick={() => {
          const idx = bag.lastIndexOf(selectedGood);
          if (idx >= 0) {
            const newBag = [...bag];
            newBag.splice(idx, 1);
            onBagUpdate(newBag);
          }
        }}
      >
        Remove from bag
      </Button>
    </div>
  );
}
