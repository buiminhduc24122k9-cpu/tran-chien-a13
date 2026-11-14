/* ============================================================
   📺 TRẬN CHIẾN A13 - TV DISPLAY LOGIC (SOCKET.IO & THREE.JS)
   ============================================================ */

const socket = io({ reconnection: true });
let tvSound = true;
let tvAudioCtx = null;
let tvRoundTimer = null;

// Three.js Background
let tvScene, tvCamera, tvRenderer, tvGroup;

function initTvAudio() {
  if (!tvAudioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) tvAudioCtx = new AudioContext();
  }
  if (tvAudioCtx && tvAudioCtx.state === 'suspended') {
    tvAudioCtx.resume();
  }
}

function playTvTone(freq, type = 'sine', duration = 0.2, gainVal = 0.2) {
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
  tick() {
    initTvAudio();
    playTvTone(600, 'triangle', 0.08, 0.15);
  },
  ding() {
    initTvAudio();
    playTvTone(1046, 'sine', 0.25, 0.25);
  },
  fanfare() {
    initTvAudio();
    if (!tvSound || !tvAudioCtx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      setTimeout(() => playTvTone(freq, 'triangle', 0.4, 0.3), idx * 100);
    });
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

// ─── THREE.JS CANDY 3D FOR TV ──────────────────────────────
function initTvThree() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  tvScene = new THREE.Scene();
  tvCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  tvCamera.position.z = 20;

  tvRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  tvRenderer.setSize(window.innerWidth, window.innerHeight);
  tvRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const amb = new THREE.AmbientLight(0xFFFFFF, 0.9);
  tvScene.add(amb);

  const dir = new THREE.DirectionalLight(0xFFB3C6, 1);
  dir.position.set(5, 10, 8);
  tvScene.add(dir);

  tvGroup = new THREE.Group();
  tvScene.add(tvGroup);

  const materials = [
    new THREE.MeshStandardMaterial({ color: 0xFF69B4, roughness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0xFFD166, roughness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0xB7E4C7, roughness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0xA0C4FF, roughness: 0.3 })
  ];

  for (let i = 0; i < 12; i++) {
    const geo = i % 2 === 0 ? new THREE.TorusGeometry(1.4, 0.5, 16, 32) : new THREE.OctahedronGeometry(1.2);
    const mesh = new THREE.Mesh(geo, materials[i % materials.length]);
    mesh.position.set((Math.random() - 0.5) * 36, (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 14);
    mesh.userData = {
      rx: (Math.random() - 0.5) * 0.015,
      ry: (Math.random() - 0.5) * 0.015,
      speed: 0.5 + Math.random() * 0.5,
      offset: Math.random() * Math.PI * 2
    };
    tvGroup.add(mesh);
  }

  window.addEventListener('resize', () => {
    tvCamera.aspect = window.innerWidth / window.innerHeight;
    tvCamera.updateProjectionMatrix();
    tvRenderer.setSize(window.innerWidth, window.innerHeight);
  });

  let t = 0;
  function anim() {
    requestAnimationFrame(anim);
    t += 0.015;
    tvGroup.children.forEach(m => {
      m.rotation.x += m.userData.rx;
      m.rotation.y += m.userData.ry;
      m.position.y += Math.sin(t * m.userData.speed + m.userData.offset) * 0.015;
    });
    tvRenderer.render(tvScene, tvCamera);
  }
  anim();
}

// ─── SOCKET.IO SYNC VỚI SERVER ─────────────────────────────
socket.on('connect', () => {
  socket.emit('register-tv');
});

socket.on('tv-init', (data) => {
  updateTvPlayers(data.players);
});

socket.on('lobby-update', (data) => {
  updateTvPlayers(data.players);
});

function updateTvPlayers(players) {
  const countEl = document.getElementById('tv-player-count');
  const listEl = document.getElementById('tv-players-list');
  if (countEl) countEl.textContent = players.length;
  if (!listEl) return;

  const avatars = ['🐰', '🐱', '🐻', '🐼', '🦊', '🦄', '🐥', '🍬', '🍓', '🍭'];
  listEl.innerHTML = players.map((p, i) => `
    <div class="tv-player-card">
      <div class="tv-p-avatar">${p.isHost ? '👑' : avatars[i % avatars.length]}</div>
      <div class="tv-p-name">${escapeHtml(p.name)}</div>
    </div>
  `).join('');
}

function tvStartGame() {
  initTvAudio();
  socket.emit('host-start');
}

function tvResetGame() {
  initTvAudio();
  socket.emit('host-reset');
}

// Đếm ngược
socket.on('game-countdown', (data) => {
  showTvScreen('tv-screen-countdown');
  document.getElementById('tv-countdown-num').textContent = data.seconds;
  TvAudio.tick();
});

// Bắt đầu vòng 10 giây
socket.on('round-start', (data) => {
  showTvScreen('tv-screen-game');
  TvAudio.fanfare();

  document.getElementById('tv-round-title').textContent = `${data.bossName.toUpperCase()} (10S)`;
  document.getElementById('tv-question-text').textContent = data.question;
  document.getElementById('tv-answered-ratio').textContent = `0/${document.getElementById('tv-player-count').textContent}`;

  const letters = ['A', 'B', 'C', 'D'];
  const grid = document.getElementById('tv-options-grid');
  grid.innerHTML = data.options.map((opt, i) => `
    <div class="tv-opt-card opt-${letters[i]}">
      <div class="tv-opt-letter">${letters[i]}</div>
      <div class="tv-opt-text">${escapeHtml(opt)}</div>
    </div>
  `).join('');

  // Chạy đồng hồ 10s trên TV
  startTvTimer(data.timeLimit || 10);
});

// Tiến độ nộp bài
socket.on('answered-progress', (data) => {
  const ratio = document.getElementById('tv-answered-ratio');
  if (ratio) ratio.textContent = `${data.answeredCount}/${data.totalPlayers}`;
  TvAudio.ding();
});

function startTvTimer(seconds) {
  const startTime = Date.now();
  const endTime = startTime + (seconds * 1000);
  const fill = document.getElementById('tv-time-fill');
  const num = document.getElementById('tv-timer-num');

  if (tvRoundTimer) clearInterval(tvRoundTimer);

  tvRoundTimer = setInterval(() => {
    const now = Date.now();
    const remain = Math.max(0, endTime - now);
    const sec = Math.ceil(remain / 1000);
    const pct = (remain / (seconds * 1000)) * 100;

    if (fill) fill.style.width = `${pct}%`;
    if (num) num.textContent = `${sec}s`;

    if (remain <= 3000 && remain > 0) {
      TvAudio.tick();
    }

    if (remain <= 0) {
      clearInterval(tvRoundTimer);
    }
  }, 100);
}

// Kết thúc vòng -> Hiện BẢNG XẾP HẠNG NGAY LẬP TỨC TRÊN TIVI
socket.on('round-end', (data) => {
  if (tvRoundTimer) clearInterval(tvRoundTimer);
  showTvScreen('tv-screen-round-end');
  TvAudio.fanfare();

  document.getElementById('tv-lb-round-num').textContent = data.roundIndex + 1;
  document.getElementById('tv-correct-ans-text').textContent = data.correctAnswer;

  // Người dẫn đầu Top 1
  if (data.topPlayer) {
    document.getElementById('tv-top1-name').textContent = data.topPlayer.name;
    document.getElementById('tv-top1-pts').textContent = `${data.topPlayer.totalPoints} Điểm (Vòng này: +${data.topPlayer.lastRoundPoints}đ)`;
  }

  // Danh sách các hạng
  const list = document.getElementById('tv-lb-container');
  const medals = ['🥇', '🥈', '🥉'];
  list.innerHTML = data.leaderboard.map((p, i) => `
    <div class="tv-lb-item ${i === 0 ? 'rank-1' : ''}">
      <div class="tv-lb-left">
        <span class="tv-lb-medal">${i < 3 ? medals[i] : `#${i + 1}`}</span>
        <span>${escapeHtml(p.name)}</span>
      </div>
      <div>
        <span class="tv-lb-pts">${p.totalPoints} Điểm</span>
        <span class="tv-lb-gain">+${p.lastRoundPoints}đ</span>
      </div>
    </div>
  `).join('');

  // Đếm lùi 7s sang vòng kế tiếp
  let nextSec = 7;
  const nextSecEl = document.getElementById('tv-next-sec');
  const nextFill = document.getElementById('tv-next-fill');
  nextFill.style.width = '100%';

  const nTimer = setInterval(() => {
    nextSec--;
    if (nextSecEl) nextSecEl.textContent = nextSec;
    if (nextFill) nextFill.style.width = `${(nextSec / 7) * 100}%`;
    if (nextSec <= 0) clearInterval(nTimer);
  }, 1000);
});

// Kết thúc chung cuộc (Grand Podium)
socket.on('game-over', (data) => {
  showTvScreen('tv-screen-game-over');
  TvAudio.fanfare();

  const showcase = document.getElementById('tv-podium-showcase');
  const top3 = data.finalRankings.slice(0, 3);
  const podiumOrder = [];

  if (top3[1]) podiumOrder.push({ ...top3[1], rank: 2, crown: '🥈', stepClass: 'step-rank-2' });
  if (top3[0]) podiumOrder.push({ ...top3[0], rank: 1, crown: '👑 🥇', stepClass: 'step-rank-1' });
  if (top3[2]) podiumOrder.push({ ...top3[2], rank: 3, crown: '🥉', stepClass: 'step-rank-3' });

  showcase.innerHTML = podiumOrder.map(p => `
    <div class="tv-podium-col">
      <div class="tv-podium-crown">${p.crown}</div>
      <div class="tv-podium-name">${escapeHtml(p.name)}</div>
      <div class="tv-podium-pts">${p.totalPoints} Điểm</div>
      <div class="tv-podium-step ${p.stepClass}">${p.rank}</div>
    </div>
  `).join('');
});

// Reset game
socket.on('game-reset', () => {
  showTvScreen('tv-screen-lobby');
});

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  initTvThree();
});
