// === あみだくじゲーム script.js ===

// ==== DOM要素の取得 ====
const DOM = {
    gameContainer: document.getElementById('game-container'),
    characterSelection: document.getElementById('character-selection'),
    amidakujiArea: document.getElementById('amidakuji-area'),
    amidakujiCanvas: document.getElementById('amidakujiCanvas'),
    resultArea: document.getElementById('result-area'),
    resultImage: document.getElementById('result-image'),
    resultMessage: document.getElementById('result-message'),
    fireworks: document.getElementById('fireworks'),
    resetButton: document.getElementById('reset-button'),
    characters: document.querySelectorAll('.character-icon'),
    bgm: document.getElementById('bgm'),
};

const ctx = DOM.amidakujiCanvas.getContext('2d');

// ==== 音声 ====
const sounds = {
    click: new Audio('sounds/click.mp3'), // 'sound' を 'sounds' に修正
    success: new Audio('sounds/success.mp3'), // 'sound' を 'sounds' に修正
    explosion: new Audio('sounds/explosion.mp3'), // 'sound' を 'sounds' に修正
    move: new Audio('sounds/move.mp3') // 'sound' を 'sounds' に修正
};

// 音声の読み込み
Object.values(sounds).forEach(sound => {
    sound.load();
    sound.volume = 0.5; // 音量を50%に設定
});

// ==== ゲーム定数 ====
const CONFIG = {
    NUM_COLUMNS: 3,
    NUM_ROWS: 8,
    CELL_HEIGHT: 60,
    LINE_WIDTH: 4,
    START_Y_OFFSET: 20,
    GOAL_AREA_HEIGHT: 80,
    CHAR_SIZE: 50,
    MOVE_SPEED_Y: 8, // キャラクターの縦移動速度を増加
    MOVE_SPEED_X: 8, // キャラクターの横移動速度を増加
    BOUNCE_HEIGHT: 10, // 横移動時のバウンス高さ
    BOUNCE_DURATION: 150, // バウンス時間
};

// ==== ゲーム状態 ====
const gameState = {
    selectedIndex: -1,
    isPlaying: false,
    currentX: -1,
    currentY: -1,
    currentCol: -1,
    animFrameId: null,
    paths: [],
    results: [],
    charStartXs: [],
    isBouncing: false,
    bounceTimer: 0,
    isMovingHorizontally: false, // 横移動中かどうかを示すフラグを追加
};

// ==== アセット管理 ====
const assets = {
    characterImages: [],
    goalImages: {},
};

// ==== 初期化処理 ====
function preloadAssets() {
    // キャラクター画像の読み込み
    DOM.characters.forEach((char, i) => {
        const img = new Image();
        img.src = char.src;
        assets.characterImages[i] = img;
    });
    
    // ゴール画像の読み込み
    ['treasure', 'bomb'].forEach(type => {
        const img = new Image();
        img.src = `images/${type}.png`;
        assets.goalImages[type] = img;
    });
}

function initializeGame() {
    gameState.isPlaying = false;
    
    // キャンバスサイズの設定
    DOM.amidakujiCanvas.width = DOM.amidakujiArea.clientWidth - 30;
    DOM.amidakujiCanvas.height = (CONFIG.NUM_ROWS + 1) * CONFIG.CELL_HEIGHT + CONFIG.START_Y_OFFSET + CONFIG.GOAL_AREA_HEIGHT;
    
    // キャラクター開始位置の計算
    gameState.charStartXs = Array.from({ length: CONFIG.NUM_COLUMNS }, (_, i) =>
        (DOM.amidakujiCanvas.width / (CONFIG.NUM_COLUMNS + 1)) * (i + 1)
    );
    
    resetUI();
    generatePaths();
    drawAll();
}

function resetUI() {
    DOM.characterSelection.style.display = 'block';
    DOM.resultArea.style.display = 'none';
    DOM.fireworks.classList.remove('show');
    DOM.resultImage.style.display = 'none';
    DOM.resultMessage.textContent = '';
    DOM.resultMessage.className = '';
    
    // キャラクター選択をリセット
    DOM.characters.forEach(char => {
        char.classList.remove('selected');
    });
    
    // ゲーム状態をリセット
    gameState.selectedIndex = -1;
    gameState.currentX = -1;
    gameState.currentY = -1;
    gameState.currentCol = -1;
    gameState.isBouncing = false;
    gameState.bounceTimer = 0;
    gameState.isMovingHorizontally = false; // フラグをリセット
    
    if (gameState.animFrameId) {
        cancelAnimationFrame(gameState.animFrameId);
    }
    
    DOM.bgm.pause();
    DOM.bgm.currentTime = 0;
}

