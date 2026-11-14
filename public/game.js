/* ============================================================
   📱 TRẬN CHIẾN A13 - LOGIC ĐIỀU KHIỂN TRÊN ĐIỆN THOẠI
   Tactile Arcade Gameplay with 3D Background & Sound
   Hỗ trợ khôi phục phiên khi rớt mạng / refresh mà không mất điểm
   ============================================================ */

const socket = io({ reconnection: true });

// ─── QUẢN LÝ ĐỊNH DANH NGƯỜI CHƠI (LOCALSTORAGE) ───────────
let myPlayerId = localStorage.getItem('a13_player_id');
if (!myPlayerId) {
  myPlayerId = 'p_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  localStorage.setItem('a13_player_id', myPlayerId);
}

let myName = localStorage.getItem('a13_player_name') || '';
let myAvatar = localStorage.getItem('a13_player_avatar') || '🐰';
let currentRound = 0;
let roundStartTime = 0;
let timerInterval = null;
let totalPoints = 0;
let soundEnabled = true;
let audioCtx = null;
let hasAnsweredCurrentRound = false;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── CHỌN AVATAR ───────────────────────────────────────────
function selectAvatar(emoji, btn) {
  myAvatar = emoji;
  localStorage.setItem('a13_player_avatar', myAvatar);
  if ($('#current-chosen-avatar')) $('#current-chosen-avatar').textContent = emoji;
  $$('.avatar-choice-btn').forEach(b => b.classList.remove('selected'));
  if (btn) btn.classList.add('selected');
  initAudio();
  SoundFX.pop();
}

// ─── ÂM THANH WEB AUDIO SYNTH CHO ĐIỆN THOẠI ───────────────
function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playTone(freq, type = 'sine', duration = 0.18, gainVal = 0.2) {
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

const SoundFX = {
  pop() {
    initAudio();
    playTone(600, 'sine', 0.08, 0.15);
  },
  tap() {
    initAudio();
    playTone(520, 'triangle', 0.12, 0.2);
    if (navigator.vibrate) {
      navigator.vibrate(35);
    }
  },
  correct() {
    initAudio();
    if (!soundEnabled || !audioCtx) return;
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
      setTimeout(() => playTone(f, 'sine', 0.25, 0.2), i * 65);
    });
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
  },
  wrong() {
    initAudio();
    if (!soundEnabled || !audioCtx) return;
    playTone(240, 'sawtooth', 0.25, 0.15);
    setTimeout(() => playTone(180, 'sawtooth', 0.35, 0.15), 140);
  },
  countdown() {
    initAudio();
    playTone(440, 'triangle', 0.12, 0.18);
  },
  fanfare() {
    initAudio();
    if (!soundEnabled || !audioCtx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.3, 0.25), i * 110));
  }
};

function toggleAudio() {
  soundEnabled = !soundEnabled;
  const icon = $('#sound-icon');
  if (icon) icon.textContent = soundEnabled ? '🔊' : '🔇';
  showToast(soundEnabled ? 'Đã bật âm thanh 🎵' : 'Đã tắt âm thanh 🔇');
}

// ─── 3D THREE.JS CANVAS NỀN ───────────────────────────────
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

  const amb = new THREE.AmbientLight(0xFFFFFF, 0.85);
  scene.add(amb);

  const dir = new THREE.DirectionalLight(0xFFB3C6, 0.9);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  candyGroup = new THREE.Group();
  scene.add(candyGroup);

  const materials = [
    new THREE.MeshStandardMaterial({ color: 0xFF69B4, roughness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0xFFD166, roughness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0xB7E4C7, roughness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0xA0C4FF, roughness: 0.3 })
  ];

  for (let i = 0; i < 12; i++) {
    const geo = i % 2 === 0 ? new THREE.TorusGeometry(1.2, 0.5, 16, 32) : new THREE.OctahedronGeometry(0.9);
    const mesh = new THREE.Mesh(geo, materials[i % materials.length]);
    mesh.position.set((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 26, (Math.random() - 0.5) * 12);
    mesh.userData = {
      rx: (Math.random() - 0.5) * 0.015,
      ry: (Math.random() - 0.5) * 0.015,
      speed: 0.5 + Math.random() * 0.5,
      offset: Math.random() * Math.PI * 2
    };
    candyGroup.add(mesh);
  }

  window.addEventListener('resize', () => {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let t = 0;
  function anim() {
    requestAnimationFrame(anim);
    t += 0.015;
    candyGroup.children.forEach(m => {
      m.rotation.x += m.userData.rx;
      m.rotation.y += m.userData.ry;
      m.position.y += Math.sin(t * m.userData.speed + m.userData.offset) * 0.012;
    });
    renderer.render(scene, camera);
  }
  anim();
}

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  const target = $(`#${id}`);
  if (target) target.classList.add('active');
}

function showToast(msg, duration = 3000) {
  const toast = $('#toast');
  if (!toast) return;
  $('#toast-msg').textContent = msg;
  toast.style.display = 'flex';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.display = 'none'; }, duration);
}

