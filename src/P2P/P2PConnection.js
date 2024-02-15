import Peer from "simple-peer";

let ws = new WebSocket("ws://localhost:8080");

ws.onopen = function () {
  console.log("Connected to the signaling server");
};

ws.onmessage = function (message) {
  console.log("Received signaling data", message.data);
};

function broadcastSignal(data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  } else {
    console.error("WebSocket connection is not open");
  }
}

export const createPeer = (isInitiator, onSignal, onPeerData) => {
  const peer = new Peer({
    initiator: isInitiator,
    trickle: false,
  });

  peer.on("signal", (data) => {
    broadcastSignal(data);
  });

  peer.on("data", (data) => {
    onPeerData(JSON.parse(data));
  });

  ws.onmessage = function (message) {
    const data = JSON.parse(message.data);
    if (data.signal && peer) {
      peer.signal(data.signal);
    }
  };

  const handleKeyPress = (event) => {
    let direction;
    switch (event.key) {
      case "w":
        direction = "forward";
        break;
      case "a":
        direction = "left";
        break;
      case "s":
        direction = "backward";
        break;
      case "d":
        direction = "right";
        break;
      default:
        return;
    }
    const action = { type: "MOVE_PLAYER", payload: { direction } };
    peer.send(JSON.stringify(action));
  };

  window.addEventListener("keydown", handleKeyPress);

  return () => window.removeEventListener("keydown", handleKeyPress);
};
