/* ============================================================
   🍭 CANDY KINGDOM: TÌM KIẾM DI SẢN
   Client-side game logic
   ============================================================ */

// ─── SOCKET CONNECTION ─────────────────────────────────────
const socket = io({ reconnection: true, reconnectionDelay: 1000 });

// ─── GAME STATE ────────────────────────────────────────────
let myName = '';
let isHost = false;
let currentRound = 0;
let currentPuzzle = null;
let roundStartTime = 0;
let timerInterval = null;
let timeLimit = 60;
let selectedOption = null;
let totalPoints = 0;

// ─── DOM HELPERS ───────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  const screen = $(`#${id}`);
  if (screen) screen.classList.add('active');
}

function showToast(msg, duration = 3000) {
  const toast = $('#toast');
  $('#toast-msg').textContent = msg;
  toast.style.display = 'block';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.display = 'none'; }, duration);
}

// ─── PARTICLES ─────────────────────────────────────────────
function initParticles() {
  const container = $('#particles-bg');
  const candies = ['🍬', '🍭', '🍫', '🍩', '🧁', '🍪', '🎀', '⭐', '🌸', '💖', '🦋', '🎈', '✨', '🍰', '🎂'];
  
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.textContent = candies[Math.floor(Math.random() * candies.length)];
    p.style.left = `${Math.random() * 100}%`;
    p.style.fontSize = `${1 + Math.random() * 1.5}rem`;
    p.style.animationDuration = `${12 + Math.random() * 18}s`;
    p.style.animationDelay = `${Math.random() * 15}s`;
    container.appendChild(p);
  }
}

// ─── LOGIN ─────────────────────────────────────────────────
function joinRoom() {
  const name = $('#input-name').value.trim();
  const password = $('#input-password').value.trim();
  
  if (!name) {
    showError('Vui lòng nhập tên của bạn!');
    return;
  }
  if (!password) {
    showError('Vui lòng nhập mật khẩu phòng!');
    return;
  }
  
  $('#btn-join').disabled = true;
  $('#btn-join').textContent = '⏳ Đang kết nối...';
  
  socket.emit('join-room', { playerName: name, password });
}

function showError(msg) {
  const el = $('#login-error');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// Handle enter key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen?.id === 'screen-login') {
      joinRoom();
    } else if (activeScreen?.id === 'screen-game') {
      submitAnswer();
    }
  }
});

// ─── SOCKET EVENTS ─────────────────────────────────────────

// Room joined successfully
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
  
  showToast(`Chào mừng ${myName} đến Vương Quốc Kẹo! 🍭`);
});

// Player joined
socket.on('player-joined', (data) => {
  updateLobbyPlayers(data.players);
  showToast(`${data.playerName} đã tham gia! (${data.playerCount} người)`);
});

// Player left
socket.on('player-left', (data) => {
  updateLobbyPlayers(data.players);
  showToast(`${data.playerName} đã rời phòng`);
});

// You are now host
socket.on('you-are-host', () => {
  isHost = true;
  $('#host-controls').style.display = 'block';
  $('#player-waiting').style.display = 'none';
  showToast('Bạn là chủ phòng mới! 👑');
});

// Game countdown
socket.on('game-countdown', (data) => {
  showScreen('screen-countdown');
  $('#countdown-number').textContent = data.seconds;
});

// Round start
socket.on('round-start', (data) => {
  currentRound = data.roundIndex;
  currentPuzzle = data.puzzle;
  timeLimit = data.timeLimit;
  selectedOption = null;
  
  showScreen('screen-game');
  
  // Update header
  $('#game-round').textContent = `Vòng ${currentRound + 1}/5`;
  $('#game-score').textContent = totalPoints;
  
  // Update boss banner
  const bossEmojis = ['🍭', '🐉', '🏰', '👾', '👑'];
  $('#boss-emoji').textContent = bossEmojis[currentRound] || '🍭';
  $('#game-boss-name').textContent = data.boss.name;
  $('#game-boss-subtitle').textContent = data.boss.subtitle;
  
  // Render puzzle
  renderPuzzle(data.puzzle);
  
  // Reset hint
  $('#hint-display').style.display = 'none';
  $('#hints-remaining').textContent = '2';
  $('#btn-hint').disabled = false;
  $('#btn-submit').disabled = false;
  
  // Start timer
  startTimer(data.timeLimit);
});

