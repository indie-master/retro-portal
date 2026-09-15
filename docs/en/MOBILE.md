# Mobile play

Retro Portal supports mobile browsers for systems powered by EmulatorJS. A game starts loading as soon as its page opens; there is no separate mobile launch screen.

Press **FULLSCREEN** to expand the game. The portal requests native fullscreen and, when the browser allows it, locks landscape orientation. If native fullscreen is unavailable, a clean page-level fullscreen fallback is used; press the same button to leave it.

On touch devices EmulatorJS provides its virtual gamepad. PlayStation receives a dedicated layout with a D-pad, △/○/✕/□, L1/L2, R1/R2, Start and Select.

PlayStation is considerably more demanding than 8/16-bit systems. On mobile, the portal loads CHD/PBP images in sequential 8 MiB HTTP ranges directly into the emulator file system. This removes the second full-size JavaScript copy that could make iPhone Safari reload the page near the end of a download. The ROM cache and threads are disabled for mobile PlayStation.

Use CHD or PBP for PS1. Range streaming is intentionally not used for BIN/ISO files or archives; convert those images to CHD/PBP first. The server must return `Content-Length`, `Accept-Ranges: bytes`, and valid `206 Content-Range` responses; Retro Portal's bundled Nginx configuration already does so.

Fullscreen and orientation lock require a user gesture. If orientation locking is denied, rotate the device manually.
