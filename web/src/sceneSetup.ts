import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { interpolateFace } from "./interpolation";
import { shaders } from "./shaders";

export const SPHERE_RADIUS = 4;

export type State = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  xzPlane: THREE.Mesh;
  xyPlane: THREE.Mesh;
  yzPlane: THREE.Mesh;
  selector: THREE.Mesh;
  rotateStart: THREE.Vector2;
  rotateEnd: THREE.Vector2;
  rotateDelta: THREE.Vector2;
  cameraDistance: number;
  dragPlane: THREE.Plane;
  selectorTexture: THREE.Texture;
  composer: EffectComposer;
  renderPixelatedPass: ShaderPass;
  selectorMaterial: THREE.MeshPhongMaterial;
};

const state: Partial<State> = {};

export function getState() {
  return state as State;
}

export function initScene() {
  state.rotateStart = new THREE.Vector2();
  state.rotateEnd = new THREE.Vector2();
  state.rotateDelta = new THREE.Vector2();
  state.cameraDistance = 0;
  state.dragPlane = new THREE.Plane();

  state.scene = new THREE.Scene();
  // state.scene.background = new THREE.Color(0x333111);
  state.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  state.camera.position.set(0, 0, 8);
  state.camera.lookAt(0, 0, 0);
  state.cameraDistance = state.camera.position.length();

  state.renderer = new THREE.WebGLRenderer({ antialias: true });
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  const container = document.getElementById("container");
  if (container) {
    container.appendChild(state.renderer.domElement);
  }

  state.composer = new EffectComposer(state.renderer);
  const renderPass = new RenderPass(state.scene, state.camera);
  state.composer.addPass(renderPass);

  const pixelShader = {
    uniforms: {
      tDiffuse: { value: null },
      resolution: { value: new THREE.Vector2() },
      pixelSize: { value: 3 },
      colorNum: { value: 12 },
      ditherScale: { value: 0.5 },
    },
    vertexShader: shaders.pixel.vertex,
    fragmentShader: shaders.pixel.fragment,
  };

  state.renderPixelatedPass = new ShaderPass(pixelShader);
  state.renderPixelatedPass.uniforms["resolution"].value.set(window.innerWidth, window.innerHeight);
  state.composer.addPass(state.renderPixelatedPass);

  state.raycaster = new THREE.Raycaster();
  state.mouse = new THREE.Vector2();

  const circleGeometry = new THREE.CircleGeometry(4, 64);
  const gradientMaterial = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(0xffffff) },
      innerOpacity: { value: 0.0 },
      outerOpacity: { value: 0.2 },
    },
    vertexShader: shaders.gradient.vertex,
    fragmentShader: shaders.gradient.fragment,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });

  state.xyPlane = new THREE.Mesh(circleGeometry, gradientMaterial);
  state.xyPlane.renderOrder = -1;
  state.scene.add(state.xyPlane);

  state.xzPlane = new THREE.Mesh(circleGeometry, gradientMaterial.clone());
  state.xzPlane.rotation.x = Math.PI / 2;
  state.xzPlane.renderOrder = -1;
  state.scene.add(state.xzPlane);

  state.yzPlane = new THREE.Mesh(circleGeometry, gradientMaterial.clone());
  state.yzPlane.rotation.y = Math.PI / 2;
  state.yzPlane.renderOrder = -1;
  state.scene.add(state.yzPlane);

  const axisLength = 4;
  const axisColor = 0xffffff;
  const axisLineWidth = 1;

  const xAxis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-axisLength, 0, 0),
      new THREE.Vector3(axisLength, 0, 0),
    ]),
    new THREE.LineBasicMaterial({ color: axisColor, linewidth: axisLineWidth, transparent: true, opacity: 0.5 })
  );
  state.scene.add(xAxis);

  const yAxis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -axisLength, 0),
      new THREE.Vector3(0, axisLength, 0),
    ]),
    new THREE.LineBasicMaterial({ color: axisColor, linewidth: axisLineWidth, transparent: true, opacity: 0.5 })
  );
  state.scene.add(yAxis);

  const zAxis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -axisLength),
      new THREE.Vector3(0, 0, axisLength),
    ]),
    new THREE.LineBasicMaterial({ color: axisColor, linewidth: axisLineWidth, transparent: true, opacity: 0.5 })
  );
  state.scene.add(zAxis);

  let uOffset = 0.5;
  let vOffset = 0.5;
  let uScale = 3.5;
  let vScale = -3;

  const selectorGeometry = new THREE.SphereGeometry(0.8, 32, 32);
  state.selectorTexture = new THREE.Texture();

  function modifyUVMapping(geometry: THREE.BufferGeometry) {
    const positionAttribute = geometry.attributes.position;
    const uvAttribute = geometry.attributes.uv;

    for (let i = 0; i < positionAttribute.count; i++) {
      const vertex = new THREE.Vector3();
      vertex.fromBufferAttribute(positionAttribute, i);
      vertex.normalize();

      const u = uOffset + uScale * (Math.atan2(vertex.x, vertex.z) / (2 * Math.PI));
      const v = vOffset + vScale * (-Math.asin(vertex.y) / Math.PI);

      uvAttribute.setXY(i, u, v);
    }
    uvAttribute.needsUpdate = true;
  }

  modifyUVMapping(selectorGeometry);

  state.selectorMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    shininess: 50,
    transparent: true,
    opacity: 1,
    emissive: 0x404040,
  });

  const faceMaterial = new THREE.MeshBasicMaterial({
    map: state.selectorTexture,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });

  state.selector = new THREE.Mesh(selectorGeometry, state.selectorMaterial);
  state.selector.position.set(0, 0, 0);
  state.scene.add(state.selector);

  const faceGeometry = new THREE.SphereGeometry(selectorGeometry.parameters.radius * 1.02, 32, 32);
  modifyUVMapping(faceGeometry);
  const faceMesh = new THREE.Mesh(faceGeometry, faceMaterial);
  state.selector.add(faceMesh);

  const ambientLight = new THREE.AmbientLight(0x808080, 4);
  state.scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(1, 1, 1);
  state.scene.add(directionalLight);

  updateSelectorTexture(0, 0, 0, 0, 0);
}

export function updateSelectorTexture(x: number, y: number, z: number, thinkingWeight: number, speakingWeight: number) {
  const state = getState();

  const svgString = interpolateFace(x, y, z, thinkingWeight, speakingWeight);
  const img = new Image();
  img.onload = function () {
    state.selectorTexture.image = img;
    state.selectorTexture.needsUpdate = true;
    state.selectorMaterial.needsUpdate = true;
  };
  img.src = "data:image/svg+xml;base64," + btoa(svgString);
}

export function invalidateWindowDimensions() {
  const state = getState();

  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.composer.setSize(window.innerWidth, window.innerHeight);
  state.renderPixelatedPass.uniforms["resolution"].value.set(window.innerWidth, window.innerHeight);
}

export function invalidateScene() {
  const state = getState();

  state.camera.position.normalize().multiplyScalar(state.cameraDistance);

  state.selector.lookAt(state.camera.position);

  state.composer.render();
}
