/* ============================================================
   📺 TRẬN CHIẾN A13 - LOGIC TIVI & 3D STUDIO CHUYÊN NGHIỆP
   Three.js 3D PBR Shaders, Gameshow Audio & MC Control
   ============================================================ */

const socket = io({ reconnection: true });
let tvSound = true;
let tvAudioCtx = null;
let tvRoundTimer = null;
let autoNextInterval = null;

// Three.js Scene Variables
let tvScene, tvCamera, tvRenderer, tvCandyGroup;

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
    [523.25, 659.25, 783.99].forEach((f, i) => setTimeout(() => playTvTone(f, 'sine', 0.2, 0.18), i * 60));
  },
  tick() {
    initTvAudio();
    playTvTone(650, 'triangle', 0.08, 0.2);
  },
  urgentTick() {
    initTvAudio();
    playTvTone(880, 'square', 0.1, 0.25);
  },
  ding() {
    initTvAudio();
    playTvTone(1046.50, 'sine', 0.3, 0.3);
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
    const melody = [523.25, 523.25, 523.25, 659.25, 783.99, 783.99, 1046.50];
    const times = [0, 120, 240, 360, 520, 680, 880];
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

// ─── 3D THREE.JS CANDY ARENA HOÀNG GIA CHO TIVI ──────────────
function initTvThree() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  tvScene = new THREE.Scene();
  tvScene.fog = new THREE.FogExp2(0xFFD6E0, 0.025);

  tvCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
  tvCamera.position.set(0, 0, 22);

  tvRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  tvRenderer.setSize(window.innerWidth, window.innerHeight);
  tvRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Ánh sáng trường quay Gameshow
  const ambLight = new THREE.AmbientLight(0xFFFFFF, 0.85);
  tvScene.add(ambLight);

  const mainLight = new THREE.DirectionalLight(0xFFB3C6, 1.2);
  mainLight.position.set(8, 12, 10);
  tvScene.add(mainLight);

  const pinkPoint = new THREE.PointLight(0xFF0A7B, 2.5, 45);
  pinkPoint.position.set(-10, 8, 12);
  tvScene.add(pinkPoint);

  const goldPoint = new THREE.PointLight(0xFFD166, 2, 45);
  goldPoint.position.set(10, -8, 10);
  tvScene.add(goldPoint);

  tvCandyGroup = new THREE.Group();
  tvScene.add(tvCandyGroup);

  // 1. Tạo Bánh Donut 3D Phủ Kem Dâu & Rắc Đường Màu
  for (let i = 0; i < 8; i++) {
    const donutGroup = new THREE.Group();
    // Bánh
    const doughGeo = new THREE.TorusGeometry(1.5, 0.6, 20, 36);
    const doughMat = new THREE.MeshStandardMaterial({ color: 0xF4A261, roughness: 0.6 });
    const dough = new THREE.Mesh(doughGeo, doughMat);
    donutGroup.add(dough);

    // Lớp kem dâu hồng bóng bẩy
    const glazeGeo = new THREE.TorusGeometry(1.5, 0.63, 16, 36, Math.PI * 1.8);
    const glazeMat = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? 0xFF0A7B : 0xFF69B4,
      roughness: 0.15,
      metalness: 0.1
    });
    const glaze = new THREE.Mesh(glazeGeo, glazeMat);
    glaze.position.z = 0.05;
    donutGroup.add(glaze);

    // Hạt đường rắc nhiều màu
    const sprinkleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.25, 6);
    const sprinkleColors = [0xFFFFFF, 0xFFD166, 0x52B788, 0x00A8E8, 0xFF4D94];
    for (let s = 0; s < 14; s++) {
      const sMat = new THREE.MeshBasicMaterial({ color: sprinkleColors[s % sprinkleColors.length] });
      const sp = new THREE.Mesh(sprinkleGeo, sMat);
      const angle = (s / 14) * Math.PI * 1.7;
      sp.position.set(Math.cos(angle) * 1.5, Math.sin(angle) * 1.5, 0.65);
      sp.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      donutGroup.add(sp);
    }

    donutGroup.position.set((Math.random() - 0.5) * 38, (Math.random() - 0.5) * 26, (Math.random() - 0.5) * 14);
    donutGroup.userData = {
      rx: (Math.random() - 0.5) * 0.012,
      ry: (Math.random() - 0.5) * 0.012,
      speed: 0.4 + Math.random() * 0.5,
      offset: Math.random() * Math.PI * 2
    };
    tvCandyGroup.add(donutGroup);
  }

  // 2. Kẹo Kim Cương Đường Lấp Lánh
  for (let i = 0; i < 10; i++) {
    const starGeo = new THREE.OctahedronGeometry(1.1 + Math.random() * 0.4);
    const starMat = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? 0xFFD166 : 0xFF8FAB,
      roughness: 0.1,
      metalness: 0.2
    });
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 28, (Math.random() - 0.5) * 15);
    star.userData = {
      rx: (Math.random() - 0.5) * 0.02,
      ry: (Math.random() - 0.5) * 0.02,
      speed: 0.6 + Math.random() * 0.4,
      offset: Math.random() * Math.PI * 2
    };
    tvCandyGroup.add(star);
  }

  // 3. Kẹo Tròn Bonbon Pastel
  for (let i = 0; i < 12; i++) {
    const ballGeo = new THREE.SphereGeometry(0.8, 24, 24);
    const ballMat = new THREE.MeshStandardMaterial({
      color: [0xFF69B4, 0xB7E4C7, 0xA0C4FF, 0xFFE5EC][i % 4],
      roughness: 0.25
    });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.set((Math.random() - 0.5) * 42, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 16);
    ball.userData = {
      rx: 0.01,
      ry: 0.01,
      speed: 0.5 + Math.random() * 0.5,
      offset: Math.random() * Math.PI * 2
    };
    tvCandyGroup.add(ball);
  }

  window.addEventListener('resize', () => {
    tvCamera.aspect = window.innerWidth / window.innerHeight;
    tvCamera.updateProjectionMatrix();
    tvRenderer.setSize(window.innerWidth, window.innerHeight);
  });

  let time = 0;
  function animate() {
    requestAnimationFrame(animate);
    time += 0.014;
    tvCandyGroup.children.forEach(item => {
      item.rotation.x += item.userData.rx;
      item.rotation.y += item.userData.ry;
      item.position.y += Math.sin(time * item.userData.speed + item.userData.offset) * 0.014;
    });
    tvRenderer.render(tvScene, tvCamera);
  }
  animate();
}

