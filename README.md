# flex-rsi.github.io

Project page of **Flex-RSI: Benchmarking Recursive Self-Improvement of Frontier Agents**,
served at https://flex-rsi.github.io.

Plain static site, no build step:

- `index.html`: the page
- `assets/style.css`: layout, components and motion
- `assets/theme.css`: the Swiss Grid look (hard rules, heavy type)
- `assets/palette.css`: the Espresso colours (dark brown ground, ochre accent)
- `assets/main.js`: scroll reveal, navigation state, copy button
- `assets/results.js`, `assets/results.css`: the results section (tabs, leaderboards, curves)
- `data/results.json`: the results, generated from the benchmark's run records
- `assets/reel.css`, `assets/reel.js`, `assets/reel/`: the task reel under the hero (short looping clips, one per tile)
- `assets/demos.js`, `assets/demos.css`, `data/demos.json`, `assets/demo/`: the demos section
  (starting vs self-improved solution on held-out cases: replays, question cards, clips)

## Results data

`data/results.json` lists `categories` (id, name, one-line description) and `tasks`. Each task names
its `category`, its `primary` metric and the `metrics` to show, and has one row per model: the test
metrics, the starting and best validation score, the gain in percent, the rounds run and why the
run ended, and the best validation score after each round. The page builds every view from this
file: categories without tasks are not shown, and a new task or category needs no change to the page.

Preview locally with `python3 -m http.server` in this directory.

Abstract, authors and links are still placeholders.
