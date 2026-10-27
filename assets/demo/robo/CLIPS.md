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

## Candidate clips (2026-10-09, from the video-candidates shortlist)

All 8 s, h264, posters at 7.5 s. Source paths are in `video-candidates.html`.

- Arrange Largest Number, Claude Opus 5.5, standard-4 (no marks given; 9–17 s in both, where the runs diverge)
  - `opus-arrange-r9-standard4-t09-17.mp4`, R9 fail: picks up the 6 but sets it down beside the row; ends 9_410 with the 6 off the slots.
  - `opus-arrange-r10-standard4-t09-17.mp4`, R10 success: places the 6 in slot two; ends 96410.
- Insert Tubes, Claude Opus 5.5, standard-12
  - `opus-tubes-r5-standard12-t09.9-17.9.mp4`, R5 fail: from the in-mark 10.9 s, starting 1 s early; the third tube goes in tilted and ends lying across the rack.
  - `opus-tubes-r7-standard12-t07.6-15.6.mp4`, R7 success: the last 8 s (out-mark 8 s, extended to the end so it shows the same third-tube insertion), all three upright.
- Open Cabinet, GPT-6 Astra, L31S58-3002, agentview left (16 s at 2× → 8 s)
  - `astra-cabinet-r4-L31S58-t24-40-2x.mp4`, R4 fail: from 24 s to the 40 s out-mark; the gripper keeps reaching for the handles and the door stays closed.
  - `astra-cabinet-r7-L31S58-t19-35-2x.mp4`, R7 success: up to the 40 s mark, clamped to the clip's 35.25 s end; the door swings open.

## Composite RoboCasa tasks (2026-10-27)

Three of the hardest RoboCasa tasks: each chains several steps, and across the models on the
leaderboard the mean test success is 0.08 (Kettle Boiling), 0.12 (Coffee Setup Mug) and 0.10
(Portion Hot Dogs). Each pair is one test episode: before is the run's starting policy (its
posthoc test of round 0, a failure) and after is the run's final policy on the final test (a success).
Agentview left, 512×512, 8 s at 25 fps, posters at 7.5 s; the page crops them to `view`.

- Kettle Boiling, Claude Opus 5.5, L2S2-2001 (16 s at 2× → 8 s)
  - `opus-kettle-r0-L2S2-t20.75-36.75-2x.mp4`, R0 fail: the kettle is on a burner but the burner never comes on; up to the episode's end (36.75 s).
  - `opus-kettle-r2-L2S2-t13.15-29.15-2x.mp4`, R2 success: the kettle goes onto the front burner and the knob turns it on; up to the episode's end (29.15 s).
- Coffee Setup Mug, GPT-6.1 Sol, L1S1-2000 (real time)
  - `sol-mug-r0-L1S1-t04-12.mp4`, R0 fail: the gripper knocks the mug over.
  - `sol-mug-r3-L1S1-t03.5-11.5.mp4`, R3 success: the mug is picked up and set on the drip tray; up to the episode's end (11.5 s).
- Portion Hot Dogs, GPT-6 Astra, L9S9-2004 (32 s at 4× → 8 s)
  - `astra-hotdogs-r0-L9S9-t05.8-37.8-4x.mp4`, R0 fail: the arm pokes at the food and tips the bowl; up to the episode's end (37.8 s).
  - `astra-hotdogs-r1-L9S9-t61.9-93.9-4x.mp4`, R1 success: the last sausage goes to the second plate; up to the episode's end (93.9 s).

At a glance tiles (`assets/reel/`, 480×360, 24 fps, 8 s): `robot-kettle` is the R2 kettle clip cropped
to its view, `robot-mug` the R3 mug clip cropped to 384×288 at (128, 120), and `robot-hotdogs` the
R1 episode from 45.9 s to its end at 6×, so both plates fill up.
