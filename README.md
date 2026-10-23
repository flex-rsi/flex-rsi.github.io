# flex-rsi.github.io

Project page of **Flex-RSI: Benchmarking Recursive Self-Improvement of Frontier Agents**,
served at https://flex-rsi.github.io.

Plain static site, no build step:

- `index.html`: home (hero, the "At a glance" band of demo tiles, overview numbers, tracks, citation)
- `leaderboard.html`, `demos.html`, `people.html`, `contribute.html`: one page each; the nav and footer are
  repeated in every page, so a change to either goes into all five
- `assets/style.css`: layout, components and motion
- `assets/theme.css`: the Swiss Grid look (hard rules, heavy type)
- `assets/palette.css`: the colours (E3 Klein Blue)
- `assets/pages.css`: the page links in the nav, and what only one page has (home numbers, people, the call)
- `assets/main.js`: scroll reveal, nav, hero chart, copy button
- `assets/home.js`: the home page's track index, numbers and track tasks, from `data/results.json`
- `assets/results.js`, `assets/results.css`: the leaderboard (tabs, overview, tables, curves); `#results/<category>/<task>` links a view
- `data/results.json`: the results, generated from the benchmark's run records
- `assets/reel.css`, `assets/reel.js`, `assets/reel/`: the "At a glance" band on the home page (two rows of tiles
  drifting in opposite directions, each linking to `demos.html#<task>`)
- `assets/demos.js`, `assets/demos.css`, `data/demos.json`, `assets/demo/`: the demos page
  (starting vs self-improved solution on held-out cases: replays, question cards, clips); `demos.html#<task>` opens a task

## Results data

`data/results.json` lists `categories` (id, name, one-line description) and `tasks`. Each task names
its `category`, its `primary` metric and the `metrics` to show, and has one row per model: the test
metrics, the starting and best validation score, the gain in percent, the rounds run and why the
run ended, and the best validation score after each round. The page builds every view from this
file: categories without tasks are not shown, and a new task or category needs no change to the page.

Preview locally with `python3 -m http.server` in this directory.

Abstract, authors and links are still placeholders.
