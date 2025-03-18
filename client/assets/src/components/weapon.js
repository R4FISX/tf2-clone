class Weapon {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.name = "Basic Rifle";
        this.damage = 20;
        this.fireRate = 10; // frames between shots
        this.fireTimer = 0;
        this.range = 100;
        this.maxAmmo = 30;
        this.currentAmmo = this.maxAmmo;
        this.reloadTime = 60; // frames
        this.isReloading = false;
        this.reloadTimer = 0;
        this.mesh = null;
        this.muzzleFlash = null;
        this.muzzleFlashTimer = 0;
        
        // Create weapon mesh for non-local players
        if (!player.isLocal) {
            this.createWeaponMesh();
        }
        
        // Setup shooting controls for local player
        if (player.isLocal) {
            this.setupControls();
        }
    }
    
    createWeaponMesh() {
        // Create a simple weapon mesh for remote players
        this.mesh = BABYLON.MeshBuilder.CreateBox(
            "weapon-" + this.player.id, 
            { width: 0.1, height: 0.1, depth: 0.8 }, 
            this.scene
        );
        
        // Position it in the player's "hand"
        this.mesh.parent = this.player.mesh;
        this.mesh.position = new BABYLON.Vector3(0.4, 0, 0.5);
        
        // Material
        const material = new BABYLON.StandardMaterial("weapon-mat-" + this.player.id, this.scene);
        material.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        this.mesh.material = material;
        
        // Create muzzle flash (disabled by default)
        this.muzzleFlash = BABYLON.MeshBuilder.CreateCylinder(
            "muzzle-flash-" + this.player.id,
            { diameterTop: 0, diameterBottom: 0.2, height: 0.5 },
            this.scene
        );
        this.muzzleFlash.parent = this.mesh;
        this.muzzleFlash.position.z = 0.65;
        this.muzzleFlash.rotation.x = Math.PI / 2;
        
        const muzzleMat = new BABYLON.StandardMaterial("muzzle-mat-" + this.player.id, this.scene);
        muzzleMat.diffuseColor = new BABYLON.Color3(1, 0.7, 0);
        muzzleMat.emissiveColor = new BABYLON.Color3(1, 0.7, 0);
        muzzleMat.specularColor = new BABYLON.Color3(0, 0, 0);
        this.muzzleFlash.material = muzzleMat;
        
        // Hide muzzle flash initially
        this.muzzleFlash.setEnabled(false);
    }
    
    setupControls() {
        // Setup mouse click to shoot
        window.addEventListener("mousedown", (evt) => {
            if (evt.button === 0) { // Left mouse button
                this.startFiring();
            }
        });
        
        window.addEventListener("mouseup", (evt) => {
            if (evt.button === 0) { // Left mouse button
                this.stopFiring();
            }
        });
        
        // Reload key
        window.addEventListener("keydown", (evt) => {
            if (evt.code === "KeyR") {
                this.reload();
            }
        });
    }
    
    startFiring() {
        this.isFiring = true;
    }
    
    stopFiring() {
        this.isFiring = false;
    }
    
    shoot() {
        if (this.isReloading) return;
        if (this.currentAmmo <= 0) {
            this.reload();
            return;
        }
        
        // Reduce ammo
        this.currentAmmo--;
        
        // Get camera direction for local player
        let origin, direction;
        
        if (this.player.isLocal) {
            const camera = this.scene.activeCamera;
            origin = camera.position.clone();
            direction = camera.getDirection(BABYLON.Vector3.Forward());
        } else {
            // For remote players, use their position/rotation
            origin = this.player.position.clone();
            
            // Create a direction vector based on player's Y rotation
            direction = new BABYLON.Vector3(
                Math.sin(this.player.rotation.y),
                0,
                Math.cos(this.player.rotation.y)
            );
        }
        
        // Raycast to detect hits
        const ray = new BABYLON.Ray(origin, direction, this.range);
        const raycastHit = this.scene.pickWithRay(ray, (mesh) => {
            // Don't detect the player's own mesh
            return mesh !== this.player.mesh && 
                  (!this.mesh || mesh !== this.mesh);
        });
        
        // Show muzzle flash
        this.showMuzzleFlash();
        
        // If we hit something
        if (raycastHit.hit) {
            // Create impact effect
            this.createImpactEffect(raycastHit.pickedPoint);
            
            // Create bullet trail
            this.createBulletTrail(origin, raycastHit.pickedPoint);
            
            // Check if we hit a player
            const hitPlayer = this.findPlayerByMesh(raycastHit.pickedMesh);
            if (hitPlayer) {
                hitPlayer.takeDamage(this.damage);
                console.log("Hit player " + hitPlayer.id + " for " + this.damage + " damage!");
                
                // Create hit marker if local player hit someone
                if (this.player.isLocal) {
                    this.createHitMarker();
                }
            }
        } else {
            // Create bullet trail to max range if nothing was hit
            const endPoint = origin.add(direction.scale(this.range));
            this.createBulletTrail(origin, endPoint);
        }
        
        // Trigger network event for shot
        // This would be handled by the network.js module
        if (this.player.isLocal && window.gameNetwork) {
            window.gameNetwork.sendShoot(origin, direction);
        }
        
        // Update HUD
        this.updateAmmoDisplay();
    }
    
    reload() {
        if (this.isReloading || this.currentAmmo === this.maxAmmo) return;
        
        this.isReloading = true;
        this.reloadTimer = this.reloadTime;
        
        console.log("Reloading...");
        
        // Update HUD to show reloading
        this.updateAmmoDisplay("Reloading...");
    }
    
    finishReload() {
        this.currentAmmo = this.maxAmmo;
        this.isReloading = false;
        console.log("Reload complete!");
        
        // Update HUD
        this.updateAmmoDisplay();
    }
    
    showMuzzleFlash() {
        if (this.muzzleFlash) {
            this.muzzleFlash.setEnabled(true);
            this.muzzleFlashTimer = 4; // Show for 4 frames
        }
        
        // For local player, add a flash effect to the screen
        if (this.player.isLocal) {
            // This could be handled by the UI module
            // Simple flash effect for now
            const canvas = this.scene.getEngine().getRenderingCanvas();
            canvas.style.boxShadow = "0 0 30px rgba(255, 150, 0, 0.5) inset";
            setTimeout(() => {
                canvas.style.boxShadow = "";
            }, 50);
        }
    }
    
    hideMuzzleFlash() {
        if (this.muzzleFlash) {
            this.muzzleFlash.setEnabled(false);
        }
    }
    
    createBulletTrail(start, end) {
        // Create a line for the bullet trail
        const trail = BABYLON.MeshBuilder.CreateLines(
            "bulletTrail",
            { points: [start, end] },
            this.scene
        );
        
        // Yellow color for bullet trail
        trail.color = new BABYLON.Color3(1, 1, 0);
        
        // Fade out and remove after a short time
        setTimeout(() => {
            trail.dispose();
        }, 100);
    }
    
    createImpactEffect(position) {
        // Create particle system for impact
        const impact = new BABYLON.ParticleSystem("impact", 20, this.scene);
        impact.emitter = position;
        impact.minEmitBox = new BABYLON.Vector3(-0.1, -0.1, -0.1);
        impact.maxEmitBox = new BABYLON.Vector3(0.1, 0.1, 0.1);
        
        // Particles
        impact.color1 = new BABYLON.Color4(1, 1, 1, 1);
        impact.color2 = new BABYLON.Color4(0.8, 0.8, 0.8, 1);
        impact.colorDead = new BABYLON.Color4(0, 0, 0, 0);
        
        impact.minSize = 0.03;
        impact.maxSize = 0.1;
        
        impact.minLifeTime = 0.1;
        impact.maxLifeTime = 0.3;
        
        impact.emitRate = 300;
        
        impact.gravity = new BABYLON.Vector3(0, -9.81, 0);
        
        impact.direction1 = new BABYLON.Vector3(-1, 1, -1);
        impact.direction2 = new BABYLON.Vector3(1, 1, 1);
        
        impact.minEmitPower = 1;
        impact.maxEmitPower = 3;
        
        impact.start();
        
        // Stop emitting after a short time
        setTimeout(() => {
            impact.stop();
            // Dispose after particles fade
            setTimeout(() => {
                impact.dispose();
            }, 500);
        }, 50);
    }
    
    createHitMarker() {
        // This would be handled by the UI module
        // Simple implementation for now
        const hitMarker = document.createElement("div");
        hitMarker.style.position = "absolute";
        hitMarker.style.top = "50%";
        hitMarker.style.left = "50%";
        hitMarker.style.width = "20px";
        hitMarker.style.height = "20px";
        hitMarker.style.transform = "translate(-50%, -50%)";
        hitMarker.style.pointerEvents = "none";
        hitMarker.innerHTML = "✓";
        hitMarker.style.color = "red";
        hitMarker.style.fontSize = "24px";
        hitMarker.style.fontWeight = "bold";
        hitMarker.style.textShadow = "0 0 3px white";
        
        document.body.appendChild(hitMarker);
        
        // Remove after a short time
        setTimeout(() => {
            document.body.removeChild(hitMarker);
        }, 200);
    }
    
    updateAmmoDisplay(text) {
        // This would be handled by the UI module
        // Simple implementation for now
        const ammoDisplay = document.querySelector(".ammo");
        if (ammoDisplay) {
            if (text) {
                ammoDisplay.textContent = text;
            } else {
                ammoDisplay.textContent = `Ammo: ${this.currentAmmo}/${this.maxAmmo}`;
            }
        }
    }
    
    findPlayerByMesh(mesh) {
        // This would be handled by the game.js module
        // Simple implementation for now
        if (window.gamePlayers) {
            return window.gamePlayers.find(p => p.mesh === mesh);
        }
        return null;
    }
    
    update() {
        // Handle firing cooldown
        if (this.fireTimer > 0) {
            this.fireTimer--;
        }
        
        // Handle reloading
        if (this.isReloading) {
            this.reloadTimer--;
            if (this.reloadTimer <= 0) {
                this.finishReload();
            }
        }
        
        // Handle muzzle flash
        if (this.muzzleFlashTimer > 0) {
            this.muzzleFlashTimer--;
            if (this.muzzleFlashTimer <= 0) {
                this.hideMuzzleFlash();
            }
        }
        
        // Handle automatic firing
        if (this.isFiring && this.fireTimer <= 0 && !this.isReloading) {
            this.shoot();
            this.fireTimer = this.fireRate;
        }
    }
}

export default Weapon;