/* ============================================================
   🍭 CANDY KINGDOM: TÌM KIẾM DI SẢN (3D BOSS ARENA)
   Client-side game logic with Three.js & Web Audio Synth
   ============================================================ */

// ─── KẾT NỐI SOCKET.IO ─────────────────────────────────────
const socket = io({ reconnection: true, reconnectionDelay: 1000 });

// ─── TRẠNG THÁI GAME (GAME STATE) ──────────────────────────
let myName = '';
let isHost = false;
let currentRound = 0;
let currentPuzzle = null;
let currentBoss = null;
let currentBossHp = 1000;
let bossMaxHp = 1000;
let roundStartTime = 0;
let timerInterval = null;
let totalPoints = 0;
let soundEnabled = true;
let audioCtx = null;
let finalAnswers = [];

// DOM Helper
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── HỆ THỐNG ÂM THANH WEB AUDIO SYNTH (KHÔNG CẦN FILE TẢI) ─────────
function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playTone(freq, type = 'sine', duration = 0.2, gainVal = 0.15) {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

// Các hiệu ứng âm thanh kẹo ngọt & kèn đồng sôi động
const SoundFX = {
  tap() {
    initAudio();
    playTone(520, 'sine', 0.08, 0.1);
  },
  pop() {
    initAudio();
    if (!soundEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  },
  correct() {
    initAudio();
    if (!soundEnabled || !audioCtx) return;
    const now = audioCtx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      setTimeout(() => playTone(freq, 'sine', 0.25, 0.2), idx * 70);
    });
  },
  wrong() {
    initAudio();
    if (!soundEnabled || !audioCtx) return;
    playTone(240, 'sawtooth', 0.25, 0.15);
    setTimeout(() => playTone(180, 'sawtooth', 0.35, 0.15), 150);
  },
  bossHit() {
    initAudio();
    if (!soundEnabled || !audioCtx) return;
    playTone(120, 'square', 0.2, 0.25);
    setTimeout(() => playTone(880, 'triangle', 0.18, 0.15), 50);
  },
  countdown() {
    initAudio();
    playTone(440, 'triangle', 0.12, 0.2);
  },
  fanfare() {
    initAudio();
    if (!soundEnabled || !audioCtx) return;
    // Upbeat brass fanfare
    const notes = [523.25, 523.25, 523.25, 659.25, 783.99, 1046.50];
    const delays = [0, 100, 200, 300, 420, 600];
    notes.forEach((f, i) => {
      setTimeout(() => playTone(f, 'triangle', 0.3, 0.25), delays[i]);
    });
  }
};

function toggleAudio() {
  soundEnabled = !soundEnabled;
  $('#sound-icon').textContent = soundEnabled ? '🔊' : '🔇';
  showToast(soundEnabled ? 'Đã bật âm thanh 🎵' : 'Đã tắt âm thanh 🔇');
}

// ─── 3D CANDY WORLD VỚI THREE.JS ───────────────────────────
let scene, camera, renderer, candyGroup;

