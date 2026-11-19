# The Price of Unity, game console

This is the console for The Price of Unity, a three-hour classroom simulation for the Immersive Software Engineering programme at the University of Limerick. The Simulator desk runs it on the shared screen while eight teams take Ireland from a unity vote through the first 25 years after unity.

The console is live at https://stephenkinsella.net/unity-game/.

Every figure comes from the United Ireland fiscal model, version 3.14, the same model behind the simulator at stephenkinsella.net/unity. The figures are illustrative scenarios in constant 2023 euros, not forecasts.

## What the console does

| Tab | Purpose |
|---|---|
| Setup | Team sizes for 30, 33 or 36 students, the hidden harmonisation case, and saving or loading a game |
| Act One | The prospectus, the cost range for the hearing, campaign cards, the two polls and the negotiated terms |
| Act Two | Three turns with a timer, growth plans, boycotts, broken promises, event cards and the support meter |
| Scoreboard | The Act One record, the Act Two scoreboard and team points |
| Change log | Every setting change with its time, for the Simulator desk to trace back to a decision sheet |
| Debrief | A one-at-a-time sensitivity test on year 25 debt and the final 25-year path |

The page keeps the game in the browser as it goes. Export the game file at the break and at the end.

## The room screen

The button at the top opens a second window for the projector. It shows the turn, the clock, the charts, the event card and the scoreboard in large type, with no controls. It follows the desk window on the same laptop as each change is made, with no server.

## The live vote

The Live vote tab shows a QR code that students scan to vote on their phones. They choose Northern Ireland or Southern Ireland, answer the question "Do you support reunification?", and the results appear as bars on the console and the room screen.

Votes travel through ntfy.sh, a free public message relay that needs no accounts. Each vote gets its own random code, and the page counts only the latest vote from each phone.

## The range across the four cases

Nobody in the room knows which harmonisation case is true. In Act One the Fiscal Council's costing includes a shaded band for total debt across all four cases, on both deals.

In Turn 1 the same band shows on the Act Two charts until the model is first run. It disappears once figures from the hidden case are on screen, so it cannot give the case away.

## What is model and what is game

The model decides the costs, the debt path and the three fiscal checks. The design, the deal with the UK, the harmonisation case, Northern Ireland growth and the EU budget line all feed the model directly.

The growth bands above 2%, the support meter, the boycott rule and the event cards are classroom rules. The year of unity and the choice to hold the deficit share steady until unity are recorded but do not change the figures, because the public model has no setting for them.

The game adds one setting to the engine, an EU transfer of a chosen amount each year, from a chosen first year, for a chosen number of years. It cuts that year's cost before borrowing, so interest and debt follow from it. It is zero by default and is a classroom setting, not an estimate of what the EU would pay.

The model's benefit channels for a UK payment, EU funding, trade, investment and integration are left out. They need sourced sizes before they can be used.

## Feedback and student changes

The Feedback tab shows QR codes for two GitHub forms, one for feedback on the session and one to suggest a change to the game. Students can also copy the repository and send their own pull request, following CONTRIBUTING.md.

When Stephen adds the label build-this to a change request, Claude builds it on a new branch and comments on the issue. This needs the Claude GitHub App and an ANTHROPIC_API_KEY secret, and stays switched off until both are in place. Only people with write access can trigger it, so student requests cost nothing until Stephen approves them.

Every change runs the same checks. They confirm the model numbers, check the model files are unchanged, check the offline copy and play a short game in a hidden browser.

## Keeping the engine honest

engine.js is copied from the book repository, with the EU transfer as its only addition. The page checks it against all 96 published numbers in paper version 3.14 each time it opens, and the same check runs on every push.

To update the engine, copy the new engine.js and the published values from the book repository, then run this.

```
node tests/check_engine.mjs
```

## Using it without Wi-Fi

offline/price_of_unity_offline.html is the whole console in one file, fonts included. Copy it to a USB stick and open it in any browser, and the room screen works from it too.

Rebuild it after changing any page file with `python3 build_offline.py`. The check on every push fails if the offline copy is out of date.

## Running it locally

Any static web server works, for example `python3 -m http.server`. There is no build step and no server code.

Fonts are Newsreader, Public Sans and IBM Plex Mono under the SIL Open Font Licence, with licence files in the fonts folder.
