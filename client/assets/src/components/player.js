import Weapon from './weapon.js';

class Player {
    constructor(scene, id, isLocal = false) {
        this.scene = scene;
        this.id = id;
        this.isLocal = isLocal;
        this.position = new BABYLON.Vector3(0, 2, 0);
        this.rotation = new BABYLON.Vector3(0, 0, 0);
        this.mesh = null;
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.team = "red"; // "red" or "blue"
        this.playerClass = "soldier"; // default class
        this.respawnTime = 5; // seconds
        this.isDead = false;
        this.speed = 1.0; // base speed multiplier
        
        // Create the weapon
        this.weapon = new Weapon(scene, this);
        
        // Initialize player mesh
        this.initialize();
    }
    
    initialize() {
        if (this.isLocal) {
            // For local player, we use the camera and don't need a visible model
            return;
        }
        
        // Create a simple capsule for remote players
        this.mesh = BABYLON.MeshBuilder.CreateCapsule(
            "player-" + this.id, 
            { radius: 0.5, height: 1.8 }, 
            this.scene
        );
        
        // Set position
        this.mesh.position = this.position.clone();
        
        // Set collision
        this.mesh.checkCollisions = true;
        
        // Create a material for the player based on team
        const material = new BABYLON.StandardMaterial("player-mat-" + this.id, this.scene);
        material.diffuseColor = this.team === "red" ? 
            new BABYLON.Color3(0.9, 0.2, 0.2) : // Red team
            new BABYLON.Color3(0.2, 0.2, 0.9); // Blue team
        
        this.mesh.material = material;
        
        // Create simple health bar
        this.createHealthBar();
    }
    
    createHealthBar() {
        // Health bar container
        const healthBarContainer = BABYLON.MeshBuilder.CreatePlane(
            "healthbar-container-" + this.id,
            { width: 1, height: 0.2 },
            this.scene
        );
        healthBarContainer.parent = this.mesh;
        healthBarContainer.position.y = 1.5; // Above player's head
        healthBarContainer.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        
        // Background
        const healthBarBg = BABYLON.MeshBuilder.CreatePlane(
            "healthbar-bg-" + this.id,
            { width: 1, height: 0.2 },
            this.scene
        );
        healthBarBg.parent = healthBarContainer;
        healthBarBg.position.z = 0.01;
        
        const bgMat = new BABYLON.StandardMaterial("healthbar-bg-mat-" + this.id, this.scene);
        bgMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        bgMat.specularColor = new BABYLON.Color3(0, 0, 0);
        healthBarBg.material = bgMat;
        
        // Health fill
        this.healthBar = BABYLON.MeshBuilder.CreatePlane(
            "healthbar-fill-" + this.id,
            { width: 1, height: 0.2 },
            this.scene
        );
        this.healthBar.parent = healthBarContainer;
        this.healthBar.position.z = 0.02;
        
        const healthMat = new BABYLON.StandardMaterial("healthbar-fill-mat-" + this.id, this.scene);
        healthMat.diffuseColor = new BABYLON.Color3(0.2, 0.9, 0.2);
        healthMat.specularColor = new BABYLON.Color3(0, 0, 0);
        this.healthBar.material = healthMat;
        
        // Update health bar scaling
        this.updateHealthBar();
    }
    
    updateHealthBar() {
        if (this.healthBar) {
            const healthPercent = this.health / this.maxHealth;
            this.healthBar.scaling.x = healthPercent;
            // Center the scaling pivot
            this.healthBar.position.x = -0.5 + (healthPercent / 2);
            
            // Change color based on health
            const healthMat = this.healthBar.material;
            if (healthPercent > 0.6) {
                healthMat.diffuseColor = new BABYLON.Color3(0.2, 0.9, 0.2); // Green
            } else if (healthPercent > 0.3) {
                healthMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.2); // Yellow
            } else {
                healthMat.diffuseColor = new BABYLON.Color3(0.9, 0.2, 0.2); // Red
            }
        }
    }
    
    takeDamage(amount) {
        if (this.isDead) return;
        
        this.health -= amount;
        this.updateHealthBar();
        
        // Check if player died
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        this.isDead = true;
        this.health = 0;
        
        if (this.mesh) {
            // Hide the mesh
            this.mesh.setEnabled(false);
        }
        
        // Schedule respawn
        setTimeout(() => this.respawn(), this.respawnTime * 1000);
        
        // Event handling (can be expanded)
        console.log("Player " + this.id + " died");
    }
    
    respawn() {
        // Reset health
        this.health = this.maxHealth;
        this.isDead = false;
        
        // Reset position (can be improved to use spawn points)
        this.position = new BABYLON.Vector3(
            Math.random() * 10 - 5, // Random X
            2,                      // Fixed Y
            Math.random() * 10 - 5  // Random Z
        );
        
        if (this.mesh) {
            // Show the mesh and update position
            this.mesh.setEnabled(true);
            this.mesh.position = this.position.clone();
        }
        
        // Update health bar
        this.updateHealthBar();
        
        // Event handling
        console.log("Player " + this.id + " respawned");
    }
    
    update() {
        if (this.isDead) return;
        
        // Update weapon
        this.weapon.update();
        
        // For remote players, update their position/rotation
        if (!this.isLocal && this.mesh) {
            this.mesh.position = this.position.clone();
            this.mesh.rotation.y = this.rotation.y;
        }
    }
    
    // Update player position from network
    setNetworkPosition(position, rotation) {
        this.position.x = position.x;
        this.position.y = position.y;
        this.position.z = position.z;
        
        this.rotation.y = rotation.y;
    }
}

export default Player;