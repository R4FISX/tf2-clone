// game.js

import { RenderSystem } from './systems/render.js';
import { PhysicsSystem } from './systems/physics.js';
import { NetworkSystem } from './systems/network.js';
import { HUD } from './ui/hud.js';
import { Menu } from './ui/menu.js';

let renderSystem, physicsSystem, networkSystem, hud, menu;
let player = {
  mesh: null,
  speed: 0.1,
  canJump: true,
  health: 100,
  maxHealth: 100,
  ammo: 30
};

// Estado de entrada (teclado/mouse)
let inputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  shoot: false
};

function init() {
  // Inicializa Render
  renderSystem = new RenderSystem('renderCanvas');
  renderSystem.initScene();

  // Cria um mesh simples para representar o jogador
  const scene = renderSystem.scene;
  player.mesh = BABYLON.MeshBuilder.CreateBox('playerBox', { size: 1 }, scene);
  player.mesh.position.y = 2; // altura inicial

  // Inicializa Physics
  physicsSystem = new PhysicsSystem(scene);

  // Inicializa Network
  networkSystem = new NetworkSystem('ws://localhost:8000/ws');
  networkSystem.connect();

  // Inicializa HUD
  hud = new HUD();

  // Inicializa Menu
  menu = new Menu();
  menu.init({
    onPlay: () => {
      menu.hide();
      startGameLoop();
    },
    onOptions: () => {
      console.log('Opções ainda não implementadas');
    }
  });
  menu.show();

  // Listeners de teclado
  setupInputListeners();
}

function setupInputListeners() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'w') inputState.forward = true;
    if (e.key === 's') inputState.backward = true;
    if (e.key === 'a') inputState.left = true;
    if (e.key === 'd') inputState.right = true;
    if (e.key === ' ') inputState.jump = true;
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'w') inputState.forward = false;
    if (e.key === 's') inputState.backward = false;
    if (e.key === 'a') inputState.left = false;
    if (e.key === 'd') inputState.right = false;
    if (e.key === ' ') inputState.jump = false;
  });

  // Exemplo de clique do mouse para atirar
  window.addEventListener('mousedown', () => {
    inputState.shoot = true;
  });
  window.addEventListener('mouseup', () => {
    inputState.shoot = false;
  });
}

function startGameLoop() {
  const loop = () => {
    update();
    requestAnimationFrame(loop);
  };
  loop();
}

function update() {
  // Atualiza física
  physicsSystem.applyPlayerMovement(player, inputState);

  // Se atirou
  if (inputState.shoot && player.ammo > 0) {
    shoot();
  }

  // Atualiza HUD
  hud.updateHealth(player.health, player.maxHealth);
  hud.updateAmmo(player.ammo);

  // Envia estado para o servidor
  networkSystem.send({
    type: 'playerUpdate',
    position: {
      x: player.mesh.position.x,
      y: player.mesh.position.y,
      z: player.mesh.position.z
    }
    // ...outros dados
  });
}

function shoot() {
  // Lógica simples de "tiro"
  player.ammo--;
  console.log('Atirou! Munição restante:', player.ammo);
}

// Inicializa tudo ao carregar a página
window.addEventListener('DOMContentLoaded', init);