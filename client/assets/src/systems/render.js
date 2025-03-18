// systems/render.js

import * as BABYLON from 'babylonjs';

export class RenderSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.engine = new BABYLON.Engine(this.canvas, true);
    this.scene = null;
    this.camera = null;
    this.light = null;
  }

  initScene() {
    // Cria cena
    this.scene = new BABYLON.Scene(this.engine);

    // Cria câmera (FPS)
    // Para um estilo FPS, podemos usar ArcRotateCamera adaptada ou UniversalCamera
    this.camera = new BABYLON.UniversalCamera(
      'camera',
      new BABYLON.Vector3(0, 2, -10),
      this.scene
    );
    this.camera.attachControl(this.canvas, true);

    // Cria luz
    this.light = new BABYLON.HemisphericLight(
      'light',
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );

    // Opcional: Adiciona um chão simples para testes
    const ground = BABYLON.MeshBuilder.CreateGround(
      'ground',
      { width: 50, height: 50 },
      this.scene
    );

    // Render loop
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    // Ajusta a cena quando a janela é redimensionada
    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }

  // Atualiza elementos visuais (chamado a cada frame, se necessário)
  update() {
    // Aqui você pode atualizar posições de meshes,
    // aplicar animações, etc.
  }
}