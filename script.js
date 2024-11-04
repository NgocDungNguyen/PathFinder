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
let gridSize = 25; // Adjusted for better mobile view
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
let animationId;

// Audio setup
const backgroundMusic = document.getElementById('backgroundMusic');
const powerUpSound = document.getElementById('powerUpSound');
const levelCompleteSound = document.getElementById('levelCompleteSound');
const gameOverSound = document.getElementById('gameOverSound');

backgroundMusic.volume = 0.1;
powerUpSound.volume = 0.5;
levelCompleteSound.volume = 0.5;
gameOverSound.volume = 0.5;

let isMuted = false;
const muteButton = document.getElementById('muteButton');

muteButton.addEventListener('click', toggleMute);

// Audio functions
function toggleMute() {
    isMuted = !isMuted;
    backgroundMusic.muted = isMuted;
    powerUpSound.muted = isMuted;
    levelCompleteSound.muted = isMuted;
    gameOverSound.muted = isMuted;
    muteButton.innerHTML = isMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
}

function playBackgroundMusic() {
    backgroundMusic.currentTime = 0;
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

// Canvas and grid setup
function resizeCanvas() {
    const container = document.querySelector('.game-canvas-container');
    const containerWidth = container.clientWidth;
    let canvasSize = Math.min(containerWidth, 375); // Optimized for mobile
    
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize * 0.75}px`;
    canvas.width = canvasSize;
    canvas.height = canvasSize * 0.75;
    
    gridSize = Math.floor(canvas.width / 15);
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
        // Reset grid
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                grid[i][j].walkable = true;
            }
        }

        startNode = grid[Math.floor(Math.random() * cols)][Math.floor(Math.random() * rows)];
        endNode = grid[Math.floor(Math.random() * cols)][Math.floor(Math.random() * rows)];

        let obstaclePercentage = 0.2 + (currentLevel - 1) * 0.1;
        for (let i = 0; i < cols * rows * obstaclePercentage; i++) {
            let obstacle = grid[Math.floor(Math.random() * cols)][Math.floor(Math.random() * rows)];
            if (obstacle !== startNode && obstacle !== endNode) {
                obstacle.walkable = false;
            }
        }

        path = aStar(startNode, endNode);
    } while (path.length === 0);

    userPath = [];
    timeLeft = 60 - (currentLevel - 1) * 10;
    powerUps = [];
    movingObstacles = [];
    showOptimalPath = false;

    addPowerUps();
    updateStats();
    drawGrid();
}

function addPowerUps() {
    const powerUpTypes = ['obstacleRemover', 'timeBoost', 'pointBoost'];
    for (let i = 0; i < 10; i++) {
        let x = Math.floor(Math.random() * cols);
        let y = Math.floor(Math.random() * rows);
        if (grid[x][y].walkable && !powerUps.some(p => p.x === x && p.y === y)) {
            powerUps.push({
                x, 
                y, 
                type: powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)]
            });
        } else {
            i--;
        }
    }
}

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid cells
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            let node = grid[i][j];
            ctx.fillStyle = node.walkable ? '#ffffff' : '#34495e';
            ctx.fillRect(i * gridSize, j * gridSize, gridSize, gridSize);
            ctx.strokeStyle = '#ecf0f1';
            ctx.strokeRect(i * gridSize, j * gridSize, gridSize, gridSize);
        }
    }

    // Draw start and end points
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(startNode.x * gridSize, startNode.y * gridSize, gridSize, gridSize);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(endNode.x * gridSize, endNode.y * gridSize, gridSize, gridSize);

    // Draw power-ups
    powerUps.forEach(powerUp => {
        let color;
        switch (powerUp.type) {
            case 'obstacleRemover': color = '#9b59b6'; break;
            case 'timeBoost': color = '#1abc9c'; break;
            case 'pointBoost': color = '#3498db'; break;
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc((powerUp.x + 0.5) * gridSize, (powerUp.y + 0.5) * gridSize, gridSize / 3, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw user path
    if (userPath.length > 0) {
        ctx.beginPath();
        ctx.moveTo((userPath[0].x + 0.5) * gridSize, (userPath[0].y + 0.5) * gridSize);
        for (let i = 1; i < userPath.length; i++) {
            ctx.lineTo((userPath[i].x + 0.5) * gridSize, (userPath[i].y + 0.5) * gridSize);
        }
        ctx.strokeStyle = theme;
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    // Draw optimal path if shown
    if (showOptimalPath) {
        ctx.beginPath();
        ctx.moveTo((path[0].x + 0.5) * gridSize, (path[0].y + 0.5) * gridSize);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo((path[i].x + 0.5) * gridSize, (path[i].y + 0.5) * gridSize);
        }
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function aStar(start, end) {
    let openSet = [start];
    let closedSet = [];
    let path = [];

    // Manhattan distance for horizontal/vertical only movement
    function heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
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
    const directions = [
        [0, -1], // up
        [1, 0],  // right
        [0, 1],  // down
        [-1, 0]  // left
    ];
    
    for (let [dx, dy] of directions) {
        let newX = node.x + dx;
        let newY = node.y + dy;
        
        if (newX >= 0 && newX < cols && newY >= 0 && newY < rows) {
            neighbors.push(grid[newX][newY]);
        }
    }
    
    return neighbors.filter(neighbor => neighbor.walkable);
}

// Event Listeners for touch and mouse
canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
canvas.addEventListener('touchend', handleEnd);
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('mouseup', handleEnd);

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
        
        if (e.type.includes('touch')) {
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

function handleEnd() {
    drawing = false;
}

function isValidMove(from, to) {
    return (Math.abs(from.x - to.x) + Math.abs(from.y - to.y)) === 1;
}

function checkPowerUpCollection(x, y) {
    let collectedPowerUp = powerUps.find(p => p.x === x && p.y === y);
    if (collectedPowerUp) {
        playPowerUpSound();
        switch (collectedPowerUp.type) {
            case 'obstacleRemover':
                removeRandomObstacles();
                break;
            case 'timeBoost':
                timeLeft += 10;
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

function removeRandomObstacles() {
    let obstacles = grid.flat().filter(node => !node.walkable);
    let removalCount = Math.min(15, obstacles.length);
    
    for (let i = 0; i < removalCount; i++) {
        let randomIndex = Math.floor(Math.random() * obstacles.length);
        let obstacle = obstacles[randomIndex];
        grid[obstacle.x][obstacle.y].walkable = true;
        obstacles.splice(randomIndex, 1);
    }
    
    path = aStar(startNode, endNode);
    drawGrid();
}

function startGame() {
    if (!gameStarted) {
        gameStarted = true;
        startTimer();
        document.getElementById('startButton').disabled = true;
        playBackgroundMusic();
        Swal.fire({
            title: 'Level ' + currentLevel,
            text: 'Draw your path from green to red!',
            icon: 'info',
            confirmButtonText: 'Start!'
        });
    }
}

function finishLevel() {
    if (gameStarted) {
        let similarity = calculateSimilarity(path, userPath);
        let resultMessage = document.getElementById('resultMessage');

        showOptimalPath = true;
        drawGrid();

        // All levels require 65% similarity
        if (similarity >= 0.65) {
            playLevelCompleteSound();
            resultMessage.innerHTML = `<i class="fas fa-trophy"></i> Great job! Your path is ${Math.round(similarity * 100)}% similar to the optimal path.`;
            resultMessage.style.color = '#27ae60';
            score += Math.round(similarity * 100) * currentLevel;
            
            if (similarity === 1) achievements.perfectPath = true;
            if (timeLeft > 30) achievements.speedster = true;
            
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
            resultMessage.innerHTML = `<i class="fas fa-redo"></i> Keep trying! Your path is only ${Math.round(similarity * 100)}% similar. Need 65% to pass.`;
            resultMessage.style.color = '#c0392b';
        }
        
        updateStats();
        updateAchievements();
        gameStarted = false;
        document.getElementById('startButton').disabled = false;
    }
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

function updateStats() {
    document.getElementById('score').textContent = score;
    document.getElementById('bestScore').textContent = Math.max(bestScore, score);
    document.getElementById('currentLevel').textContent = currentLevel;
    document.getElementById('timeLeft').textContent = timeLeft;
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
    stopBackgroundMusic();
    playGameOverSound();
    
    Swal.fire({
        title: 'Game Over!',
        text: `Final Score: ${score}`,
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
    score = 0;
    currentLevel = 1;
    gameStarted = false;
    achievements = {
        perfectPath: false,
        speedster: false,
        collector: false
    };
    document.getElementById('startButton').disabled = false;
    initializeGrid();
}

// Event Listeners
document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('finishButton').addEventListener('click', finishLevel);
document.getElementById('newGameButton').addEventListener('click', newGame);

// Initialize game
initializeGrid();
