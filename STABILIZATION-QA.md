# DMusic Final QA / Architecture Notes

## 01 — Runtime architecture
- `script.js` remains the primary library/player runtime.
- `scanner-fix.js`, `pro-ui.js`, `pro-suite.js`, and `pro-player.js` remain loaded because their functionality has not yet been safely consolidated into one file.
- `dm-stabilizer.js`, `pro-hotfix.js`, and `cover-eq-fix.js` are not loaded and are no longer part of the active runtime.
- `pro-ui.js` now debounces its DOM observer to avoid mutation/render storms.

## 02 — UI / visual system
- `style.css` provides the responsive base layout and 3D/neon scene.
- `pro-style.css` and `pro-suite.css` preserve the mature player/library feature styling.
- `neon-theme.css` is loaded last as the compatibility layer that moves legacy Pro components onto the new cyan/violet/magenta visual identity.
- The main page has a single valid HTML document and a dedicated DMusic 3D hero stage.

## 03 — Responsive behavior
- Desktop, tablet and mobile layouts use dedicated breakpoints.
- Mobile receives a compact player and bottom navigation.
- Fixed player positioning is constrained to the viewport and avoids the historical right-shift issue.
- Reduced-motion users receive a low-motion fallback.

## 04 — Library / scanner
- Folder scanning and individual-file import remain supported.
- Audio and image discovery, filename parsing, cover matching and IndexedDB persistence remain supported.
- Library views include Library, Favorites, Recently Played, Most Played, Continue and Playlists.

## 05 — Player
- Mini-player controls remain wired to the existing player core.
- Queue, shuffle, repeat, progress, volume and navigation remain available.
- Full-player and cover-editor functionality remain supplied by the existing Pro runtime.
- The removed stabilizer is intentionally not reintroduced; duplicate playback ownership was the source of several regression risks.

## 06 — Covers / visualizer
- Custom track/folder covers remain persisted through `dmusic-covers-v1`.
- Cover fallback handling remains enabled.
- Existing Pro visualizer/EQ/full-player components remain available through their current runtime files.

## 07 — PWA / deployment
- GitHub Pages support remains configured through `.github/workflows/pages.yml`.
- `.nojekyll`, `manifest.webmanifest` and the 404 page remain present.
- Manifest metadata now matches the new DMusic neon identity.

## 08 — Validation boundary
Source-level validation was performed against the repository structure and the active HTML/CSS/runtime references. GitHub connector access cannot physically operate a browser, select a user's local music folder, decode arbitrary local audio, or validate device-specific GPU rendering.

The final browser smoke test is therefore required locally:
1. Load the GitHub Pages build and hard-refresh.
2. Confirm the hero, navigation, folder cards and track list render without console errors.
3. Add a folder and individual audio files.
4. Play, pause, resume, seek, change volume, shuffle, repeat and navigate tracks.
5. Confirm an intentionally selected new track starts at `0:00` and ended playback advances once.
6. Verify queue, favorites, playlists and Continue.
7. Verify custom cover upload/reset and Full Player.
8. Refresh and verify persisted state/library behavior.
9. Test desktop, tablet and mobile widths.
10. Test reduced-motion mode if applicable.

## Current release
The repository is intentionally kept on the stable multi-runtime architecture while the visual system is upgraded. No additional playback hotfix runtime has been introduced.