import * as THREE from "three";
import {
  getState,
  invalidateScene,
  invalidateWindowDimensions,
  SPHERE_RADIUS,
  updateSelectorTexture,
} from "./sceneSetup";

let isThinking = false;
let thinkingTransition = 0;
let isTransitioningToThinking = false;
let isSpeaking = false;
let currentSpeakingValue = 0;
let targetSpeakingValue = 0;
let isTransitioningToSpeaking = false;
let isDragging = false;
let isRotating = false;

export function getWeights(): [number, number, number] {
  const state = getState();

  const x = state.selector!.position.x / SPHERE_RADIUS;
  const y = state.selector!.position.y / SPHERE_RADIUS;
  const z = state.selector!.position.z / SPHERE_RADIUS;
  return [x, y, z];
}

export function setSpeaking(speaking: null | 1 | 2) {
  isSpeaking = speaking !== null;
  isTransitioningToSpeaking = true;
  targetSpeakingValue = speaking !== null ? speaking : 0;
}

export function setThinking(thinking: boolean) {
  isThinking = thinking;
  isTransitioningToThinking = true;
  thinkingTransition = thinking ? 0 : 1;
}

export function initInteraction() {
  updateSelectorValue();
  const state = getState();

  state.dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  window.addEventListener("resize", onWindowResize, false);
  state.renderer!.domElement.addEventListener("mousedown", onMouseDown, false);
  state.renderer!.domElement.addEventListener("mousemove", onMouseMove, false);
  state.renderer!.domElement.addEventListener("mouseup", onMouseUp, false);
  state.renderer!.domElement.addEventListener("contextmenu", onContextMenu, false);

  animate();
}

function onWindowResize() {
  invalidateWindowDimensions();
}

function onMouseDown(event: MouseEvent) {
  const state = getState();

  event.preventDefault();
  if (event.button === 0) {
    isDragging = true;
    updateMousePosition(event);

    const cameraDirection = new THREE.Vector3().subVectors(state.camera!.position, state.scene!.position).normalize();
    state.dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, state.selector!.position);

    dragSelector();
  } else if (event.button === 2) {
    isRotating = true;
    state.rotateStart.set(event.clientX, event.clientY);
  }
}

function onMouseMove(event: MouseEvent) {
  const state = getState();

  event.preventDefault();
  updateMousePosition(event);
  if (isDragging) {
    dragSelector();
  } else if (isRotating) {
    state.rotateEnd.set(event.clientX, event.clientY);
    state.rotateDelta.subVectors(state.rotateEnd, state.rotateStart);
    rotateCamera();
    state.rotateStart.copy(state.rotateEnd);
  }
}

function onMouseUp(event: MouseEvent) {
  event.preventDefault();
  isDragging = false;
  isRotating = false;
}

function onContextMenu(event: MouseEvent) {
  event.preventDefault();
}

function updateMousePosition(event: MouseEvent) {
  const state = getState();

  state.mouse!.x = (event.clientX / window.innerWidth) * 2 - 1;
  state.mouse!.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function dragSelector() {
  const state = getState();

  state.raycaster!.setFromCamera(state.mouse!, state.camera!);
  const intersection = new THREE.Vector3();
  state.raycaster!.ray.intersectPlane(state.dragPlane, intersection);

  intersection.clampLength(0, SPHERE_RADIUS);

  state.selector!.position.copy(intersection);
  updateSelectorValue();
}

function rotateCamera() {
  const state = getState();

  const rotateSpeed = 0.005;

  state.camera!.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), -state.rotateDelta.x * rotateSpeed);
  state.camera!.lookAt(state.scene!.position);
}

function updateSelectorValue(animate = false) {
  const state = getState();

  const time = Date.now() * 0.001;
  const x = state.selector!.position.x / SPHERE_RADIUS + (animate ? Math.sin(time) * 0.08 : 0);
  const y = state.selector!.position.y / SPHERE_RADIUS + (animate ? Math.sin(time) * 0.1 : 0);
  const z = state.selector!.position.z / SPHERE_RADIUS + (animate ? Math.sin(time) * 0.1 : 0);

  if (isTransitioningToThinking) {
    if (isThinking) {
      thinkingTransition += 0.1;
      if (thinkingTransition >= 1) {
        thinkingTransition = 1;
        isTransitioningToThinking = false;
      }
    } else {
      thinkingTransition -= 0.05;
      if (thinkingTransition <= 0) {
        thinkingTransition = 0;
        isTransitioningToThinking = false;
      }
    }
  }

  if (isTransitioningToSpeaking) {
    const transitionSpeed = 0.2;
    currentSpeakingValue += (targetSpeakingValue - currentSpeakingValue) * transitionSpeed;

    if (Math.abs(targetSpeakingValue - currentSpeakingValue) < 0.01) {
      currentSpeakingValue = targetSpeakingValue;
      isTransitioningToSpeaking = false;
    }
  } else if (!isSpeaking && currentSpeakingValue > 0) {
    currentSpeakingValue -= 0.1;
    if (currentSpeakingValue < 0) {
      currentSpeakingValue = 0;
    }
  }

  const finalSpeakingValue = isSpeaking ? Math.max(0.1, currentSpeakingValue) : currentSpeakingValue;

  updateSelectorTexture(x, y, z, thinkingTransition, finalSpeakingValue);
}

function animate() {
  requestAnimationFrame(animate);
  const shouldAnimate = !isDragging;
  updateSelectorValue(shouldAnimate);

  invalidateScene();
}
