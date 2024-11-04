const MOBILE = {
    isTouchDevice: () => 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    MIN_TOUCH_TARGET: 44,
    SCROLL_THRESHOLD: 10
};

class Node {
    constructor(x, y, walkable = true) {
        this.x = x;
        this.y = y;
        this.walkable = walkable;
        this.g = 0;
        this.h = 0;
        this.f = 0;
        this.parent = null;
        this.touched = false;
    }
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let gridSize = MOBILE.isTouchDevice() ? 35 : 30;
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
let touchStartY = 0;
let isScrolling = false;
let lastTouchPos = { x: 0, y: 0 };
let touchFeedbackTimeout;

let achievements = {
    perfectPath: false,
    speedster: false,
    collector: false
};

let powerUps = [];
let theme = '#3498db';
let showOptimalPath = false;
let animationId;

const backgroundMusic = document.getElementById('backgroundMusic');
const powerUpSound = document.getElementById('powerUpSound');
const levelCompleteSound = document.getElementById('levelCompleteSound');
const gameOverSound = document.getElementById('gameOverSound');

[backgroundMusic, powerUpSound, levelCompleteSound, gameOverSound].forEach(audio => {
    audio.volume = audio === backgroundMusic ? 0.1 : 0.5;
});

let isMuted = false;
const muteButton = document.getElementById('muteButton');

function enableMobileScrolling() {
    if (MOBILE.isTouchDevice()) {
        document.body.style.overflow = 'auto';
        document.body.style.height = 'auto';
        
        document.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            const touchY = e.touches[0].clientY;
            const deltaY = Math.abs(touchY - touchStartY);
            
            if (deltaY > MOBILE.SCROLL_THRESHOLD) {
                isScrolling = true;
            }
        }, { passive: true });

        document.addEventListener('touchend', () => {
            isScrolling = false;
        }, { passive: true });
    }
}

