# Patra

Merge, split and rotate PDFs privately.

**Live:** https://patra.avlokai.com

**For:** Anyone assembling documents for an application, office paperwork or a scanned set of pages.

## What it does

- Merge PDFs and JPG or PNG photos into one PDF, in any order
- Photos fitted onto A4 pages, or kept at native size
- Keep or delete pages with ranges like 1-3, 5, 8-
- Rotate selected pages left or right
- Split a PDF into files of N pages

Built on pdf-lib (MIT), vendored. Files never leave the browser.

## Privacy

Everything runs in your browser. There is no backend, no analytics and no account. Nothing you enter is uploaded.

## Run locally

No build step and no runtime dependencies. Serve the folder with any static server:

```
npx serve .
```

## Tests

The logic lives in `lib.js` as pure functions, tested with the Node test runner (Node 20+):

```
npm test
```

## Files

- `index.html` page and styles
- `app.js` wiring between the page and the logic
- `lib.js` pure logic, no DOM
- `lib.test.js` tests
- `base.css`, `ui.js` shared look and small DOM helpers

## Licence

MIT. Made by [Sushanth Kasturi](https://sushanth.avlokai.com).
