# Gather Village

<h2 align="center"><a href="https://gather-village.vercel.app/">Click here to try it out!</a></h3>
<img src="https://github.com/Andrew32A/gather-village/blob/main/resources/public/images/screenshot1.png" align="center">

## Commands to run project locally:

### Start websockets server

Make sure to change the websocket url in `src/Components/GameScene.js` to `ws://localhost:8080`:

```javascript
wsRef.current = new WebSocket("ws://localhost:8080");
```

Then run with:

```bash
node src/Server/server.js
```

### Start client:

```bash
npm run start
```
