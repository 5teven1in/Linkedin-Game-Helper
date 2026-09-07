# Linkedin Game Helper

This extension helps you achieve better scores in Linkedin games.

## Leaderboard

- Patches - 0:03
- Mini Sudoku - 0:02
- Zip - 0:02
- Tango - 0:02
- Queens - 0:02
- Pinpoint - 1
- Crossclimb - 0:02

![](demo/demo.gif)

## Installation

1. Download or clone this repository to your computer
2. Open Google Chrome browser
3. Navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top-right corner
5. Click "Load unpacked" button in the top-left corner
6. Select the downloaded/cloned project folder
7. Done! The extension is now installed

## How to Use

1. Load the extension in Chrome, or click **Reload** on `chrome://extensions/` after updating it.
2. Reload LinkedIn and open the games lobby (`https://www.linkedin.com/games/`; `/game` is also matched).
3. Click **一鍵完成所有遊戲** in the bottom-right panel. The extension visits each supported game linked on the lobby in the same tab, starts it, and runs its solver.
4. The panel shows progress. A game is counted as completed when its share control, a visible link to its results, or its rendered results page appears. Results rendered inside LinkedIn's visible same-origin preload frame are also recognized. Already completed games are skipped as completed. A failure or 90-second timeout is recorded before moving on.
5. After the last game, the extension returns to the lobby with the results. Click **停止** at any time to stop and reload the current page, cancelling pending inputs.

Individual game pages now show **完成此遊戲** instead of solving immediately on page load. Batch progress is stored in this tab's `sessionStorage` and expires after 30 minutes. Leaving the queued game stops the batch. Keep the tab in the foreground while it runs.

Supported solvers: Patches, Mini Sudoku, Zip, Tango, Queens, Pinpoint, Crossclimb, and Wend. Only supported game links actually present in the lobby are queued. LinkedIn markup or puzzle data changes may require solver updates; a timeout is not reported as success. The automatic start button recognizes common English and Chinese labels; an unrecognized tutorial/start screen may need manual interaction.

## Development

- `gameHelper.js`: puzzle response capture, embedded Voyager JSON capture, early Como hydration capture, answer extraction, and existing game solvers. Hydration answers are retained before LinkedIn removes `#rehydrate-data` and `window.__como_rehydration__`, and cleared when the game route changes.
- `queue.js`: route matching, queue discovery, and persisted-state validation.
- `gameRunner.js`: controls, explicit activation, navigation, completion checks, and timeout handling.
- Run offline hydration, queue, and controller tests with `node --test tests/*.test.js` (no dependencies).
- Live verification on 2026-09-07 in Chrome: Wend #90, Patches #173, Zip #538, Mini Sudoku #391, Tango #699, Queens #859, Crossclimb #859, and Pinpoint #859 completed. The final batch recognized earlier completed games, solved the remaining games, reported 8/8 completed, and returned to the lobby. Offline tests remain simulations and do not replace this browser check.

## Note

- This extension is for educational and research purposes only
- Please comply with Linkedin's terms of service
