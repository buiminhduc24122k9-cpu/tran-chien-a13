/* ============================================================
   📺 TRẬN CHIẾN A13 - LOGIC TIVI & 3D STUDIO CHUYÊN NGHIỆP
   Three.js 3D PBR Shaders, Candy Physics, Confetti & Sound FX
   ============================================================ */

const socket = io({ reconnection: true });
let tvSound = true;
let tvAudioCtx = null;
let tvRoundTimer = null;
let autoNextInterval = null;

// Three.js Scene Variables
let tvScene, tvCamera, tvRenderer, tvCandyGroup, stardustPoints;
let mouseX = 0, mouseY = 0;
let targetCameraX = 0, targetCameraY = 0;

// ─── HỆ THỐNG ÂM THANH GAMESHOW TIVI (WEB AUDIO SYNTH) ───────
function initTvAudio() {
  if (!tvAudioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) tvAudioCtx = new AudioContext();
  }
  if (tvAudioCtx && tvAudioCtx.state === 'suspended') {
    tvAudioCtx.resume();
  }
}

function playTvTone(freq, type = 'sine', duration = 0.2, gainVal = 0.25) {
  if (!tvSound || !tvAudioCtx) return;
  try {
    const osc = tvAudioCtx.createOscillator();
    const gain = tvAudioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, tvAudioCtx.currentTime);
    gain.gain.setValueAtTime(gainVal, tvAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, tvAudioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(tvAudioCtx.destination);
    osc.start();
    osc.stop(tvAudioCtx.currentTime + duration);
  } catch (e) {}
}

const TvAudio = {
  joinChime() {
    initTvAudio();
    if (!tvSound || !tvAudioCtx) return;
    [523.25, 659.25, 783.99].forEach((f, i) => setTimeout(() => playTvTone(f, 'sine', 0.2, 0.22), i * 60));
  },
  tick() {
    initTvAudio();
    playTvTone(650, 'triangle', 0.08, 0.2);
  },
  urgentTick() {
    initTvAudio();
    playTvTone(920, 'square', 0.12, 0.28);
  },
  ding() {
    initTvAudio();
    playTvTone(1046.50, 'sine', 0.35, 0.32);
  },
  fanfare() {
    initTvAudio();
    if (!tvSound || !tvAudioCtx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      setTimeout(() => playTvTone(freq, 'triangle', 0.35, 0.3), idx * 90);
    });
  },
  grandVictory() {
    initTvAudio();
    if (!tvSound || !tvAudioCtx) return;
    const melody = [523.25, 523.25, 523.25, 659.25, 783.99, 783.99, 1046.50, 1318.51];
    const times = [0, 120, 240, 360, 520, 680, 880, 1100];
    melody.forEach((f, i) => setTimeout(() => playTvTone(f, 'triangle', 0.45, 0.35), times[i]));
  }
};

function toggleTvAudio() {
  tvSound = !tvSound;
  document.getElementById('tv-sound-btn').textContent = tvSound ? '🔊' : '🔇';
}

function showTvScreen(id) {
  document.querySelectorAll('.tv-screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// ─── PHÁO HOA & CONFETTI HIỆU ỨNG ĐỈNH CAO ──────────────────
function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 80,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#FF0A7B', '#FFD166', '#00A8E8', '#52B788', '#FF69B4', '#FFF']
    });
  }
}

function triggerGrandPodiumFireworks() {
  if (typeof confetti !== 'function') return;
  const duration = 6 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 35, spread: 360, ticks: 70, zIndex: 99999 };

  const interval = setInterval(function() {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      return clearInterval(interval);
    }
    const particleCount = 50 * (timeLeft / duration);

    confetti(Object.assign({}, defaults, {
      particleCount,
      origin: { x: Math.random() * 0.4, y: Math.random() - 0.2 },
      colors: ['#FF0A7B', '#FFD166', '#00A8E8', '#52B788', '#FFFFFF']
    }));

    confetti(Object.assign({}, defaults, {
      particleCount,
      origin: { x: 0.6 + Math.random() * 0.4, y: Math.random() - 0.2 },
      colors: ['#FF0A7B', '#FFD166', '#00A8E8', '#52B788', '#FFFFFF']
    }));
  }, 220);
}

