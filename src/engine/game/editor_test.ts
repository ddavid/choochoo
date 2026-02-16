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
import { GameStarter, PlayerUser } from "./starter";
import {
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
  });
});