// ─── ĐIỀU KHIỂN SOCKET.IO VỚI SERVER ───────────────────────
socket.on('connect', () => {
  socket.emit('register-tv');
  // Hiển thị domain đang chạy
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
  document.getElementById('tv-countdown-num').textContent = data.seconds;
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
socket.on('answered-progress', (data) => {
  const ratio = document.getElementById('tv-answered-ratio');
  if (ratio) ratio.textContent = `${data.answeredCount}/${data.totalPlayers}`;

  const feed = document.getElementById('tv-feed-avatars');
  if (feed && data.justAnsweredName) {
    const chip = document.createElement('div');
    chip.className = 'feed-avatar-chip';
    chip.innerHTML = `${data.justAnsweredAvatar || '✨'} ${escapeHtml(data.justAnsweredName)} ✓`;
    feed.appendChild(chip);
    TvAudio.ding();
  }
});

// Đồng hồ vòng tròn 10 giây
function startTvCountdownCircle(seconds) {
  const startTime = Date.now();
  const endTime = startTime + (seconds * 1000);
  const circle = document.getElementById('tv-timer-circle');
  const num = document.getElementById('tv-timer-num');
  const circumference = 2 * Math.PI * 42; // r=42 -> ~264

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

    if (num) num.textContent = sec;

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
    <div class="tv-race-card ${i === 0 ? 'rank-top1' : ''}">
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

  // Tự động đếm lùi 7s hoặc để MC nhấn nút tiếp tục
  let nextSec = 7;
  const nextSecEl = document.getElementById('tv-next-sec');
  const nextFill = document.getElementById('tv-next-fill');
  nextFill.style.width = '100%';

  if (autoNextInterval) clearInterval(autoNextInterval);
  autoNextInterval = setInterval(() => {
    nextSec--;
    if (nextSecEl) nextSecEl.textContent = nextSec;
    if (nextFill) nextFill.style.width = `${(nextSec / 7) * 100}%`;
    if (nextSec <= 0) {
      clearInterval(autoNextInterval);
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

  // Tóm tắt giải thưởng
  const summary = document.getElementById('tv-awards-summary');
  summary.innerHTML = `
    <div class="tv-award-card">🥇 1 Giải Nhất: <strong>${escapeHtml(top3[0]?.name || '---')}</strong></div>
    <div class="tv-award-card">🥈 2 Giải Nhì: <strong>${escapeHtml(top3[1]?.name || '---')}</strong> & <strong>${escapeHtml(data.finalRankings[2]?.name || '---')}</strong></div>
    <div class="tv-award-card">🥉 3 Giải Ba: <strong>${escapeHtml(data.finalRankings[3]?.name || '---')}</strong>, <strong>${escapeHtml(data.finalRankings[4]?.name || '---')}</strong>, <strong>${escapeHtml(data.finalRankings[5]?.name || '---')}</strong></div>
  `;
});

socket.on('game-reset', () => {
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