// ─── 3D THREE.JS CANDY ARENA HOÀNG GIA CHO TIVI ──────────────
function initTvThree() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  tvScene = new THREE.Scene();
  tvScene.fog = new THREE.FogExp2(0xFFD6E0, 0.022);

  tvCamera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 1000);
  tvCamera.position.set(0, 0, 24);

  tvRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  tvRenderer.setSize(window.innerWidth, window.innerHeight);
  tvRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Ánh sáng trường quay Gameshow chuyên nghiệp
  const ambLight = new THREE.AmbientLight(0xFFFFFF, 0.9);
  tvScene.add(ambLight);

  const mainLight = new THREE.DirectionalLight(0xFFC2D1, 1.4);
  mainLight.position.set(10, 15, 12);
  tvScene.add(mainLight);

  const pinkPoint = new THREE.PointLight(0xFF0A7B, 3.2, 50);
  pinkPoint.position.set(-14, 10, 15);
  tvScene.add(pinkPoint);

  const goldPoint = new THREE.PointLight(0xFFD166, 2.5, 45);
  goldPoint.position.set(14, -10, 12);
  tvScene.add(goldPoint);

  const cyanPoint = new THREE.PointLight(0x00A8E8, 1.8, 40);
  cyanPoint.position.set(0, 16, 8);
  tvScene.add(cyanPoint);

  tvCandyGroup = new THREE.Group();
  tvScene.add(tvCandyGroup);

  // 1. Tạo Bánh Donut 3D Phủ Kem Dâu & Rắc Đường Màu
  for (let i = 0; i < 9; i++) {
    const donutGroup = new THREE.Group();
    const doughGeo = new THREE.TorusGeometry(1.6, 0.65, 20, 36);
    const doughMat = new THREE.MeshStandardMaterial({ color: 0xF7A87A, roughness: 0.5 });
    const dough = new THREE.Mesh(doughGeo, doughMat);
    donutGroup.add(dough);

    const glazeGeo = new THREE.TorusGeometry(1.62, 0.68, 18, 36, Math.PI * 1.85);
    const glazeMat = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? 0xFF0A7B : 0xFF69B4,
      roughness: 0.12,
      metalness: 0.15
    });
    const glaze = new THREE.Mesh(glazeGeo, glazeMat);
    glaze.position.z = 0.06;
    donutGroup.add(glaze);

    // Hạt đường rắc nhiều màu
    const sprinkleGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.28, 6);
    const sprinkleColors = [0xFFFFFF, 0xFFD166, 0x52B788, 0x00A8E8, 0xFF4D94];
    for (let s = 0; s < 16; s++) {
      const sMat = new THREE.MeshBasicMaterial({ color: sprinkleColors[s % sprinkleColors.length] });
      const sp = new THREE.Mesh(sprinkleGeo, sMat);
      const angle = (s / 16) * Math.PI * 1.75;
      sp.position.set(Math.cos(angle) * 1.62, Math.sin(angle) * 1.62, 0.72);
      sp.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      donutGroup.add(sp);
    }

    donutGroup.position.set((Math.random() - 0.5) * 44, (Math.random() - 0.5) * 28, (Math.random() - 0.5) * 16);
    donutGroup.userData = {
      rx: (Math.random() - 0.5) * 0.012,
      ry: (Math.random() - 0.5) * 0.012,
      speed: 0.4 + Math.random() * 0.5,
      offset: Math.random() * Math.PI * 2
    };
    tvCandyGroup.add(donutGroup);
  }

  // 2. Kẹo Mút Khổng Lồ (3D Swirl Lollipop)
  for (let i = 0; i < 6; i++) {
    const lolliGroup = new THREE.Group();
    // Que kẹo
    const stickGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.8, 16);
    const stickMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.3 });
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.position.y = -1.9;
    lolliGroup.add(stick);

    // Đầu kẹo xoắn ốc nhiều màu
    const headGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.38, 32);
    const headMat = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? 0xFF0A7B : 0xFFD166,
      roughness: 0.15,
      metalness: 0.1
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.rotation.x = Math.PI / 2;
    lolliGroup.add(head);

    lolliGroup.position.set((Math.random() - 0.5) * 42, (Math.random() - 0.5) * 28, (Math.random() - 0.5) * 14);
    lolliGroup.userData = {
      rx: (Math.random() - 0.5) * 0.015,
      ry: (Math.random() - 0.5) * 0.015,
      speed: 0.5 + Math.random() * 0.4,
      offset: Math.random() * Math.PI * 2
    };
    tvCandyGroup.add(lolliGroup);
  }

  // 3. Trái Tim 3D Dễ Thương (Extruded 3D Heart)
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, 0.5);
  heartShape.bezierCurveTo(0, 0.8, -0.6, 1.3, -1.2, 1.3);
  heartShape.bezierCurveTo(-1.8, 1.3, -2.0, 0.8, -2.0, 0.3);
  heartShape.bezierCurveTo(-2.0, -0.5, -1.2, -1.2, 0, -2.0);
  heartShape.bezierCurveTo(1.2, -1.2, 2.0, -0.5, 2.0, 0.3);
  heartShape.bezierCurveTo(2.0, 0.8, 1.8, 1.3, 1.2, 1.3);
  heartShape.bezierCurveTo(0.6, 1.3, 0, 0.8, 0, 0.5);

  const extrudeSettings = { depth: 0.4, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.15, bevelThickness: 0.15 };
  const heartGeo = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);
  heartGeo.scale(0.55, 0.55, 0.55);

  for (let i = 0; i < 8; i++) {
    const heartMat = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? 0xFF0A7B : 0xFF69B4,
      roughness: 0.1,
      metalness: 0.2
    });
    const heart = new THREE.Mesh(heartGeo, heartMat);
    heart.position.set((Math.random() - 0.5) * 46, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 16);
    heart.userData = {
      rx: (Math.random() - 0.5) * 0.02,
      ry: (Math.random() - 0.5) * 0.02,
      speed: 0.6 + Math.random() * 0.5,
      offset: Math.random() * Math.PI * 2
    };
    tvCandyGroup.add(heart);
  }

  // 4. Kẹo Gói Hai Đầu Xinh Xắn (Wrapped Candy)
  for (let i = 0; i < 7; i++) {
    const candyWrap = new THREE.Group();
    // Viên kẹo giữa
    const bodyGeo = new THREE.SphereGeometry(0.8, 20, 20);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: [0xFF69B4, 0x00A8E8, 0x52B788, 0xFFD166][i % 4],
      roughness: 0.2
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(1.2, 0.8, 0.8);
    candyWrap.add(body);

    // 2 đầu nếp gấp
    const wingGeo = new THREE.ConeGeometry(0.55, 0.7, 10, 1, true);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.3, side: THREE.DoubleSide });

    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.rotation.z = Math.PI / 2;
    wingL.position.x = -1.2;
    candyWrap.add(wingL);

    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.rotation.z = -Math.PI / 2;
    wingR.position.x = 1.2;
    candyWrap.add(wingR);

    candyWrap.position.set((Math.random() - 0.5) * 44, (Math.random() - 0.5) * 28, (Math.random() - 0.5) * 14);
    candyWrap.userData = {
      rx: (Math.random() - 0.5) * 0.015,
      ry: (Math.random() - 0.5) * 0.015,
      speed: 0.5 + Math.random() * 0.5,
      offset: Math.random() * Math.PI * 2
    };
    tvCandyGroup.add(candyWrap);
  }

  // 5. Đám Mây Hạt Bụi Ngôi Sao Lấp Lánh (Stardust Particles)
  const stardustCount = 140;
  const starGeo = new THREE.BufferGeometry();
  const starPositions = new Float32Array(stardustCount * 3);
  for (let i = 0; i < stardustCount * 3; i += 3) {
    starPositions[i] = (Math.random() - 0.5) * 55;
    starPositions[i + 1] = (Math.random() - 0.5) * 35;
    starPositions[i + 2] = (Math.random() - 0.5) * 20;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xFFFFFF,
    size: 0.35,
    transparent: true,
    opacity: 0.8
  });
  stardustPoints = new THREE.Points(starGeo, starMat);
  tvScene.add(stardustPoints);

  // Parallax tương tác chuột
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    targetCameraX = mouseX * 2.5;
    targetCameraY = mouseY * 1.8;
  });

  window.addEventListener('resize', () => {
    tvCamera.aspect = window.innerWidth / window.innerHeight;
    tvCamera.updateProjectionMatrix();
    tvRenderer.setSize(window.innerWidth, window.innerHeight);
  });

  let time = 0;
  function animate() {
    requestAnimationFrame(animate);
    time += 0.015;

    // Camera chuyển động mượt mà
    tvCamera.position.x += (targetCameraX - tvCamera.position.x) * 0.04;
    tvCamera.position.y += (targetCameraY - tvCamera.position.y) * 0.04;
    tvCamera.lookAt(0, 0, 0);

    // Đổi màu ánh sáng đèn trường quay theo nhịp thở
    pinkPoint.intensity = 2.8 + Math.sin(time * 2) * 0.8;
    goldPoint.intensity = 2.2 + Math.cos(time * 2.2) * 0.6;

    // Xoay các vật phẩm kẹo ngọt
    tvCandyGroup.children.forEach(item => {
      item.rotation.x += item.userData.rx;
      item.rotation.y += item.userData.ry;
      item.position.y += Math.sin(time * item.userData.speed + item.userData.offset) * 0.016;
    });

    if (stardustPoints) {
      stardustPoints.rotation.y += 0.0006;
      stardustPoints.rotation.x += 0.0004;
    }

    tvRenderer.render(tvScene, tvCamera);
  }
  animate();
}

