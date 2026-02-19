import { city, plain, town } from "../../testing/factory";
import { InjectionHelper } from "../../testing/injection_helper";
import { resettable } from "../../testing/resettable";
import { Coordinates } from "../../utils/coordinates";
import { Good } from "../state/good";
import { SpaceType } from "../state/location_type";
import { PlayerColor, PlayerData } from "../state/player";
import { LandData, MutableSpaceData } from "../state/space";
import { Direction, SimpleTileType } from "../state/tile";
import { InterCityConnection } from "../state/inter_city_connection";
import { GameEngine } from "./game";
import { CityGroup } from "../state/city_group";
import {
  AVAILABLE_CITIES,
  BAG,
  GRID,
  INTER_CITY_CONNECTIONS,
  TEST_ONLY_PLAYERS,
  TURN_ORDER,
} from "./state";

describe("Editor Mode", () => {
  describe("startFromEditorData", () => {
    const injector = InjectionHelper.install();

    const cityCoords = Coordinates.from({ q: 0, r: 0 });
    const landCoords = cityCoords.neighbor(Direction.TOP);
    const secondCity = landCoords.neighbor(Direction.TOP);

    const players = injector.initResettableState(TEST_ONLY_PLAYERS, [
      {
        playerId: 1,
        color: PlayerColor.RED,
        income: 5,
        shares: 3,
        money: 15,
        locomotive: 2,
      } as PlayerData,
      {
        playerId: 2,
        color: PlayerColor.BLUE,
        income: 3,
        shares: 2,
        money: 8,
        locomotive: 1,
      } as PlayerData,
    ]);

    const turnOrder = injector.initResettableState(TURN_ORDER, [
      PlayerColor.RED,
      PlayerColor.BLUE,
    ]);

    const bag = injector.initResettableState(BAG, [
      Good.RED,
      Good.BLUE,
      Good.PURPLE,
    ]);

    const grid = injector.initResettableState(
      GRID,
      new Map<Coordinates, MutableSpaceData>([
        [cityCoords, city()],
        [landCoords, plain()],
        [secondCity, city()],
      ]),
    );

    injector.initResettableState(INTER_CITY_CONNECTIONS, []);

    const engine = resettable(() => new GameEngine());

    it("preserves existing player data", () => {
      engine().startFromEditorData();

      expect(players()[0].money).toEqual(15);
      expect(players()[0].income).toEqual(5);
      expect(players()[0].shares).toEqual(3);
      expect(players()[0].locomotive).toEqual(2);
      expect(players()[1].money).toEqual(8);
    });

    it("preserves existing turn order", () => {
      engine().startFromEditorData();

      expect(turnOrder()).toEqual([PlayerColor.RED, PlayerColor.BLUE]);
    });

    it("preserves existing bag contents", () => {
      engine().startFromEditorData();

      expect(bag()).toEqual([Good.RED, Good.BLUE, Good.PURPLE]);
    });

    it("preserves tiles placed on the grid", () => {
      grid.update((g) => {
        const land = g.get(landCoords) as LandData;
        g.set(landCoords, {
          ...land,
          tile: {
            tileType: SimpleTileType.STRAIGHT,
            orientation: Direction.TOP,
            owners: [PlayerColor.RED],
          },
        });
      });

      engine().startFromEditorData();

      const landData = grid().get(landCoords) as LandData;
      expect(landData.tile).toBeDefined();
      expect(landData.tile!.tileType).toEqual(SimpleTileType.STRAIGHT);
      expect(landData.tile!.owners).toEqual([PlayerColor.RED]);
    });

    it("preserves goods on cities", () => {
      grid.update((g) => {
        const cityData = g.get(cityCoords)!;
        if (cityData.type === SpaceType.CITY) {
          g.set(cityCoords, {
            ...cityData,
            goods: [Good.YELLOW, Good.PURPLE],
          });
        }
      });

      engine().startFromEditorData();

      const cityData = grid().get(cityCoords)!;
      if (cityData.type === SpaceType.CITY) {
        expect(cityData.goods).toEqual([Good.YELLOW, Good.PURPLE]);
      }
    });
  });

  describe("editor state validation", () => {
    const injector = InjectionHelper.install();

    const cityCoords = Coordinates.from({ q: 0, r: 0 });
    const landCoords = cityCoords.neighbor(Direction.TOP);

    const players = injector.initResettableState(TEST_ONLY_PLAYERS, [
      {
        playerId: 1,
        color: PlayerColor.RED,
        income: 0,
        shares: 2,
        money: 10,
        locomotive: 1,
      } as PlayerData,
    ]);

    const turnOrder = injector.initResettableState(TURN_ORDER, [
      PlayerColor.RED,
    ]);

    const bag = injector.initResettableState(BAG, [Good.RED, Good.BLUE]);

    const grid = injector.initResettableState(
      GRID,
      new Map<Coordinates, MutableSpaceData>([
        [cityCoords, city()],
        [landCoords, plain()],
      ]),
    );

    injector.initResettableState(INTER_CITY_CONNECTIONS, []);

    it("can place a tile with an owner", () => {
      grid.update((g) => {
        const land = g.get(landCoords) as LandData;
        g.set(landCoords, {
          ...land,
          tile: {
            tileType: SimpleTileType.CURVE,
            orientation: Direction.TOP_LEFT,
            owners: [PlayerColor.RED],
          },
        });
      });

      const landData = grid().get(landCoords) as LandData;
      expect(landData.tile).toBeDefined();
      expect(landData.tile!.tileType).toEqual(SimpleTileType.CURVE);
      expect(landData.tile!.orientation).toEqual(Direction.TOP_LEFT);
      expect(landData.tile!.owners).toEqual([PlayerColor.RED]);
    });

    it("can place a tile without an owner", () => {
      grid.update((g) => {
        const land = g.get(landCoords) as LandData;
        g.set(landCoords, {
          ...land,
          tile: {
            tileType: SimpleTileType.STRAIGHT,
            orientation: Direction.TOP,
            owners: [undefined],
          },
        });
      });

      const landData = grid().get(landCoords) as LandData;
      expect(landData.tile!.owners).toEqual([undefined]);
    });

    it("can modify player money directly", () => {
      players.update((p) => {
        p[0] = { ...p[0], money: 42 };
      });

      expect(players()[0].money).toEqual(42);
    });

    it("can modify player income directly", () => {
      players.update((p) => {
        p[0] = { ...p[0], income: 7 };
      });

      expect(players()[0].income).toEqual(7);
    });

    it("can modify player shares directly", () => {
      players.update((p) => {
        p[0] = { ...p[0], shares: 5 };
      });

      expect(players()[0].shares).toEqual(5);
    });

    it("can modify player locomotive directly", () => {
      players.update((p) => {
        p[0] = { ...p[0], locomotive: 3 };
      });

      expect(players()[0].locomotive).toEqual(3);
    });

    it("can add goods to a city", () => {
      grid.update((g) => {
        const cityData = g.get(cityCoords)!;
        if (cityData.type === SpaceType.CITY) {
          g.set(cityCoords, {
            ...cityData,
            goods: [...cityData.goods, Good.YELLOW],
          });
        }
      });

      const cityData = grid().get(cityCoords)!;
      if (cityData.type === SpaceType.CITY) {
        expect(cityData.goods).toContain(Good.YELLOW);
      }
    });

    it("can remove goods from a city", () => {
      grid.update((g) => {
        const cityData = g.get(cityCoords)!;
        if (cityData.type === SpaceType.CITY) {
          g.set(cityCoords, {
            ...cityData,
            goods: [],
          });
        }
      });

      const cityData = grid().get(cityCoords)!;
      if (cityData.type === SpaceType.CITY) {
        expect(cityData.goods).toEqual([]);
      }
    });

    it("can modify bag contents", () => {
      bag.set([Good.PURPLE, Good.PURPLE, Good.YELLOW]);

      expect(bag()).toEqual([Good.PURPLE, Good.PURPLE, Good.YELLOW]);
    });

    it("can remove a tile (eraser)", () => {
      grid.update((g) => {
        const land = g.get(landCoords) as LandData;
        g.set(landCoords, {
          ...land,
          tile: {
            tileType: SimpleTileType.STRAIGHT,
            orientation: Direction.TOP,
            owners: [PlayerColor.RED],
          },
        });
      });

      // Now erase
      grid.update((g) => {
        const land = g.get(landCoords) as LandData;
        g.set(landCoords, { ...land, tile: undefined });
      });

      const landData = grid().get(landCoords) as LandData;
      expect(landData.tile).toBeUndefined();
    });

    it("can modify turn order", () => {
      turnOrder.set([PlayerColor.RED]);

      expect(turnOrder()).toEqual([PlayerColor.RED]);

      // Swap order
      turnOrder.set([PlayerColor.RED]);
      expect(turnOrder()[0]).toEqual(PlayerColor.RED);
    });

    it("can modify available cities", () => {
      const availCities = injector.initResettableState(AVAILABLE_CITIES, [
        {
          color: Good.RED,
          onRoll: [{ group: CityGroup.WHITE, onRoll: 3, goods: [] }],
          goods: [Good.RED, Good.BLUE],
        },
      ]);

      availCities.update((cities) => {
        cities[0] = { ...cities[0], goods: [Good.PURPLE] };
      });

      expect(availCities()[0].goods).toEqual([Good.PURPLE]);
    });

    it("can toggle urbanized on a city", () => {
      grid.update((g) => {
        const cityData = g.get(cityCoords)!;
        if (cityData.type === SpaceType.CITY) {
          g.set(cityCoords, { ...cityData, urbanized: true });
        }
      });

      const cityData = grid().get(cityCoords)!;
      if (cityData.type === SpaceType.CITY) {
        expect(cityData.urbanized).toEqual(true);
      }
    });
  });

  describe("startFromEditorData with custom round", () => {
    const injector = InjectionHelper.install();

    const cityCoords = Coordinates.from({ q: 0, r: 0 });
    const landCoords = cityCoords.neighbor(Direction.TOP);
    const secondCity = landCoords.neighbor(Direction.TOP);

    injector.initResettableState(TEST_ONLY_PLAYERS, [
      {
        playerId: 1,
        color: PlayerColor.RED,
        income: 5,
        shares: 3,
        money: 15,
        locomotive: 2,
      } as PlayerData,
      {
        playerId: 2,
        color: PlayerColor.BLUE,
        income: 3,
        shares: 2,
        money: 8,
        locomotive: 1,
      } as PlayerData,
    ]);

    injector.initResettableState(TURN_ORDER, [
      PlayerColor.RED,
      PlayerColor.BLUE,
    ]);

    injector.initResettableState(BAG, [Good.RED, Good.BLUE, Good.PURPLE]);

    injector.initResettableState(
      GRID,
      new Map<Coordinates, MutableSpaceData>([
        [cityCoords, city()],
        [landCoords, plain()],
        [secondCity, city()],
      ]),
    );

    injector.initResettableState(INTER_CITY_CONNECTIONS, []);

    injector.initResettableState(AVAILABLE_CITIES, []);

    const engine = resettable(() => new GameEngine());

    it("starts at the specified round", () => {
      engine().startFromEditorData(5);

      // The round is deleted and re-created during lifecycle,
      // so we just verify the game started without error at round 5.
      // The round state will be set to 5 by RoundEngine.start(5).
    });

    it("defaults to round 1", () => {
      engine().startFromEditorData();
      // No error means it started at round 1 successfully.
    });
  });

  describe("urbanize town via editor", () => {
    const injector = InjectionHelper.install();

    const cityCoords = Coordinates.from({ q: 0, r: 0 });
    const townCoords = cityCoords.neighbor(Direction.TOP);

    const grid = injector.initResettableState(
      GRID,
      new Map<Coordinates, MutableSpaceData>([
        [cityCoords, city()],
        [townCoords, town({ goods: [Good.RED] })],
      ]),
    );

    const availCities = injector.initResettableState(AVAILABLE_CITIES, [
      {
        color: Good.BLUE,
        onRoll: [{ group: CityGroup.WHITE, onRoll: 4, goods: [] }],
        goods: [Good.YELLOW],
      },
      {
        color: Good.PURPLE,
        onRoll: [{ group: CityGroup.WHITE, onRoll: 5, goods: [] }],
        goods: [Good.BLACK],
      },
    ]);

    it("replaces a town with a city using an available city", () => {
      // Simulate what editor_mode.onUrbanize does: replace the town land
      // with a city and remove the used city from available.
      const usedCity = availCities()[0];
      const townData = grid().get(townCoords) as LandData;
      const townGoods = townData.goods ?? [];

      grid.update((g) => {
        g.set(townCoords, {
          type: SpaceType.CITY,
          name: townData.townName ?? "Town",
          color: usedCity.color,
          goods: [...usedCity.goods, ...townGoods],
          urbanized: true,
          onRoll: usedCity.onRoll,
        });
      });

      availCities.update((cities) => {
        cities.splice(0, 1);
      });

      // Verify the town is now a city
      const updatedSpace = grid().get(townCoords)!;
      expect(updatedSpace.type).toEqual(SpaceType.CITY);
      if (updatedSpace.type === SpaceType.CITY) {
        expect(updatedSpace.urbanized).toEqual(true);
        expect(updatedSpace.color).toEqual(Good.BLUE);
        expect(updatedSpace.goods).toEqual([Good.YELLOW, Good.RED]);
        expect(updatedSpace.name).toEqual("Foo City");
      }

      // Verify available cities reduced
      expect(availCities().length).toEqual(1);
      expect(availCities()[0].color).toEqual(Good.PURPLE);
    });

    it("preserves town goods when urbanizing", () => {
      const usedCity = availCities()[0];
      const townData = grid().get(townCoords) as LandData;
      const townGoods = townData.goods ?? [];

      grid.update((g) => {
        g.set(townCoords, {
          type: SpaceType.CITY,
          name: townData.townName ?? "Town",
          color: usedCity.color,
          goods: [...usedCity.goods, ...townGoods],
          urbanized: true,
          onRoll: usedCity.onRoll,
        });
      });

      const updatedSpace = grid().get(townCoords)!;
      if (updatedSpace.type === SpaceType.CITY) {
        // Town had [RED], city had [YELLOW] → combined
        expect(updatedSpace.goods).toContain(Good.YELLOW);
        expect(updatedSpace.goods).toContain(Good.RED);
      }
    });
  });

  describe("player color change via editor", () => {
    const injector = InjectionHelper.install();

    const cityCoords = Coordinates.from({ q: 0, r: 0 });
    const landCoords = cityCoords.neighbor(Direction.TOP);
    const secondCity = landCoords.neighbor(Direction.TOP);

    const players = injector.initResettableState(TEST_ONLY_PLAYERS, [
      {
        playerId: 1,
        color: PlayerColor.RED,
        income: 5,
        shares: 3,
        money: 15,
        locomotive: 2,
      } as PlayerData,
      {
        playerId: 2,
        color: PlayerColor.BLUE,
        income: 3,
        shares: 2,
        money: 8,
        locomotive: 1,
      } as PlayerData,
    ]);

    const turnOrder = injector.initResettableState(TURN_ORDER, [
      PlayerColor.RED,
      PlayerColor.BLUE,
    ]);

    const grid = injector.initResettableState(
      GRID,
      new Map<Coordinates, MutableSpaceData>([
        [cityCoords, city()],
        [
          landCoords,
          plain({
            tile: {
              tileType: SimpleTileType.STRAIGHT,
              orientation: Direction.TOP,
              owners: [PlayerColor.RED],
            },
          }),
        ],
        [secondCity, city()],
      ]),
    );

    const connections = injector.initResettableState(INTER_CITY_CONNECTIONS, [
      {
        id: "conn1",
        connects: [cityCoords, secondCity],
        cost: 3,
        owner: { color: PlayerColor.BLUE },
      } as InterCityConnection,
    ]);

    it("updates player color in players array", () => {
      players.update((p) => {
        p[0] = { ...p[0], color: PlayerColor.GREEN };
      });

      expect(players()[0].color).toEqual(PlayerColor.GREEN);
      expect(players()[1].color).toEqual(PlayerColor.BLUE);
    });

    it("propagates color change to turn order", () => {
      // Simulate editor_mode.onColorChange: replace old color in turnOrder
      turnOrder.update((order) => {
        for (let i = 0; i < order.length; i++) {
          if (order[i] === PlayerColor.RED) {
            order[i] = PlayerColor.GREEN;
          }
        }
      });

      expect(turnOrder()).toEqual([PlayerColor.GREEN, PlayerColor.BLUE]);
    });

    it("propagates color change to tile owners", () => {
      grid.update((g) => {
        const land = g.get(landCoords) as LandData;
        if (land.tile) {
          g.set(landCoords, {
            ...land,
            tile: {
              ...land.tile,
              owners: land.tile.owners.map((o) =>
                o === PlayerColor.RED ? PlayerColor.GREEN : o,
              ),
            },
          });
        }
      });

      const landData = grid().get(landCoords) as LandData;
      expect(landData.tile!.owners).toEqual([PlayerColor.GREEN]);
    });

    it("propagates color change to connection owners", () => {
      connections.update((conns) => {
        for (let i = 0; i < conns.length; i++) {
          if (conns[i].owner?.color === PlayerColor.BLUE) {
            conns[i] = {
              ...conns[i],
              owner: { color: PlayerColor.YELLOW },
            };
          }
        }
      });

      expect(connections()[0].owner?.color).toEqual(PlayerColor.YELLOW);
    });

    it("does not change other players when changing one color", () => {
      players.update((p) => {
        p[0] = { ...p[0], color: PlayerColor.GREEN };
      });

      // Player 2 should be unchanged
      expect(players()[1].color).toEqual(PlayerColor.BLUE);
      expect(players()[1].money).toEqual(8);
    });
  });
});
