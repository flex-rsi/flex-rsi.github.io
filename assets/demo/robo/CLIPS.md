# Selected Opus 5.5 clips

All four clips use the head camera. Source files are the full validation rollouts from `rsi_viz/robodojo-throw-bottles-into-dustbin/opus55-validation-choices/videos/`; each exported clip is exactly 8 seconds.

- `opus-r2-standard1-t12-20.mp4`: R2, standard-1, source 12–20 s. The gripper fails to secure the upright small bottle.
- `opus-r5-standard1-t04-12.mp4`: R5, standard-1, source 4–12 s. The upright small bottle is picked up successfully.
- `opus-r8-standard4-t04-12.mp4`: R8, standard-4, source 4–12 s. The bottle is knocked off the table and falls below it.
- `opus-r9-standard4-t04-12.mp4`: R9, standard-4, source 4–12 s. The arm approaches higher; the bottle tips on contact but remains on the tabletop, unlike R8.

Each poster is sampled 7.5 seconds into its selected clip to show the outcome.

## Zoom composites (what the page plays)

`zoom-<clip>.mp4` / `.jpg` are built from the clips above with ffmpeg: the head camera (576×432) with
the decisive region boxed in Klein blue, next to that region enlarged 2× (576×432), joined by a 6 px
dark gap (1158×432). Region in source pixels (640×480), `x,y,w,h`:

- standard-1 (R2, R5): `20,100,320,240`, the upright small bottle beside the bin
- standard-4 (R8, R9): `320,20,320,240`, the white bottle at the far edge of the table
