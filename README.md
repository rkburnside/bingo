# bingo

A multiplayer bingo game you can play from your phone. One person creates a room, friends join with a room code, everyone gets their own card, and players take turns drawing random balls in real time.

## Run locally

```
npm install
npm start
```

Open `http://localhost:3000` (or your machine's LAN IP so phones on the same Wi-Fi can join).

## Deploy to Render

This repo includes a `render.yaml` blueprint.

1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. In the [Render dashboard](https://dashboard.render.com), click **New +** → **Blueprint**, and connect this repository.
3. Render detects `render.yaml` and creates a free web service that runs `npm install` then `npm start`.
4. Once deployed, Render gives you a public URL (e.g. `https://bingo-xxxx.onrender.com`) — share that with friends to play from their phones.
5. Every push to the connected branch auto-deploys.

## Deploy to Railway

This repo includes a `railway.json` config.

1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. In the [Railway dashboard](https://railway.app/dashboard), click **New Project** → **Deploy from GitHub repo**, and select this repository.
3. Railway reads `railway.json` and builds/runs the app with Nixpacks (`npm install` then `npm start`) — no extra configuration needed.
4. Go to the service's **Settings → Networking** and click **Generate Domain** to get a public URL (e.g. `https://bingo-production-xxxx.up.railway.app`) — share that with friends to play from their phones.
5. Every push to the connected branch auto-deploys.
