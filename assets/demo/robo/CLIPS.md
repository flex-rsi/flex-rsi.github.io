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

## More RoboDojo examples (2026-10-27)

Head camera (`cam_head`), 640×480, 8 s at 25 fps, h264 crf 23; a clip shorter than 8 s after speed-up holds its last frame. Posters at 7.5 s, except the Muse R6 clip (6.5 s, where the arm does not cover the board) and the Gemini push-T R6 clip (7.92 s, after the arm leaves the block). Before is the run's earlier version on that episode (its posthoc test, or validation where noted), after is the final test of the run's final version unless noted. Where the two sides play at different speeds, each side carries its own `speed`.

- Pick From Conveyor By Image, GPT-6.1 Sol, standard-5 (test)
  - `sol-conveyor-r0-standard5-t00-11.2-2x.mp4`, R0 fail (0): source 0–11.2 s, 2×. The right arm knocks the basket away, and the left gripper closes beside the objects without lifting any of them.
  - `sol-conveyor-r6-standard5-t2.4-18.4-2x.mp4`, R6 success (100): source 2.4–18.4 s, 2×. One arm lifts the basket and holds it over the conveyor while the other picks the object shown on the board and drops it in.
- Play Tic-Tac-Toe, GPT-6 Astra, standard-5 (test)
  - `astra-tictactoe-r1-standard5-t00-7.4.mp4`, R1 fail (10): source 0–7.4 s, real time. It sets one ring on the board and then stops, so the opponent never gets a turn.
  - `astra-tictactoe-r8-standard5-t5.44-37.44-4x.mp4`, R8 success (100): source 5.44–37.44 s, 4×. It takes turns with the opponent arm and places all five of its rings until the board is full.
- Play Tic-Tac-Toe, Muse Wonder 1.0, standard-5 (test)
  - `muse-tictactoe-r1-standard5-t00-27.28-4x.mp4`, R1 partial (75): source 0–27.28 s, 4×. It drops its five rings one after another without pausing, so the opponent never places an X and the board is never filled.
  - `muse-tictactoe-r6-standard5-t8.36-40.36-4x.mp4`, R6 success (100): source 8.36–40.36 s, 4×. After each ring both arms go back to their start pose, the opponent places an X, and play continues until the board is full.
- Sort Nesting Dolls By Size, GPT-6.1 Sol, random-4 (test)
  - `sol-dolls-r0-random4-t00-15.8-2x.mp4`, R0 fail (0): source 0–15.8 s, 2×. The arms sweep across the table and knock the dolls about; none of them end up in a row.
  - `sol-dolls-r9-random4-t7.88-39.88-4x.mp4`, R9 success (100): source 7.88–39.88 s, 4×. It picks the dolls up one at a time and stands them in a straight row, smallest on the left.
- Play Xylophone, DeepSeek-V4.1 Flash 1017, standard-6 (test)
  - `deepseek-xylophone-r3-standard6-t1.1-9.1.mp4`, R3 fail (0): source 1.1–9.1 s, real time. The gripper misses the mallet and pokes at the keys with empty fingers.
  - `deepseek-xylophone-r6-standard6-t3.8-11.8.mp4`, R6 success (100): source 3.8–11.8 s, real time. It picks up the mallet and strikes the keys one after another, from left to right.
- Push T, Gemini 4 Argon, random-4 (test)
  - `argon-pusht-r5-random4-t7.8-23.8-2x.mp4`, R5 fail (0): source 7.8–23.8 s, 2×. After a push near the back of the table the arm stalls, and the episode ends with the block beside the pad, turned away from it.
  - `argon-pusht-r6-random4-t3.92-19.92-2x.mp4`, R6 success (100): source 3.92–19.92 s, 2×. It nudges the block in short pushes until it covers the gray pad exactly.
- Fill Egg Holder, Claude Opus 5.5, standard-4 (validation, rounds 0 and 3)
  - `opus-egg-r0-standard4-t0.44-16.44-2x.mp4`, R0 fail (0): source 0.44–16.44 s, 2×. The gripper pokes around in the basket and never lifts an egg.
  - `opus-egg-r3-standard4-t00-28.04-4x.mp4`, R3 partial (90): source 0–28.04 s, 4×. It moves all four eggs into the holder, standing upright; the lid stays open, which costs the last 10 points.

## More RoboCasa examples (2026-10-27)

Four more models and tasks. Each pair is one test episode: before is the run's starting policy (its
posthoc test of round 0, a failure) and after is the run's final policy on the final test (a success).
512×512, 8 s at 25 fps, h264 crf 23, posters at 7.5 s; the page crops them to `view`. A source shorter
than 8 s after the speed change is held on its last frame to 8 s.

- Open Drawer, Claude Opus 5.5, L1S1-2000, agentview left (16 s at 2× → 8 s)
  - `opus-drawer-r0-L1S1-t21.5-37.5-2x.mp4`, R0 fail: the gripper hovers by the drawer front and the drawer stays shut; up to the episode's end (37.5 s).
  - `opus-drawer-r1-L1S1-t02.7-18.7-2x.mp4`, R1 success: the hand closes on the handle and pulls the drawer open; up to the episode's end (18.7 s).
- Turn On Microwave, Qwen3.8-Flash-Next, L5S5-2004, agentview right (real time)
  - `qwen-microwave-r0-L5S5-t00-08.mp4`, R0 fail: the arm reaches past the control panel into empty space (episode runs to its 22.5 s step limit).
  - `qwen-microwave-r5-L5S5-t00-07.75.mp4`, R5 success: the base turns to the panel and the fingertip presses start; the whole episode (7.75 s), last frame held 0.25 s.
- Turn On Sink Faucet, GLM-5.3 Flash, L3S3-2002, agentview left (played at 0.5×)
  - `glm-faucet-r0-L3S3-t00-02.35-0.5x.mp4`, R0 fail: the arm does not move before the time limit ends the episode (2.35 s of video, 46 steps); held on its last frame.
  - `glm-faucet-r10-L3S3-t00-03.75-0.5x.mp4`, R10 success: the hand takes the lever and lifts it; the whole episode (3.75 s → 7.5 s), last frame held 0.5 s.
- Turn Off Stove, GPT-6 Astra, L2S2-2001, agentview left (16 s at 2× → 8 s)
  - `astra-stove-r0-L2S2-t00-16-2x.mp4`, R0 fail: it turns the wrong knobs and two more burners light up.
  - `astra-stove-r10-L2S2-t16.1-32.1-2x.mp4`, R10 success: it turns the rear center knob off; up to the episode's end (32.1 s). The episode ends on the step the knob reads off, so the burner's glow is still drawn in the last frame.
