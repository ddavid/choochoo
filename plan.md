# Editor Mode Implementation Plan

## Overview

Add a GUI-based Editor mode for LOBBY games that lets the game owner set up a board state before starting, enabling replication of in-progress physical games (e.g. Disco Inferno). The editor allows placing tiles, goods, and setting player stats — like a god mode with no game-rule validation.

## Key Design Decisions

- **LOBBY-only**: Editor mode is available only for games in LOBBY status. Started (ACTIVE) games keep the existing admin-only raw JSON editor.
- **Game owner access**: The game owner (first player) can use editor mode once enough players have joined.
- **Two-phase approach**: First "initialize" the game state (assigns player colors, draws initial cubes), then edit it via GUI. When the game is started, the edited state is used directly.
- **No validation bypass needed in the engine**: Edits happen at the data level — directly modifying the serialized game state (grid, players, bag, connections) — not through the action pipeline.

## Implementation Steps

### 1. Backend: Add `initializeEditor` API endpoint

**Files**: `src/api/game.ts`, `src/server/game/routes.ts`

Add a new contract endpoint:
```
POST /games/:gameId/editor/init
```

- Requires: user is the game owner, game status is LOBBY, minimum players joined
- Calls `EngineDelegator.singleton.start()` to generate initial game state
- Saves the resulting `gameData` on the GameDao **without** changing status to ACTIVE
- Returns the updated game (still LOBBY, but now with `gameData`)

### 2. Backend: Add `setEditorData` API endpoint

**Files**: `src/api/game.ts`, `src/server/game/routes.ts`

Add a new contract endpoint:
```
PUT /games/:gameId/editor/data
```

- Requires: user is the game owner, game status is LOBBY, game has gameData (editor initialized)
- Accepts `{ gameData: string }` body (same format as admin `setGameData`)
- Saves updated gameData to the LOBBY game
- This allows the game owner (not just admin) to save editor changes

### 3. Backend: Modify `startGame` to use existing editor state

**Files**: `src/server/game/logic.ts`

When `startGame()` is called:
- If the game already has `gameData` (set by editor), skip `EngineDelegator.singleton.start()`
- Just set `status = ACTIVE`, assign `activePlayerId` from the existing state, set `turnStartTime`
- Still create the GameHistory record for the start event
- Emit turn notification as normal

### 4. Frontend: Add editor initialization hook

**File**: `src/client/services/game.ts`

- `useInitializeEditor(game)`: calls `POST /games/:gameId/editor/init`
  - `canPerform`: user is owner, game is LOBBY, min players met, no gameData yet
  - Returns the game with initialized gameData
- `useSetEditorData()`: calls `PUT /games/:gameId/editor/data`
  - Used to save editor changes back to the server

### 5. Frontend: Editor mode context and tools

**New file**: `src/client/game/editor_mode/editor_context.tsx`

React context providing:
- `currentTool`: which editing tool is active (TILE, GOOD, PLAYER, CONNECTION, ERASER)
- `selectedOwner`: which PlayerColor owns items being placed
- `setTool()`, `setOwner()`: state setters
- Parsed game state for reading/modifying

### 6. Frontend: Editor panel component

**New file**: `src/client/game/editor_mode/editor_panel.tsx`

A sidebar/panel UI containing:
- **Tool selector**: buttons to switch between Tile, Good, Player Stats, Connection, and Eraser tools
- **Owner selector**: dropdown or color buttons to pick which player color owns the placed item
- **Player stats editor**: editable fields for each player's money, income, shares, locomotive
- **Bag editor**: display/edit goods remaining in the bag
- **Save button**: persists current state to server via `useSetEditorData`

### 7. Frontend: Editor map component

**New file**: `src/client/game/editor_mode/editor_map.tsx`

An interactive map for editor mode. Wraps `HexGrid` with editor-specific click handlers:

- **Tile tool**: clicking a land hex opens a tile selection dialog (all tile types, all orientations, no validation). The placed tile gets the selected owner color.
- **Good tool**: clicking a city opens a dialog to add/remove goods (select color from dropdown).
- **Connection tool**: clicking an inter-city connection toggles ownership to the selected player color.
- **Eraser tool**: clicking a hex with a tile removes it; clicking a city good removes it.

