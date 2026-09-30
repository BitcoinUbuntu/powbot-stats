# PoWBoT Stats

The public face of PoWBoT, live at [powbot.africa](https://powbot.africa): epoch stats,
leaderboards and a submission tracker, plus the CBAF member directory with profiles,
merchant pages and donation panels.

It is plain static HTML, CSS and JavaScript. There is no build step and nothing to install.
Live figures are fetched from the project's API every few minutes; the copy of the data
committed here is the fallback and the record for finished epochs.

## What is on the site

| Page | What it shows |
|---|---|
| `index.html` | The live epoch: countries, latest posts, project and merchant standings, highlights |
| `tracker.html` | Every submission, filterable by epoch, project, country, merchant and status |
| `members.html`, `merchants.html` | The Directory: projects and merchants |
| `profile.html`, `merchant-profile.html` | A project's or merchant's page |
| `profile-edit.html` | Sign-in and self-service editing for project leaders |
| `archive.html`, `epoch5.html` | Finished epochs |
| `about.html`, `guidelines.html`, `disclaimer.html` | Background and rules |

The design is a two-tone Nokia 3310 screen: light by default, dark on request. Fonts are
self-hosted (`fonts/`), so the site makes no external font requests.

## Folder map

| Path | Holds |
|---|---|
| `css/powbot.css` | The design system: every token and shared component |
| `includes/` | The shared nav and footer and the script that injects them (see its README) |
| `images/` | Site images; `images/members/` holds each project's logo and gallery (WebP only) and `images/flags/` the flag SVGs |
| `scripts/` | Data maintenance scripts (see its README) |
| `*.js` at the root | Page logic: data loading, tracker, visits, flags, globe, donations, profile editor |
| `*.json` at the root | Data: the live epoch, frozen epochs, members and the merchant indexes |
| `serve.py` | A local test server |

## Running it locally

```bash
python serve.py
```

Then open <http://localhost:8080>. Always browse through the server; opening a file directly
skips the CSS and JavaScript that pages load. The server sends no-cache headers, so a normal
reload shows your latest edit. Profile sign-in only works against the live API.

## Working on it

- **Never push to `main`.** It deploys to the live site within a couple of minutes. Work on a
  branch and open a pull request.
- **Never show payment amounts.** The site shows counts (posts, projects, merchants,
  countries, payment counts) and nothing about value. Keep amounts out of commits as well.
- **Keep the data shapes.** The JSON schemas and the code that reads them change only on
  purpose.
- **Quality floor:** works at 320px with no sideways scroll, 44px touch targets, visible
  focus, AA contrast in both themes, and respects reduced motion.

An automated job commits fresh stats to `main` twice a day, so pull with rebase before
merging `main` into a branch.

## Credits

Built and maintained by [Bitcoin Ubuntu](https://bitcoinubuntu.org), part of the CBAF
(Circular Bitcoin Africa Fund) initiative powered by PoWBoT.