function initThreeWorld() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xFFD6E0, 0.035);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 18;

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Ánh sáng kẹo ngọt lung linh
  const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.85);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xFFB3C6, 0.9);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  const pinkPointLight = new THREE.PointLight(0xFF0A7B, 1.2, 50);
  pinkPointLight.position.set(-8, 5, 10);
  scene.add(pinkPointLight);

  candyGroup = new THREE.Group();
  scene.add(candyGroup);

  // Tạo các vật thể kẹo 3D lơ lửng
  const candyMaterials = [
    new THREE.MeshStandardMaterial({ color: 0xFF69B4, roughness: 0.2, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: 0xFFB3C6, roughness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0xFFD166, roughness: 0.2, metalness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0xB7E4C7, roughness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0xA0C4FF, roughness: 0.3 })
  ];

  // 1. Bánh Donut 3D
  for (let i = 0; i < 6; i++) {
    const donutGeo = new THREE.TorusGeometry(1.2, 0.5, 16, 32);
    const mat = candyMaterials[i % candyMaterials.length];
    const donut = new THREE.Mesh(donutGeo, mat);
    donut.position.set((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 26, (Math.random() - 0.5) * 12);
    donut.rotation.x = Math.random() * Math.PI;
    donut.rotation.y = Math.random() * Math.PI;
    donut.userData = {
      rotX: (Math.random() - 0.5) * 0.015,
      rotY: (Math.random() - 0.5) * 0.015,
      floatSpeed: 0.5 + Math.random() * 0.5,
      floatOffset: Math.random() * Math.PI * 2
    };
    candyGroup.add(donut);
  }

  // 2. Kẹo Kim Cương / Tinh Thể Đường 3D
  for (let i = 0; i < 8; i++) {
    const starGeo = new THREE.OctahedronGeometry(0.8 + Math.random() * 0.5);
    const star = new THREE.Mesh(starGeo, candyMaterials[i % candyMaterials.length]);
    star.position.set((Math.random() - 0.5) * 28, (Math.random() - 0.5) * 28, (Math.random() - 0.5) * 15);
    star.userData = {
      rotX: (Math.random() - 0.5) * 0.02,
      rotY: (Math.random() - 0.5) * 0.02,
      floatSpeed: 0.8 + Math.random() * 0.5,
      floatOffset: Math.random() * Math.PI * 2
    };
    candyGroup.add(star);
  }

  // 3. Kẹo Tròn Bonbon
  for (let i = 0; i < 10; i++) {
    const sphereGeo = new THREE.SphereGeometry(0.7, 24, 24);
    const bonbon = new THREE.Mesh(sphereGeo, candyMaterials[i % candyMaterials.length]);
    bonbon.position.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 14);
    bonbon.userData = {
      rotX: 0.01,
      rotY: 0.01,
      floatSpeed: 0.6 + Math.random() * 0.4,
      floatOffset: Math.random() * Math.PI * 2
    };
    candyGroup.add(bonbon);
  }

  window.addEventListener('resize', onWindowResize);
  animateThree();
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

let clock = { time: 0 };
function animateThree() {
  requestAnimationFrame(animateThree);
  clock.time += 0.015;

  if (candyGroup) {
    candyGroup.children.forEach(obj => {
      obj.rotation.x += obj.userData.rotX;
      obj.rotation.y += obj.userData.rotY;
      obj.position.y += Math.sin(clock.time * obj.userData.floatSpeed + obj.userData.floatOffset) * 0.012;
    });
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// ─── TIỆN ÍCH HIỂN THỊ MÀN HÌNH & THÔNG BÁO ────────────────
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  const target = $(`#${id}`);
  if (target) target.classList.add('active');
}

function showToast(msg, duration = 3000) {
  const toast = $('#toast');
  $('#toast-msg').textContent = msg;
  toast.style.display = 'flex';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.display = 'none'; }, duration);
}

function showDamageText(text, x, y) {
  const container = $('#damage-container');
  if (!container) return;
  const dmg = document.createElement('div');
  dmg.className = 'floating-dmg';
  dmg.textContent = text;
  dmg.style.left = `${x || window.innerWidth / 2 - 40}px`;
  dmg.style.top = `${y || 180}px`;
  container.appendChild(dmg);
  setTimeout(() => dmg.remove(), 1200);
}

// ─── TẠO HẠT KẸO BAY LƠ LỬNG ──────────────────────────────
function initParticles() {
  const container = $('#particles-bg');
  const emojis = ['🍬', '🍭', '🍩', '🧁', '🍪', '💖', '✨', '🍓', '🎀', '🌸', '🍰'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'floating-particle';
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    p.style.left = `${Math.random() * 95}%`;
    p.style.fontSize = `${1.2 + Math.random() * 1.4}rem`;
    p.style.animationDuration = `${10 + Math.random() * 15}s`;
    p.style.animationDelay = `${Math.random() * 10}s`;
    container.appendChild(p);
  }
}

// ─── ĐĂNG NHẬP VÀO PHÒNG ──────────────────────────────────
function joinRoom() {
  initAudio();
  SoundFX.tap();

  const name = $('#input-name').value.trim();
  const password = $('#input-password').value.trim();

  if (!name) {
    showError('Vui lòng nhập tên của bạn nhé!');
    return;
  }
  if (!password) {
    showError('Vui lòng nhập mật khẩu ABC13!');
    return;
  }

  $('#btn-join').disabled = true;
  $('#btn-join').innerHTML = '⏳ ĐANG VÀO ĐẤU TRƯỜNG...';

  socket.emit('join-room', { playerName: name, password });
}

