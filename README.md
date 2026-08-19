# Padel Ladder

A mobile-first league website powered by the public Google Sheet.

## Included

- Weekly boxes with court and match times
- Player search and profiles
- UP, STAY, and DOWN movement animation
- Downloadable and shareable player cards
- Automatic next-week box projections
- Player history and season statistics
- Player comparison with shared box sessions

The site reads the sheet during the build. It does not write to the sheet or make runtime requests. Rebuild and redeploy after each weekly update.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verify

```bash
npm test
npm run build
```
