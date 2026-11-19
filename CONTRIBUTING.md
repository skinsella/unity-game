# How to change the game

You can change The Price of Unity in two ways. Both need a free GitHub account.

## Option 1, suggest a change in plain words

1. Go to the Issues tab of this repository and click New issue.
2. Choose Change the game and fill in the form.
3. Stephen reads every request. If he approves it, he adds the label build-this.
4. Claude then builds the change on a new branch and comments on your issue with what it did.
5. The automatic checks test the change, and Stephen decides whether to merge it.

To leave feedback on a session, choose Feedback on the session.

## Option 2, change the code yourself

1. Click Fork at the top of this page to make your own copy.
2. Make your change in your copy. The table below shows which file does what.
3. Run the checks, described below.
4. Open a pull request back to this repository and say what you changed and why.

| File | What it does |
|---|---|
| index.html | The layout of the console and the room screen |
| game.js | The rules of play, turns, cards, support meter, scoreboard and change log |
| livevote.js and vote.html | The QR code vote |
| style.css | Colours, fonts and layout |
| engine.js | The economics model. Do not change it |
| paper_values.js | The published numbers the model must reproduce. Do not change it |

## Running the checks

You need Node and Python on your computer.

```
node tests/check_engine.mjs
python3 build_offline.py
python3 build_offline.py --check
pip install playwright
python3 -m playwright install chromium
python3 tests/smoke.py
```

The first check confirms the model still gives all 96 published numbers. The offline build keeps the single-file copy in step with the page. The smoke test plays a short game in a hidden browser and fails if anything breaks.

If you change index.html, game.js, livevote.js, vote.html or style.css, also update the ?v= number on the script and style tags in index.html and vote.html. Use the current date and time, written as YYYYMMDDHHMM.

## The rules for every change

The economics model stays as it is, because it comes from published research. Change how the game is played, not the numbers the model produces.

Write in plain words that a 15-year-old could read. Do not use em dashes, semicolons or colons in sentences.