// ─── ĐĂNG NHẬP VÀO PHÒNG ──────────────────────────────────
function joinRoom() {
  initAudio();
  SoundFX.pop();

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
  $('#btn-join').innerHTML = '⏳ ĐANG VÀO PHÒNG...';

  // Lưu thông tin vào localStorage để nếu lỡ F5 hoặc rớt mạng sẽ tự vào lại
  localStorage.setItem('a13_player_name', name);
  localStorage.setItem('a13_player_avatar', myAvatar);
  localStorage.setItem('a13_password', password);

  socket.emit('join-room', {
    playerId: myPlayerId,
    playerName: name,
    password: password,
    avatar: myAvatar
  });
}

function changePlayerName() {
  localStorage.removeItem('a13_player_name');
  showScreen('screen-login');
  const btn = $('#btn-join');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '🚀 VÀO PHÒNG ĐẤU A13!';
  }
}

function showError(msg) {
  const el = $('#login-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  SoundFX.wrong();
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ─── TỰ ĐỘNG KẾT NỐI LẠI KHI SOCKET RECONNECT ───────────────
socket.on('connect', () => {
  const savedName = localStorage.getItem('a13_player_name');
  const savedPass = localStorage.getItem('a13_password') || 'ABC13';
  if (savedName) {
    socket.emit('join-room', {
      playerId: myPlayerId,
      playerName: savedName,
      password: savedPass,
      avatar: myAvatar
    });
  }
});

// ─── LẮNG NGHE SỰ KIỆN TỪ SERVER ───────────────────────────
socket.on('room-joined', (data) => {
  myPlayerId = data.playerId || myPlayerId;
  myName = data.playerName;
  myAvatar = data.avatar || myAvatar;
  totalPoints = data.totalPoints || 0;

  localStorage.setItem('a13_player_id', myPlayerId);
  localStorage.setItem('a13_player_name', myName);
  localStorage.setItem('a13_player_avatar', myAvatar);

  const btn = $('#btn-join');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '🚀 VÀO PHÒNG ĐẤU A13!';
  }

  if ($('#lounge-my-avatar')) $('#lounge-my-avatar').textContent = myAvatar;
  if ($('#lounge-my-name')) $('#lounge-my-name').textContent = myName;
  if ($('#game-score')) $('#game-score').textContent = totalPoints;

  if (data.isReconnection) {
    SoundFX.correct();
    showToast(`♻️ Chào mừng trở lại, ${myName}! Giữ nguyên ${totalPoints} điểm!`, 3500);
    if (data.phase === 'WAITING') {
      showScreen('screen-lobby');
    }
  } else {
    showScreen('screen-lobby');
    SoundFX.correct();
    showToast(`Chào mừng ${myName}! Đã sẵn sàng! 👑`, 2500);
  }

  if (data.players) {
    updateLobbyPlayers(data.players);
  }
});

socket.on('lobby-update', (data) => {
  updateLobbyPlayers(data.players);
});

function updateLobbyPlayers(players) {
  const count = $('#lobby-count');
  const container = $('#lobby-players');
  if (count) count.textContent = players.length;
  if (!container) return;
  container.innerHTML = '';

  players.forEach(p => {
    const bubble = document.createElement('div');
    bubble.className = 'player-bubble';
    bubble.innerHTML = `
      <div class="player-avatar">${p.avatar || '🐰'}</div>
      <div class="player-name">${escapeHtml(p.name)}</div>
    `;
    container.appendChild(bubble);
  });
}

// Đếm ngược 5s
socket.on('game-countdown', (data) => {
  showScreen('screen-countdown');
  $('#countdown-number').textContent = data.seconds;
  SoundFX.countdown();
});

// Bắt đầu vòng đấu 10 giây
socket.on('round-start', (data) => {
  currentRound = data.roundIndex;
  hasAnsweredCurrentRound = data.alreadyAnswered || false;

  showScreen('screen-game');
  SoundFX.fanfare();

  $('#game-round').textContent = `Vòng ${currentRound + 1}/${data.totalRounds}`;
  $('#game-score').textContent = totalPoints;
  $('#phone-question-text').textContent = data.question;

  renderPhoneButtons(data.options);

  if (data.alreadyAnswered) {
    $('#answered-waiting-msg').style.display = 'block';
    $('#answer-area').style.display = 'none';
    $$('.option-candy-btn').forEach(b => {
      b.disabled = true;
      b.style.pointerEvents = 'none';
    });
  } else {
    $('#answered-waiting-msg').style.display = 'none';
    $('#answer-area').style.display = 'flex';
  }

  startTimer(data.timeLimit || 10);
});

// Render 4 nút chọn A, B, C, D to bự
function renderPhoneButtons(options) {
  const container = $('#answer-area');
  const letters = ['A', 'B', 'C', 'D'];
  const colors = ['#FF5A5F', '#00A8E8', '#FFB703', '#FF0A7B'];

  container.innerHTML = options.map((opt, i) => `
    <button type="button" class="option-candy-btn" onclick="submitChoice(this, '${escapeHtml(opt)}')">
      <span class="option-badge-letter" style="background:${colors[i]};">${letters[i]}</span>
      <span style="flex:1;">${escapeHtml(opt)}</span>
    </button>
  `).join('');
}

// Bấm nộp bài 1 chạm
function submitChoice(btn, choiceValue) {
  if (hasAnsweredCurrentRound) return;
  hasAnsweredCurrentRound = true;

  SoundFX.tap();

  // Khóa tất cả nút để tránh bấm nhiều lần
  $$('.option-candy-btn').forEach(b => {
    b.disabled = true;
    b.style.pointerEvents = 'none';
  });

  btn.classList.add('correct-choice');

  const timeMs = Date.now() - roundStartTime;
  socket.emit('submit-answer', {
    roundIndex: currentRound,
    answer: choiceValue,
    timeMs
  });

  $('#submitted-time-val').textContent = `${(timeMs / 1000).toFixed(2)}s`;
  $('#answered-waiting-msg').style.display = 'block';
}

// Đồng hồ 10s & Giảm điểm trực tiếp
function startTimer(seconds) {
  roundStartTime = Date.now();
  const endTime = roundStartTime + (seconds * 1000);

  const timerBar = $('#game-timer-bar');
  const timerText = $('#game-timer-text');
  const potentialEl = $('#live-potential-pts');

  if (timerBar) timerBar.style.width = '100%';

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    const now = Date.now();
    const remainMs = Math.max(0, endTime - now);
    const sec = Math.ceil(remainMs / 1000);
    const pct = (remainMs / (seconds * 1000)) * 100;

    if (timerBar) timerBar.style.width = `${pct}%`;
    if (timerText) timerText.textContent = `${sec}s`;

    // Điểm thưởng giảm dần từ 200đ về 100đ trong 10s
    const speedRatio = Math.max(0, remainMs / (seconds * 1000));
    const currentPotential = 100 + Math.round(100 * speedRatio);
    if (potentialEl) potentialEl.textContent = currentPotential;

    if (remainMs <= 0) {
      clearInterval(timerInterval);
      if (timerText) timerText.textContent = '0s';
      if (!hasAnsweredCurrentRound) {
        $$('.option-candy-btn').forEach(b => b.disabled = true);
      }
    }
  }, 75);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Nhận kết quả cá nhân
