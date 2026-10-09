# Selected Opus 5.5 clips

All four clips use the head camera. Source files are the full validation rollouts from `rsi_viz/robodojo-throw-bottles-into-dustbin/opus55-validation-choices/videos/`; each exported clip is exactly 8 seconds.

- `opus-r2-standard1-t12-20.mp4`: R2, standard-1, source 12–20 s. The gripper fails to secure the upright small bottle.
- `opus-r5-standard1-t04-12.mp4`: R5, standard-1, source 4–12 s. The upright small bottle is picked up successfully.
- `opus-r8-standard4-t04-12.mp4`: R8, standard-4, source 4–12 s. The bottle is knocked off the table and falls below it.
- `opus-r9-standard4-t04-12.mp4`: R9, standard-4, source 4–12 s. The arm approaches higher; the bottle tips on contact but remains on the tabletop, unlike R8.

Each poster is sampled 7.5 seconds into its selected clip to show the outcome.

## Zoom composites (what the page plays)

`zoom-<clip>.mp4` / `.jpg` (1286×480) use the active-search marks at the camera's own resolution: on the
left the decisive region enlarged 2× (320×240 → 640×480) with a dark chip "R<n>  enlarged 2×"; a 6 px dark
gap; on the right the full head camera, uncropped and undimmed (640×480), with the region boxed in a dashed
white line labelled "Enlarged region". The chip, box and label are a transparent PNG rendered in
JetBrains Mono and overlaid with ffmpeg. Region in source pixels `x,y,w,h`:

- standard-1 (R2, R5): `20,100,320,240`, the upright small bottle beside the bin
- standard-4 (R8, R9): `300,20,320,240`, the white bottle at the far edge of the table
