const { Engine, Render, Runner, Bodies, Composite, Vector, Body, Events } = Matter;

const FRUIT_TYPES = [
    { label: 'watermelon', color: '#2ecc71', juice: '#e74c3c', radius: 100, shape: 'watermelon' },
    { label: 'orange', color: '#f39c12', juice: '#e67e22', radius: 40, shape: 'circle' },
    { label: 'apple', color: '#e74c3c', juice: '#f1c40f', radius: 50, shape: 'apple' },
    { label: 'banana', color: '#f1c40f', juice: '#f1c40f', radius: 50, shape: 'banana' },
    { label: 'pizza', color: '#f1c40f', juice: '#e67e22', radius: 60, shape: 'pizza' }
];

// Game State
let engine;
let runner;
let score = 0;
let missed = 0;
const MAX_MISSED = 3;
let isGameStarted = false;
let isGameOver = false;
let fruits = [];
let particles = [];
let bladeTrail = [];
const BLADE_MAX_POINTS = 12;
const FRUIT_SPAWN_INTERVAL = 1200;
let lastSpawnTime = 0;
let audioCtx;

const sfx = {
    slice: () => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    },
    gameOver: () => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1);
    }
};

// DOM Elements
const scoreElement = document.getElementById('score');
const startBtn = document.getElementById('start-btn');
const overlay = document.getElementById('overlay');

function init() {
    // 1. Setup Engine
    engine = Engine.create();
    engine.gravity.y = 0.1; // Reduced gravity for slower falling

    // 2. Setup Custom Rendering
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.getElementById('game-container').appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // 3. Runner
    runner = Runner.create();
    Runner.run(runner, engine);

    // 4. Game Loop (for custom rendering)
    (function update(time) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (isGameStarted) {
            handleSpawning(time);
            updateBladeTrail();
            updateParticles(ctx);
        }

        renderFruits(ctx);
        renderBladeTrail(ctx);

        requestAnimationFrame(update);
    })(0);

    // 5. Events
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    startBtn.addEventListener('click', startGame);

    const handleInput = (x, y) => {
        if (!isGameStarted) return;
        const currentPos = { x, y };
        bladeTrail.push({ ...currentPos, timestamp: Date.now() });
        if (bladeTrail.length > BLADE_MAX_POINTS) bladeTrail.shift();
        checkCollisions(currentPos);
    };

    window.addEventListener('pointerdown', (e) => {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (!isGameStarted) return;
        if (e.pointerType === 'touch') bladeTrail = [];
        handleInput(e.clientX, e.clientY);
    });

    window.addEventListener('pointermove', (e) => {
        if (!isGameStarted) return;
        handleInput(e.clientX, e.clientY);
    });

    window.addEventListener('pointerup', (e) => {
        if (e.pointerType === 'touch') bladeTrail = [];
    });
}

function startGame() {
    isGameStarted = true;
    isGameOver = false;
    overlay.classList.add('hidden');
    score = 0;
    missed = 0;
    updateScoreUI();
    
    // Clear any existing bodies
    fruits.forEach(f => Composite.remove(engine.world, f));
    fruits = [];
}

function gameOver() {
    isGameStarted = false;
    isGameOver = true;
    sfx.gameOver();
    overlay.classList.remove('hidden');
    overlay.querySelector('h1').innerText = 'GAME OVER';
    overlay.querySelector('h1').style.background = 'linear-gradient(45deg, #e74c3c, #c0392b)';
    overlay.querySelector('h1').style.webkitBackgroundClip = 'text';
    startBtn.innerText = 'TRY AGAIN';
}

function spawnFruit() {
    const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
    const x = Math.random() * (window.innerWidth - 100) + 50;
    const y = -50; // Spawn at the top
    
    const fruit = Bodies.circle(x, y, type.radius, {
        restitution: 0.5,
        frictionAir: 0.01,
        label: 'fruit',
        fruitType: type
    });

    // Let it fall naturally or give a tiny downward nudge
    const forceX = (Math.random() - 0.5) * 0.05;
    const forceY = Math.random() * 0.05; // Tiny bit of downward force
    Body.applyForce(fruit, fruit.position, { x: forceX, y: forceY });
    Body.setAngularVelocity(fruit, (Math.random() - 0.5) * 0.1);

    Composite.add(engine.world, fruit);
    fruits.push(fruit);
}