socket.on('answer-result', (data) => {
  stopTimer();
  totalPoints = data.totalPoints;
  if ($('#game-score')) $('#game-score').textContent = totalPoints;

  if (data.isCorrect) {
    SoundFX.correct();
    showToast(`🎯 ĐÚNG RỒI! +${data.points} Điểm (${data.timeSeconds}s)! 🌟`, 2500);
  } else if (data.timeout) {
    SoundFX.wrong();
    showToast('⏰ Hết 10 giây! Không kịp nhận điểm.', 2500);
  } else {
    SoundFX.wrong();
    showToast(`❌ Chưa đúng! Đáp án đúng: ${data.correctAnswer}`, 3500);
  }
});

// Kết thúc vòng -> Bảng điểm
socket.on('round-end', (data) => {
  stopTimer();
  showScreen('screen-round-result');
  SoundFX.fanfare();

  const myResult = data.leaderboard.find(p => p.name === myName);
  const roundPts = myResult ? myResult.lastRoundPoints : 0;

  $('#result-points').textContent = `+${roundPts}`;
  $('#result-total').textContent = myResult?.totalPoints || 0;

  if (myResult) {
    $('#my-current-rank-tag').innerHTML = `Vị trí hiện tại: <strong>#${myResult.rank}</strong> trên Bảng Vàng (${myResult.prize})`;
  }

  if (roundPts > 0) {
    $('#result-icon').textContent = '🎉';
    $('#result-title').textContent = 'XUẤT SẮC!';
    $('#result-message').textContent = `Bạn nhận được +${roundPts} điểm trong vòng này!`;
  } else {
    $('#result-icon').textContent = '💪';
    $('#result-title').textContent = 'TIẾC QUÁ!';
    $('#result-message').textContent = 'Hãy nhìn Tivi xem đáp án đúng và bứt phá vòng sau nhé!';
  }

  renderMiniLeaderboard(data.leaderboard);

  // Đếm lùi 7s
  if (data.roundIndex < data.totalRounds - 1) {
    let nextSec = 7;
    const barFill = $('#next-round-bar-fill');
    if (barFill) barFill.style.width = '100%';

    const nextTimer = setInterval(() => {
      nextSec--;
      if (barFill) barFill.style.width = `${(nextSec / 7) * 100}%`;
      if (nextSec <= 0) clearInterval(nextTimer);
    }, 1000);
  } else {
    const nextTimerEl = document.querySelector('.next-round-timer');
    if (nextTimerEl) nextTimerEl.innerHTML = '<p>🏆 Đang tính toán Bảng Vàng Chung Cuộc...</p>';
  }
});

