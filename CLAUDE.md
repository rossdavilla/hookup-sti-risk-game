# The Hook-Up Game (`hookup-sti-risk-game`)

A classroom sexual-health tool for **PSY175**: model a year of choices (partners, partner type,
condoms, HPV vaccination), see the estimated STI odds, then roll the dice for an outcome.
Live at <https://rossdavilla.github.io/hookup-sti-risk-game/>.

## ⚠️ This repo publishes from `ClassroomApps`, not `main`

There is no `main` branch. GitHub Pages serves the repository root of the **`ClassroomApps`**
branch, so that is the branch to commit to and push, and a push to it is the deploy.

## Layout

```
index.html      the app UI and flow
app.js          UI logic, dice roll, live "what-if" controls
riskModel.js    the risk engine — every parameter and equation
styles.css      palette and layout
about.html      methodology and the full sourced reference list
about.css
tophat.html     the 720 × 450 Top Hat embed — a separate copy, so a change to
                the game has to be made here too
img/            bespoke illustrations
Hook-Up Game — Art Direction & ChatGPT Image Prompts.docx
.nojekyll
```

Static site: no build step, no dependencies. Serve it rather than opening `index.html` from disk,
so the relative paths resolve: `python3 -m http.server 5050`.

## The rule that matters

**Every number lives in `riskModel.js`, and every number is cited in `about.html`.** The app's
credibility with other educators rests on that pairing — the About page exists so they can audit
the methodology before adopting it.

So: do not change a transmission rate, condom effectiveness, vaccine effect or prevalence figure
in `riskModel.js` without updating the corresponding entry and source in `about.html` in the same
change. And do not invent a parameter — if a new one is needed and there is no source for it, say
so and ask Ross rather than picking a plausible-looking value.

Keep the framing the README and the app already use: a simplified population-level model
calibrated to CDC/NHANES data, for education, not medical advice and not a prediction about any
individual.

## Publishing

Push `ClassroomApps`. Already listed in `data/sites.json` in the
[`rossdavilla.github.io`](https://github.com/rossdavilla/rossdavilla.github.io) repo under the
`PSY175` tag.