function showError(msg) {
  const el = $('#login-error');
  el.textContent = msg;
  el.style.display = 'block';
  SoundFX.wrong();
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ─── SOCKET.IO LẮNG NGHE SỰ KIỆN ───────────────────────────

// Đã tham gia phòng
socket.on('room-joined', (data) => {
  myName = data.playerName;
  isHost = data.isHost;

  showScreen('screen-lobby');
  updateLobbyPlayers(data.players);

  if (isHost) {
    $('#host-controls').style.display = 'block';
    $('#player-waiting').style.display = 'none';
  } else {
    $('#host-controls').style.display = 'none';
    $('#player-waiting').style.display = 'block';
  }

  SoundFX.correct();
  showToast(`Chào mừng ${myName} vào Vương Quốc Kẹo! 👑`);
});

// Người chơi khác tham gia
socket.on('player-joined', (data) => {
  updateLobbyPlayers(data.players);
  SoundFX.pop();
  showToast(`🎉 ${data.playerName} đã tham gia (${data.playerCount} người)`);
});

// Người chơi rời đi
socket.on('player-left', (data) => {
  updateLobbyPlayers(data.players);
  showToast(`👋 ${data.playerName} đã rời phòng`);
});

// Trở thành Host
socket.on('you-are-host', () => {
  isHost = true;
  $('#host-controls').style.display = 'block';
  $('#player-waiting').style.display = 'none';
  SoundFX.fanfare();
  showToast('👑 Bạn đã trở thành Chủ Phòng!');
});

// Đếm ngược vào trận
socket.on('game-countdown', (data) => {
  showScreen('screen-countdown');
  $('#countdown-number').textContent = data.seconds;
  SoundFX.countdown();
});

// Bắt đầu vòng đấu
socket.on('round-start', (data) => {
  currentRound = data.roundIndex;
  currentPuzzle = data.puzzle;
  currentBoss = data.boss;
  bossMaxHp = data.boss.maxHp || 1000;
  currentBossHp = bossMaxHp;

  showScreen('screen-game');
  SoundFX.fanfare();

  // Cập nhật thanh tiêu đề
  $('#game-round').textContent = `Vòng ${currentRound + 1}/5`;
  $('#game-score').textContent = totalPoints;

  // Cập nhật Boss
  $('#boss-emoji').textContent = data.boss.emoji || '🍭';
  $('#game-boss-name').textContent = data.boss.name;
  $('#game-boss-subtitle').textContent = data.boss.subtitle;
  $('#boss-speech-text').textContent = data.boss.dialogue || 'Chuẩn bị nếm thử sức mạnh của ta!';
  
  // Reset máu boss
  updateBossHpBar(bossMaxHp, bossMaxHp);

  // Reset Gợi ý
  $('#hint-display').style.display = 'none';
  $('#hints-remaining').textContent = '1';
  $('#btn-hint').disabled = false;

  // Render câu đố siêu dễ
  renderPuzzle(data.puzzle);

  // Bắt đầu đồng hồ đếm ngược
  startTimer(data.timeLimit);
});

// Boss bị trúng đòn (từ bất kỳ ai trong phòng)
socket.on('boss-hit', (data) => {
  const bossAvatar = $('#boss-emoji');
  const sparkle = $('#boss-sparkle');

  if (bossAvatar) {
    bossAvatar.classList.add('hurt');
    setTimeout(() => bossAvatar.classList.remove('hurt'), 500);
  }
  if (sparkle) {
    sparkle.classList.add('active');
    setTimeout(() => sparkle.classList.remove('active'), 500);
  }

  // Âm thanh đòn đánh
  SoundFX.bossHit();

  // Giảm thanh máu boss
  currentBossHp = Math.max(0, currentBossHp - Math.floor(data.damage * 0.8));
  updateBossHpBar(currentBossHp, bossMaxHp);

  // Số sát thương bay
  showDamageText(`-${data.damage} HP! 💥`, window.innerWidth / 2 - 30, 200);

  if (data.comboStreak > 1 && data.playerName === myName) {
    const comboPill = $('#game-combo');
    comboPill.style.display = 'inline-block';
    comboPill.textContent = `🔥 COMBO x${data.comboStreak}`;
  }
});

// Kết quả câu trả lời của bản thân
socket.on('answer-result', (data) => {
  stopTimer();

  if (data.correct) {
    totalPoints = data.totalPoints;
    $('#game-score').textContent = totalPoints;
    SoundFX.correct();
    showToast(`🎯 CHÍNH XÁC! +${data.points} Điểm! 🌟`, 2500);
  } else if (data.timeout) {
    SoundFX.wrong();
    showToast('⏰ Hết giờ! Cố gắng ở vòng sau nhé!', 2500);
  } else {
    totalPoints = data.totalPoints;
    SoundFX.wrong();
    let msg = `❌ Chưa đúng! (+${data.points}đ)`;
    if (data.correctAnswer) {
      msg += ` Đáp án đúng: ${Array.isArray(data.correctAnswer) ? data.correctAnswer.join(', ') : data.correctAnswer}`;
    }
    showToast(msg, 3500);
  }

  $('#btn-hint').disabled = true;
});

// Kết thúc vòng đấu
socket.on('round-end', (data) => {
  showScreen('screen-round-result');
  SoundFX.fanfare();

  const myResult = data.leaderboard.find(p => p.name === myName);
  const roundPoints = myResult?.roundScores?.[data.roundIndex] || 0;

  $('#result-points').textContent = `+${roundPoints}`;
  $('#result-total').textContent = myResult?.totalPoints || 0;

  if (roundPoints > 0) {
    $('#result-icon').textContent = '🎉';
    $('#result-title').textContent = 'XUẤT SẮC!';
    $('#result-message').textContent = `Bạn đã vượt qua Thử Thách Vòng ${data.roundIndex + 1}!`;
  } else {
    $('#result-icon').textContent = '💪';
    $('#result-title').textContent = 'CỐ LÊN NHÉ!';
    $('#result-message').textContent = `Vòng ${data.roundIndex + 1} đã khép lại. Vòng sau sẽ bùng nổ hơn!`;
  }

  renderMiniLeaderboard(data.leaderboard);

  // Đếm ngược vòng kế tiếp
  if (data.roundIndex < 4) {
    let nextSec = 7;
    $('#next-round-countdown').textContent = nextSec;
    const barFill = $('#next-round-bar-fill');
    barFill.style.width = '100%';

    const nextTimer = setInterval(() => {
      nextSec--;
      $('#next-round-countdown').textContent = nextSec;
      barFill.style.width = `${(nextSec / 7) * 100}%`;
      if (nextSec <= 0) clearInterval(nextTimer);
    }, 1000);
  } else {
    document.querySelector('.next-round-timer').innerHTML = '<p>🏆 Đang tính toán bảng xếp hạng Chung Cuộc...</p>';
  }
});

// Kết thúc trò chơi (Game Over)
socket.on('game-over', (data) => {
  setTimeout(() => {
    showScreen('screen-results');
    SoundFX.fanfare();
    renderPodium(data.finalRankings);
    renderFullRankings(data.finalRankings);

    if (isHost) {
      $('#final-host-controls').style.display = 'block';
    }
  }, 1500);
});

// Nhận gợi ý
socket.on('hint-result', (data) => {
  SoundFX.pop();
  $('#hint-display').style.display = 'block';
  $('#hint-text').textContent = `💡 Gợi ý: ${data.hint}`;
  $('#hints-remaining').textContent = '0';
  $('#btn-hint').disabled = true;
});

// Lỗi
socket.on('error-msg', (data) => {
  if (document.querySelector('.screen.active')?.id === 'screen-login') {
    showError(data.message);
    $('#btn-join').disabled = false;
    $('#btn-join').innerHTML = '<span class="btn-icon">🚀</span> VÀO ĐẤU TRƯỜNG NGAY!';
  } else {
    showToast(data.message);
  }
});

// Reset game
socket.on('game-reset', () => {
  totalPoints = 0;
  currentRound = 0;
  showScreen('screen-lobby');
  showToast('🔄 Đã làm mới trận đấu! Sẵn sàng chơi ván mới!');
});

// ─── THAO TÁC SẢNH CHỜ (LOBBY) ────────────────────────────
function updateLobbyPlayers(players) {
  const container = $('#lobby-players');
  const count = $('#lobby-count');
  count.textContent = players.length;
  container.innerHTML = '';

  const cuteAvatars = ['🐰', '🐱', '🐻', '🐼', '🦊', '🦄', '🐥', '🍬', '🍓'];
  players.forEach((p, idx) => {
    const bubble = document.createElement('div');
    bubble.className = `player-bubble ${p.isHost ? 'host' : ''}`;
    const avatar = p.isHost ? '👑' : cuteAvatars[idx % cuteAvatars.length];
    bubble.innerHTML = `
      <div class="player-avatar">${avatar}</div>
      <div class="player-name">${escapeHtml(p.name)}</div>
    `;
    container.appendChild(bubble);
  });
}

function hostStart() {
  initAudio();
  SoundFX.tap();
  socket.emit('host-start');
  $('#btn-start').disabled = true;
  $('#btn-start').innerHTML = '⏳ ĐANG KHỞI TRANH...';
}

function hostReset() {
  initAudio();
  SoundFX.tap();
  socket.emit('host-reset');
}

// ─── RENDER CÂU ĐỐ SIÊU DỄ & VUI NHỘN ───────────────────────
function renderPuzzle(puzzle) {
  const puzzleArea = $('#game-puzzle');
  const answerArea = $('#answer-area');

  if (puzzle.type === 'final_boss') {
    // Vòng 5: Combo 3 đòn liên hoàn
    puzzleArea.innerHTML = `
      <h3 style="color:var(--pink-hot); margin-bottom:6px;">⚡ ĐẠI CHIẾN BOSS CUỐI ⚡</h3>
      <p class="puzzle-question-text">Chọn nhanh cả 3 đáp án để bắn đại bác kẹo tiêu diệt Nữ Hoàng!</p>
    `;

    finalAnswers = new Array(puzzle.steps.length).fill(null);
    let stepsHtml = '';

    puzzle.steps.forEach((st, sIdx) => {
      let optBtns = st.options.map(opt => `
        <button type="button" class="final-mini-btn" onclick="selectFinalOption(${sIdx}, this, '${escapeHtml(opt)}')">
          ${escapeHtml(opt)}
        </button>
      `).join('');

      stepsHtml += `
        <div class="final-step-block">
          <div class="final-step-title">${escapeHtml(st.question)}</div>
          <div class="final-step-options">${optBtns}</div>
        </div>
      `;
    });

    answerArea.innerHTML = `
      ${stepsHtml}
      <button id="btn-fire-combo" class="candy-btn candy-btn-primary" onclick="submitFinalCombo()" style="margin-top:8px;">
        💥 TUNG ĐÒN CHÍ MẠNG!
      </button>
    `;

  } else {
    // Vòng 1 đến 4: Trắc nghiệm 1 chạm siêu nhanh & dễ hiểu
    puzzleArea.innerHTML = `
      <p class="puzzle-question-text">${escapeHtml(puzzle.question)}</p>
    `;

    const letters = ['A', 'B', 'C', 'D'];
    let btnsHtml = puzzle.options.map((opt, idx) => `
      <button type="button" class="option-candy-btn" onclick="chooseAnswer(this, '${escapeHtml(opt)}')">
        <span class="option-badge-letter">${letters[idx]}</span>
        <span>${escapeHtml(opt)}</span>
      </button>
    `).join('');

    answerArea.innerHTML = btnsHtml;
  }
}

// 1 chạm chọn đáp án (Vòng 1 - 4)
function chooseAnswer(btn, value) {
  initAudio();
  SoundFX.pop();

  // Khóa tất cả nút để tránh bấm nhiều lần
  $$('.option-candy-btn').forEach(b => {
    b.disabled = true;
    b.style.pointerEvents = 'none';
  });

  btn.classList.add('correct-choice');

  const timeMs = Date.now() - roundStartTime;
  socket.emit('submit-answer', {
    roundIndex: currentRound,
    answer: value,
    timeMs
  });
}

// Chọn đáp án trong vòng 5
function selectFinalOption(stepIndex, btn, value) {
  initAudio();
  SoundFX.tap();

  const parent = btn.parentElement;
  parent.querySelectorAll('.final-mini-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  finalAnswers[stepIndex] = value;
}

function submitFinalCombo() {
  initAudio();
  SoundFX.bossHit();

  if (finalAnswers.some(ans => !ans)) {
    showToast('⚠️ Bạn hãy chọn đủ cả 3 đòn tấn công nhé!');
    return;
  }

  $('#btn-fire-combo').disabled = true;
  $('#btn-fire-combo').innerHTML = '⏳ ĐANG PHÓNG ĐẠI BÁC...';

  const timeMs = Date.now() - roundStartTime;
  socket.emit('submit-answer', {
    roundIndex: currentRound,
    answer: finalAnswers,
    timeMs
  });
}

function requestHint() {
  initAudio();
  SoundFX.tap();
  socket.emit('request-hint', { roundIndex: currentRound });
}

// ─── THANH MÁU BOSS & ĐỒNG HỒ ĐẾM NGƯỢC ────────────────────
function updateBossHpBar(current, max) {
  const fill = $('#boss-hp-fill');
  const text = $('#boss-hp-text');
  if (fill && text) {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    fill.style.width = `${pct}%`;
    text.textContent = `${current}/${max} HP`;
  }
}

function startTimer(seconds) {
  roundStartTime = Date.now();
  const endTime = roundStartTime + (seconds * 1000);

  const timerBar = $('#game-timer-bar');
  const timerText = $('#game-timer-text');

  timerBar.style.width = '100%';

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    const now = Date.now();
    const remaining = Math.max(0, endTime - now);
    const sec = Math.ceil(remaining / 1000);
    const pct = (remaining / (seconds * 1000)) * 100;

    timerBar.style.width = `${pct}%`;
    timerText.textContent = `${sec}s`;

    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerText.textContent = '0s';
    }
  }, 100);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ─── RENDER BẢNG XẾP HẠNG ──────────────────────────────────
