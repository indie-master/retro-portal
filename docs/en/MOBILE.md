# Mobile play

Retro Portal supports mobile browsers for systems powered by EmulatorJS. On a phone or tablet, open a game, rotate the device to landscape and press **MOBILE MODE**. The ROM is not downloaded before this tap.

The portal requests native fullscreen and, when the browser allows it, locks landscape orientation. On iPhone/iPad Safari, where fullscreen for a regular HTML element may be unavailable, a full-viewport overlay is used automatically. The **EXIT** button at the top of the game surface returns to the page.

On touch devices EmulatorJS provides its virtual gamepad. Mobile mode removes secondary page chrome, expands the game area to the browser's actual visible viewport, respects safe-area insets and prevents accidental scrolling over the game surface. PlayStation receives a dedicated layout with a D-pad, △/○/✕/□, L1/L2, R1/R2, Start and Select.

PlayStation is considerably more demanding than 8/16-bit systems. On mobile, the portal disables threads and skips storing a second large ROM copy in EmulatorJS's internal cache to reduce peak memory pressure. Use CHD or PBP for PS1; BIN/ISO images are substantially heavier for a mobile browser.

Fullscreen and orientation lock require a user gesture. If orientation locking is denied, rotate the device manually; the full-viewport overlay will keep working.
