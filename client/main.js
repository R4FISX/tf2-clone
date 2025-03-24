// main.js - Cliente de teste para o backend do clone de TF2
const WebSocket = require('ws');
const axios = require('axios');
const readline = require('readline');

/**
 * Configuração do cliente de teste
 */
class Config {
  constructor() {
    this.apiUrl = 'http://localhost:5500/api';
    this.wsUrl = 'ws://localhost:5500/game';
    this.numTestPlayers = 3;
    this.debug = true;
    this.fallbackEndpoints = [
      { apiUrl: 'http://localhost:5500', wsUrl: 'ws://localhost:5500' },
      { apiUrl: 'http://localhost:5500/api', wsUrl: 'ws://localhost:5500/ws' },
      { apiUrl: 'http://localhost:5500/api', wsUrl: 'ws://localhost:5500/socket' },
      { apiUrl: 'http://localhost:3000/api', wsUrl: 'ws://localhost:3000/game' }
    ];
  }
}

/**
 * Classe utilitária para logging
 */
class Logger {
  constructor(config) {
    this.config = config;
  }

  log(message, isDebug = false) {
    if (!isDebug || this.config.debug) {
      console.log(message);
    }
  }

  error(message, error) {
    console.error(`ERROR: ${message}`);
    if (error) {
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Resposta: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        console.error('Sem resposta do servidor. Verifique se o servidor está rodando.');
      } else {
        console.error(`Mensagem: ${error.message}`);
      }
      if (error.stack && this.config.debug) {
        console.error(`Stack: ${error.stack}`);
      }
    }
  }
}

/**
 * Classe para gerenciar um jogador de teste
 */
class TestPlayer {
  constructor(id, logger, config, mockMode = false) {
    this.id = id;
    this.username = `TestPlayer${id}`;
    this.logger = logger;
    this.config = config;
    this.mockMode = mockMode;
    this.connection = null;
    this.position = { x: Math.random() * 1000, y: 0, z: Math.random() * 1000 };
    this.health = 100;
    this.team = id % 2 === 0 ? 'RED' : 'BLU';
    this.playerClass = this.getRandomClass();
    this.connected = false;
    this.playerId = null;
    this.heartbeatInterval = null;
  }

  getRandomClass() {
    const classes = ['Scout', 'Soldier', 'Pyro', 'Demoman', 'Heavy', 'Engineer', 'Medic', 'Sniper', 'Spy'];
    return classes[Math.floor(Math.random() * classes.length)];
  }

  async connect() {
    if (this.mockMode) {
      this.playerId = `mock_player_${this.id}`;
      this.connected = true;
      this.logger.log(`Jogador ${this.username} conectado em modo mock`);
      this.startHeartbeat();
      return;
    }

    try {
      this.logger.log(`Conectando jogador ${this.username}...`);
      
      // Verificar health do servidor
      if (!await this.checkServerHealth()) {
        throw new Error('Servidor não está acessível');
      }
      
      // Tentar registrar o jogador
      await this.registerPlayer();
      
      // Conectar via WebSocket
      await this.connectWebSocket();
      
      return true;
    } catch (error) {
      this.logger.error(`Erro ao conectar ${this.username}`, error);
      throw error;
    }
  }
  
  async checkServerHealth() {
    const healthEndpoints = [
      `${this.config.apiUrl}/health`,
      `${this.config.apiUrl}/status`,
      `${this.config.apiUrl.split('/api')[0]}/health`,
      `${this.config.apiUrl.split('/api')[0]}/status`
    ];
    
    for (const endpoint of healthEndpoints) {
      try {
        this.logger.log(`Tentando health check em: ${endpoint}`, true);
        await axios.get(endpoint, { timeout: 3000 });
        this.logger.log(`Servidor acessível via ${endpoint}`, true);
        return true;
      } catch (err) {
        this.logger.log(`Endpoint ${endpoint} não disponível: ${err.message}`, true);
      }
    }
    
    // Tentar a raiz do servidor como último recurso
    try {
      const rootUrl = this.config.apiUrl.split('/api')[0];
      this.logger.log(`Tentando acessar raiz: ${rootUrl}`, true);
      await axios.get(rootUrl, { timeout: 3000 });
      this.logger.log(`Servidor responde na raiz: ${rootUrl}`, true);
      return true;
    } catch (err) {
      this.logger.log(`Raiz do servidor não disponível: ${err.message}`, true);
      return false;
    }
  }
  
