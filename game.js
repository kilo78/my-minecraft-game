// Setting up the scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 10, 5).normalize();
scene.add(ambientLight);
scene.add(directionalLight);

// Load textures
const loader = new THREE.TextureLoader();
const textures = {
    grass: loader.load('textures/grass.png'),
    dirt: loader.load('textures/dirt.png'),
    stone: loader.load('textures/stone.png'),
    water: loader.load('textures/water.png'),
    wood: loader.load('textures/wood.png'),
    sand: loader.load('textures/sand.png'),
    // Add more textures as needed
};

// Define items with textures
const items = {
    'grass_block': { texture: textures.grass, name: 'Grass Block' },
    'dirt_block': { texture: textures.dirt, name: 'Dirt Block' },
    'stone_block': { texture: textures.stone, name: 'Stone Block' },
    'wood_block': { texture: textures.wood, name: 'Wood Block' },
    'sand_block': { texture: textures.sand, name: 'Sand Block' },
    // Add more items as needed
};

// Inventory system
const inventory = [];
const maxInventorySize = 10;

function addItemToInventory(item) {
    if (inventory.length < maxInventorySize) {
        inventory.push(item);
        console.log(`Added ${item} to inventory`);
    } else {
        console.log("Inventory is full!");
    }
}

function selectItem(index) {
    return inventory[index] || null;
}

// Create a block
function createBlock(texture) {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshLambertMaterial({ map: texture });
    return new THREE.Mesh(geometry, material);
}

// Chunk size and world settings
const CHUNK_SIZE = 16;
const worldSize = 4; // Number of chunks in each direction
const chunks = [];
const loadedChunks = new Set();
const renderDistance = 2;

// Game modes
const GameMode = {
    SURVIVAL: 'survival',
    CREATIVE: 'creative',
    ADVENTURE: 'adventure',
    SPECTATOR: 'spectator'
};
let currentMode = GameMode.SURVIVAL;

// Simple Perlin noise function for terrain generation
function noise(x, y) {
    return Math.sin(x) * Math.cos(y); // Placeholder noise function
}

// Create a chunk
function createChunk(xOffset, zOffset) {
    const chunk = new THREE.Group();
    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const height = Math.max(noise(x + xOffset * CHUNK_SIZE, z + zOffset * CHUNK_SIZE) * 10, 2);
                let block;
                if (y < height - 1) block = createBlock(textures.stone);
                else if (y < height) block = createBlock(textures.dirt);
                else block = createBlock(textures.grass);

                block.position.set(x + xOffset * CHUNK_SIZE, y, z + zOffset * CHUNK_SIZE);
                chunk.add(block);
            }
        }
    }
    return chunk;
}

// Add chunks to the scene
function loadChunks() {
    const px = Math.floor(camera.position.x / CHUNK_SIZE);
    const pz = Math.floor(camera.position.z / CHUNK_SIZE);

    for (let x = px - renderDistance; x <= px + renderDistance; x++) {
        for (let z = pz - renderDistance; z <= pz + renderDistance; z++) {
            const key = `${x},${z}`;
            if (!loadedChunks.has(key)) {
                const chunk = createChunk(x, z);
                chunk.position.set(x * CHUNK_SIZE, 0, z * CHUNK_SIZE);
                chunks.push(chunk);
                scene.add(chunk);
                loadedChunks.add(key);
            }
        }
    }

    // Remove chunks that are too far away
    chunks.forEach(chunk => {
        const pos = chunk.position;
        const dx = Math.abs(camera.position.x - pos.x);
        const dz = Math.abs(camera.position.z - pos.z);
        if (dx > (renderDistance + 1) * CHUNK_SIZE || dz > (renderDistance + 1) * CHUNK_SIZE) {
            scene.remove(chunk);
            loadedChunks.delete(`${pos.x / CHUNK_SIZE},${pos.z / CHUNK_SIZE}`);
        }
    });
}

// Switch game modes
function switchMode(mode) {
    currentMode = mode;
    console.log(`Switched to ${mode} mode`);
}

// First-person controls
const controls = new THREE.PointerLockControls(camera, renderer.domElement);
document.addEventListener('click', () => controls.lock());

// Handle player movement
const movementSpeed = 0.1;
const jumpSpeed = 0.2;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
document.addEventListener('keydown', (event) => {
    const speed = movementSpeed;
    switch (event.key) {
        case 'w': direction.z = -speed; break;
        case 's': direction.z = speed; break;
        case 'a': direction.x = -speed; break;
        case 'd': direction.x = speed; break;
        case ' ': velocity.y = jumpSpeed; break;
        case '1': switchMode(GameMode.SURVIVAL); break;
        case '2': switchMode(GameMode.CREATIVE); break;
        case '3': switchMode(GameMode.ADVENTURE); break;
        case '4': switchMode(GameMode.SPECTATOR); break;
        case 'i': addItemToInventory('grass_block'); break;
        case 'j': addItemToInventory('wood_block'); break;
        case 'k': addItemToInventory('stone_block'); break;
    }
});
document.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'w':
        case 's': direction.z = 0; break;
        case 'a':
        case 'd': direction.x = 0; break;
    }
});

// Update player position and velocity
function updatePlayer() {
    if (currentMode === GameMode.CREATIVE || currentMode === GameMode.SPECTATOR) {
        // Creative and Spectator modes: Flying
        if (currentMode === GameMode.SPECTATOR) {
            controls.getObject().position.add(direction.clone().multiplyScalar(movementSpeed * 2));
        } else {
            controls.getObject().position.add(direction.clone().multiplyScalar(movementSpeed));
        }
    } else {
        // Survival and Adventure modes: Walking and jumping
        controls.getObject().position.add(direction.clone().multiplyScalar(movementSpeed));
        controls.getObject().position.add(velocity.clone().multiplyScalar(movementSpeed));
        velocity.y -= 0.01; // Simulate gravity
        controls.getObject().position.y += velocity.y;
    }
}

// Day/Night cycle
const clock = new THREE.Clock();
function updateLighting() {
    const time = clock.getElapsedTime();
    directionalLight.position.set(Math.sin(time) * 10, 10, Math.cos(time) * 10);
}

// Block interaction
const raycaster = new THREE.Raycaster();
const intersects = [];
document.addEventListener('click', () => {
    raycaster.ray.origin.copy(camera.position);
    raycaster.ray.direction.copy(camera.getWorldDirection(new THREE.Vector3()));
    intersects.length = 0;
    raycaster.intersectObject(scene, true).forEach(intersect => {
        if (intersect.object !== camera) {
            intersects.push(intersect);
        }
    });

    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        const selectedItem = selectItem(0); // Get the first item in the inventory for simplicity

        if (selectedItem) {
            if (currentMode === GameMode.CREATIVE) {
                // In Creative mode, allow block placement
                const newBlock = createBlock(items[selectedItem].texture);
                newBlock.position.copy(intersects[0].point);
                scene.add(newBlock);
            } else if (currentMode === GameMode.SURVIVAL) {
                // In Survival mode, you could add logic for breaking blocks or other interactions
            }
        }
    }
});

// Render loop
function animate() {
    requestAnimationFrame(animate);
    updatePlayer();
    loadChunks();
    updateLighting();
    renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});