function handleSpawning(time) {
    if (time - lastSpawnTime > FRUIT_SPAWN_INTERVAL) {
        spawnFruit();
        lastSpawnTime = time;
    }

    // Cleanup off-screen fruits
    fruits = fruits.filter(fruit => {
        if (fruit.position.y > window.innerHeight + 100) {
            Composite.remove(engine.world, fruit);
            if (isGameStarted) {
                missed++;
                document.getElementById('missed').innerText = missed + '/' + MAX_MISSED;
                if (missed >= MAX_MISSED) gameOver();
            }
            return false;
        }
        return true;
    });
}

function checkCollisions(mousePos) {
    if (bladeTrail.length < 2) return;
    
    const prevPos = bladeTrail[bladeTrail.length - 2];
    
    for (let i = fruits.length - 1; i >= 0; i--) {
        const fruit = fruits[i];
        const dist = getDistanceToSegment(fruit.position, prevPos, mousePos);
        if (dist < fruit.fruitType.radius + 10) {
            sliceFruit(fruit, i, mousePos);
        }
    }
}

function sliceFruit(fruit, index, cutPos) {
    const type = fruit.fruitType;
    
    // 1. Remove original
    Composite.remove(engine.world, fruit);
    fruits.splice(index, 1);
    
    // 2. Update Score
    score += 10;
    updateScoreUI();
    sfx.slice();

    // 3. Create Particles (Juice)
    createJuiceParticles(fruit.position, type.juice);

    // 4. Create Halves
    const prevPos = bladeTrail[bladeTrail.length - 2] || cutPos;
    const angle = Math.atan2(cutPos.y - prevPos.y, cutPos.x - prevPos.x);
    spawnHalves(fruit.position, type, angle);
}

function spawnHalves(pos, type, angle) {
    for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const offset = {
            x: Math.cos(angle + Math.PI / 2) * side * 10,
            y: Math.sin(angle + Math.PI / 2) * side * 10
        };
        
        const half = Bodies.circle(pos.x + offset.x, pos.y + offset.y, type.radius * 0.7, {
            collisionFilter: { group: -1 },
            label: 'half',
            render: { fillStyle: type.color }
        });
        half.customColor = type.color;
        
        const forceMagnitude = 0.03;
        const force = {
            x: Math.cos(angle + Math.PI / 2) * side * forceMagnitude,
            y: Math.sin(angle + Math.PI / 2) * side * forceMagnitude - 0.01
        };
        
        Body.applyForce(half, half.position, force);
        Body.setAngularVelocity(half, side * 0.1);
        
        Composite.add(engine.world, half);
        
        setTimeout(() => Composite.remove(engine.world, half), 1000);
    }
}

function createJuiceParticles(pos, color) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: pos.x,
            y: pos.y,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            life: 1.0,
            color: color
        });
    }
}

function updateParticles(ctx) {
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // Gravity
        p.life -= 0.02;
        
        if (p.life > 0) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
            return true;
        }
        return false;
    });
    ctx.globalAlpha = 1;
}

function updateBladeTrail() {
    const now = Date.now();
    bladeTrail = bladeTrail.filter(p => now - p.timestamp < 150);
}