  async registerPlayer() {
    const registrationEndpoints = [
      `${this.config.apiUrl}/players/register`,
      `${this.config.apiUrl}/player/register`,
      `${this.config.apiUrl}/register`,
      `${this.config.apiUrl.split('/api')[0]}/api/players/register`
    ];
    
    for (const endpoint of registrationEndpoints) {
      try {
        this.logger.log(`Tentando registrar jogador em: ${endpoint}`, true);
        const response = await axios.post(endpoint, {
          username: this.username,
          playerClass: this.playerClass,
          team: this.team
        }, { timeout: 3000 });
        
        this.playerId = response.data.playerId || response.data.id || `player_${this.id}`;
        this.logger.log(`Jogador ${this.username} registrado com ID: ${this.playerId}`);
        return true;
      } catch (error) {
        this.logger.log(`Falha ao registrar em ${endpoint}: ${error.message}`, true);
      }
    }
    
    // Se todas as tentativas falharem, usar ID de fallback
    this.playerId = `fallback_player_${this.id}`;
    this.logger.log(`Usando ID de fallback: ${this.playerId}`);
    return false;
  }
  
  async connectWebSocket() {
    const wsEndpoints = [
      `${this.config.wsUrl}?id=${this.playerId}`,
      `${this.config.wsUrl}/${this.playerId}`,
      `${this.config.wsUrl}`,
      `${this.config.apiUrl.split('/api')[0].replace('http', 'ws')}/game?id=${this.playerId}`,
      `${this.config.apiUrl.split('/api')[0].replace('http', 'ws')}/ws?id=${this.playerId}`,
      `${this.config.apiUrl.split('/api')[0].replace('http', 'ws')}/socket?id=${this.playerId}`
    ];
    
    return new Promise((resolve, reject) => {
      let connectionAttempts = 0;
      
      const tryNextWsEndpoint = () => {
        if (connectionAttempts >= wsEndpoints.length) {
          reject(new Error('Falha em todas as tentativas de conexão WebSocket'));
          return;
        }
        
        const wsUrl = wsEndpoints[connectionAttempts++];
        
        try {
          this.logger.log(`Tentando conectar WebSocket em: ${wsUrl}`, true);
          
          this.connection = new WebSocket(wsUrl);
          
          // Definir timeout para conexão
          const connectionTimeout = setTimeout(() => {
            this.connection.terminate();
            tryNextWsEndpoint();
          }, 3000);
          
          this.connection.on('open', () => {
            clearTimeout(connectionTimeout);
            this.logger.log(`Conexão WebSocket estabelecida para ${this.username} em ${wsUrl}`);
            this.connected = true;
            this.startHeartbeat();
            resolve();
          });
          
          this.connection.on('message', (data) => {
            this.handleServerMessage(data);
          });
          
          this.connection.on('close', () => {
            this.logger.log(`Conexão fechada para ${this.username}`);
            this.connected = false;
            if (this.heartbeatInterval) {
              clearInterval(this.heartbeatInterval);
            }
          });
          
          this.connection.on('error', (error) => {
            clearTimeout(connectionTimeout);
            this.logger.log(`Erro na conexão WebSocket de ${this.username}: ${error.message}`, true);
            tryNextWsEndpoint();
          });
        } catch (error) {
          this.logger.log(`Erro ao configurar WebSocket: ${error.message}`, true);
          tryNextWsEndpoint();
        }
      };
      
      tryNextWsEndpoint();
    });
  }
  
