# The Hook-Up Game

An interactive, illustrated classroom tool that helps young adults explore how their
choices affect their odds of contracting an STI over a year — then "rolls the dice" to
show a possible outcome. Built for sexual-health education.

Students choose their anatomy and their partners' anatomy, a partner type
(relationship / friend / acquaintance / stranger) and how many partners, whether they
use condoms, and whether they've had the HPV vaccine. The app estimates the per-STI and
overall risk, lets students tweak one variable at a time to see how risk moves, and
shows which STI(s) — if any — they contracted.

## Run it

It's a static site — no build step or dependencies.

- **Quickest:** open `index.html` in a browser.
- **Recommended (for correct relative paths):** serve the folder, e.g.
  ```bash
  python3 -m http.server 5050
  ```
  then visit http://localhost:5050

## How the math works

All statistics, transmission rates, condom and HPV-vaccine effects, equations, and a
full list of cited sources are documented on the in-app **About & sources** page
([`about.html`](about.html)) so educators can review the methodology before adopting it.

Every parameter lives in one readable, editable file: [`riskModel.js`](riskModel.js).

## Files

| File | Purpose |
|------|---------|
| `index.html` | The app UI and flow |
| `styles.css` | Styling (palette, layout) |
| `app.js` | UI logic, dice roll, live "what-if" controls |
| `riskModel.js` | The risk engine — all parameters and equations |
| `about.html` / `about.css` | Methodology and full sourced reference list |
| `img/` | Bespoke illustrations |
| `Hook-Up Game — Art Direction & ChatGPT Image Prompts.docx` | Art-direction guide + methodology appendix |

## Disclaimer

This is an **educational model** using simplified, population-level estimates calibrated
to CDC/NHANES data. It cannot predict any real individual's risk and is **not medical
advice**. Real risk depends on testing, treatment, local prevalence, vaccination, partner
history, and many factors not captured here.

## License / use

Free to use and adapt for non-commercial educational purposes.
