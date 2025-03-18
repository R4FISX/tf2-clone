// ui/menu.js

export class Menu {
    constructor() {
      this.menuContainer = document.getElementById('menuContainer');
      this.playButton = document.getElementById('playButton');
      this.optionsButton = document.getElementById('optionsButton');
    }
  
    init(callbacks) {
      // callbacks: { onPlay: Function, onOptions: Function }
      if (this.playButton) {
        this.playButton.addEventListener('click', () => {
          if (callbacks.onPlay) callbacks.onPlay();
        });
      }
  
      if (this.optionsButton) {
        this.optionsButton.addEventListener('click', () => {
          if (callbacks.onOptions) callbacks.onOptions();
        });
      }
    }
  
    show() {
      if (this.menuContainer) {
        this.menuContainer.style.display = 'block';
      }
    }
  
    hide() {
      if (this.menuContainer) {
        this.menuContainer.style.display = 'none';
      }
    }
  }  