  disconnect() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.connection) {
      try {
        this.connection.close();
        this.logger.log(`Jogador ${this.username} desconectado`);
      } catch (error) {
        this.logger.error(`Erro ao desconectar ${this.username}`, error);
      }
    }
    
    this.connected = false;
  }
  
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      if (this.connected) {
        this.sendPosition();
      } else {
        clearInterval(this.heartbeatInterval);
      }
    }, 100);
  }
  
  sendPosition() {
    // Atualizar posição aleatoriamente para simular movimento
    this.position.x += (Math.random() - 0.5) * 5;
    this.position.z += (Math.random() - 0.5) * 5;
    
    const message = {
      type: 'playerUpdate',
      data: {
        position: this.position,
        health: this.health,
        ammo: 100
      }
    };
    
    this.sendMessage(message);
  }
  
  simulateShot(targetPlayer) {
    if (!targetPlayer) return;
    
    this.logger.log(`${this.username} atirando em ${targetPlayer.username}`);
    
    const message = {
      type: 'playerAction',
      action: 'shoot',
      data: {
        targetId: targetPlayer.playerId,
        damage: 20,
        position: this.position,
        direction: {
          x: targetPlayer.position.x - this.position.x,
          y: 0,
          z: targetPlayer.position.z - this.position.z
        }
      }
    };
    
    this.sendMessage(message);
  }
  
  handleServerMessage(data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'gameState':
          this.logger.log(`${this.username} recebeu atualização do estado do jogo`, true);
          break;
          
        case 'playerDamage':
          this.logger.log(`${this.username} recebeu dano: ${message.data.damage} de ${message.data.sourcePlayer}`);
          this.health -= message.data.damage;
          if (this.health <= 0) {
            this.logger.log(`${this.username} foi eliminado!`);
            this.health = 100; // Respawn
          }
          break;
          
        case 'chatMessage':
          this.logger.log(`Chat: ${message.data.sender || this.username}: ${message.data.message}`);
          break;
          
        case 'pointCaptured':
          this.logger.log(`Ponto ${message.data.pointId} capturado pelo time ${message.data.team}`);
          break;
          
        default:
          this.logger.log(`${this.username} recebeu mensagem: ${message.type}`, true);
      }
    } catch (error) {
      this.logger.error(`Erro ao processar mensagem para ${this.username}`, error);
    }
  }
  
  sendMessage(message) {
    if (this.mockMode) {
      // Em modo mock, apenas registrar a mensagem
      this.logger.log(`[MOCK] ${this.username} enviou: ${JSON.stringify(message)}`, true);
      return;
    }
    
    if (this.connected && this.connection) {
      try {
        this.connection.send(JSON.stringify(message));
      } catch (error) {
        this.logger.error(`Erro ao enviar mensagem para ${this.username}`, error);
        this.connected = false;
      }
    }
  }
  
  sendChatMessage(text) {
    const message = {
      type: 'chatMessage',
      data: {
        message: text
      }
    };
    
    this.sendMessage(message);
    this.logger.log(`${this.username} enviou mensagem: ${text}`);
  }
}

/**
 * Classe para verificar disponibilidade do servidor
 */
class ServerScanner {
  constructor(logger) {
    this.logger = logger;
  }
  
  async detectServerConfiguration() {
    this.logger.log('Iniciando detecção automática de servidor...');
    const portsToTry = [5500, 3000, 8080, 4000, 9000];
    const pathsToTry = ['', '/api', '/game', '/tf2clone'];
    
    for (const port of portsToTry) {
      for (const path of pathsToTry) {
        const baseUrl = `http://localhost:${port}${path}`;
        try {
          this.logger.log(`Tentando acessar: ${baseUrl}`, true);
          const response = await axios.get(baseUrl, { timeout: 2000 });
          
          if (response.status < 400) {
            this.logger.log(`Servidor detectado em: ${baseUrl}`);
            
            // Testar WebSocket em diferentes endpoints
            const wsBaseUrl = `ws://localhost:${port}`;
            const wsPaths = ['/game', '/socket', '/ws', path || '/'];
            
            for (const wsPath of wsPaths) {
              const wsUrl = `${wsBaseUrl}${wsPath}`;
              try {
                this.logger.log(`Testando WebSocket em: ${wsUrl}`, true);
                
                const wsResult = await this.testWebSocketConnection(wsUrl);
                if (wsResult) {
                  this.logger.log(`WebSocket disponível em: ${wsUrl}`);
                  return {
                    apiUrl: baseUrl,
                    wsUrl: wsUrl
                  };
                }
              } catch (wsError) {
                this.logger.log(`Erro ao testar WebSocket em ${wsUrl}: ${wsError.message}`, true);
              }
            }
          }
        } catch (error) {
          this.logger.log(`Servidor não detectado em: ${baseUrl}`, true);
        }
      }
    }
    
    return null; // Nenhuma configuração detectada
  }
  