// Answer result
socket.on('answer-result', (data) => {
  stopTimer();
  
  if (data.correct) {
    totalPoints = data.totalPoints;
    $('#game-score').textContent = totalPoints;
    document.querySelector('.game-container').classList.add('correct-flash');
    showToast(`✅ Chính xác! +${data.points} điểm!`, 2000);
  } else if (data.timeout) {
    showToast('⏰ Hết giờ! Không nhận được điểm.', 2000);
  } else {
    totalPoints = data.totalPoints;
    document.querySelector('.game-container').classList.add('wrong-flash');
    let msg = `❌ Sai rồi! +${data.points} điểm.`;
    if (data.correctAnswer) {
      if (Array.isArray(data.correctAnswer)) {
        msg += ` Đáp án: ${data.correctAnswer.join(', ')}`;
      } else {
        msg += ` Đáp án: ${data.correctAnswer}`;
      }
    }
    showToast(msg, 4000);
  }
  
  $('#btn-submit').disabled = true;
  $('#btn-hint').disabled = true;
  
  setTimeout(() => {
    document.querySelector('.game-container').classList.remove('correct-flash', 'wrong-flash');
  }, 600);
});

// Round end
socket.on('round-end', (data) => {
  showScreen('screen-round-result');
  
  const myResult = data.leaderboard.find(p => p.name === myName);
  const roundPoints = myResult?.roundScores?.[data.roundIndex] || 0;
  
  if (roundPoints > 0) {
    $('#result-icon').textContent = '✅';
    $('#result-title').textContent = 'Tuyệt vời!';
    $('#result-message').textContent = `Bạn đã hoàn thành vòng ${data.roundIndex + 1}`;
  } else {
    $('#result-icon').textContent = '💪';
    $('#result-title').textContent = 'Cố gắng hơn!';
    $('#result-message').textContent = `Vòng ${data.roundIndex + 1} đã kết thúc`;
  }
  
  $('#result-points').textContent = `+${roundPoints}`;
  $('#result-total').textContent = myResult?.totalPoints || 0;
  
  // Render mini leaderboard
  renderLeaderboard(data.leaderboard, '#leaderboard-round');
  
  // Next round countdown
  if (data.roundIndex < 4) {
    let nextCountdown = 8;
    $('#next-round-countdown').textContent = nextCountdown;
    const nextBar = $('#next-round-bar-fill');
    nextBar.style.width = '100%';
    
    const nextInterval = setInterval(() => {
      nextCountdown--;
      $('#next-round-countdown').textContent = nextCountdown;
      nextBar.style.width = `${(nextCountdown / 8) * 100}%`;
      if (nextCountdown <= 0) clearInterval(nextInterval);
    }, 1000);
  } else {
    document.querySelector('.next-round-timer').innerHTML = '<p>Đang tính kết quả chung cuộc...</p>';
  }
});

// Game over
socket.on('game-over', (data) => {
  setTimeout(() => {
    showScreen('screen-results');
    renderFinalResults(data.finalRankings);
    createConfetti();
    
    if (isHost) {
      $('#final-host-controls').style.display = 'block';
    }
  }, 2000);
});

// Hint result
socket.on('hint-result', (data) => {
  const hintDisplay = $('#hint-display');
  hintDisplay.style.display = 'block';
  $('#hint-text').textContent = `💡 ${data.hint} (−${data.pointsPenalty} điểm)`;
  $('#hints-remaining').textContent = data.hintsRemaining;
  
  if (data.hintsRemaining <= 0) {
    $('#btn-hint').disabled = true;
  }
});

// Error message
socket.on('error-msg', (data) => {
  if (document.querySelector('.screen.active')?.id === 'screen-login') {
    showError(data.message);
    $('#btn-join').disabled = false;
    $('#btn-join').textContent = '🚀 Vào Vương Quốc Kẹo!';
  } else {
    showToast(data.message);
  }
});

// Game reset
socket.on('game-reset', () => {
  totalPoints = 0;
  currentRound = 0;
  showScreen('screen-lobby');
  showToast('🔄 Trò chơi đã được reset!');
});

// Connection events
socket.on('connect', () => {
  console.log('🔌 Connected to server');
});

socket.on('disconnect', () => {
  showToast('⚠️ Mất kết nối! Đang thử kết nối lại...');
});

socket.on('reconnect', () => {
  showToast('✅ Đã kết nối lại!');
});

// ─── LOBBY FUNCTIONS ───────────────────────────────────────