function preventDefaultBehaviors() {
    canvas.addEventListener('touchmove', (e) => {
        if (drawing) {
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('gesturestart', (e) => {
        e.preventDefault();
    });

    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

function toggleMute() {
    isMuted = !isMuted;
    [backgroundMusic, powerUpSound, levelCompleteSound, gameOverSound]
        .forEach(audio => audio.muted = isMuted);
    muteButton.innerHTML = isMuted ? 
        '<i class="fas fa-volume-mute"></i>' : 
        '<i class="fas fa-volume-up"></i>';
}

function playBackgroundMusic() {
    backgroundMusic.currentTime = 0;
    backgroundMusic.play().catch(() => {});
}

function stopBackgroundMusic() {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
}

function playPowerUpSound() {
    powerUpSound.currentTime = 0;
    powerUpSound.play().catch(() => {});
}

function playLevelCompleteSound() {
    levelCompleteSound.currentTime = 0;
    levelCompleteSound.play().catch(() => {});
}

function playGameOverSound() {
    gameOverSound.currentTime = 0;
    gameOverSound.play().catch(() => {});
}

function resizeCanvas() {
    const container = document.querySelector('.game-canvas-container');
    const containerWidth = container.clientWidth;
    let canvasSize = Math.min(containerWidth - 20, MOBILE.isTouchDevice() ? 375 : 600);
    
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize * 0.75}px`;
    canvas.width = canvasSize;
    canvas.height = canvasSize * 0.75;
    
    gridSize = Math.floor(canvasSize / 12); // Changed from 15 to 12 for bigger cells
    cols = Math.floor(canvas.width / gridSize);
    rows = Math.floor(canvas.height / gridSize);
    
    if (!gameStarted) {
        initializeGrid();
    }
}

function initializeGrid() {
    // Reset grid
    grid = [];
    for (let i = 0; i < cols; i++) {
        grid[i] = [];
        for (let j = 0; j < rows; j++) {
            grid[i][j] = new Node(i, j, true);
        }
    }

    // Place start and end points with minimum distance
    startNode = grid[1][Math.floor(rows/2)];
    endNode = grid[cols-2][Math.floor(rows/2)];

    // Add obstacles
    let obstacleCount = Math.floor((cols * rows) * 0.25); // 25% of cells are obstacles
    for (let i = 0; i < obstacleCount; i++) {
        let x = Math.floor(Math.random() * cols);
        let y = Math.floor(Math.random() * rows);
        
        // Check if position is valid for obstacle
        if (grid[x][y] !== startNode && 
            grid[x][y] !== endNode && 
            grid[x][y].walkable) {
            grid[x][y].walkable = false;
        } else {
            i--; // Try again if position was invalid
        }
    }

    // Reset game state
    userPath = [];
    path = aStar(startNode, endNode);
    timeLeft = Math.max(30, 60 - (currentLevel - 1) * 10);
    powerUps = [];
    showOptimalPath = false;

    // Only proceed if a valid path exists
    if (!path || path.length === 0) {
        console.log("No valid path found, retrying...");
        initializeGrid(); // Retry if no valid path
        return;
    }

    addPowerUps();
    updateStats();
    drawGrid();
}

function addPowerUps() {
    const powerUpTypes = ['obstacleRemover', 'timeBoost', 'pointBoost'];
    const powerUpCount = MOBILE.isTouchDevice() ? 5 : 8;

    for (let i = 0; i < powerUpCount; i++) {
        let x = Math.floor(Math.random() * cols);
        let y = Math.floor(Math.random() * rows);
        
        // Check distance from start and end points
        const distanceFromStart = Math.abs(x - startNode.x) + Math.abs(y - startNode.y);
        const distanceFromEnd = Math.abs(x - endNode.x) + Math.abs(y - endNode.y);
        
        if (grid[x][y].walkable && 
            !powerUps.some(p => p.x === x && p.y === y) &&
            distanceFromStart > 2 && // Minimum distance from start
            distanceFromEnd > 2 &&   // Minimum distance from end
            grid[x][y] !== startNode && 
            grid[x][y] !== endNode) {
            
            powerUps.push({
                x, 
                y, 
                type: powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)],
                collected: false
            });
        } else {
            i--; // Try again if position was invalid
        }
    }
}

function drawGrid() {
    console.log("Drawing grid:", {cols, rows, gridSize, startNode, endNode});

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid and obstacles
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            let node = grid[i][j];
            // Set fill color based on node type
            if (!node.walkable) {
                ctx.fillStyle = '#34495e'; // Obstacle color
            } else if (node.touched) {
                ctx.fillStyle = 'rgba(52, 152, 219, 0.2)'; // Touched path
            } else {
                ctx.fillStyle = '#ffffff'; // Empty cell
            }
            
            // Draw cell
            ctx.fillRect(i * gridSize, j * gridSize, gridSize, gridSize);
            ctx.strokeStyle = '#ecf0f1';
            ctx.strokeRect(i * gridSize, j * gridSize, gridSize, gridSize);
        }
    }

    // Draw start point
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(
        startNode.x * gridSize + gridSize/2,
        startNode.y * gridSize + gridSize/2,
        gridSize/3,
        0,
        Math.PI * 2
    );
    ctx.fill();

    // Draw end point
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(
        endNode.x * gridSize + gridSize/2,
        endNode.y * gridSize + gridSize/2,
        gridSize/3,
        0,
        Math.PI * 2
    );
    ctx.fill();

    // Draw power-ups
    powerUps.forEach(powerUp => {
        if (!powerUp.collected) {
            let color;
            switch (powerUp.type) {
                case 'obstacleRemover': color = '#ff6b6b'; // Changed to red-orange
                case 'timeBoost': color = '#ffd93d'; // Changed to yellow
                case 'pointBoost': color = '#6c5ce7'; // Changed to purple
                break;
            }
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(
                (powerUp.x + 0.5) * gridSize,
                (powerUp.y + 0.5) * gridSize,
                gridSize/4, // Made power-ups slightly smaller
                0,
                Math.PI * 2
            );
            ctx.fill();
            
            // Add a distinctive border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });

    // Draw user path
    if (userPath.length > 0) {
        ctx.beginPath();
        ctx.moveTo(
            userPath[0].x * gridSize + gridSize/2,
            userPath[0].y * gridSize + gridSize/2
        );
        for (let i = 1; i < userPath.length; i++) {
            ctx.lineTo(
                userPath[i].x * gridSize + gridSize/2,
                userPath[i].y * gridSize + gridSize/2
            );
        }
        ctx.strokeStyle = theme;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    // Draw optimal path if shown
    if (showOptimalPath && path.length > 0) {
        ctx.beginPath();
        ctx.moveTo((path[0].x + 0.5) * gridSize, (path[0].y + 0.5) * gridSize);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo((path[i].x + 0.5) * gridSize, (path[i].y + 0.5) * gridSize);
        }
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Draw touch feedback
    if (MOBILE.isTouchDevice() && lastTouchPos.x !== 0) {
        ctx.fillStyle = 'rgba(52, 152, 219, 0.3)';
        ctx.beginPath();
        ctx.arc(lastTouchPos.x, lastTouchPos.y, MOBILE.MIN_TOUCH_TARGET/2, 0, Math.PI * 2);
        ctx.fill();
    }
}

function aStar(start, end) {
    let openSet = [start];
    let closedSet = [];
    let path = [];

    function heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    while (openSet.length > 0) {
        let current = openSet.reduce((a, b) => a.f < b.f ? a : b);

        if (current === end) {
            let temp = current;
            while (temp.parent) {
                path.push(temp);
                temp = temp.parent;
            }
            path.push(start);
            return path.reverse();
        }

        openSet = openSet.filter(node => node !== current);
        closedSet.push(current);

        let neighbors = getNeighbors(current);
        for (let neighbor of neighbors) {
            if (!closedSet.includes(neighbor) && neighbor.walkable) {
                let tempG = current.g + 1;
                let newPath = false;

                if (openSet.includes(neighbor)) {
                    if (tempG < neighbor.g) {
                        neighbor.g = tempG;
                        newPath = true;
                    }
                } else {
                    neighbor.g = tempG;
                    newPath = true;
                    openSet.push(neighbor);
                }

                if (newPath) {
                    neighbor.h = heuristic(neighbor, end);
                    neighbor.f = neighbor.g + neighbor.h;
                    neighbor.parent = current;
                }
            }
        }
    }
    return [];
}

function getNeighbors(node) {
    const directions = [
        [0, -1], // up
        [1, 0],  // right
        [0, 1],  // down
        [-1, 0]  // left
    ];
    
    return directions
        .map(([dx, dy]) => {
            let newX = node.x + dx;
            let newY = node.y + dy;
            return (newX >= 0 && newX < cols && newY >= 0 && newY < rows) 
                ? grid[newX][newY] 
                : null;
        })
        .filter(neighbor => neighbor && neighbor.walkable);
}

function handleStart(e) {
    if (gameStarted) {
        if (e.type.includes('touch')) {
            if (e.target === canvas) {
                e.preventDefault();
            }
        }
        
        if (!isScrolling) {
            drawing = true;
            userPath = [];
            handleMove(e);
        }
    }
}

function handleMove(e) {
    if (drawing && gameStarted && !isScrolling) {
        if (e.type.includes('touch')) {
            if (e.target === canvas) {
                e.preventDefault();
            }
        }

        let rect = canvas.getBoundingClientRect();
        let scaleX = canvas.width / rect.width;
        let scaleY = canvas.height / rect.height;
        let clientX, clientY;
        
        if (e.type.includes('touch')) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
            showTouchFeedback(clientX, clientY);
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
                    if (window.navigator.vibrate) {
                        window.navigator.vibrate(25);
                    }
                    
                    userPath.push(node);
                    node.touched = true;
                    checkPowerUpCollection(x, y);
                    drawGrid();
                }
            }
        }
    }
}

function handleEnd() {
    drawing = false;
    lastTouchPos = { x: 0, y: 0 };
}

function showTouchFeedback(x, y) {
    lastTouchPos = { x, y };
    clearTimeout(touchFeedbackTimeout);
    touchFeedbackTimeout = setTimeout(() => {
        lastTouchPos = { x: 0, y: 0 };
        drawGrid();
    }, 300);
}

function isValidMove(from, to) {
    return Math.abs(from.x - to.x) + Math.abs(from.y - to.y) === 1;
}

function checkPowerUpCollection(x, y) {
    let collectedPowerUp = powerUps.find(p => p.x === x && p.y === y && !p.collected);
    if (collectedPowerUp) {
        collectedPowerUp.collected = true;
        playPowerUpSound();
        
        switch (collectedPowerUp.type) {
            case 'obstacleRemover':
                removeRandomObstacles();
                showPowerUpEffect('Obstacles Removed!', '#9b59b6');
                break;
            case 'timeBoost':
                timeLeft += 10;
                showPowerUpEffect('+10 Seconds!', '#1abc9c');
                break;
            case 'pointBoost':
                score += 10;
                showPowerUpEffect('+10 Points!', '#3498db');
                break;
        }
        
        if (powerUps.every(p => p.collected)) {
            achievements.collector = true;
        }
        
        updateStats();
    }
}


function showPowerUpEffect(text, color) {
    const effect = document.createElement('div');
    effect.className = 'power-up-effect';
    effect.textContent = text;
    effect.style.color = color;
    document.querySelector('.game-canvas-container').appendChild(effect);
    setTimeout(() => effect.remove(), 1000);
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
        initializeGrid(); // Add this line to ensure grid is initialized
        startTimer();
        document.getElementById('startButton').style.display = 'none';
        playBackgroundMusic();
        
        Swal.fire({
            title: `Level ${currentLevel}`,
            text: 'Draw your path from green to red!',
            icon: 'info',
            confirmButtonText: 'Start!',
            allowOutsideClick: false
        }).then(() => {
            drawGrid(); // Add this line to ensure grid is drawn
            animationId = requestAnimationFrame(gameLoop);
        });
    }
}

function finishLevel() {
    if (gameStarted) {
        let similarity = calculateSimilarity(path, userPath);

        if (similarity >= 0.65) {
            playLevelCompleteSound();
            score += Math.round(similarity * 100) * currentLevel;
            
            if (similarity === 1) achievements.perfectPath = true;
            if (timeLeft > 30) achievements.speedster = true;
            
            currentLevel++;
            
            showLevelComplete(similarity, () => {
                if (currentLevel > 3) {
                    endGame(true);
                } else {
                    initializeGrid();
                    gameStarted = true;
                    startTimer();
                    showNextLevelTransition();
                }
            });
        } else {
            showFailureMessage(similarity);
        }
        
        updateStats();
        updateAchievements();
    }
}

function showLevelComplete(similarity, callback) {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
    
    Swal.fire({
        title: 'Level Complete!',
        html: `
            <div class="level-complete-stats">
                <p>Path Similarity: ${Math.round(similarity * 100)}%</p>
                <p>Time Left: ${timeLeft}s</p>
                <p>Score: ${score}</p>
            </div>
        `,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        allowOutsideClick: false
    }).then(callback);
}

function showNextLevelTransition() {
    Swal.fire({
        title: `Level ${currentLevel}`,
        text: 'Get Ready!',
        timer: 1500,
        showConfirmButton: false,
        allowOutsideClick: false
    });
}

function showFailureMessage(similarity) {
    Swal.fire({
        title: 'Try Again!',
        text: `Your path is ${Math.round(similarity * 100)}% similar. Need 65% to pass.`,
        icon: 'error',
        confirmButtonText: 'OK'
    });
}

function calculateSimilarity(optimalPath, userPath) {
    if (userPath.length === 0) return 0;
    
    let matchingPoints = 0;
    let totalPoints = optimalPath.length;
    
    for (let i = 0; i < userPath.length; i++) {
        if (optimalPath.some(node => node.x === userPath[i].x && node.y === userPath[i].y)) {
            matchingPoints++;
        }
    }
    
    return matchingPoints / totalPoints;
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timeLeft').textContent = timeLeft;
        
        if (timeLeft <= 10) {
            document.getElementById('timeLeft').style.color = '#e74c3c';
            if (timeLeft <= 5) {
                document.getElementById('timeLeft').style.animation = 'pulse 1s infinite';
            }
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            endGame(false);
        }
    }, 1000);
}

function endGame(completed) {
    clearInterval(timerInterval);
    cancelAnimationFrame(animationId);
    stopBackgroundMusic();
    gameStarted = false;
    
    if (completed) {
        playLevelCompleteSound();
        showGameComplete();
    } else {
        playGameOverSound();
        showGameOver();
    }
    
    bestScore = Math.max(bestScore, score);
}

function showGameComplete() {
    confetti({
        particleCount: 200,
        spread: 160,
        origin: { y: 0.6 }
    });
    
    Swal.fire({
        title: 'Congratulations!',
        html: `
            <div class="game-complete-stats">
                <h3>You've completed all levels!</h3>
                <p>Final Score: ${score}</p>
                <p>Best Score: ${bestScore}</p>
                <p>Achievements Earned: ${Object.values(achievements).filter(Boolean).length}</p>
            </div>
        `,
        icon: 'success',
        confirmButtonText: 'Play Again',
        allowOutsideClick: false
    }).then((result) => {
        if (result.isConfirmed) {
            resetGame();
        }
    });
}

function showGameOver() {
    Swal.fire({
        title: 'Game Over!',
        html: `
            <div class="game-over-stats">
                <p>Score: ${score}</p>
                <p>Level Reached: ${currentLevel}</p>
                <p>Best Score: ${bestScore}</p>
            </div>
        `,
        icon: 'error',
        confirmButtonText: 'Try Again',
        allowOutsideClick: false
    }).then((result) => {
        if (result.isConfirmed) {
            resetGame();
        }
    });
}

function resetGame() {
    score = 0;
    currentLevel = 1;
    achievements = {
        perfectPath: false,
        speedster: false,
        collector: false
    };
    document.getElementById('startButton').style.display = 'block';
    document.getElementById('timeLeft').style.color = '';
    document.getElementById('timeLeft').style.animation = '';
    initializeGrid();
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
    
    const achievementsList = {
        perfectPath: { text: 'Perfect Path', color: '#f1c40f' },
        speedster: { text: 'Speedster', color: '#e74c3c' },
        collector: { text: 'Collector', color: '#2ecc71' }
    };
    
    Object.entries(achievements).forEach(([key, achieved]) => {
        if (achieved) {
            achievementsDiv.innerHTML += `
                <span class="achievement" style="background-color: ${achievementsList[key].color}">
                    ${achievementsList[key].text}
                </span>
            `;
        }
    });
}

function gameLoop() {
    if (gameStarted) {
        drawGrid();
        animationId = requestAnimationFrame(gameLoop);
    }
}

// Event Listeners
canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
canvas.addEventListener('touchend', handleEnd);
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('mouseup', handleEnd);
document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('finishButton').addEventListener('click', finishLevel);
document.getElementById('newGameButton').addEventListener('click', resetGame);
muteButton.addEventListener('click', toggleMute);

// Initialize
enableMobileScrolling();
preventDefaultBehaviors();
resizeCanvas();

const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        if (entry.target === canvas) {
            resizeCanvas();
        }
    }
});

resizeObserver.observe(canvas);
