class Controls {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.moveDirection = new BABYLON.Vector3();
        this.horizontalRotation = 0;
        this.verticalRotation = 0;
        this.moveSpeed = 0.15;
        this.jumpForce = 0.2;
        this.gravity = -0.01;
        this.jumpCooldown = 0;
        this.onGround = false;
        this.velocity = new BABYLON.Vector3(0, 0, 0);
        
        // Input flags
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false
        };
        
        // Lock pointer
        this.initPointerLock();
        
        // Setup keyboard inputs
        this.setupInputs();
    }
    
    initPointerLock() {
        // Click event to request pointer lock
        this.scene.getEngine().getRenderingCanvas().addEventListener("click", () => {
            this.scene.getEngine().getRenderingCanvas().requestPointerLock = 
                this.scene.getEngine().getRenderingCanvas().requestPointerLock || 
                this.scene.getEngine().getRenderingCanvas().msRequestPointerLock || 
                this.scene.getEngine().getRenderingCanvas().mozRequestPointerLock || 
                this.scene.getEngine().getRenderingCanvas().webkitRequestPointerLock;
                
            if(this.scene.getEngine().getRenderingCanvas().requestPointerLock) {
                this.scene.getEngine().getRenderingCanvas().requestPointerLock();
            }
        });
        
        // Mouse movement event
        const onPointerMove = (evt) => {
            const movementX = evt.movementX || evt.mozMovementX || evt.webkitMovementX || 0;
            const movementY = evt.movementY || evt.mozMovementY || evt.webkitMovementY || 0;
            
            this.horizontalRotation += movementX * 0.002;
            this.verticalRotation -= movementY * 0.002;
            
            // Limit vertical rotation to avoid flipping
            this.verticalRotation = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.verticalRotation));
            
            // Apply rotation to camera
            this.camera.rotation.y = this.horizontalRotation;
            this.camera.rotation.x = this.verticalRotation;
        };
        
        document.addEventListener("mousemove", onPointerMove);
    }
    
    setupInputs() {
        // Keyboard down event
        window.addEventListener("keydown", (evt) => {
            switch(evt.code) {
                case "KeyW":
                    this.keys.forward = true;
                    break;
                case "KeyS":
                    this.keys.backward = true;
                    break;
                case "KeyA":
                    this.keys.left = true;
                    break;
                case "KeyD":
                    this.keys.right = true;
                    break;
                case "Space":
                    this.keys.jump = true;
                    break;
            }
        });
        
        // Keyboard up event
        window.addEventListener("keyup", (evt) => {
            switch(evt.code) {
                case "KeyW":
                    this.keys.forward = false;
                    break;
                case "KeyS":
                    this.keys.backward = false;
                    break;
                case "KeyA":
                    this.keys.left = false;
                    break;
                case "KeyD":
                    this.keys.right = false;
                    break;
                case "Space":
                    this.keys.jump = false;
                    break;
            }
        });
    }
    
    update() {
        // Reset move direction
        this.moveDirection.setAll(0);
        
        // Calculate move direction based on key inputs and camera orientation
        const cameraDirection = this.camera.getDirection(BABYLON.Vector3.Forward());
        const cameraRight = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), cameraDirection).normalize();
        
        // Forward/backward
        if (this.keys.forward) {
            this.moveDirection.addInPlace(cameraDirection.scale(this.moveSpeed));
        }
        if (this.keys.backward) {
            this.moveDirection.subtractInPlace(cameraDirection.scale(this.moveSpeed));
        }
        
        // Left/right strafe
        if (this.keys.right) {
            this.moveDirection.addInPlace(cameraRight.scale(this.moveSpeed));
        }
        if (this.keys.left) {
            this.moveDirection.subtractInPlace(cameraRight.scale(this.moveSpeed));
        }
        
        // Normalize to get direction only
        if (this.moveDirection.length() > 0) {
            // Only normalize horizontal movement
            const horizontalMove = new BABYLON.Vector3(this.moveDirection.x, 0, this.moveDirection.z);
            if (horizontalMove.length() > 0) {
                horizontalMove.normalize();
                this.moveDirection.x = horizontalMove.x * this.moveSpeed;
                this.moveDirection.z = horizontalMove.z * this.moveSpeed;
            }
        }
        
        // Apply jumping and gravity
        if (this.jumpCooldown > 0) {
            this.jumpCooldown--;
        }
        
        // Check if on ground (simple check, can be improved)
        const ray = new BABYLON.Ray(this.camera.position, BABYLON.Vector3.Down(), 1.2);
        const raycastHit = this.scene.pickWithRay(ray);
        this.onGround = raycastHit.hit;
        
        // Apply gravity if not on ground
        if (!this.onGround) {
            this.velocity.y += this.gravity;
        } else {
            this.velocity.y = 0;
            
            // Jump when on ground
            if (this.keys.jump && this.jumpCooldown <= 0) {
                this.velocity.y = this.jumpForce;
                this.jumpCooldown = 20; // prevent jump spam
            }
        }
        
        // Apply horizontal movement
        this.velocity.x = this.moveDirection.x;
        this.velocity.z = this.moveDirection.z;
        
        // Apply movement to camera
        this.camera.position.addInPlace(this.velocity);
    }
}

export default Controls;