// ==== あみだくじ生成 ====
function generatePaths() {
    // パスの初期化
    gameState.paths = Array.from({ length: CONFIG.NUM_COLUMNS }, () => []);
    
    // 結果の設定（1つは宝箱、残りは爆弾）
    const results = Array(CONFIG.NUM_COLUMNS).fill('bomb');
    results[Math.floor(Math.random() * CONFIG.NUM_COLUMNS)] = 'treasure';
    gameState.results = results;
    
    // 横線の生成
    for (let r = 0; r < CONFIG.NUM_ROWS; r++) {
        for (let c = 0; c < CONFIG.NUM_COLUMNS - 1; c++) {
            if (Math.random() < 0.4) {
                const hasLeft = gameState.paths[c].some(p => p.row === r);
                const hasRight = gameState.paths[c + 1].some(p => p.row === r);
                
                if (!hasLeft && !hasRight) {
                    gameState.paths[c].push({ row: r, toCol: c + 1 });
                    gameState.paths[c + 1].push({ row: r, toCol: c });
                }
            }
        }
    }
}

// ==== 描画処理 ====
function drawAll() {
    ctx.clearRect(0, 0, DOM.amidakujiCanvas.width, DOM.amidakujiCanvas.height);
    drawLines();
    drawGoals();
    drawCharacter();
}

function drawLines() {
    // 縦線の描画
    ctx.lineWidth = CONFIG.LINE_WIDTH;
    ctx.strokeStyle = '#8D6E63';
    ctx.lineCap = 'round';
    
    for (let i = 0; i < CONFIG.NUM_COLUMNS; i++) {
        const x = gameState.charStartXs[i];
        ctx.beginPath();
        ctx.moveTo(x, CONFIG.START_Y_OFFSET);
        ctx.lineTo(x, DOM.amidakujiCanvas.height - CONFIG.GOAL_AREA_HEIGHT);
        ctx.stroke();
    }
    
    // 横線の描画
    ctx.strokeStyle = '#A1887F';
    ctx.lineWidth = CONFIG.LINE_WIDTH;
    
    gameState.paths.forEach((col, ci) => {
        col.forEach(p => {
            if (p.toCol > ci) {
                const y = CONFIG.START_Y_OFFSET + (p.row + 0.5) * CONFIG.CELL_HEIGHT;
                const x1 = gameState.charStartXs[ci];
                const x2 = gameState.charStartXs[p.toCol];
                
                ctx.beginPath();
                ctx.moveTo(x1, y);
                ctx.lineTo(x2, y);
                ctx.stroke();
            }
        });
    });
}

function drawGoals() {
    for (let i = 0; i < CONFIG.NUM_COLUMNS; i++) {
        const img = assets.goalImages[gameState.results[i]];
        if (!img || !img.complete) continue;
        
        const x = gameState.charStartXs[i];
        const y = DOM.amidakujiCanvas.height - CONFIG.GOAL_AREA_HEIGHT / 2;
        
        ctx.drawImage(img, x - 30, y - 30, 60, 60);
    }
}

function drawCharacter() {
    if (gameState.selectedIndex === -1 || gameState.currentY < 0) return;
    
    const img = assets.characterImages[gameState.selectedIndex];
    if (!img || !img.complete) return;
    
    let displayY = gameState.currentY;
    if (gameState.isBouncing) {
        // バウンスアニメーションの計算 (sin波を使用)
        const bounceOffset = Math.sin((gameState.bounceTimer / CONFIG.BOUNCE_DURATION) * Math.PI) * CONFIG.BOUNCE_HEIGHT;
        displayY -= bounceOffset;
    }

    ctx.drawImage(
        img,
        gameState.currentX - CONFIG.CHAR_SIZE / 2,
        displayY - CONFIG.CHAR_SIZE / 2,
        CONFIG.CHAR_SIZE,
        CONFIG.CHAR_SIZE
    );
}

// ==== ゲーム進行 ====
function selectCharacter(index) {
    if (gameState.isPlaying || gameState.selectedIndex !== -1) return;
    
    // 音楽を開始
    DOM.bgm.play().catch(() => {
        console.log('BGM再生に失敗しました');
    });
    
    gameState.selectedIndex = index;
    gameState.currentCol = index;
    
    // キャラクター選択の表示
    DOM.characters[index].classList.add('selected');
    
    // 効果音
    sounds.click.play().catch(() => {});
    
    // ゲーム開始
    gameState.isPlaying = true;
    gameState.currentX = gameState.charStartXs[index];
    gameState.currentY = CONFIG.START_Y_OFFSET;
    
    animateMove();
}

