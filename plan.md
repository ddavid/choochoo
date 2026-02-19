# Editor Mode — Phase 2 Plan

## Overview

Refactor the editor interaction model and add missing features. The current mode-based tool selector (Tile/Good/Link/Erase) is replaced with context-sensitive actions that appear based on what the user clicks. Additional features: urbanize towns with available cities, editable player colors, and undo/redo.

## Analysis of current modes

Current modes and what they gate:

| Mode | Land (empty) | Land (has tile) | City | Inter-city connection |
|------|-------------|----------------|------|----------------------|
| TILE | opens tile dialog | opens tile dialog | nothing | nothing |
| GOOD | nothing | nothing | opens good dialog | nothing |
| CONNECTION | nothing | nothing | nothing | sets owner |
| ERASER | nothing | removes tile | removes one good | removes owner |

**Key insight**: The context (what was clicked) already determines the action. There's no scenario where clicking the same thing should do different things depending on the mode — except for inter-city connections (set owner vs erase owner), which can be unified into a single dialog.

## Changes

### 1. Remove tool modes, use context-sensitive click handling

**Files**: `editor_map.tsx`, `editor_context.tsx`, `editor_panel.tsx`

Replace the `EditorTool` enum and mode selector buttons with a single click handler that inspects what was clicked:

- **Land (no tile)**: open tile dialog (same as before)
- **Land (has tile)**: open a small dialog offering "Replace tile" or "Erase tile"
- **City**: open good dialog (same as now, already has urbanized toggle)
- **Inter-city connection**: open a small dialog to pick owner or clear owner

The `EditorContext` still keeps `selectedOwner` (needed for tile placement and connection assignment). Remove `currentTool`/`setTool`.

The tool selector buttons in `EditorPanel` are removed. The owner selector stays.

### 2. Urbanize towns from available cities

**Files**: `editor_map.tsx`

When clicking a **town** (a Land with `hasTown()` but no tile to worry about — towns are Land spaces with a `townName`), offer an "Urbanize" option. This shows a list of available cities (from the editor state). Selecting one:

1. Replaces the Land space with a City space (same as `UrbanizeAction.process()` does):
   - `type: CITY`, `name: townName`, `color: city.color`, `goods: city.goods`, `urbanized: true`, `onRoll: city.onRoll`
2. Removes that city from `availableCities` in the gameData

This needs both `updateGridSpace` (to change the space) and an `updateAvailableCities` callback (to remove the used city). The `EditorMode` component already has `availableCities` and `onAvailableCitiesUpdate`.

For the click handler: check `space instanceof Land && space.hasTown()`. Open a dialog that shows available cities to pick from, plus the existing tile dialog option.

Actually, simplifying further: when clicking a town (Land with townName), show a dialog with two sections:
- "Place tile" (opens tile dialog as before)
- "Urbanize" with a list of available cities to pick

When clicking empty land (no town), just open tile dialog directly.

### 3. Editable player colors

**Files**: `editor_panel.tsx`, `editor_mode.tsx`

Add a color dropdown next to each player in the Players section. The dropdown shows all `eligiblePlayerColors` minus colors already used by other players. Changing a player's color:
1. Updates `players[i].color` in gameData
2. Updates `turnOrder` to replace the old color with the new one
3. Updates any tile `owners` on the grid that reference the old color
4. Updates any inter-city connection owners that reference the old color

Since this is a "replace all references" operation, it's cleanest to do a string-level find/replace on the serialized gameData, or walk through the relevant arrays. The serialized format stores `PlayerColor` as a number, so the safest approach is to parse, walk all relevant fields, and re-serialize.

### 4. Undo/Redo

**Files**: `editor_mode.tsx`

The editor already manages `localGameData` as a string state. Undo/redo is straightforward:

- Maintain a `history: string[]` array and a `historyIndex: number`
- Every time `setLocalGameData` is called (from any source — map click, panel edit, etc.), push the new state onto history and advance the index
- "Undo" decrements `historyIndex` and sets `localGameData = history[historyIndex]`
- "Redo" increments `historyIndex` and sets `localGameData = history[historyIndex]`
- Buttons in `EditorPanel` (or at the top): Undo (disabled when index=0), Redo (disabled when index=end)

This gives free undo/redo for every operation since all state changes flow through the same `localGameData` string.

### 5. Tests

**File**: `editor_test.ts`

New tests (Jasmine + InjectionHelper pattern, matching existing tests):

- **Urbanize in editor**: Set up a grid with a town, create an available city, simulate the urbanization (replace land→city, remove from available cities). Verify the resulting grid space is a city with correct fields and `urbanized: true`, and that the available city was removed.
- **Player color change**: Set up two players, change one's color, verify turnOrder updated, verify tile owners updated with new color.
- **Round number with startFromEditorData**: Already tested. Verify round 5 starts correctly.
- **Undo/redo**: This is purely UI state management (history array), not engine logic. No engine-level test needed — it's React state.

## File Change Summary

| File | Change |
|------|--------|
| `editor_context.tsx` | Remove `EditorTool` enum and `currentTool`/`setTool`. Keep `selectedOwner`/`setOwner` only. |
| `editor_panel.tsx` | Remove tool selector buttons. Add player color dropdown. Add Undo/Redo buttons. Keep owner selector, game settings, turn order, players, available cities, save. |
| `editor_map.tsx` | Replace mode-switched `onClick` with context-sensitive handler. Add town click dialog (urbanize or place tile). Add tile-exists dialog (replace or erase). Merge connection click into a small owner-picker dialog. |
| `editor_mode.tsx` | Add undo/redo history management. Add `onColorChange` callback that walks gameData. Pass `availableCities` + `onUrbanize` to `EditorMap`. |
| `editor_test.ts` | Add urbanize-in-editor and player-color-change tests. |
