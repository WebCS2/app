const canvas = document.getElementById("game");
const ctx = canvas.getContext("3d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// World settings
const TILE_SIZE = 32;
const WORLD_WIDTH = 64;
const WORLD_HEIGHT = 32;

// Block types
const BLOCKS = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
};

const BLOCK_COLORS = {
  [BLOCKS.AIR]: null,
  [BLOCKS.GRASS]: "#3cb043",
  [BLOCKS.DIRT]: "#8b4513",
  [BLOCKS.STONE]: "#888888",
};

// Simple inventory (keys 1–3)
const INVENTORY = [
  { id: BLOCKS.GRASS, key: "1" },
  { id: BLOCKS.DIRT, key: "2" },
  { id: BLOCKS.STONE, key: "3" },
];

let selectedSlot = 0;

// Build UI inventory
const inventoryDiv = document.getElementById("inventory");
function renderInventoryUI() {
  inventoryDiv.innerHTML = "";
  INVENTORY.forEach((slot, i) => {
    const div = document.createElement("div");
    div.className = "slot" + (i === selectedSlot ? " selected" : "");
    div.textContent = slot.key;
    div.style.background = BLOCK_COLORS[slot.id] || "transparent";
    div.addEventListener("click", () => {
      selectedSlot = i;
      renderInventoryUI();
    });
    inventoryDiv.appendChild(div);
  });
}
renderInventoryUI();

// Generate world (simple terrain)
const world = [];
for (let y = 0; y < WORLD_HEIGHT; y++) {
  world[y] = [];
  for (let x = 0; x < WORLD_WIDTH; x++) {
    const groundLevel = Math.floor(WORLD_HEIGHT / 2);
    if (y < groundLevel - 3) {
      world[y][x] = BLOCKS.AIR;
    } else if (y === groundLevel - 3) {
      world[y][x] = BLOCKS.GRASS;
    } else if (y < groundLevel + 3) {
      world[y][x] = BLOCKS.DIRT;
    } else {
      world[y][x] = BLOCKS.STONE;
    }
  }
}

// Player
const player = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  vx: 0,
  vy: 0,
  width: 0.6,
  height: 1.8,
  speed: 6,
  onGround: false,
};

const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;

  // Inventory hotkeys
  if (e.key === "1" || e.key === "2" || e.key === "3") {
    const idx = INVENTORY.findIndex((s) => s.key === e.key);
    if (idx !== -1) {
      selectedSlot = idx;
      renderInventoryUI();
    }
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Camera
const camera = { x: 0, y: 0 };

// Physics
const GRAVITY = 25;
const JUMP_VELOCITY = -10;

function isSolid(blockId) {
  return blockId !== BLOCKS.AIR;
}

function getBlock(x, y) {
  if (x < 0 || y < 0 || x >= WORLD_WIDTH || y >= WORLD_HEIGHT) return BLOCKS.AIR;
  return world[y][x];
}

function setBlock(x, y, id) {
  if (x < 0 || y < 0 || x >= WORLD_WIDTH || y >= WORLD_HEIGHT) return;
  world[y][x] = id;
}

// Mouse interaction
let mouseWorldX = 0;
let mouseWorldY = 0;

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;
  mouseWorldX = (screenX / TILE_SIZE) + camera.x;
  mouseWorldY = (screenY / TILE_SIZE) + camera.y;
});

canvas.addEventListener("mousedown", (e) => {
  const tx = Math.floor(mouseWorldX);
  const ty = Math.floor(mouseWorldY);

  if (e.button === 0) {
    // Place block
    const blockId = INVENTORY[selectedSlot].id;
    // Prevent placing inside player
    if (!isPlayerOverlappingTile(tx, ty)) {
      setBlock(tx, ty, blockId);
    }
  } else if (e.button === 2) {
    // Break block
    setBlock(tx, ty, BLOCKS.AIR);
  }
});

// Prevent context menu on right click
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

function isPlayerOverlappingTile(tx, ty) {
  const left = player.x - player.width / 2;
  const right = player.x + player.width / 2;
  const top = player.y - player.height;
  const bottom = player.y;

  const tileLeft = tx;
  const tileRight = tx + 1;
  const tileTop = ty;
  const tileBottom = ty + 1;

  return !(
    right <= tileLeft ||
    left >= tileRight ||
    bottom <= tileTop ||
    top >= tileBottom
  );
}

// Game loop
let lastTime = performance.now();

function update(dt) {
  // Horizontal input
  let move = 0;
  if (keys["a"] || keys["arrowleft"]) move -= 1;
  if (keys["d"] || keys["arrowright"]) move += 1;

  player.vx = move * player.speed;

  // Jump
  if ((keys["w"] || keys["arrowup"] || keys[" "]) && player.onGround) {
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
  }

  // Gravity
  player.vy += GRAVITY * dt;

  // Move and collide
  moveAndCollide(player, dt);

  // Camera follows player
  camera.x = player.x - canvas.width / TILE_SIZE / 2;
  camera.y = player.y - canvas.height / TILE_SIZE / 2;
}

function moveAndCollide(p, dt) {
  // Horizontal
  let newX = p.x + p.vx * dt;
  if (!collidesAt(newX, p.y, p.width, p.height)) {
    p.x = newX;
  } else {
    // Slide until touching
    while (!collidesAt(p.x + Math.sign(p.vx) * 0.01, p.y, p.width, p.height)) {
      p.x += Math.sign(p.vx) * 0.01;
    }
    p.vx = 0;
  }

  // Vertical
  let newY = p.y + p.vy * dt;
  p.onGround = false;
  if (!collidesAt(p.x, newY, p.width, p.height)) {
    p.y = newY;
  } else {
    // Slide until touching
    while (!collidesAt(p.x, p.y + Math.sign(p.vy) * 0.01, p.width, p.height)) {
      p.y += Math.sign(p.vy) * 0.01;
    }
    if (p.vy > 0) p.onGround = true;
    p.vy = 0;
  }
}

function collidesAt(cx, cy, w, h) {
  const left = Math.floor(cx - w / 2);
  const right = Math.floor(cx + w / 2);
  const top = Math.floor(cy - h);
  const bottom = Math.floor(cy);

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (isSolid(getBlock(x, y))) return true;
    }
  }
  return false;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const startX = Math.floor(camera.x);
  const startY = Math.floor(camera.y);
  const endX = Math.ceil(camera.x + canvas.width / TILE_SIZE);
  const endY = Math.ceil(camera.y + canvas.height / TILE_SIZE);

  // Draw background
  ctx.fillStyle = "#5ca0ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw tiles
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const block = getBlock(x, y);
      if (block !== BLOCKS.AIR) {
        const color = BLOCK_COLORS[block];
        if (!color) continue;
        const screenX = (x - camera.x) * TILE_SIZE;
        const screenY = (y - camera.y) * TILE_SIZE;
        ctx.fillStyle = color;
        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // Draw player
  const px = (player.x - camera.x - player.width / 2) * TILE_SIZE;
  const py = (player.y - camera.y - player.height) * TILE_SIZE;
  ctx.fillStyle = "#ffdd55";
  ctx.fillRect(px, py, player.width * TILE_SIZE, player.height * TILE_SIZE);

  // Draw mouse highlight
  const tx = Math.floor(mouseWorldX);
  const ty = Math.floor(mouseWorldY);
  const hx = (tx - camera.x) * TILE_SIZE;
  const hy = (ty - camera.y) * TILE_SIZE;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.strokeRect(hx + 1, hy + 1, TILE_SIZE - 2, TILE_SIZE - 2);
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  update(dt);
  render();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