function renderMiniLeaderboard(rankings) {
  const container = $('#leaderboard-round');
  if (!container) return;

  const medals = ['🥇', '🥈', '🥉'];
  container.innerHTML = rankings.slice(0, 6).map((p, idx) => {
    const medal = idx < 3 ? medals[idx] : `#${idx + 1}`;
    const isSelf = p.name === myName;
    return `
      <div class="lb-row ${isSelf ? 'self' : ''}">
        <div class="lb-left">
          <span class="lb-medal">${medal}</span>
          <span>${escapeHtml(p.name)}${isSelf ? ' (Bạn)' : ''}</span>
        </div>
        <div><strong>${p.totalPoints}</strong> ⭐</div>
      </div>
    `;
  }).join('');
}

// ─── RENDER BỤC VINH QUANG CHUNG CUỘC ──────────────────────
function renderPodium(rankings) {
  const podium = $('#podium');
  if (!podium) return;

  const top3 = rankings.slice(0, 3);
  // Thứ tự hiển thị: Hạng 2 (trái) - Hạng 1 (giữa, cao nhất) - Hạng 3 (phải)
  const displaySlots = [];
  if (top3[1]) displaySlots.push({ ...top3[1], podiumRank: 2, class: 'podium-rank-2', crown: '🥈' });
  if (top3[0]) displaySlots.push({ ...top3[0], podiumRank: 1, class: 'podium-rank-1', crown: '👑🥇' });
  if (top3[2]) displaySlots.push({ ...top3[2], podiumRank: 3, class: 'podium-rank-3', crown: '🥉' });

  podium.innerHTML = displaySlots.map(p => `
    <div class="podium-pillar">
      <div class="podium-crown">${p.crown}</div>
      <div class="podium-player-name">${escapeHtml(p.name)}</div>
      <div class="podium-player-score">${p.totalPoints}⭐</div>
      <div class="podium-block ${p.class}">${p.podiumRank}</div>
    </div>
  `).join('');
}

function renderFullRankings(rankings) {
  const tbody = $('#results-table');
  if (!tbody) return;

  tbody.innerHTML = rankings.map(p => {
    const isSelf = p.name === myName;
    let pillClass = 'prize-other';
    if (p.rank === 1) pillClass = 'prize-gold';
    else if (p.rank <= 3) pillClass = 'prize-silver';
    else if (p.rank <= 6) pillClass = 'prize-bronze';

    return `
      <tr class="${isSelf ? 'my-rank' : ''}">
        <td><strong>#${p.rank}</strong></td>
        <td>${escapeHtml(p.name)}${isSelf ? ' 👈' : ''}</td>
        <td><strong>${p.totalPoints}</strong> ⭐</td>
        <td><span class="prize-pill ${pillClass}">${p.prize}</span></td>
      </tr>
    `;
  }).join('');
}

// ─── TIỆN ÍCH CHỐNG XSS ────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ─── KHỞI TẠO GAME KHI TẢI TRANG ───────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initThreeWorld();
  initParticles();
  showScreen('screen-login');

  // Cho phép bấm Enter ở ô nhập
  $('#input-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinRoom();
  });
  $('#input-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#input-password')?.focus();
  });
});
