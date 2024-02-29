# Gather Village

A multiplayer YouTube first-person view website built with Three.js, Blender, React, and Websockets! Users can get together and watch YouTube videos in a virtual world. The project is hosted on Vercel and the websocket server is hosted on Heroku.

<h2 align="center"><a href="https://gather-village.vercel.app/">Click here to try it out!</a></h3>
<img src="https://github.com/Andrew32A/gather-village/blob/main/public/images/screenshot1.png?raw=true" align="center">

## Controls

- WASD to move
- Mouse to look around
- Q to toggle menu for changing youtube videos

## Commands to run project locally

### Install dependencies

```bash
npm install
```

### Start websocket server

Make sure to change the websocket url in `src/Components/GameScene.js` to `ws://localhost:8080`:

```javascript
wsRef.current = new WebSocket("ws://localhost:8080");
```

Then run with:

```bash
node src/Server/server.js
```

### Start client

```bash
npm run start
```