function updateLobbyPlayers(players) {
  const container = $('#lobby-players');
  const count = $('#lobby-count');
  
  count.textContent = players.length;
  container.innerHTML = '';
  
  players.forEach(p => {
    const tag = document.createElement('div');
    tag.className = `player-tag ${p.isHost ? 'host' : ''}`;
    tag.innerHTML = `
      <span>${p.isHost ? '👑' : '🍬'}</span>
      <span>${escapeHtml(p.name)}</span>
    `;
    container.appendChild(tag);
  });
}

function hostStart() {
  socket.emit('host-start');
  $('#btn-start').disabled = true;
  $('#btn-start').textContent = '⏳ Đang bắt đầu...';
}

function hostReset() {
  socket.emit('host-reset');
}

// ─── PUZZLE RENDERING ──────────────────────────────────────

function renderPuzzle(puzzle) {
  const puzzleArea = $('#game-puzzle');
  const answerArea = $('#answer-area');
  
  switch (puzzle.type) {
    case 'caesar':
      renderCaesarPuzzle(puzzle, puzzleArea, answerArea);
      break;
    case 'pattern':
      renderPatternPuzzle(puzzle, puzzleArea, answerArea);
      break;
    case 'logic':
      renderLogicPuzzle(puzzle, puzzleArea, answerArea);
      break;
    case 'riddle':
      renderRiddlePuzzle(puzzle, puzzleArea, answerArea);
      break;
    case 'final':
      renderFinalPuzzle(puzzle, puzzleArea, answerArea);
      break;
  }
}

function renderCaesarPuzzle(puzzle, area, answerArea) {
  area.innerHTML = `
    <div class="puzzle-label">🔐 Giải Mã Bí Ẩn</div>
    <p class="puzzle-content">Dưới đây là một câu tiếng Việt đã bị mã hóa. Mỗi chữ cái đã bị dịch chuyển đi một số vị trí trong bảng chữ cái (A-Z). Hãy tìm ra câu gốc!</p>
    <div class="puzzle-encrypted">${escapeHtml(puzzle.encrypted)}</div>
    <p class="puzzle-content" style="font-size:0.85rem; color:var(--text-light);">💡 Chỉ cần giải mã các chữ cái A-Z, giữ nguyên dấu và ký tự đặc biệt.</p>
  `;
  
  answerArea.innerHTML = `
    <input type="text" class="candy-input" id="answer-input" placeholder="Nhập câu đã giải mã..." autocomplete="off" autocapitalize="off">
  `;
}

function renderPatternPuzzle(puzzle, area, answerArea) {
  let seqHtml = '';
  puzzle.sequence.forEach((num, i) => {
    if (i > 0) seqHtml += '<span class="seq-arrow">→</span>';
    seqHtml += `<div class="seq-num">${num}</div>`;
  });
  seqHtml += '<span class="seq-arrow">→</span><div class="seq-question">?</div>';
  
  area.innerHTML = `
    <div class="puzzle-label">🔢 Tìm Quy Luật</div>
    <p class="puzzle-content">Tìm số tiếp theo trong dãy số dưới đây:</p>
    <div class="puzzle-sequence">${seqHtml}</div>
  `;
  
  answerArea.innerHTML = `
    <input type="text" class="candy-input" id="answer-input" placeholder="Nhập số tiếp theo..." inputmode="numeric" autocomplete="off">
  `;
}

function renderLogicPuzzle(puzzle, area, answerArea) {
  const letters = ['A', 'B', 'C', 'D'];
  let optionsHtml = puzzle.options.map((opt, i) => `
    <button class="option-btn" onclick="selectOption(this, '${escapeHtml(opt)}')" data-value="${escapeHtml(opt)}">
      <span class="option-letter">${letters[i]}</span>
      <span>${escapeHtml(opt)}</span>
    </button>
  `).join('');
  
  area.innerHTML = `
    <div class="puzzle-label">🧩 Thử Thách Logic</div>
    <p class="puzzle-content">${escapeHtml(puzzle.question)}</p>
  `;
  
  answerArea.innerHTML = `
    <div class="puzzle-options">${optionsHtml}</div>
  `;
}