function animateMove() {
    // 横移動中の場合は、縦移動をスキップ
    if (gameState.isMovingHorizontally) {
        gameState.animFrameId = requestAnimationFrame(animateMove);
        return;
    }

    const goalY = DOM.amidakujiCanvas.height - CONFIG.GOAL_AREA_HEIGHT;
    
    // ゴールに到達した場合
    if (gameState.currentY >= goalY) {
        showResult();
        return;
    }
    
    // 横線との交差点をチェック
    const nextCross = gameState.paths[gameState.currentCol].find(p => {
        const crossY = CONFIG.START_Y_OFFSET + (p.row + 0.5) * CONFIG.CELL_HEIGHT;
        // 現在のY座標から次のステップで横線を超えるかどうかを判定
        return (gameState.currentY < crossY && gameState.currentY + CONFIG.MOVE_SPEED_Y >= crossY);
    });
    
    if (nextCross) {
        const crossY = CONFIG.START_Y_OFFSET + (nextCross.row + 0.5) * CONFIG.CELL_HEIGHT;
        gameState.currentY = crossY; // 横線のY座標に正確に移動
            
        // 効果音
        sounds.move.play().catch(() => {});
        
        // 横移動開始
        gameState.isBouncing = true;
        gameState.bounceTimer = 0;
        gameState.isMovingHorizontally = true; // 横移動フラグを立てる
        const targetX = gameState.charStartXs[nextCross.toCol];
        const startX = gameState.currentX;
        const startCol = gameState.currentCol;

        const animateHorizontalMove = () => {
            gameState.bounceTimer += 16; // 約60fps
            const progress = Math.min(1, gameState.bounceTimer / CONFIG.BOUNCE_DURATION); // 1を超えないように
            
            // 線形補間とバウンスを組み合わせ
            gameState.currentX = startX + (targetX - startX) * progress;
            
            drawAll();

            if (progress === 1) { // アニメーションが完了したら
                gameState.isBouncing = false;
                gameState.currentX = targetX;
                gameState.currentCol = nextCross.toCol;
                gameState.isMovingHorizontally = false; // 横移動フラグをリセット
                animateMove(); // 次の縦移動を開始
            } else {
                gameState.animFrameId = requestAnimationFrame(animateHorizontalMove);
            }
        };
        animateHorizontalMove();
        return; // 横移動中は縦移動しない
    }
    
    // バウンス中でない場合のみ縦移動
    if (!gameState.isMovingHorizontally) { // 横移動中でないことを確認
        gameState.currentY += CONFIG.MOVE_SPEED_Y;
    }
    
    drawAll();
    gameState.animFrameId = requestAnimationFrame(animateMove);
}

function showResult() {
    if (gameState.animFrameId) {
        cancelAnimationFrame(gameState.animFrameId);
    }
    
    const result = gameState.results[gameState.currentCol];
    
    // 結果表示
    DOM.resultArea.style.display = 'flex';
    DOM.resultImage.src = `images/${result}.png`;
    DOM.resultImage.style.display = 'block';
    
    if (result === 'treasure') {
        DOM.resultMessage.textContent = 'おめでとう！宝箱をゲット！';
        DOM.resultMessage.className = 'success';
        
        // 花火アニメーション
        DOM.fireworks.classList.add('show');
        sounds.success.play().catch(() => {});
        
        // 花火をより長く表示
        setTimeout(() => {
            DOM.fireworks.classList.remove('show');
        }, 3000); // 3秒に延長
        
    } else {
        DOM.resultMessage.textContent = '残念！爆弾に当たってしまった…';
        DOM.resultMessage.className = 'failure';
        sounds.explosion.play().catch(() => {});
    }
    
    gameState.isPlaying = false;
}

// ==== イベントリスナー ====
DOM.characters.forEach((char, i) => {
    char.addEventListener('click', () => selectCharacter(i));
});

DOM.resetButton.addEventListener('click', initializeGame);

// ==== 起動処理 ====
window.addEventListener('load', () => {
    preloadAssets();
    // setTimeout(initializeGame, 100); // 画像読み込み後に初期化 - 不要な遅延なのでコメントアウト
    initializeGame(); // 直接呼び出す
});

window.addEventListener('resize', () => {
    if (!gameState.isPlaying) {
        initializeGame();
    }
});