### 8. Frontend: Editor tile dialog

**New file**: `src/client/game/editor_mode/editor_tile_dialog.tsx`

Similar to the existing `BuildingDialog` but:
- Shows ALL tile types and orientations (no validation filtering)
- No cost display
- Selected tile is placed immediately with the current owner color
- Uses existing tile rendering components for preview

### 9. Frontend: Modify GamePage for editor mode

**File**: `src/client/game/page.tsx`

In the LOBBY branch:
- If `game.gameData` exists (editor initialized), render the editor UI (EditorPanel + EditorMap) instead of the static `MapGridPreview`
- Add "Initialize Editor" button (shown when `canPerform` from `useInitializeEditor`)
- Keep the existing `GameCard` with join/leave/start buttons

### 10. Frontend: Modify GameCard for editor button

**File**: `src/client/home/game_card.tsx`

Add an "Editor Mode" button next to the Start button:
- Visible when: user is game owner, game is LOBBY, min players met, no gameData yet
- On click: calls `useInitializeEditor` to generate initial state
- After initialization, the page switches to editor view

### 11. Tests

**New file**: `src/engine/game/editor_test.ts`

Unit tests using the existing Jasmine + InjectionHelper pattern:

1. **Editor initialization**:
   - Test that `initializeEditor` creates valid gameData for a LOBBY game
   - Test that initialized gameData contains correct player count and colors
   - Test that grid is properly populated with starting map data
   - Test that bag, available cities, and connections are initialized

2. **Start with editor data**:
   - Test that `startGame` with pre-existing gameData preserves the editor state
   - Test that `startGame` with pre-existing gameData sets status to ACTIVE
   - Test that `startGame` with pre-existing gameData sets correct activePlayerId
   - Test that gameData modifications (e.g. placed tiles) survive start

3. **Guard rails**:
   - Test that editor init rejects ACTIVE games
   - Test that editor init rejects games without minimum players
   - Test that `setEditorData` rejects ACTIVE games
   - Test that `setEditorData` rejects non-owner users
   - Test that `setEditorData` rejects games without initialized editor state (no gameData)

**New file**: `src/server/game/editor_route_test.ts`

Server-side route tests (if the project adds route-level testing):

4. **API endpoint tests**:
   - Test `POST /games/:gameId/editor/init` returns 200 with gameData
   - Test `PUT /games/:gameId/editor/data` saves and returns updated game
   - Test endpoints reject unauthorized users
   - Test endpoints reject wrong game states

## File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/api/game.ts` | Modified | Add `initializeEditor` and `setEditorData` contract endpoints |
| `src/server/game/routes.ts` | Modified | Add route handlers for editor endpoints |
| `src/server/game/logic.ts` | Modified | Modify `startGame` to use existing gameData when present |
| `src/client/services/game.ts` | Modified | Add `useInitializeEditor` and `useSetEditorData` hooks |
| `src/client/game/page.tsx` | Modified | Render editor mode in LOBBY when gameData exists |
| `src/client/home/game_card.tsx` | Modified | Add "Editor Mode" initialization button |
| `src/client/game/editor_mode/editor_context.tsx` | New | Editor state context (tool, owner selection) |
| `src/client/game/editor_mode/editor_panel.tsx` | New | Editor toolbar and player stats UI |
| `src/client/game/editor_mode/editor_map.tsx` | New | Interactive map with editor click handlers |
| `src/client/game/editor_mode/editor_tile_dialog.tsx` | New | Tile selection dialog for editor (no validation) |
| `src/engine/game/editor_test.ts` | New | Unit tests for editor initialization and startGame integration |

## Architecture Notes

- The editor operates on the serialized `gameData` string. It deserializes it, modifies the state objects, and re-serializes it for saving. This avoids needing to run through the engine's action pipeline.
- The frontend parses `gameData` using the same state key parsers the engine uses, modifies the in-memory state, and sends the serialized version back via the `setEditorData` endpoint.
- No new database migrations are needed — `gameData` is already a nullable TEXT column on GameDao, and we're just populating it earlier (in LOBBY instead of only in ACTIVE).
- The editor mode is orthogonal to the existing admin JSON editor, which continues to work on ACTIVE games for admins.