function renderRiddlePuzzle(puzzle, area, answerArea) {
  // Word mask
  let maskHtml = '';
  for (const ch of puzzle.mask) {
    if (ch === '_') {
      maskHtml += `<div class="mask-letter hidden">_</div>`;
    } else {
      maskHtml += `<div class="mask-letter">${ch}</div>`;
    }
  }
  
  // Clues
  const clueIcons = ['🔍', '💎', '🌟'];
  let cluesHtml = puzzle.clues.map((clue, i) => `
    <li class="clue-item">
      <span class="clue-icon">${clueIcons[i] || '📌'}</span>
      <span>${escapeHtml(clue)}</span>
    </li>
  `).join('');
  
  area.innerHTML = `
    <div class="puzzle-label">🎯 Truy Tìm Mật Khẩu</div>
    <p class="puzzle-content">Dựa vào các gợi ý, hãy đoán từ tiếng Anh bí ẩn:</p>
    <div class="word-mask">${maskHtml}</div>
    <ul class="clue-list">${cluesHtml}</ul>
  `;
  
  answerArea.innerHTML = `
    <input type="text" class="candy-input" id="answer-input" placeholder="Nhập từ bí ẩn..." autocomplete="off" autocapitalize="characters" style="text-transform:uppercase; letter-spacing:3px;">
  `;
}

function renderFinalPuzzle(puzzle, area, answerArea) {
  let stepsHtml = '';
  
  puzzle.steps.forEach((step, i) => {
    let stepContent = '';
    
    if (step.type === 'caesar_mini') {
      stepContent = `
        <div class="final-step-label">Bước ${i + 1}: Giải mã từ</div>
        <div class="puzzle-encrypted" style="font-size:1rem;">${escapeHtml(step.encrypted)}</div>
        <input type="text" class="candy-input" id="final-answer-${i}" placeholder="Từ đã giải mã..." autocomplete="off">
      `;
    } else if (step.type === 'pattern_mini') {
      const seqText = step.sequence.join(' → ');
      stepContent = `
        <div class="final-step-label">Bước ${i + 1}: Số tiếp theo</div>
        <p class="puzzle-content" style="font-size:0.95rem;">${seqText} → <strong>?</strong></p>
        <input type="text" class="candy-input" id="final-answer-${i}" placeholder="Số tiếp theo..." inputmode="numeric" autocomplete="off">
      `;
    } else if (step.type === 'riddle_mini') {
      const cluesText = step.clues.map(c => `• ${c}`).join('<br>');
      stepContent = `
        <div class="final-step-label">Bước ${i + 1}: Đoán từ</div>
        <p class="puzzle-content" style="font-size:0.9rem;">${cluesText}</p>
        <input type="text" class="candy-input" id="final-answer-${i}" placeholder="Từ bí ẩn..." autocomplete="off" style="text-transform:uppercase;">
      `;
    }
    
    stepsHtml += `<div class="final-step">${stepContent}</div>`;
  });
  
  area.innerHTML = `
    <div class="puzzle-label">⚔️ Trận Chiến Cuối Cùng</div>
    <p class="puzzle-content">Hoàn thành cả 3 bước để đánh bại Nữ Hoàng Đường Phèn! Mỗi bước đúng nhận thêm điểm.</p>
  `;
  
  answerArea.innerHTML = `<div class="final-steps">${stepsHtml}</div>`;
}

// ─── ANSWER HANDLING ───────────────────────────────────────