// ─── ĐIỀU KHIỂN SOCKET.IO VỚI SERVER ───────────────────────
socket.on('connect', () => {
  socket.emit('register-tv');
  const linkDisplay = document.getElementById('tv-link-display');
  if (linkDisplay) {
    linkDisplay.textContent = window.location.host;
  }
});

socket.on('tv-init', (data) => {
  updateTvPlayers(data.players);
});

socket.on('lobby-update', (data) => {
  updateTvPlayers(data.players);
  if (data.newPlayer) {
    TvAudio.joinChime();
    triggerConfetti();
  }
});

function updateTvPlayers(players) {
  const countEl = document.getElementById('tv-player-count');
  const listEl = document.getElementById('tv-players-list');
  if (countEl) countEl.textContent = players.length;
  if (!listEl) return;

  listEl.innerHTML = players.map(p => `
    <div class="tv-player-card">
      <div class="tv-p-avatar">${p.avatar || '🐰'}</div>
      <div class="tv-p-name">${escapeHtml(p.name)}</div>
    </div>
  `).join('');
}

// MC BẮT ĐẦU TRẬN ĐẤU
function tvStartGame() {
  initTvAudio();
  TvAudio.ding();
  socket.emit('tv-start-game');
}

// MC CHUYỂN VÒNG NGAY LẬP TỨC
function tvNextRoundNow() {
  if (autoNextInterval) clearInterval(autoNextInterval);
  initTvAudio();
  TvAudio.ding();
  socket.emit('tv-next-round');
}