  async testWebSocketConnection(wsUrl) {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(wsUrl);
        
        const timeout = setTimeout(() => {
          ws.terminate();
          resolve(false);
        }, 2000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        });
        
        ws.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
      } catch (error) {
        resolve(false);
      }
    });
  }
}

/**
 * Gerenciador de testes
 */
class TestManager {
  constructor() {
    this.config = new Config();
    this.logger = new Logger(this.config);
    this.scanner = new ServerScanner(this.logger);
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.players = [];
    this.serverInfo = null;
    this.simulationActive = false;
    this.mockMode = false;
    this.simulationInterval = null;
  }
  
  async runServerScan() {
    this.logger.log('Iniciando busca automática por servidor...');
    
    try {
      const detectedConfig = await this.scanner.detectServerConfiguration();
      if (detectedConfig) {
        this.config.apiUrl = detectedConfig.apiUrl;
        this.config.wsUrl = detectedConfig.wsUrl;
        this.logger.log('Configuração de servidor detectada automaticamente:');
        this.logger.log(`API URL: ${this.config.apiUrl}`);
        this.logger.log(`WebSocket URL: ${this.config.wsUrl}`);
        return true;
      } else {
        this.logger.log('Não foi possível detectar o servidor automaticamente.');
        return false;
      }
    } catch (error) {
      this.logger.error('Erro durante detecção automática', error);
      return false;
    }
  }
  
  async initialize() {
    try {
      this.logger.log('Verificando servidor...');
      
      // Tentar detectar servidor automaticamente
      await this.runServerScan();
      
      // Verificar se o servidor está acessível
      if (!await this.checkServerAvailability()) {
        this.logger.log('AVISO: Servidor não está acessível. Ativando modo de simulação local.');
        this.mockMode = true;
      }
      
      // Obter informações do servidor se não estiver em modo mock
      if (!this.mockMode) {
        try {
          await this.getServerInfo();
        } catch (error) {
          this.logger.log('Aviso: Não foi possível obter informações do servidor. Continuando mesmo assim...');
        }
      }
      
      // Criar e conectar jogadores de teste
      await this.connectTestPlayers();
      
      this.startSimulation();
      this.showCommands();
      
    } catch (error) {
      this.logger.error('Erro ao inicializar testes', error);
      this.promptRetryOptions();
    }
  }
  
  async checkServerAvailability() {
    this.logger.log(`Testando conexão com servidor em ${this.config.apiUrl}...`);
    
    // Tentar diferentes caminhos
    const endpointsToTry = [
      `${this.config.apiUrl}`,
      `${this.config.apiUrl}/health`,
      `${this.config.apiUrl}/status`,
      `${this.config.apiUrl.split('/api')[0]}`
    ];
    
    for (const endpoint of endpointsToTry) {
      try {
        this.logger.log(`Tentando acessar ${endpoint}...`, true);
        const response = await axios.get(endpoint, { timeout: 3000 });
        this.logger.log(`Conseguiu conexão com ${endpoint}, status: ${response.status}`, true);
        return true;
      } catch (error) {
        this.logger.log(`Falha ao acessar ${endpoint}: ${error.message}`, true);
      }
    }
    
    // Tentar cada endpoint fallback
    for (const fallback of this.config.fallbackEndpoints) {
      try {
        this.logger.log(`Tentando configuração fallback: API ${fallback.apiUrl}, WS ${fallback.wsUrl}`, true);
        const response = await axios.get(fallback.apiUrl, { timeout: 3000 });
        this.logger.log(`Conexão bem-sucedida com: ${fallback.apiUrl}`, true);
        this.config.apiUrl = fallback.apiUrl;
        this.config.wsUrl = fallback.wsUrl;
        return true;
      } catch (error) {
        this.logger.log(`Falha na configuração fallback: ${error.message}`, true);
      }
    }
    
    return false;
  }
  
  async getServerInfo() {
    this.logger.log(`Tentando obter informações do servidor de ${this.config.apiUrl}/server/info...`);
    try {
      const response = await axios.get(`${this.config.apiUrl}/server/info`, { timeout: 3000 });
      this.serverInfo = response.data;
      this.logger.log('Informações do servidor:', this.serverInfo);
      return true;
    } catch (error) {
      this.logger.log(`Erro ao obter informações do servidor: ${error.message}`, true);
      return false;
    }
  }
  