function selectOption(btn, value) {
  $$('.option-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedOption = value;
}

function submitAnswer() {
  if (!currentPuzzle) return;
  
  const timeMs = Date.now() - roundStartTime;
  let answer;
  
  if (currentPuzzle.type === 'logic') {
    if (!selectedOption) {
      showToast('Vui lòng chọn một đáp án!');
      return;
    }
    answer = selectedOption;
  } else if (currentPuzzle.type === 'final') {
    answer = [];
    for (let i = 0; i < currentPuzzle.steps.length; i++) {
      const input = $(`#final-answer-${i}`);
      answer.push(input ? input.value : '');
    }
    if (answer.every(a => !a.trim())) {
      showToast('Vui lòng nhập ít nhất một đáp án!');
      return;
    }
  } else {
    const input = $('#answer-input');
    if (!input || !input.value.trim()) {
      showToast('Vui lòng nhập đáp án!');
      return;
    }
    answer = input.value;
  }
  
  socket.emit('submit-answer', {
    roundIndex: currentRound,
    answer,
    timeMs
  });
  
  $('#btn-submit').disabled = true;
  $('#btn-submit').textContent = '⏳ Đang chấm...';
}

function requestHint() {
  socket.emit('request-hint', { roundIndex: currentRound });
}

// ─── TIMER ─────────────────────────────────────────────────

function startTimer(seconds) {
  roundStartTime = Date.now();
  const endTime = roundStartTime + (seconds * 1000);
  
  const timerBar = $('#game-timer-bar');
  const timerText = $('#game-timer-text');
  
  timerBar.style.width = '100%';
  timerBar.classList.remove('urgent');
  
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    const now = Date.now();
    const remaining = Math.max(0, endTime - now);
    const remainingSec = Math.ceil(remaining / 1000);
    const pct = (remaining / (seconds * 1000)) * 100;
    
    timerBar.style.width = `${pct}%`;
    timerText.textContent = `${remainingSec}s`;
    
    if (remainingSec <= 10) {
      timerBar.classList.add('urgent');
    }
    
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

// ─── LEADERBOARD RENDERING ─────────────────────────────────

function renderLeaderboard(rankings, containerId) {
  const container = $(containerId);
  if (!container) return;
  
  container.innerHTML = rankings.map((p, i) => {
    const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    const isSelf = p.name === myName;
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
    
    return `
      <div class="lb-row ${rankClass} ${isSelf ? 'self' : ''}">
        <span class="lb-rank">${rankEmoji}</span>
        <span class="lb-name">${escapeHtml(p.name)}${isSelf ? ' (Bạn)' : ''}</span>
        <span class="lb-points">${p.totalPoints}⭐</span>
      </div>
    `;
  }).join('');
}

// ─── FINAL RESULTS ─────────────────────────────────────────

function renderFinalResults(rankings) {
  // Podium (top 3)
  const podium = $('#podium');
  const top3 = rankings.slice(0, 3);
  
  // Order: 2nd, 1st, 3rd for visual layout
  const podiumOrder = [];
  if (top3[1]) podiumOrder.push({ ...top3[1], podiumRank: 2 });
  if (top3[0]) podiumOrder.push({ ...top3[0], podiumRank: 1 });
  if (top3[2]) podiumOrder.push({ ...top3[2], podiumRank: 3 });
  
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const baseClasses = { 1: 'first', 2: 'second', 3: 'third' };
  
  podium.innerHTML = podiumOrder.map(p => `
    <div class="podium-slot">
      <div class="podium-medal">${medals[p.podiumRank]}</div>
      <div class="podium-name">${escapeHtml(p.name)}</div>
      <div class="podium-points">${p.totalPoints}⭐</div>
      <div class="podium-base ${baseClasses[p.podiumRank]}">${p.podiumRank}</div>
    </div>
  `).join('');
  
  // Full rankings table
  const tbody = $('#results-table');
  tbody.innerHTML = rankings.map(p => {
    const isSelf = p.name === myName;
    let prizeClass = '';
    let prizeText = p.prize;
    
    if (p.rank === 1) prizeClass = 'prize-1';
    else if (p.rank <= 3) prizeClass = 'prize-2';
    else if (p.rank <= 6) prizeClass = 'prize-3';
    else prizeClass = 'prize-complete';
    
    return `
      <tr class="${isSelf ? 'highlight' : ''}">
        <td><strong>${p.rank}</strong></td>
        <td>${escapeHtml(p.name)}${isSelf ? ' 👈' : ''}</td>
        <td><strong>${p.totalPoints}</strong></td>
        <td><span class="prize-badge ${prizeClass}">${prizeText}</span></td>
      </tr>
    `;
  }).join('');
}

// ─── CONFETTI ──────────────────────────────────────────────

function createConfetti() {
  const colors = ['#FF69B4', '#FFD700', '#87CEEB', '#98FB98', '#DDA0DD', '#F0E68C', '#FF6B6B', '#4ECDC4'];
  
  for (let i = 0; i < 60; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-piece';
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.width = `${6 + Math.random() * 8}px`;
    confetti.style.height = `${6 + Math.random() * 8}px`;
    confetti.style.animationDuration = `${2 + Math.random() * 3}s`;
    confetti.style.animationDelay = `${Math.random() * 2}s`;
    confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    document.body.appendChild(confetti);
    
    setTimeout(() => confetti.remove(), 5000);
  }
}

// ─── UTILITIES ─────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  showScreen('screen-login');
  
  // Focus name input
  setTimeout(() => {
    const nameInput = $('#input-name');
    if (nameInput) nameInput.focus();
  }, 500);
});