// MC RESET GAME
function tvResetGame() {
  initTvAudio();
  TvAudio.ding();
  socket.emit('tv-reset-game');
}

// Đếm ngược 5s
socket.on('game-countdown', (data) => {
  showTvScreen('tv-screen-countdown');
  const numEl = document.getElementById('tv-countdown-num');
  if (numEl) {
    numEl.textContent = data.seconds;
    numEl.classList.remove('pulse-countdown');
    void numEl.offsetWidth; // Trigger reflow
    numEl.classList.add('pulse-countdown');
  }
  TvAudio.tick();
});

// Bắt đầu vòng đấu 10 giây
socket.on('round-start', (data) => {
  if (autoNextInterval) clearInterval(autoNextInterval);
  showTvScreen('tv-screen-game');
  TvAudio.fanfare();

  document.getElementById('tv-round-title').textContent = `${data.bossName.toUpperCase()} (10S)`;
  document.getElementById('tv-question-text').textContent = data.question;
  document.getElementById('tv-answered-ratio').textContent = `0/${document.getElementById('tv-player-count').textContent}`;
  document.getElementById('tv-feed-avatars').innerHTML = '';

  const letters = ['A', 'B', 'C', 'D'];
  const grid = document.getElementById('tv-options-grid');
  grid.innerHTML = data.options.map((opt, i) => `
    <div class="tv-opt-card opt-${letters[i]}">
      <div class="tv-opt-letter">${letters[i]}</div>
      <div class="tv-opt-text">${escapeHtml(opt)}</div>
    </div>
  `).join('');

  startTvCountdownCircle(data.timeLimit || 10);
});

