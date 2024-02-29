import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  CSS3DRenderer,
  CSS3DObject,
} from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import Peer from "simple-peer";

const GameScene = () => {
  const debugMode = true; // enable/disable debug messages
  const wsRef = useRef(null);
  const mountRef = useRef(null);
  const css3dMountRef = useRef(null);
  const allowRetryRef = useRef(true);

  // const [peers, setPeers] = useState({});
  const selfPeerIdRef = useRef(null); // TODO: testing some things out, may need to remove
  const otherPlayers = useRef({});
  const lastPositionSentRef = useRef({ x: 0, y: 0, z: 0 });
  const updatePositionTickRate = 30; // in milliseconds
  let positionIntervalRef = useRef(null);
  let isPlayerAbleToMove = useRef(true);
  let isPlayerStopped = useRef(null);

  const videoMenuVisibilityRef = useRef(false);
  const youtubeWallRef = useRef(null);
  let videoIdRef = useRef(null); // store video id so when a new player joins, everyone hands them new video

  // youtube wall global position and rotation
  const youtubeWallX = -100; // left/right of user
  const youtubeWallY = 450; // up/down of user
  const youtubeWallZ = -450; // front/back of user
  const youtubeWallRY = 0; // rotation of wall, 0 is facing user, 55 is 90 degrees clockwise
  const youtubeWallRX = 0.5; // rotation of wall, points down
  const youtubeWallRZ = 0; // rotation of wall

  // update video in the scene
  const updateVideo = (videoId) => {
    console.log("||RECEIVED|| video ID, updating YouTube video:", videoId);
    // css3dScene.remove(youtubeWallRef.current); // apparently i dont need this... AND IT WORKS NOW! WOOOOOOOOOOOO!!!!! you have no idea the pain and tears this caused me
    css3dScene.add(
      createYouTubeWall(
        videoId,
        youtubeWallX,
        youtubeWallY,
        youtubeWallZ,
        youtubeWallRY,
        youtubeWallRX,
        youtubeWallRZ
      )
    );
  };

  // toggle video menu for youtube url input, needed to use a useRef instead of useState so the youtube wall wouldn't reset. i know this is against react, but it works for now
  const toggleVideoMenu = () => {
    videoMenuVisibilityRef.current = !videoMenuVisibilityRef.current;
    const menuElement = document.getElementById("video-menu");

    if (menuElement) {
      menuElement.style.display = videoMenuVisibilityRef.current
        ? "block"
        : "none";
    }
  };

  // init YouTube wall
  const createYouTubeWall = (id, x, y, z, ry, rx, rz) => {
    let div, iframe;
    if (youtubeWallRef.current) {
      iframe = youtubeWallRef.current.element.querySelector("iframe");
      iframe.id = "youtube-iframe";
      iframe.src = `https://www.youtube.com/embed/${id}?rel=0&autoplay=1&mute=1`;
    } else {
      div = document.createElement("div");
      div.style.width = "800px";
      div.style.height = "650px";
      iframe = document.createElement("iframe");
      iframe.style.width = "840px";
      iframe.style.height = "650px";
      iframe.style.border = "0px";
      iframe.src = `https://www.youtube.com/embed/${id}?rel=0&autoplay=1&mute=1`;
      div.appendChild(iframe);

      let object = new CSS3DObject(div);
      object.position.set(x, y, z);
      object.rotation.y = ry;
      object.rotation.x = rx;
      object.rotation.z = rz;

      youtubeWallRef.current = object;
      return object;
    }
  };

  const css3dScene = new THREE.Scene();
  css3dScene.add(
    createYouTubeWall(
      "LDU_Txk06tM",
      youtubeWallX,
      youtubeWallY,
      youtubeWallZ,
      youtubeWallRY,
      youtubeWallRX,
      youtubeWallRZ
    )
  );

  useEffect(() => {
    wsRef.current = new WebSocket("wss://gather-village.onrender.com"); // local: ws://localhost:8080
    wsRef.current.onopen = () => {
      console.log("Successfully connected to the signaling server! :D");

      // send the initial position to the server, may need to refactor this later for DRY code
      wsRef.current.send(
        JSON.stringify({
          type: "updatePosition",
          position: { x: 0, y: 2, z: 0 },
        })
      );

      // generate random peer id
      selfPeerIdRef.current = Math.random().toString(36).substring(7);

      if (debugMode) {
        console.log("Generated peer ID:", selfPeerIdRef.current);
      }

      // announce to others by sending new-peer message
      wsRef.current.send(
        JSON.stringify({ type: "new-peer", peerId: selfPeerIdRef.current })
      );
    };
    wsRef.onclose = () => {
      console.log("WebSocket connection closed. Attempting to reconnect...");
      const ws = new WebSocket("wss://gather-village.onrender.com");
      ws.onopen = () => {
        console.log("Successfully reconnected to the signaling server! :D");
        // re-assign the WebSocket reference to the new connection
        wsRef.current = ws;
        // reset reconnection allowance upon successful connection
        allowRetryRef.current = true;
      };
    };
    wsRef.onerror = (error) => {
      console.error("WebSocket encountered an error:", error);
      wsRef.close(); // close the connection on error to trigger the onclose handler
    };

    // handle signaling for peers
    // const handleSignalData = (data) => {
    //   if (data.signal && peers[data.peerId]) {
    //     peers[data.peerId].signal(data.signal);
    //   }
    // };

    // create and manage a new peer connection
    const handleNewPeer = (data) => {
      const peerId = data.peerId;
      // const peer = new Peer({ initiator: false, trickle: false });

      // peer.on("signal", (signal) => {
      //   wsRef.current.send(JSON.stringify({ type: "signal", peerId, signal }));
      // });

      // peer.on("data", (data) => {
      //   const parsedData = JSON.parse(data);
      //   const { type, position } = parsedData;
      //   if (type === "updatePosition" && position) {
      //     updatePlayerPosition(peerId, position);
      //   }
      // });

      // add peer to otherPlayers.current
      otherPlayers.current[peerId] = peerId;
    };

    // handle update player position
    const handleUpdatePosition = (data) => {
      const { peerId, position } = data;
      updatePlayerPosition(peerId, position);
    };

    // main function to handle incoming messages
    const handleMessage = (message) => {
      const handleData = (data) => {
        if (debugMode) {
          console.log("||RECEIVED||:", data);
        }
        // TODO: add pop up message for when a new player joins w/ their name
        switch (data.type) {
          case "signal":
            // handleSignalData(data);
            handleUpdatePosition(data); // display player for initial spawn position

            break;
          case "updateVideo":
            updateVideo(data.videoId);
            break;
          case "new-peer":
            console.log("New peer joined the server:", data);
            broadcastCurrentPlayers();
            handleNewPeer(data);
            // TODO: send the video ID to the new peer, testing to see if this works
            updateVideo(videoIdRef.current);
            break;
          case "updatePosition":
            console.log(otherPlayers.current);
            // if (debugMode) {
            // console.log("||RECEIVED|| position update:", data); // debug, commented out to avoid spam
            // }
            handleUpdatePosition(data);
            break;
          case "current-players":
            const currentPlayers = data.players; // assuming this is an array of player IDs
            currentPlayers.forEach((playerId) => {
              if (!otherPlayers.current[playerId]) {
                // create a new player object and add to otherPlayers.current
                addPlayer(playerId);
              }
            });
            break;
          default:
            console.error("Received unknown data type:", data.type);
        }
      };

      // broadcasting current players
      const broadcastCurrentPlayers = () => {
        const currentPlayers = otherPlayers.current;
        if (debugMode) {
          console.log("Broadcasting current players:", currentPlayers);
        }
        wsRef.current.send(
          JSON.stringify({
            type: "current-players",
            players: currentPlayers,
          })
        );
      };

      const addPlayer = (playerId) => {
        // create a new THREE.js object for new player
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({
          color: Math.random() * 0xffffff,
        });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        // add the new player to otherPlayers.current
        otherPlayers.current[playerId] = mesh;
      };

      // handle beforeunload event to notify the server when the user leaves and removes them from otherPlayers.current
      const handleBeforeUnload = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "peer-left",
              peerId: selfPeerIdRef.current,
            })
          );
        }
      };
      window.addEventListener("beforeunload", handleBeforeUnload);

      const processData = (data) => {
        console.log("Processing data:", data);
        try {
          const parsedData = JSON.parse(data);
          handleData(parsedData);
        } catch (e) {
          console.error("Error parsing message data", e);
        }
      };

      if (message.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => processData(reader.result);
        reader.onerror = (e) => console.error("Error reading Blob data", e);
        reader.readAsText(message.data);
      } else {
        processData(message.data);
      }
    };

    // assign the message handler to the WebSocket reference
    wsRef.current.onmessage = handleMessage;

    const updatePlayerPosition = (peerId, position) => {
      if (!otherPlayers.current[peerId]) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({
          color: Math.random() * 0xffffff,
        });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        otherPlayers.current[peerId] = mesh;
      }

      const playerMesh = otherPlayers.current[peerId];
      playerMesh.position.set(position.x, position.y, position.z);
    };

    const sendPosition = () => {
      if (debugMode) {
        console.log("Calling send position start");
      }
      const currentPosition = controls.getObject().position;
      const lastPosition = lastPositionSentRef.current;

      // round the position to the nearest 0.001th to avoid sending lingering messages after the user stops moving
      const roundedPosition = {
        x: parseFloat(currentPosition.x.toFixed(3)),
        y: parseFloat(currentPosition.y.toFixed(3)),
        z: parseFloat(currentPosition.z.toFixed(3)),
      };

      // check if the position has changed
      if (
        roundedPosition.x !== lastPosition.x ||
        roundedPosition.y !== lastPosition.y ||
        roundedPosition.z !== lastPosition.z
      ) {
        const trySendPosition = () => {
          if (wsRef.current.readyState === WebSocket.OPEN) {
            if (debugMode) {
              console.log("Try send position", currentPosition);
            }
            wsRef.current.send(
              JSON.stringify({
                type: "updatePosition",
                position: currentPosition,
              })
            );
            // update the last sent position
            lastPositionSentRef.current = roundedPosition;
          } else if (allowRetryRef.current) {
            console.log(
              "WebSocket is not open. ReadyState:",
              wsRef.current.readyState,
              ". Retrying in 2 seconds..."
            );
            // prevent further retries until this one completes
            allowRetryRef.current = false;

            // schedule a retry in 2 seconds
            setTimeout(() => {
              allowRetryRef.current = true; // re-enable retries
              trySendPosition(); // attempt to send the position again
            }, 2000);
          }
        };

        trySendPosition();
        if (debugMode) {
          console.log("Sent position at end:", roundedPosition);
        }
      }
    };

    // only set up the interval when movement starts
    const startSendingPosition = () => {
      isPlayerAbleToMove.current = true;
      clearInterval(isPlayerStopped.current); // clear existing interval to avoid duplicates

      // clear existing interval to avoid duplicates
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
      }
      positionIntervalRef.current = setInterval(
        sendPosition,
        updatePositionTickRate
      );
    };

    // stop sending position when there's no movement
    const stopSendingPosition = () => {
      // wait 1 second for smoothness
      isPlayerAbleToMove.current = false;
      if (!isPlayerAbleToMove.current) {
        isPlayerStopped.current = setTimeout(() => {
          if (debugMode) {
            console.log("Stopping position updates");
          }
          clearInterval(positionIntervalRef.current);
          positionIntervalRef.current = null; // clear the reference
          isPlayerAbleToMove.current = true;
        }, 1000);
      }
    };

    // TODO: fix this, it's not working as intended. the position updates are being sent but the other players arn't able to handle this data yet
    // update player position every 2 seconds so those who log in will load other players. could also listen out for new peers and send their position but this felt more consistent
    // const playerPositionPersist = function () {
    //   setInterval(sendPosition, 500);
    // };

    // playerPositionPersist();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.physicallyCorrectLights = true; // for more realistic lighting? i dont know if this is actually doing anything
    mountRef.current.appendChild(renderer.domElement);

    const css3dRenderer = new CSS3DRenderer();
    css3dRenderer.setSize(window.innerWidth, window.innerHeight);
    css3dRenderer.domElement.style.position = "absolute";
    css3dRenderer.domElement.style.top = "0";
    css3dMountRef.current.appendChild(css3dRenderer.domElement);

    const controls = new PointerLockControls(camera, document.body);
    scene.add(controls.getObject());

    document.addEventListener("click", () => controls.lock(), false);

    // adds global lighting, took me way too long to find this out... i was messing around with blender lighting and wonky gltf exports for way too long
    const ambientLight = new THREE.AmbientLight(0xffffff, 5);
    scene.add(ambientLight);

    // directional lighting for shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 5);
    directionalLight.position.set(0, 10, 10);
    directionalLight.castShadow = true; // enable shadow casting for the light
    scene.add(directionalLight);

    // TODO: fix this, shadows and light dont seem to be displaying properly
    const pointLight = new THREE.PointLight(0xffffff, 1, 10);
    pointLight.position.set(0, 10, 10);
    ambientLight.castShadow = true;
    scene.add(pointLight);

    // user player model
    let playerModel = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    scene.add(playerModel);
    playerModel.position.set(0, -1, -5);

    // controls
    let moveForward = false;
    let moveBackward = false;
    let moveLeft = false;
    let moveRight = false;
    let prevTime = performance.now();
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();
    document.addEventListener("click", () => controls.lock(), false);
    document.addEventListener(
      "keydown",
      (event) => {
        startSendingPosition();
        switch (event.code) {
          case "KeyW":
            moveForward = true;
            break;
          case "KeyA":
            moveLeft = true;
            break;
          case "KeyS":
            moveBackward = true;
            break;
          case "KeyD":
            moveRight = true;
            break;
          case "KeyQ":
            toggleVideoMenu();
            // unlock the pointer if the video menu is opened
            if (videoMenuVisibilityRef.current) {
              controls.unlock();
            }
            break;
          default:
            break;
        }
      },
      false
    );
    document.addEventListener(
      "keyup",
      (event) => {
        switch (event.code) {
          case "KeyW":
            moveForward = false;
            break;
          case "KeyA":
            moveLeft = false;
            break;
          case "KeyS":
            moveBackward = false;
            break;
          case "KeyD":
            moveRight = false;
            break;
          default:
            break;
        }
        if (
          !moveForward &&
          !moveBackward &&
          !moveLeft &&
          !moveRight &&
          isPlayerAbleToMove.current
        ) {
          // if no movement keys are pressed, stop sending position
          stopSendingPosition();
        }
      },
      false
    );

    // load the gltf model
    const loader = new GLTFLoader();
    loader.load(
      "Models/scene.gltf",
      (gltf) => {
        scene.add(gltf.scene);
      },
      undefined,
      (error) => {
        console.error("An error happened", error);
      }
    );
    camera.position.set(0, 2, 0);

    // main animate loop
    const animate = function () {
      requestAnimationFrame(animate);
      const time = performance.now();
      const delta = (time - prevTime) / 1000;
      velocity.x -= velocity.x * 10.0 * delta;
      velocity.z -= velocity.z * 10.0 * delta;
      direction.z = Number(moveForward) - Number(moveBackward);
      direction.x = Number(moveRight) - Number(moveLeft);
      direction.normalize();
      if (moveForward || moveBackward)
        velocity.z -= direction.z * 400.0 * delta;
      if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;
      controls.moveRight(-velocity.x * delta);
      controls.moveForward(-velocity.z * delta);

      if (playerModel) {
        playerModel.position.copy(controls.getObject().position);
        playerModel.position.y -= 1;
        playerModel.rotation.y = camera.rotation.y;
      }

      prevTime = time;
      renderer.render(scene, camera);

      // check if youtube wall exists before rendering for url changes
      if (css3dRenderer) {
        css3dRenderer.render(css3dScene, camera);
      }
    };
    animate();

    return () => {
      // cleanup
      clearInterval(positionIntervalRef.current);
      window.removeEventListener("beforeunload", handleBeforeUnload); // TODO: need a better way to clean this up
      wsRef.current.close();
      mountRef.current.removeChild(renderer.domElement);
      document.removeEventListener("keydown", (event) => {});
      document.removeEventListener("keyup", (event) => {});
    };
  }, []);

  // i know im using react but im putting this component here cause im lazy and dont want to deal with hooks
  const VideoMenu = () => {
    const [videoUrl, setVideoUrl] = useState("");

    const handleVideoChange = (event) => {
      setVideoUrl(event.target.value);
    };

    const handleSubmit = () => {
      // extract video ID from the URL
      const videoIdMatch = videoUrl.match(
        /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
      );
      if (videoIdMatch && videoIdMatch[1]) {
        const videoId = videoIdMatch[1];
        videoIdRef.current = videoId;
        console.log("Sending video ID to websocket server:", videoId);

        // send the video ID to the WebSocket server
        wsRef.current.send(JSON.stringify({ type: "updateVideo", videoId }));

        // update video client side
        updateVideo(videoId);

        // reset the video URL input after sending
        setVideoUrl("");

        // hide the video menu
        toggleVideoMenu();
      } else {
        console.log("Invalid YouTube URL");
      }
    };

    return (
      <div
        id="video-menu"
        style={{
          display: "none",
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "white",
          padding: "20px",
          borderRadius: "5px",
          boxShadow: "0px 0px 10px rgba(0, 0, 0, 0.5)",
        }}
      >
        <input
          type="text"
          value={videoUrl}
          onChange={handleVideoChange}
          placeholder="Enter full YouTube video URL"
        />
        <button onClick={handleSubmit}>Submit</button>
      </div>
    );
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }}></div>
      <div ref={css3dMountRef}></div>
      <VideoMenu />
    </div>
  );
};

export default GameScene;