  async connectTestPlayers() {
    this.logger.log(`Iniciando conexão de ${this.config.numTestPlayers} jogadores de teste...`);
    let connectedCount = 0;
    
    for (let i = 1; i <= this.config.numTestPlayers; i++) {
      try {
        const player = new TestPlayer(i, this.logger, this.config, this.mockMode);
        this.players.push(player);
        
        await player.connect();
        connectedCount++;
      } catch (playerError) {
        this.logger.error(`Falha ao conectar jogador de teste #${i}`, playerError);
        // Continuar com os próximos jogadores
      }
    }
    
    if (connectedCount === 0 && !this.mockMode) {
      this.logger.log('Nenhum jogador conseguiu conectar. Ativando modo de simulação local.');
      this.mockMode = true;
      
      // Limpar jogadores existentes
      this.players.forEach(player => player.disconnect());
      this.players = [];
      
      // Adicionar jogadores simulados
      for (let i = 1; i <= this.config.numTestPlayers; i++) {
        const player = new TestPlayer(i, this.logger, this.config, true);
        await player.connect();
        this.players.push(player);
      }
      connectedCount = this.config.numTestPlayers;
    }
    
    this.logger.log(`${connectedCount} de ${this.config.numTestPlayers} jogadores ${this.mockMode ? 'simulados' : 'conectados'} com sucesso`);
    
    if (this.mockMode) {
      this.logger.log('\n⚠️ EXECUTANDO EM MODO DE SIMULAÇÃO LOCAL ⚠️');
      this.logger.log('O servidor não está acessível. As ações serão simuladas localmente.');
    }
    
    return connectedCount;
  }
  
  promptRetryOptions() {
    if (this.players.length > 0) {
      this.logger.log('\nAlguns jogadores conectados. Deseja continuar com recursos limitados? (s/n)');
      this.rl.question('', (answer) => {
        if (answer.toLowerCase() === 's') {
          this.showCommands();
        } else {
          this.shutdownTest();
        }
      });
    } else {
      this.logger.log('\nDeseja tentar modificar as configurações? (s/n)');
      this.rl.question('', (answer) => {
        if (answer.toLowerCase() === 's') {
          this.promptConfiguration();
        } else {
          this.shutdownTest();
        }
      });
    }
  }
  
  promptConfiguration() {
    this.logger.log('\n--- Configuração ---');
    this.rl.question('URL da API (ex: http://localhost:5500/api): ', (apiUrl) => {
      if (apiUrl) this.config.apiUrl = apiUrl;
      
      this.rl.question('URL do WebSocket (ex: ws://localhost:5500/game): ', (wsUrl) => {
        if (wsUrl) this.config.wsUrl = wsUrl;
        
        this.rl.question('Número de jogadores de teste (1-10): ', (numPlayers) => {
          const num = parseInt(numPlayers);
          if (!isNaN(num) && num > 0 && num <= 10) this.config.numTestPlayers = num;
          
          this.rl.question('Ativar modo de simulação local? (s/n): ', (mockMode) => {
            this.mockMode = mockMode.toLowerCase() === 's';
            
            this.logger.log('\nNovas configurações:');
            this.logger.log(`API URL: ${this.config.apiUrl}`);
            this.logger.log(`WebSocket URL: ${this.config.wsUrl}`);
            this.logger.log(`Jogadores de teste: ${this.config.numTestPlayers}`);
            this.logger.log(`Modo de simulação: ${this.mockMode ? 'Ativado' : 'Desativado'}`);
            
            this.rl.question('\nTentar conectar novamente? (s/n): ', (retry) => {
              if (retry.toLowerCase() === 's') {
                this.initialize();
              } else {
                this.shutdownTest();
              }
            });
          });
        });
      });
    });
  }
  
  startSimulation() {
    this.simulationActive = true;
    this.logger.log('Iniciando simulação de ações...');
    
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
    
    // Simular ações aleatórias dos jogadores
    this.simulationInterval = setInterval(() => {
      if (!this.simulationActive) return;
      
      this.simulateRandomActions();
    }, 2000);
  }
  