// Tiến độ nộp bài trực tiếp
let lastDingTime = 0;
socket.on('answered-progress', (data) => {
  const ratio = document.getElementById('tv-answered-ratio');
  if (ratio) ratio.textContent = `${data.answeredCount}/${data.totalPlayers}`;

  const feed = document.getElementById('tv-feed-avatars');
  if (feed && data.justAnsweredName) {
    const chip = document.createElement('div');
    chip.className = 'feed-avatar-chip';
    chip.innerHTML = `${data.justAnsweredAvatar || '✨'} ${escapeHtml(data.justAnsweredName)} ✓`;
    feed.appendChild(chip);

    const now = Date.now();
    if (now - lastDingTime > 300) {
      TvAudio.ding();
      lastDingTime = now;
    }
  }
});

// Đồng hồ vòng tròn 10 giây
function startTvCountdownCircle(seconds) {
  const startTime = Date.now();
  const endTime = startTime + (seconds * 1000);
  const circle = document.getElementById('tv-timer-circle');
  const num = document.getElementById('tv-timer-num');
  const circumference = 2 * Math.PI * 42;

  if (tvRoundTimer) clearInterval(tvRoundTimer);

  tvRoundTimer = setInterval(() => {
    const now = Date.now();
    const remainMs = Math.max(0, endTime - now);
    const sec = Math.ceil(remainMs / 1000);
    const ratio = Math.max(0, remainMs / (seconds * 1000));
    const offset = circumference * (1 - ratio);

    if (circle) {
      circle.style.strokeDashoffset = offset;
      if (sec <= 3) {
        circle.style.stroke = '#FF0A7B';
      } else if (sec <= 6) {
        circle.style.stroke = '#FFB703';
      } else {
        circle.style.stroke = '#52B788';
      }
    }

    if (num) {
      num.textContent = sec;
      if (sec <= 3) {
        num.style.color = '#FF0A7B';
        num.style.transform = 'scale(1.2)';
      } else {
        num.style.color = '#D81B60';
        num.style.transform = 'scale(1)';
      }
    }

    if (sec <= 3 && remainMs > 0 && Math.floor(remainMs / 100) % 10 === 0) {
      TvAudio.urgentTick();
    }

    if (remainMs <= 0) {
      clearInterval(tvRoundTimer);
    }
  }, 80);
}

