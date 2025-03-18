// systems/network.js

export class NetworkSystem {
    constructor(serverUrl) {
      this.serverUrl = serverUrl;
      this.socket = null;
      this.onMessageCallbacks = [];
      this.onOpenCallback = null;
      this.onCloseCallback = null;
    }
  
    connect() {
      this.socket = new WebSocket(this.serverUrl);
  
      this.socket.onopen = (event) => {
        console.log('Conexão estabelecida com o servidor');
        if (this.onOpenCallback) this.onOpenCallback(event);
      };
  
      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.onMessageCallbacks.forEach(cb => cb(data));
      };
  
      this.socket.onclose = (event) => {
        console.log('Conexão fechada', event);
        if (this.onCloseCallback) this.onCloseCallback(event);
      };
    }
  
    send(data) {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(data));
      }
    }
  
    onMessage(callback) {
      this.onMessageCallbacks.push(callback);
    }
  
    onOpen(callback) {
      this.onOpenCallback = callback;
    }
  
    onClose(callback) {
      this.onCloseCallback = callback;
    }
  }  