  simulateRandomActions() {
    // Escolher jogador aleatório para atirar
    if (Math.random() > 0.8) {
      const player = this.getRandomPlayer();
      const target = this.getRandomPlayer(player?.id);
      if (player && target) {
        player.simulateShot(target);
      }
    }
    
    // Simular mensagens de chat ocasionais
    if (Math.random() > 0.95) {
      const player = this.getRandomPlayer();
      const messages = [
        "Preciso de médico!",
        "Vamos capturar o ponto!",
        "Spy aqui!",
        "Engenheiro, precisamos de sentinela!",
        "Bom trabalho, time!"
      ];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      
      if (player) {
        player.sendChatMessage(randomMessage);
      }
    }
    
    // Em modo de mock, simular respostas do servidor
    if (this.mockMode && Math.random() > 0.9) {
      const targetPlayer = this.getRandomPlayer();
      const sourcePlayer = this.getRandomPlayer(targetPlayer?.id);
      
      if (targetPlayer && sourcePlayer) {
        const damage = Math.floor(Math.random() * 30) + 10;
        this.logger.log(`Simulação: ${sourcePlayer.username} causou ${damage} de dano em ${targetPlayer.username}`);
        
        // Simular processamento da mensagem
        targetPlayer.handleServerMessage(JSON.stringify({
          type: 'playerDamage',
          data: {
            damage: damage,
            sourcePlayer: sourcePlayer.username
          }
        }));
      }
    }
  }
  
  stopSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationActive = false;
      this.logger.log('Simulação interrompida');
    }
  }
  
  getRandomPlayer(excludeId = null) {
    const eligiblePlayers = this.players.filter(p => p.id !== excludeId && p.connected);
    if (eligiblePlayers.length === 0) return null;
    
    return eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)];
  }
  
  shutdownTest() {
    this.stopSimulation();
    
    // Desconectar todos os jogadores
    this.logger.log('Desconectando jogadores...');
    for (const player of this.players) {
      player.disconnect();
    }
    
    this.logger.log('Teste finalizado');
    this.rl.close();
    process.exit(0);
  }
  
  sendGlobalChatMessage(message) {
    for (const player of this.players) {
      if (player.connected) {
        player.sendChatMessage(message);
        break; // Apenas um jogador precisa enviar
      }
    }
  }
  
  async checkServerStatus() {
    if (this.mockMode) {
      this.logger.log('Executando em modo de simulação. O servidor não está disponível.');
      return false;
    }
    
    this.logger.log('Verificando status do servidor...');
    
    // Verificar API REST
    let serverResponding = false;
    const endpointsToTry = [
      `${this.config.apiUrl}`,
      `${this.config.apiUrl}/health`,
      `${this.config.apiUrl}/status`,
      `${this.config.apiUrl.split('/api')[0]}`
    ];
    
    for (const endpoint of endpointsToTry) {
      try {
        this.logger.log(`Tentando acessar ${endpoint}...`, true);
        const response = await axios.get(endpoint, { timeout: 3000 });
        this.logger.log(`Servidor respondendo em ${endpoint} com status: ${response.status}`);
        serverResponding = true;
        break;
      } catch (error) {
        this.logger.log(`Falha ao acessar ${endpoint}: ${error.message}`, true);
      }
    }
    
    if (!serverResponding) {
      this.logger.log('API REST não está respondendo em nenhum endpoint conhecido.');
    }
    
    // Verificar WebSocket
    try {
      this.logger.log(`Testando conexão WebSocket em ${this.config.wsUrl}...`);
      const wsResult = await this.scanner.testWebSocketConnection(this.config.wsUrl);
      if (wsResult) {
        this.logger.log('WebSocket respondendo normalmente');
      } else {
        this.logger.log('WebSocket não está respondendo corretamente');
      }
    } catch (wsError) {
      this.logger.error('WebSocket não está respondendo corretamente', wsError);
    }
    // Continuação da função checkServerStatus()
    return serverResponding;
  }
  
  showCommands() {
    this.logger.log('\n=== COMANDOS DISPONÍVEIS ===');
    this.logger.log('status - Verificar status do servidor');
    this.logger.log('chat [mensagem] - Enviar mensagem global de chat');
    this.logger.log('shoot - Simular tiro de jogador aleatório');
    this.logger.log('players - Listar jogadores conectados');
    this.logger.log('scan - Procurar o servidor novamente');
    this.logger.log('start - Iniciar simulação automática');
    this.logger.log('stop - Parar simulação automática');
    this.logger.log('config - Modificar configurações');
    this.logger.log('exit - Sair do teste');
    this.logger.log('help - Exibir esta ajuda\n');
    
    this.listenForCommands();
  }
  
  listenForCommands() {
    this.rl.question('> ', (input) => {
      const args = input.split(' ');
      const command = args[0].toLowerCase();
      
      switch (command) {
        case 'status':
          this.checkServerStatus().then(() => this.listenForCommands());
          break;
          
        case 'chat':
          const message = args.slice(1).join(' ');
          if (message) {
            this.sendGlobalChatMessage(message);
          } else {
            this.logger.log('Você precisa fornecer uma mensagem');
          }
          this.listenForCommands();
          break;
          
        case 'shoot':
          const shooter = this.getRandomPlayer();
          const target = this.getRandomPlayer(shooter?.id);
          if (shooter && target) {
            shooter.simulateShot(target);
            this.logger.log(`${shooter.username} atirou em ${target.username}`);
          } else {
            this.logger.log('Não há jogadores suficientes para simular tiro');
          }
          this.listenForCommands();
          break;
          
        case 'players':
          this.logger.log('\n=== JOGADORES CONECTADOS ===');
          for (const player of this.players) {
            this.logger.log(`${player.id}: ${player.username} | Classe: ${player.playerClass} | Time: ${player.team} | Conectado: ${player.connected ? 'Sim' : 'Não'}`);
          }
          this.listenForCommands();
          break;
          
        case 'scan':
          this.runServerScan().then(() => this.listenForCommands());
          break;
          
        case 'start':
          if (!this.simulationActive) {
            this.startSimulation();
            this.logger.log('Simulação automática iniciada');
          } else {
            this.logger.log('Simulação já está ativa');
          }
          this.listenForCommands();
          break;
          
        case 'stop':
          if (this.simulationActive) {
            this.stopSimulation();
            this.logger.log('Simulação automática parada');
          } else {
            this.logger.log('Simulação não está ativa');
          }
          this.listenForCommands();
          break;
          
        case 'config':
          this.promptConfiguration();
          break;
          
        case 'exit':
          this.shutdownTest();
          break;
          
        case 'help':
          this.showCommands();
          break;
          
        default:
          this.logger.log(`Comando "${command}" desconhecido. Digite "help" para ver a lista de comandos.`);
          this.listenForCommands();
          break;
      }
    });
  }
  
  async reconnectPlayer(playerId) {
    const player = this.players.find(p => p.id === playerId);
    
    if (!player) {
      this.logger.error(`Jogador com ID ${playerId} não encontrado`);
      return false;
    }
    
    this.logger.log(`Tentando reconectar jogador ${player.username}...`);
    
    try {
      // Primeiro desconectar se já estiver conectado
      if (player.connected) {
        player.disconnect();
      }
      
      // Tentar reconectar
      await player.connect();
      this.logger.log(`Jogador ${player.username} reconectado com sucesso`);
      return true;
    } catch (error) {
      this.logger.error(`Falha ao reconectar jogador ${player.username}`, error);
      return false;
    }
  }
  
  async addNewPlayer() {
    const newId = this.players.length + 1;
    const player = new TestPlayer(newId, this.logger, this.config, this.mockMode);
    
    try {
      this.logger.log(`Adicionando novo jogador #${newId}...`);
      await player.connect();
      this.players.push(player);
      this.logger.log(`Jogador ${player.username} adicionado com sucesso`);
      return true;
    } catch (error) {
      this.logger.error(`Falha ao adicionar novo jogador #${newId}`, error);
      return false;
    }
  }
}

/**
 * Função principal
 */
async function main() {
  console.log("=================================================");
  console.log("  Cliente de Teste para Clone de TF2");
  console.log("  Versão 1.0.0");
  console.log("=================================================");
  console.log("\nInicializando...\n");
  
  const testManager = new TestManager();
  await testManager.initialize();
}

// Iniciar o programa
main().catch(error => {
  console.error('Erro fatal no programa:', error);
  process.exit(1);
});