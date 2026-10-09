# Selected Opus 5.5 clips

All four clips use the head camera. Source files are the full validation rollouts from `rsi_viz/robodojo-throw-bottles-into-dustbin/opus55-validation-choices/videos/`; each exported clip is exactly 8 seconds.

- `opus-r2-standard1-t12-20.mp4`: R2, standard-1, source 12–20 s. The gripper fails to secure the upright small bottle.
- `opus-r5-standard1-t04-12.mp4`: R5, standard-1, source 4–12 s. The upright small bottle is picked up successfully.
- `opus-r8-standard4-t04-12.mp4`: R8, standard-4, source 4–12 s. The bottle is knocked off the table and falls below it.
- `opus-r9-standard4-t04-12.mp4`: R9, standard-4, source 4–12 s. The arm approaches higher; the bottle tips on contact but remains on the tabletop, unlike R8.

Each poster is sampled 7.5 seconds into its selected clip to show the outcome.

## On the page

The page plays the clips above unchanged. `assets/demos.js` boxes the decisive region on the head camera
and draws that region, enlarged, into a canvas beside it from the same video on every frame; the region
is `region` (`x,y,w,h` in 640×480 pixels) on each comparison in `data/demos.json`:

- standard-1 (R2, R5): `50,140,224,168`, the upright small bottle beside the bin
- standard-4 (R8, R9): `390,50,224,168`, the white bottle at the far edge of the table
