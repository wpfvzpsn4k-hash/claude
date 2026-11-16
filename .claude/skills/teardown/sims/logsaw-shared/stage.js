// Atölye sahnesi: açık gri stüdyo, epoksi zemin, tek güneş + gökyüzü ışığı, yumuşak gölgeler.
// frame(state, cam) makineyi pozlar ve bir kare çizer.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {buildMachine} from './machine.js';

export const BG = '#e7ebee';

export function createStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 14, 30);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.02, 80);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pm.dispose();

  const sun = new THREE.DirectionalLight('#fff7ec', 2.2);
  sun.position.set(-1.5, 9, 6);
  sun.target.position.set(-1.5, 0, 0);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {left: -6, right: 6, top: 3.5, bottom: -3.5, near: 1, far: 25});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.01;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#f6f8fb', '#c9ced3', 0.9));

  // zemin: hafif ızgara çizgili epoksi, ufukta arka plana karışır
  const floorMat = new THREE.ShaderMaterial({
    uniforms: {uBg: {value: new THREE.Color(BG)}, uA: {value: new THREE.Color('#dde2e6')}, uB: {value: new THREE.Color('#cfd5da')}},
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uBg, uA, uB; varying vec3 vW;
      void main(){
        vec2 g = abs(fract(vW.xz / 1.0) - 0.5);
        float l = 1.0 - smoothstep(0.485, 0.495, max(g.x, g.y));
        vec3 c = mix(uA, uB, (1.0 - l) * 0.6);
        // güvenlik şeridi: makine çevresinde sarı çizgi
        vec2 q = abs(vW.xz - vec2(-1.6, 0.0)) - vec2(5.3, 1.2);
        float y = step(abs(max(q.x, q.y)), 0.03) ;
        c = mix(c, vec3(0.93, 0.74, 0.2), y * 0.85);
        float d = length(vW.xz - vec2(-1.5, 0.0));
        gl_FragColor = vec4(mix(c, uBg, smoothstep(7.0, 16.0, d)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({color: '#3a4652', opacity: 0.28, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4}));
  shade.rotation.x = -Math.PI / 2;
  shade.receiveShadow = true;
  scene.add(shade);

  const mc = buildMachine();
  scene.add(mc.root);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  // cam: {tx, ty, tz, az, el, d, sx, sy} (radyan, metre); az = 0 operatör tarafından (+z) bakış
  const frame = (st, cam) => {
    mc.update(st);
    camera.position.set(cam.tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), cam.ty + cam.d * Math.sin(cam.el), cam.tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
  };
  const pv = new THREE.Vector3();
  const project = (p) => {
    pv.set(p[0], p[1], p[2]).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({shadow}) => {
    sun.shadow.mapSize.set(shadow, shadow);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  };
  return {renderer, scene, camera, mc, resize, frame, project, size, setQuality};
}
