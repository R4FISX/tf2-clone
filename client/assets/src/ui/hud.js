// ui/hud.js

export class HUD {
    constructor() {
      // Se usar HTML, pode criar elementos e anexar no DOM
      this.healthBar = document.getElementById('healthBar');
      this.ammoCount = document.getElementById('ammoCount');
    }
  
    updateHealth(value, max) {
      if (!this.healthBar) return;
      this.healthBar.style.width = `${(value / max) * 100}%`;
    }
  
    updateAmmo(value) {
      if (!this.ammoCount) return;
      this.ammoCount.textContent = `Munição: ${value}`;
    }
  }  