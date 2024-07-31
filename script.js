class Node {
    constructor(x, y, walkable = true) {
        this.x = x;
        this.y = y;
        this.walkable = walkable;
        this.g = 0;
        this.h = 0;
        this.f = 0;
        this.parent = null;
    }
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let gridSize = 30;
let cols, rows;
let grid = [];
let startNode, endNode;
let path = [];
let userPath = [];
let drawing = false;
let score = 0;
let bestScore = 0;
let currentLevel = 1;
let timeLeft = 60;
let timerInterval;
let gameStarted = false;
let achievements = {
    perfectPath: false,
    speedster: false,
    collector: false
};
let powerUps = [];
let movingObstacles = [];
let theme = '#3498db';
let showOptimalPath = false;
let speedBoost = false;
let animationId;

const backgroundMusic = document.getElementById('backgroundMusic');
const powerUpSound = document.getElementById('powerUpSound');
const levelCompleteSound = document.getElementById('levelCompleteSound');
const gameOverSound = document.getElementById('gameOverSound');

// Set initial volumes
backgroundMusic.volume = 0.1; // Reduced to 10% volume for background music
powerUpSound.volume = 0.5; // 50% volume for power-up sound
levelCompleteSound.volume = 0.5; // 50% volume for level complete sound
gameOverSound.volume = 0.5; // 50% volume for game over sound

let isMuted = false;
const muteButton = document.getElementById('muteButton');

muteButton.addEventListener('click', toggleMute);


function toggleMute() {
    isMuted = !isMuted;
    backgroundMusic.muted = isMuted;
    powerUpSound.muted = isMuted;
    levelCompleteSound.muted = isMuted;
    gameOverSound.muted = isMuted;
    muteButton.innerHTML = isMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
}

function playBackgroundMusic() {
    backgroundMusic.currentTime = 0; // Reset to start of the track
    backgroundMusic.play();
}

function stopBackgroundMusic() {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
}

function playPowerUpSound() {
    powerUpSound.currentTime = 0;
    powerUpSound.play();
}

function playLevelCompleteSound() {
    levelCompleteSound.currentTime = 0;
    levelCompleteSound.play();
}

function playGameOverSound() {
    gameOverSound.currentTime = 0;
    gameOverSound.play();
}

function resizeCanvas() {
    const container = document.querySelector('.container');
    const containerWidth = container.clientWidth;
    let canvasSize = Math.min(containerWidth - 40, 600);
    
    if (window.innerWidth >= 1200) {
        canvasSize = 800;
    } else if (window.innerWidth <= 768) {
        canvasSize = containerWidth - 20;
    }

    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize * 0.75}px`;
    canvas.width = canvasSize;
    canvas.height = canvasSize * 0.75;
    
    gridSize = Math.floor(canvas.width / 20);
    cols = Math.floor(canvas.width / gridSize);
    rows = Math.floor(canvas.height / gridSize);
    
    initializeGrid();
    drawGrid();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function initializeGrid() {
    grid = [];
    for (let i = 0; i < cols; i++) {
        grid[i] = [];
        for (let j = 0; j < rows; j++) {
            grid[i][j] = new Node(i, j);
        }
    }

    do {
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                grid[i][j].walkable = true;
            }
        }

        startNode = grid[Math.floor(Math.random() * cols)][Math.floor(Math.random() * rows)];
        endNode = grid[Math.floor(Math.random() * cols)][Math.floor(Math.random() * rows)];

        let obstaclePercentage = 0.3 + (currentLevel - 1) * 0.15;
        for (let i = 0; i < cols * rows * obstaclePercentage; i++) {
            let obstacle = grid[Math.floor(Math.random() * cols)][Math.floor(Math.random() * rows)];
            if (obstacle !== startNode && obstacle !== endNode) {
                obstacle.walkable = false;
            }
        }

        path = aStar(startNode, endNode);
    } while (path.length === 0);

    userPath = [];
    score = 0;
    timeLeft = 60 - (currentLevel - 1) * 10;
    powerUps = [];
    movingObstacles = [];
    showOptimalPath = false;

    addPowerUps();

    if (currentLevel >= 3) {
        addMovingObstacles();
    }

    updateStats();
    drawGrid();
}

function isAccessible(node) {
    let neighbors = getNeighbors(node);
    return neighbors.some(neighbor => neighbor.walkable);
}

function addPowerUps() {
    const powerUpTypes = ['pathReveal', 'obstacleRemover', 'timeBoost', 'speedBoost', 'pointBoost'];
    for (let i = 0; i < 20; i++) {
        let x = Math.floor(Math.random() * cols);
        let y = Math.floor(Math.random() * rows);
        if (grid[x][y].walkable && !powerUps.some(p => p.x === x && p.y === y)) {
            powerUps.push({x, y, type: powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)]});
        } else {
            i--;
        }
    }
}

function addMovingObstacles() {
    for (let i = 0; i < 9; i++) {
        movingObstacles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            dx: (Math.random() - 0.5) * 2,
            dy: (Math.random() - 0.5) * 2
        });
    }
}

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let timeOfDay = (Date.now() % 60000) / 60000;
    let brightness = Math.sin(timeOfDay * Math.PI) * 0.3 + 0.7;

    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            let node = grid[i][j];
            let color = node.walkable ? `rgb(${220 * brightness}, ${220 * brightness}, ${220 * brightness})` : `rgb(${100 * brightness}, ${100 * brightness}, ${100 * brightness})`;
            ctx.fillStyle = color;
            ctx.fillRect(node.x * gridSize, node.y * gridSize, gridSize, gridSize);
            ctx.strokeStyle = `rgb(${150 * brightness}, ${150 * brightness}, ${150 * brightness})`;
            ctx.strokeRect(node.x * gridSize, node.y * gridSize, gridSize, gridSize);
        }
    }

    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(startNode.x * gridSize, startNode.y * gridSize, gridSize, gridSize);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(endNode.x * gridSize, endNode.y * gridSize, gridSize, gridSize);

    powerUps.forEach(powerUp => {
        let color;
        switch (powerUp.type) {
            case 'pathReveal': color = '#f39c12'; break;
            case 'obstacleRemover': color = '#9b59b6'; break;
            case 'timeBoost': color = '#1abc9c'; break;
            case 'speedBoost': color = '#e67e22'; break;
            case 'pointBoost': color = '#3498db'; break;
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc((powerUp.x + 0.5) * gridSize, (powerUp.y + 0.5) * gridSize, gridSize / 2.5, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.fillStyle = '#e67e22';
    movingObstacles.forEach(obstacle => {
        ctx.beginPath();
        ctx.arc(obstacle.x, obstacle.y, gridSize / 1.5, 0, Math.PI * 2);
        ctx.fill();
    });

    if (userPath.length > 0) {
        ctx.beginPath();
        ctx.moveTo((userPath[0].x + 0.5) * gridSize, (userPath[0].y + 0.5) * gridSize);
        for (let i = 1; i < userPath.length; i++) {
            ctx.lineTo((userPath[i].x + 0.5) * gridSize, (userPath[i].y + 0.5) * gridSize);
        }
        ctx.strokeStyle = theme;
        ctx.lineWidth = 5;
        ctx.stroke();
    }

    if (showOptimalPath) {
        drawOptimizedPath();
    }

    if (currentLevel >= 2) {
        ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
        for (let i = 0; i < 100; i++) {
            let x = Math.random() * canvas.width;
            let y = Math.random() * canvas.height;
            ctx.fillRect(x, y, 2, 7);
        }
    }
}

function aStar(start, end) {
    let openSet = [start];
    let closedSet = [];
    let path = [];

    function heuristic(a, b) {
        let dx = Math.abs(a.x - b.x);
        let dy = Math.abs(a.y - b.y);
        return Math.max(dx, dy) + (Math.sqrt(2) - 1) * Math.min(dx, dy);
    }        

    while (openSet.length > 0) {
        let lowestIndex = 0;
        for (let i = 0; i < openSet.length; i++) {
            if (openSet[i].f < openSet[lowestIndex].f) {
                lowestIndex = i;
            }
        }

        let current = openSet[lowestIndex];

        if (current === end) {
            let temp = current;
            path.push(temp);
            while (temp.parent) {
                path.push(temp.parent);
                temp = temp.parent;
            }
            return path.reverse();
        }

        openSet.splice(lowestIndex, 1);
        closedSet.push(current);

        let neighbors = getNeighbors(current);
        for (let neighbor of neighbors) {
            if (!closedSet.includes(neighbor) && neighbor.walkable) {
                let tempG = current.g + 1;
                if (openSet.includes(neighbor)) {
                    if (tempG < neighbor.g) {
                        neighbor.g = tempG;
                    }
                } else {
                    neighbor.g = tempG;
                    openSet.push(neighbor);
                }
                neighbor.h = heuristic(neighbor, end);
                neighbor.f = neighbor.g + neighbor.h;
                neighbor.parent = current;
            }
        }
    }

    return path;
}

function getNeighbors(node) {
    let neighbors = [];
    let { x, y } = node;
    
    const directions = [
        [-1, -1], [0, -1], [1, -1],
        [-1,  0],          [1,  0],
        [-1,  1], [0,  1], [1,  1]
    ];
    
    for (let [dx, dy] of directions) {
        let newX = x + dx;
        let newY = y + dy;
        
        if (newX >= 0 && newX < cols && newY >= 0 && newY < rows) {
            if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
                if (grid[x][newY].walkable || grid[newX][y].walkable) {
                    neighbors.push(grid[newX][newY]);
                }
            } else {
                neighbors.push(grid[newX][newY]);
            }
        }
    }
    
    return neighbors.filter(neighbor => neighbor.walkable);
}

canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
canvas.addEventListener('touchend', handleEnd);
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('mouseup', handleEnd);
canvas.addEventListener('touchstart', handleStart);
canvas.addEventListener('touchmove', handleMove);
canvas.addEventListener('touchend', handleEnd);

function handleStart(e) {
    if (gameStarted) {
        e.preventDefault();
        drawing = true;
        userPath = [];
        handleMove(e);
    }
}

function handleMove(e) {
    if (drawing && gameStarted) {
        e.preventDefault();
        let rect = canvas.getBoundingClientRect();
        let scaleX = canvas.width / rect.width;
        let scaleY = canvas.height / rect.height;
        let clientX, clientY;
        if (e.type === 'touchmove') {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        let x = Math.floor(((clientX - rect.left) * scaleX) / gridSize);
        let y = Math.floor(((clientY - rect.top) * scaleY) / gridSize);
        if (x >= 0 && x < cols && y >= 0 && y < rows) {
            let node = grid[x][y];
            if (!userPath.includes(node) && node.walkable) {
                if (userPath.length === 0 || isValidMove(userPath[userPath.length - 1], node)) {
                    userPath.push(node);
                    checkPowerUpCollection(x, y);
                    drawGrid();
                }
            }
        }
    }
}

function isValidMove(from, to) {
    let dx = Math.abs(from.x - to.x);
    let dy = Math.abs(from.y - to.y);
    
    if (dx === 1 && dy === 1) {
        return grid[from.x][to.y].walkable || grid[to.x][from.y].walkable;
    }
    
    return dx + dy === 1;
}

function handleEnd() {
    drawing = false;
}

function checkPowerUpCollection(x, y) {
    let collectedPowerUp = powerUps.find(p => p.x === x && p.y === y);
    if (collectedPowerUp) {
        playPowerUpSound();
        switch (collectedPowerUp.type) {
            case 'pathReveal':
                revealPath();
                break;
            case 'obstacleRemover':
                removeRandomObstacles();
                break;
            case 'timeBoost':
                timeLeft += 10;
                break;
            case 'speedBoost':
                activateSpeedBoost();
                break;
            case 'pointBoost':
                score += 10;
                updateStats();
                break;
        }
        powerUps = powerUps.filter(p => p !== collectedPowerUp);
        if (powerUps.length === 0) {
            achievements.collector = true;
        }
    }
}

function revealPath() {
    let revealLength = Math.min(Math.floor(path.length / 2), path.length);
    for (let i = 0; i < revealLength; i++) {
        ctx.fillStyle = 'rgba(52, 152, 219, 0.5)';
        ctx.fillRect(path[i].x * gridSize, path[i].y * gridSize, gridSize, gridSize);
    }
}

function removeRandomObstacles() {
    let obstacles = grid.flat().filter(node => !node.walkable);
    let removalCount = Math.min(15, obstacles.length);
    
    for (let i = 0; i < removalCount; i++) {
        let randomIndex = Math.floor(Math.random() * obstacles.length);
        let obstacle = obstacles[randomIndex];
        
        grid[obstacle.x][obstacle.y].walkable = true;
        
        const adjacentDirections = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (let [dx, dy] of adjacentDirections) {
            let newX = obstacle.x + dx;
            let newY = obstacle.y + dy;
            if (newX >= 0 && newX < cols && newY >= 0 && newY < rows) {
                grid[newX][newY].walkable = true;
            }
        }
        
        obstacles.splice(randomIndex, 1);
    }
    
    path = aStar(startNode, endNode);
    
    drawGrid();
}

function activateSpeedBoost() {
    speedBoost = true;
    setTimeout(() => {
        speedBoost = false;
    }, 5000);
}

document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('finishButton').addEventListener('click', finishLevel);
document.getElementById('showPathButton').addEventListener('click', toggleOptimalPath);
document.getElementById('newGameButton').addEventListener('click', newGame);

// Modify the startGame function to include background music
function startGame() {
    if (!gameStarted) {
        gameStarted = true;
        startTimer();
        document.getElementById('startButton').disabled = true;
        animationId = requestAnimationFrame(gameLoop);
        playBackgroundMusic(); // Start playing background music
        Swal.fire({
            title: 'Level Started!',
            text: 'Find the best path to the goal!',
            icon: 'info',
            confirmButtonText: 'Let\'s Go!'
        });
    }
}


function finishLevel() {
    if (gameStarted) {
        let similarity = calculateSimilarity(path, userPath);
        let resultMessage = document.getElementById('resultMessage');

        showOptimalPath = true;
        drawGrid();

        let passThreshold;
        switch (currentLevel) {
            case 1:
                passThreshold = 0.8;
                break;
            case 2:
                passThreshold = 0.7;
                break;
            case 3:
                passThreshold = 0.6;
                break;
            default:
                passThreshold = 0.8;
        }

        if (similarity >= passThreshold) {
            playLevelCompleteSound();
            resultMessage.innerHTML = `<i class="fas fa-trophy"></i> Great job! Your path is ${Math.round(similarity * 100)}% similar to the optimized path.`;
            resultMessage.style.color = '#27ae60';
            score += Math.round(similarity * 100) * currentLevel;
            if (similarity === 1) {
                achievements.perfectPath = true;
            }
            if (timeLeft > 30) {
                achievements.speedster = true;
            }
            currentLevel++;
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
            if (currentLevel > 3) {
                endGame();
            } else {
                initializeGrid();
            }
        } else {
            resultMessage.innerHTML = `<i class="fas fa-redo"></i> Keep trying! Your path is only ${Math.round(similarity * 100)}% similar to the optimized path.`;
            resultMessage.style.color = '#c0392b';
        }
        updateStats();
        updateAchievements();
        gameStarted = false;
        document.getElementById('startButton').disabled = false;
    }
}


function toggleOptimalPath() {
    showOptimalPath = !showOptimalPath;
    drawGrid();
}


function calculateSimilarity(optimalPath, userPath) {
    let matchingPoints = 0;

    for (let i = 0; i < userPath.length; i++) {
        if (optimalPath.includes(userPath[i])) {
            matchingPoints++;
        }
    }

    return matchingPoints / optimalPath.length;
}

function drawOptimizedPath() {
    if (path.length > 0) {
        ctx.beginPath();
        ctx.moveTo((path[0].x + 0.5) * gridSize, (path[0].y + 0.5) * gridSize);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo((path[i].x + 0.5) * gridSize, (path[i].y + 0.5) * gridSize);
        }
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 5;
        ctx.stroke();
    }
}

function updateStats() {
    document.getElementById('score').textContent = score;
    document.getElementById('bestScore').textContent = Math.max(bestScore, score);
    document.getElementById('currentLevel').textContent = currentLevel;
}

function updateAchievements() {
    let achievementsDiv = document.getElementById('achievements');
    achievementsDiv.innerHTML = 'Achievements: ';
    if (achievements.perfectPath) achievementsDiv.innerHTML += '<span class="achievement">Perfect Path</span>';
    if (achievements.speedster) achievementsDiv.innerHTML += '<span class="achievement">Speedster</span>';
    if (achievements.collector) achievementsDiv.innerHTML += '<span class="achievement">Collector</span>';
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timeLeft').textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            endGame();
        }
    }, 1000);
}

function endGame() {
    clearInterval(timerInterval);
    cancelAnimationFrame(animationId);
    stopBackgroundMusic();
    playGameOverSound();
    Swal.fire({
        title: 'Game Over!',
        text: `Your final score is ${score}`,
        icon: 'info',
        confirmButtonText: 'Play Again'
    }).then((result) => {
        if (result.isConfirmed) {
            newGame();
        }
    });
    bestScore = Math.max(bestScore, score);
    currentLevel = 1;
    gameStarted = false;
    document.getElementById('startButton').disabled = false;
    initializeGrid();
}

function newGame() {
    currentLevel = 1;
    gameStarted = false;
    document.getElementById('startButton').disabled = false;
    initializeGrid();
}

function changeTheme(newTheme) {
    theme = newTheme;
    drawGrid();
}

function gameLoop() {
    if (currentLevel >= 3 && gameStarted) {
        movingObstacles.forEach(obstacle => {
            obstacle.x += obstacle.dx;
            obstacle.y += obstacle.dy;
            if (obstacle.x < 0 || obstacle.x > canvas.width) obstacle.dx *= -1;
            if (obstacle.y < 0 || obstacle.y > canvas.height) obstacle.dy *= -1;
        });
    }
    drawGrid();
    animationId = requestAnimationFrame(gameLoop);
}

// Add floating items
const floatingItems = ['🏙️', '🚗', '🚕', '🚙', '🚌', '🏢', '🏬', '🏫', '🏥', '🚦', '🚧', '🚲'];
for (let i = 0; i < 20; i++) {
    const item = document.createElement('div');
    item.className = 'floating-item';
    item.textContent = floatingItems[Math.floor(Math.random() * floatingItems.length)];
    item.style.left = `${Math.random() * 100}vw`;
    item.style.top = `${Math.random() * 100}vh`;
    item.style.fontSize = `${Math.random() * 20 + 10}px`;
    item.style.opacity = Math.random() * 0.5 + 0.5;
    item.style.animationDuration = `${Math.random() * 10 + 5}s`;
    item.style.animationDelay = `${Math.random() * 5}s`;
    document.body.appendChild(item);
}

 // Add particles
 for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = `${Math.random() * 100}vw`;
    particle.style.top = `${Math.random() * 100}vh`;
    particle.style.width = `${Math.random() * 5 + 1}px`;
    particle.style.height = particle.style.width;
    particle.style.opacity = Math.random() * 0.5 + 0.5;
    particle.style.animationDuration = `${Math.random() * 20 + 10}s`;
    particle.style.animationDelay = `${Math.random() * 5}s`;
    document.body.appendChild(particle);
}

initializeGrid();