// Kết thúc vòng -> BẢNG VÀNG THỨ HẠNG A13
socket.on('round-end', (data) => {
  if (tvRoundTimer) clearInterval(tvRoundTimer);
  showTvScreen('tv-screen-round-end');
  TvAudio.fanfare();
  triggerConfetti();

  document.getElementById('tv-lb-round-num').textContent = data.roundIndex + 1;
  document.getElementById('tv-correct-ans-text').textContent = data.correctAnswer;

  // Spotlight Top 1
  if (data.topPlayer) {
    document.getElementById('tv-top1-avatar').textContent = data.topPlayer.avatar || '👑';
    document.getElementById('tv-top1-name').textContent = data.topPlayer.name;
    document.getElementById('tv-top1-pts').textContent = `${data.topPlayer.totalPoints} Điểm`;
    document.getElementById('tv-top1-gain').textContent = `+${data.topPlayer.lastRoundPoints}đ Vòng Này (${data.topPlayer.lastAnswerTime}s)`;
  }

  // Bảng xếp hạng các vị trí
  const list = document.getElementById('tv-lb-container');
  const medals = ['🥇', '🥈', '🥉'];
  list.innerHTML = data.leaderboard.map((p, i) => `
    <div class="tv-race-card ${i === 0 ? 'rank-top1' : ''}" style="animation-delay: ${i * 0.08}s">
      <div class="tv-race-left">
        <span class="tv-race-medal">${i < 3 ? medals[i] : `#${i + 1}`}</span>
        <span class="tv-race-avatar">${p.avatar || '🐰'}</span>
        <span class="tv-race-name">${escapeHtml(p.name)}</span>
      </div>
      <div class="tv-race-right">
        <span class="tv-race-score">${p.totalPoints} Điểm</span>
        <span class="tv-race-gain">+${p.lastRoundPoints}đ</span>
      </div>
    </div>
  `).join('');

  // Đếm lùi 12s cho MC và cả lớp cùng theo dõi hoặc MC nhấn nút chuyển vòng ngay lập tức
  let nextSec = 12;
  const nextSecEl = document.getElementById('tv-next-sec');
  const nextFill = document.getElementById('tv-next-fill');
  if (nextFill) nextFill.style.width = '100%';

  if (autoNextInterval) clearInterval(autoNextInterval);
  autoNextInterval = setInterval(() => {
    nextSec--;
    if (nextSecEl) nextSecEl.textContent = nextSec;
    if (nextFill) nextFill.style.width = `${(nextSec / 12) * 100}%`;
    if (nextSec <= 0) {
      clearInterval(autoNextInterval);
      autoNextInterval = null;
      if (!data.isLastRound) {
        socket.emit('tv-next-round');
      }
    }
  }, 1000);
});

// Chung cuộc vinh quang (Grand Podium)
socket.on('game-over', (data) => {
  if (autoNextInterval) clearInterval(autoNextInterval);
  showTvScreen('tv-screen-game-over');
  TvAudio.grandVictory();
  triggerGrandPodiumFireworks();

  const showcase = document.getElementById('tv-podium-showcase');
  const top3 = data.finalRankings.slice(0, 3);
  const slots = [];

  if (top3[1]) slots.push({ ...top3[1], rank: 2, crown: '🥈 Á QUÂN', stepClass: 'step-rank-2' });
  if (top3[0]) slots.push({ ...top3[0], rank: 1, crown: '👑 QUÁN QUÂN', stepClass: 'step-rank-1' });
  if (top3[2]) slots.push({ ...top3[2], rank: 3, crown: '🥉 GIẢI BA', stepClass: 'step-rank-3' });

  showcase.innerHTML = slots.map(p => `
    <div class="tv-podium-col">
      <div class="tv-podium-crown">${p.crown}</div>
      <div class="tv-podium-avatar">${p.avatar || '🐰'}</div>
      <div class="tv-podium-name">${escapeHtml(p.name)}</div>
      <div class="tv-podium-pts">${p.totalPoints} Điểm</div>
      <div class="tv-podium-step ${p.stepClass}">#${p.rank}</div>
    </div>
  `).join('');

  // Tóm tắt giải thưởng: 1 Nhất, 2 Nhì, 3 Ba
  const summary = document.getElementById('tv-awards-summary');
  summary.innerHTML = `
    <div class="tv-award-card">🥇 1 Giải Nhất: <strong>${escapeHtml(top3[0]?.name || '---')}</strong></div>
    <div class="tv-award-card">🥈 2 Giải Nhì: <strong>${escapeHtml(top3[1]?.name || '---')}</strong> & <strong>${escapeHtml(data.finalRankings[2]?.name || '---')}</strong></div>
    <div class="tv-award-card">🥉 3 Giải Ba: <strong>${escapeHtml(data.finalRankings[3]?.name || '---')}</strong>, <strong>${escapeHtml(data.finalRankings[4]?.name || '---')}</strong>, <strong>${escapeHtml(data.finalRankings[5]?.name || '---')}</strong></div>
  `;
});

socket.on('game-reset', () => {
  if (autoNextInterval) clearInterval(autoNextInterval);
  if (tvRoundTimer) clearInterval(tvRoundTimer);
  showTvScreen('tv-screen-lobby');
});

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ─── QUẢN LÝ MÃ QR CHO ĐIỆN THOẠI ─────────────────────────
function openQrModal() {
  initTvAudio();
  TvAudio.ding();
  const modal = document.getElementById('tv-qr-modal');
  const qrImg = document.getElementById('tv-qr-img');
  const qrUrlText = document.getElementById('tv-qr-url-text');

  const mobileUrl = window.location.origin;
  if (qrUrlText) qrUrlText.textContent = mobileUrl;

  if (qrImg) {
    const apiQr = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(mobileUrl)}`;
    qrImg.src = apiQr;
    qrImg.onerror = () => {
      qrImg.src = '/qr.png';
    };
  }

  if (modal) modal.style.display = 'flex';
}

function closeQrModal(e) {
  if (e && e.target && e.target.closest('.tv-qr-card') && !e.target.classList.contains('tv-qr-close-btn')) {
    return;
  }
  const modal = document.getElementById('tv-qr-modal');
  if (modal) modal.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  initTvThree();
});
