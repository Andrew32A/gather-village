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
  const mountRef = useRef(null);
  const css3dMountRef = useRef(null);
  const [peers, setPeers] = useState({});
  const otherPlayers = useRef({});

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    ws.onopen = () => {
      console.log("Connected to the signaling server");
    };

    ws.onmessage = (message) => {
      const handleData = (data) => {
        if (data.signal && peers[data.peerId]) {
          peers[data.peerId].signal(data.signal);
        } else if (data.type === "new-peer") {
          const peerId = data.peerId;
          const peer = new Peer({ initiator: false, trickle: false });

          peer.on("signal", (signal) => {
            ws.send(JSON.stringify({ type: "signal", peerId, signal }));
          });

          peer.on("data", (data) => {
            const parsedData = JSON.parse(data);
            const { type, position } = parsedData;
            if (type === "updatePosition" && position) {
              updatePlayerPosition(peerId, position);
            }
          });

          setPeers((prev) => ({ ...prev, [peerId]: peer }));
        } else if (data.type === "updatePosition") {
          const { peerId, position } = data;
          updatePlayerPosition(peerId, position);
        }
      };

      if (message.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = function () {
          try {
            const data = JSON.parse(reader.result);
            handleData(data);
          } catch (e) {
            console.error("Error parsing JSON from Blob", e);
          }
        };
        reader.readAsText(message.data);
      } else {
        try {
          const data = JSON.parse(message.data);
          handleData(data);
        } catch (e) {
          console.error("Error parsing message data", e);
        }
      }
    };

    const updatePlayerPosition = (peerId, position) => {
      // console.log(otherPlayers.current, peerId, otherPlayers.current[peerId]);
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
      if (ws.readyState === WebSocket.OPEN) {
        const position = controls.getObject().position;
        ws.send(
          JSON.stringify({
            type: "updatePosition",
            position: { x: position.x, y: position.y, z: position.z },
          })
        );
      } else {
        console.log("WebSocket is not open. ReadyState:", ws.readyState);
      }
    };

    const positionInterval = setInterval(sendPosition, 100);

    // Three.js WebGL scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ alpha: true }); // Enable transparency to see the CSS3D content behind the WebGL content
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    // CSS3DRenderer setup
    const css3dRenderer = new CSS3DRenderer();
    css3dRenderer.setSize(window.innerWidth, window.innerHeight);
    css3dRenderer.domElement.style.position = "absolute";
    css3dRenderer.domElement.style.top = "0";
    css3dMountRef.current.appendChild(css3dRenderer.domElement);

    const controls = new PointerLockControls(camera, document.body);
    scene.add(controls.getObject());

    document.addEventListener("click", () => controls.lock(), false);

    // create a YouTube iframe element
    const createYouTubeWall = (id, x, y, z, ry) => {
      let div = document.createElement("div");
      div.style.width = "500px"; // size of the "wall"
      div.style.height = "450px"; // size of the "wall"
      let iframe = document.createElement("iframe");
      iframe.style.width = "640px";
      iframe.style.height = "450px";
      iframe.style.border = "0px";
      iframe.src = [
        "https://www.youtube.com/embed/",
        id,
        "?rel=0&autoplay=1&mute=1",
      ].join("");
      div.appendChild(iframe);

      let object = new CSS3DObject(div);
      object.position.set(x, y, z);
      object.rotation.y = ry;
      return object;
    };

    // add the YouTube wall to the scene
    const css3dScene = new THREE.Scene(); // separate scene for CSS3DRenderer objects
    css3dScene.add(createYouTubeWall("B0J27sf9N1Y", 530, 200, -130, 55)); // position of wall, youtube video id, left/right of user, up/down of user, front/back of user, rotation of wall.

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
      css3dRenderer.render(css3dScene, camera); // render youtube wall
    };
    animate();

    return () => {
      clearInterval(positionInterval);
      ws.close();
      mountRef.current.removeChild(renderer.domElement);
      document.removeEventListener("keydown", (event) => {});
      document.removeEventListener("keyup", (event) => {});
    };
  }, [peers]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }}></div>
      <div ref={css3dMountRef}></div>
    </div>
  );
};

export default GameScene;
