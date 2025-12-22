import * as THREE from 'three';

let scene, camera, renderer, birds = [];
let mouse = new THREE.Vector2();
let targetPosition = new THREE.Vector3(0, 10, 0);
let raycaster = new THREE.Raycaster();
let plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -10); // Plane at y=10

init();
animate();

function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 20);
    camera.lookAt(0, 0, 0);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    // Green Field
    const geometry = new THREE.PlaneGeometry(100, 100);
    const material = new THREE.MeshPhongMaterial({ color: 0x228b22, side: THREE.DoubleSide });
    const field = new THREE.Mesh(geometry, material);
    field.rotation.x = -Math.PI / 2;
    scene.add(field);

    // Birds
    for (let i = 0; i < 20; i++) {
        createBird();
    }

    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('mousemove', onMouseMove, false);
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(plane, targetPosition);
}

function createBird() {
    const group = new THREE.Group();

    // Simple bird made of two wings
    const wingGeometry = new THREE.PlaneGeometry(1, 0.5);
    const wingMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, side: THREE.DoubleSide });

    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.x = -0.5;
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.x = 0.5;
    group.add(rightWing);

    // Initial position and velocity
    group.position.set(
        Math.random() * 40 - 20,
        5 + Math.random() * 10,
        Math.random() * 40 - 20
    );

    const birdData = {
        mesh: group,
        leftWing: leftWing,
        rightWing: rightWing,
        speed: 0.1 + Math.random() * 0.1,
        angle: Math.random() * Math.PI * 2,
        wingPhase: Math.random() * Math.PI * 2
    };

    scene.add(group);
    birds.push(birdData);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.005;

    birds.forEach(bird => {
        // Steer towards target
        const dx = targetPosition.x - bird.mesh.position.x;
        const dz = targetPosition.z - bird.mesh.position.z;
        const targetAngle = Math.atan2(dz, dx);

        // Smoothly rotate bird.angle towards targetAngle
        let angleDiff = targetAngle - bird.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        bird.angle += angleDiff * 0.05;

        // Move bird
        bird.mesh.position.x += Math.cos(bird.angle) * bird.speed;
        bird.mesh.position.z += Math.sin(bird.angle) * bird.speed;

        // Keep bird within bounds
        if (bird.mesh.position.x > 50) bird.mesh.position.x = -50;
        if (bird.mesh.position.x < -50) bird.mesh.position.x = 50;
        if (bird.mesh.position.z > 50) bird.mesh.position.z = -50;
        if (bird.mesh.position.z < -50) bird.mesh.position.z = 50;

        // Orient bird
        bird.mesh.rotation.y = -bird.angle + Math.PI / 2;

        // Flap wings
        bird.wingPhase += 0.2;
        const wingRotation = Math.sin(bird.wingPhase) * 0.5;
        bird.leftWing.rotation.z = wingRotation;
        bird.rightWing.rotation.z = -wingRotation;
    });

    renderer.render(scene, camera);
}
