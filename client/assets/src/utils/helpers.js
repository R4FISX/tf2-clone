// utils/helpers.js

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  
  export function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  // Exemplo: converter graus para radianos
  export function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }  