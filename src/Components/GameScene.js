import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import Peer from "simple-peer";

const GameScene = () => {
  const mountRef = useRef(null);
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

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new PointerLockControls(camera, document.body);
    scene.add(controls.getObject());

    document.addEventListener("click", () => controls.lock(), false);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);
    document.addEventListener("click", () => controls.lock(), false);

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
    };
    animate();

    return () => {
      clearInterval(positionInterval);
      ws.close();
      mountRef.current.removeChild(renderer.domElement);
      document.removeEventListener("keydown", (event) => {});
      document.removeEventListener("keyup", (event) => {});
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100vh" }}></div>;
};

export default GameScene;