// Kết thúc chung cuộc (Grand Podium)
socket.on('game-over', (data) => {
  setTimeout(() => {
    showScreen('screen-results');
    SoundFX.fanfare();
    renderPodium(data.finalRankings);
    renderFullRankings(data.finalRankings);
  }, 1200);
});

socket.on('game-reset', () => {
  totalPoints = 0;
  currentRound = 0;
  showScreen('screen-lobby');
  showToast('🔄 Đã làm mới trận đấu!');
});

socket.on('error-msg', (data) => {
  showScreen('screen-login');
  showError(data.message);
  const btn = $('#btn-join');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '🚀 VÀO PHÒNG ĐẤU A13!';
  }
});

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
          <span>${p.avatar || '🐰'} ${escapeHtml(p.name)}${isSelf ? ' (Bạn)' : ''}</span>
        </div>
        <div><strong>${p.totalPoints}</strong> ⭐</div>
      </div>
    `;
  }).join('');
}

function renderPodium(rankings) {
  const podium = $('#podium');
  if (!podium) return;

  const top3 = rankings.slice(0, 3);
  const displaySlots = [];
  if (top3[1]) displaySlots.push({ ...top3[1], podiumRank: 2, class: 'podium-rank-2', crown: '🥈' });
  if (top3[0]) displaySlots.push({ ...top3[0], podiumRank: 1, class: 'podium-rank-1', crown: '👑 🥇' });
  if (top3[2]) displaySlots.push({ ...top3[2], podiumRank: 3, class: 'podium-rank-3', crown: '🥉' });

  podium.innerHTML = displaySlots.map(p => `
    <div class="podium-pillar">
      <div class="podium-crown">${p.crown}</div>
      <div class="podium-player-name">${p.avatar || '🐰'} ${escapeHtml(p.name)}</div>
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
        <td>${p.avatar || '🐰'} ${escapeHtml(p.name)}${isSelf ? ' 👈' : ''}</td>
        <td><strong>${p.totalPoints}</strong> ⭐</td>
        <td><span class="prize-pill ${pillClass}">${p.prize}</span></td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  initThreeWorld();

  // Nạp avatar đã lưu
  const savedAvatar = localStorage.getItem('a13_player_avatar');
  if (savedAvatar) {
    myAvatar = savedAvatar;
    if ($('#current-chosen-avatar')) $('#current-chosen-avatar').textContent = myAvatar;
    $$('.avatar-choice-btn').forEach(b => {
      if (b.textContent.trim() === myAvatar) b.classList.add('selected');
      else b.classList.remove('selected');
    });
  }

  const savedName = localStorage.getItem('a13_player_name');
  const savedPass = localStorage.getItem('a13_password') || 'ABC13';

  if (savedName && $('#input-name')) $('#input-name').value = savedName;
  if (savedPass && $('#input-password')) $('#input-password').value = savedPass;

  // Nếu người dùng đã từng vào phòng trước đó (có ID và Tên), tự động kết nối lại liền!
  if (savedName) {
    const btn = $('#btn-join');
    if (btn) btn.innerHTML = '🔄 ĐANG KHÔI PHỤC PHIÊN CHƠI...';
    socket.emit('join-room', {
      playerId: myPlayerId,
      playerName: savedName,
      password: savedPass,
      avatar: myAvatar
    });
  } else {
    showScreen('screen-login');
  }

  $('#input-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinRoom();
  });
  $('#input-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#input-password')?.focus();
  });
});
