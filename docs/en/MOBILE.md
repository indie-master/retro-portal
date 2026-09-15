# Mobile play

Retro Portal supports mobile browsers for systems powered by EmulatorJS. A game starts loading as soon as its page opens; there is no separate mobile launch screen.

Press **FULLSCREEN** to expand the game. The portal requests native fullscreen and, when the browser allows it, locks landscape orientation. If native fullscreen is unavailable, a clean page-level fullscreen fallback is used; press the same button to leave it.

On touch devices EmulatorJS provides its virtual gamepad. PlayStation receives a dedicated layout with a D-pad, △/○/✕/□, L1/L2, R1/R2, Start and Select.

PlayStation is considerably more demanding than 8/16-bit systems. On mobile, the portal disables threads and skips storing a second large ROM copy in EmulatorJS's internal cache to reduce peak memory pressure. Use CHD or PBP for PS1; BIN/ISO images are substantially heavier for a mobile browser.

Fullscreen and orientation lock require a user gesture. If orientation locking is denied, rotate the device manually.
