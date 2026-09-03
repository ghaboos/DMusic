# DMusic Stabilization QA

## 01 Audit / Cleanup
- Superseded `pro-hotfix.js` removed from runtime and repository.
- Superseded `cover-eq-fix.js` removed from runtime and repository.
- Player stabilization is centralized in `dm-stabilizer.js`.

## 02 Player Core
- Manual track selection marks the selected track as a fresh play and clears its saved resume position.
- Previous / Next mark the next playback as a fresh play.
- Pressing Play after a track has ended starts at `0:00`.
- The core player remains the owner of `ended -> next`; the stabilization layer does not synthesize a second Next click.
- Play / Pause state is mirrored to the mini and full player UI.

## 03 CSS + UI
- Stabilization overrides are scoped to DMusic player/library selectors.
- Legacy EQ/hotfix selectors are no longer loaded from the removed hotfix runtime.
- Existing base/pro UI styles remain intact to avoid destructive visual regressions.

## 04 Cover + CD
- Track cover precedence remains: custom track cover -> track cover -> custom folder cover -> folder cover -> fallback.
- Mini player cover is rendered as a layered physical CD with hub, hole, grooves and highlight.
- CD rotation uses one transform state, so pause freezes the current position instead of restarting an animation.

## 05 Real EQ / Visualizer
- Web Audio `AnalyserNode` is attached lazily to the actual playback element on first Play.
- EQ bars react to frequency data while playing and settle when paused.
- Full-player EQ ring and mini-player EQ stay independent so the mini player cannot be stretched by the full-player ring.

## 06 Mobile
- Mini CD scales down for small screens.
- Full player uses a single-column mobile layout.
- Existing swipe navigation remains enabled.
- Full-player mode hides the fixed mini player to prevent overlap.

## 07 Scanner / Library
- Existing scanner, IndexedDB persistence, Add Folder and Add Files flows are preserved.
- Existing content-visibility optimization remains enabled for large track lists.

## 08 Persistence / Backup
- Existing `dmusic-state-v8` state remains the source for favorites, queue, history, play counts and positions.
- Existing Pro Suite backup/restore remains loaded.
- Stabilizer only changes positions when a user explicitly starts a track/navigation action.

## 09 Final QA

### Browser smoke test
1. Add a folder with MP3 files.
2. Add individual MP3 files.
3. Play a track from the list.
4. Pause and resume; position must remain unchanged.
5. Select a different track; it must begin at `0:00`.
6. Press Previous / Next; the new track must begin at `0:00`.
7. Let a track reach `ended`; the core player should advance once.
8. Select the ended track again; it must begin at `0:00`.
9. Refresh the page; library/state should restore according to the existing scanner persistence flow.
10. Open Full Player; verify cover, EQ, progress and controls.
11. Upload/reset a custom cover.
12. Export and restore a backup.
13. Repeat the above on a narrow mobile viewport.

### Known validation boundary
GitHub-side validation can inspect and update source, but it cannot physically click the browser, select local files, or listen to audio. The checklist above is therefore the required end-user smoke test after pulling the stabilized commit.
