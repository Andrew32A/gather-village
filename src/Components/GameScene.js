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
  const wsRef = useRef(null);
  const mountRef = useRef(null);
  const css3dMountRef = useRef(null);
  const [peers, setPeers] = useState({});
  const otherPlayers = useRef({});
  const youtubeWallRef = useRef(null);

  // update video in the scene
  const updateVideo = (videoId) => {
    console.log("||RECEIVED|| video ID, updating YouTube video:", videoId);
    // css3dScene.remove(youtubeWallRef.current); // apparently i dont need this... AND IT WORKS NOW! WOOOOOOOOOOOO!!!!! you have no idea the pain and tears this caused me
    css3dScene.add(createYouTubeWall(videoId, 530, 200, -130, 55));
  };

  // init YouTube wall
  const createYouTubeWall = (id, x, y, z, ry) => {
    let div, iframe;
    if (youtubeWallRef.current) {
      iframe = youtubeWallRef.current.element.querySelector("iframe");
      iframe.id = "youtube-iframe";
      iframe.src = `https://www.youtube.com/embed/${id}?rel=0&autoplay=1&mute=1`;
    } else {
      div = document.createElement("div");
      div.style.width = "500px";
      div.style.height = "450px";
      iframe = document.createElement("iframe");
      iframe.style.width = "640px";
      iframe.style.height = "450px";
      iframe.style.border = "0px";
      iframe.src = `https://www.youtube.com/embed/${id}?rel=0&autoplay=1&mute=1`;
      div.appendChild(iframe);

      let object = new CSS3DObject(div);
      object.position.set(x, y, z);
      object.rotation.y = ry;
      youtubeWallRef.current = object;
      return object;
    }
  };

  const css3dScene = new THREE.Scene();
  css3dScene.add(createYouTubeWall("LDU_Txk06tM", 530, 200, -130, 55));

  useEffect(() => {
    wsRef.current = new WebSocket("ws://localhost:8080");
    wsRef.current.onopen = () => {
      console.log("Connected to the signaling server");
    };

    // handle signaling for peers
    const handleSignalData = (data) => {
      if (data.signal && peers[data.peerId]) {
        peers[data.peerId].signal(data.signal);
      }
    };

    // create and manage a new peer connection
    const handleNewPeer = (data) => {
      const peerId = data.peerId;
      const peer = new Peer({ initiator: false, trickle: false });

      peer.on("signal", (signal) => {
        wsRef.current.send(JSON.stringify({ type: "signal", peerId, signal }));
      });

      peer.on("data", (data) => {
        const parsedData = JSON.parse(data);
        const { type, position } = parsedData;
        if (type === "updatePosition" && position) {
          updatePlayerPosition(peerId, position);
        }
      });

      setPeers((prev) => ({ ...prev, [peerId]: peer }));
    };

    // handle update player position
    const handleUpdatePosition = (data) => {
      const { peerId, position } = data;
      updatePlayerPosition(peerId, position);
    };

    // main function to handle incoming messages
    const handleMessage = (message) => {
      console.log("IS THIS WORKING?!?!");
      const handleData = (data) => {
        switch (data.type) {
          case "signal":
            handleSignalData(data);
            break;
          case "updateVideo":
            updateVideo(data.videoId);
            break;
          case "new-peer":
            handleNewPeer(data);
            break;
          case "updatePosition":
            console.log("||RECEIVED|| position update:", data);
            handleUpdatePosition(data);
            break;
          default:
            console.error("Received unknown data type:", data.type);
        }
      };

      const processData = (data) => {
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
      if (wsRef.current.readyState === WebSocket.OPEN) {
        const position = controls.getObject().position;
        wsRef.current.send(
          JSON.stringify({
            type: "updatePosition",
            position: { x: position.x, y: position.y, z: position.z },
          })
        );
      } else {
        console.log(
          "WebSocket is not open. ReadyState:",
          wsRef.current.readyState
        );
      }
    };

    // tick rate for sending position updates, 100ms by default
    const positionInterval = setInterval(sendPosition, 100);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    const css3dRenderer = new CSS3DRenderer();
    css3dRenderer.setSize(window.innerWidth, window.innerHeight);
    css3dRenderer.domElement.style.position = "absolute";
    css3dRenderer.domElement.style.top = "0";
    css3dMountRef.current.appendChild(css3dRenderer.domElement);

    const controls = new PointerLockControls(camera, document.body);
    scene.add(controls.getObject());

    document.addEventListener("click", () => controls.lock(), false);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    let playerModel = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    scene.add(playerModel);
    playerModel.position.set(0, -1, -5);

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
            // TODO: toggle menu for changing video URL
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
      },
      false
    );
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
      clearInterval(positionInterval);
      wsRef.current.close();
      mountRef.current.removeChild(renderer.domElement);
      document.removeEventListener("keydown", (event) => {});
      document.removeEventListener("keyup", (event) => {});
    };
  }, [peers]);

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
        console.log("Sending video ID to websocket server:", videoId);

        // send the video ID to the WebSocket server
        wsRef.current.send(JSON.stringify({ type: "updateVideo", videoId }));

        // update video client side
        updateVideo(videoId);

        // reset the video URL input after sending
        setVideoUrl("");
      } else {
        console.log("Invalid YouTube URL");
      }
    };

    return (
      <div
        style={{
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