function renderBladeTrail(ctx) {
    if (bladeTrail.length < 2) return;
    
    ctx.beginPath();
    ctx.moveTo(bladeTrail[0].x, bladeTrail[0].y);
    for (let i = 1; i < bladeTrail.length; i++) {
        ctx.lineTo(bladeTrail[i].x, bladeTrail[i].y);
    }
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Glow effect
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function renderFruits(ctx) {
    const bodies = Composite.allBodies(engine.world);
    bodies.forEach(body => {
        if (body.label === 'fruit') {
            const { x, y } = body.position;
            const angle = body.angle;
            const type = body.fruitType;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);

            drawFruitShape(ctx, type);

            ctx.restore();
        } else if (body.label === 'half') {
            const { x, y } = body.position;
            const angle = body.angle;
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            
            // Draw a simple half-circle for halves
            ctx.beginPath();
            ctx.arc(0, 0, body.circleRadius, Math.PI, 0);
            ctx.closePath();
            ctx.fillStyle = body.customColor;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.stroke();
            
            ctx.restore();
        }
    });
}

function drawFruitShape(ctx, type) {
    const r = type.radius;
    
    switch (type.shape) {
        case 'watermelon':
            // Main body
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fillStyle = type.color;
            ctx.fill();
            
            // Stripes
            ctx.strokeStyle = '#0a1e12ff';
            ctx.lineWidth = 4;
            for (let i = 0; i < 6; i++) {
                ctx.beginPath();
                const angle = (i / 6) * Math.PI * 2;
                ctx.moveTo(Math.cos(angle) * r * 0.2, Math.sin(angle) * r * 0.2);
                ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
                ctx.stroke();
            }
            break;
            
        case 'banana':
            ctx.beginPath();
            ctx.moveTo(-r, 0);
            ctx.quadraticCurveTo(0, r, r, -r * 0.2);
            ctx.quadraticCurveTo(0, r * 0.5, -r, 0);
            ctx.fillStyle = type.color;
            ctx.fill();
            // Tips
            ctx.fillStyle = '#f39c12';
            ctx.beginPath();
            ctx.arc(-r, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            break;
            
        case 'apple':
            // Body
            ctx.beginPath();
            ctx.moveTo(0, r * 0.2);
            ctx.bezierCurveTo(-r * 0.8, -r * 0.2, -r, r, 0, r);
            ctx.bezierCurveTo(r, r, r * 0.8, -r * 0.2, 0, r * 0.2);
            ctx.fillStyle = type.color;
            ctx.fill();
            
            // Stem
            ctx.strokeStyle = '#5d4037';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, r * 0.2);
            ctx.lineTo(0, -r * 0.3);
            ctx.stroke();
            
            // Leaf
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath();
            ctx.ellipse(r * 0.2, -r * 0.3, r * 0.3, r * 0.15, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'pizza':
            // Triangle slice
            ctx.beginPath();
            ctx.moveTo(0, -r); // Top tip
            ctx.lineTo(-r * 0.8, r); // Bottom left
            ctx.lineTo(r * 0.8, r);  // Bottom right
            ctx.closePath();
            ctx.fillStyle = '#f1c40f'; // Cheese yellow
            ctx.fill();

            // Crust
            ctx.beginPath();
            ctx.moveTo(-r * 0.85, r);
            ctx.quadraticCurveTo(0, r + 10, r * 0.85, r);
            ctx.strokeStyle = '#d35400'; // Crust orange
            ctx.lineWidth = 8;
            ctx.stroke();

            // Toppings (pepperoni)
            ctx.fillStyle = '#c0392b';
            for (let i = 0; i < 3; i++) {
                const tx = (Math.random() - 0.5) * r * 0.6;
                const ty = (Math.random() - 0.5) * r * 0.6 + r * 0.2;
                ctx.beginPath();
                ctx.arc(tx, ty, 5, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
            
        default: // Circle
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fillStyle = type.color;
            ctx.fill();
            break;
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function updateScoreUI() {
    scoreElement.innerText = score;
}

function getDistanceToSegment(p, a, b) {
    const l2 = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
    if (l2 === 0) return Math.sqrt(Math.pow(p.x - a.x, 2) + Math.pow(p.y - a.y, 2));
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt(Math.pow(p.x - (a.x + t * (b.x - a.x)), 2) + Math.pow(p.y - (a.y + t * (b.y - a.y)), 2));
}

init();
