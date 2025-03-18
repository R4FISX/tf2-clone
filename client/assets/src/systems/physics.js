// systems/physics.js

export class PhysicsSystem {
    constructor(scene) {
      this.scene = scene;
      // Caso use plugin de física, inicialize aqui.
      // ex: scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), new BABYLON.CannonJSPlugin());
    }
  
    applyPlayerMovement(player, input) {
      // Exemplo simples de movimentação FPS
      const speed = player.speed || 0.1;
      const jumpForce = 0.2;
  
      // input contém dados do teclado e mouse (W, A, S, D, etc.)
      if (input.forward) {
        player.mesh.moveWithCollisions(player.mesh.forward.multiplyByFloats(speed, speed, speed));
      }
      if (input.backward) {
        player.mesh.moveWithCollisions(player.mesh.forward.multiplyByFloats(-speed, -speed, -speed));
      }
      if (input.left) {
        player.mesh.rotate(BABYLON.Axis.Y, -0.03, BABYLON.Space.LOCAL);
      }
      if (input.right) {
        player.mesh.rotate(BABYLON.Axis.Y, 0.03, BABYLON.Space.LOCAL);
      }
      if (input.jump && player.canJump) {
        // Lógica de pulo simples
        player.mesh.position.y += jumpForce;
        player.canJump = false; // Desativar para evitar múltiplos pulos no ar
      }
  
      // Verifica se está no chão para reabilitar pulo
      if (player.mesh.position.y <= 1.0) {
        player.canJump = true;
      }
    }
  
    checkCollisions(entities) {
      // Aqui você pode checar colisões entre players, projéteis, etc.
      // Exemplo genérico
      entities.forEach(entity => {
        // Exemplo: se entity está fora do mapa, reposiciona
        if (entity.mesh.position.y < -10) {
          entity.mesh.position = new BABYLON.Vector3(0, 2, 0);
        }
      });
    }
  }  