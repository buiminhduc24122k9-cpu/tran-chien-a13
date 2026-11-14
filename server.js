/* ============================================================
   ⚔️ TRẬN CHIẾN A13 (BATTLE OF A13) - TONE HỒNG & TV SPECTATOR
   Server-side game engine with Socket.IO multiplayer
   ============================================================ */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(express.static(path.join(__dirname, 'public')));

// Tuyến đường chuyên dụng cho Laptop kết nối Tivi
app.get('/tv', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tv.html'));
});

// ─── CONFIG ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const ROOM_PASSWORD = process.env.GAME_PASSWORD || 'ABC13';
const TIME_LIMIT_SECONDS = 10; // Đúng 10s theo yêu cầu

// ─── LOAD QUESTIONS FROM FILE (DỄ DÀNG CHỈNH SỬA) ───────────
function loadQuestions() {
  try {
    const qPath = path.join(__dirname, 'questions.json');
    if (fs.existsSync(qPath)) {
      const data = fs.readFileSync(qPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Lỗi đọc questions.json:', err);
  }
  return [];
}

let QUESTIONS = loadQuestions();

// ─── GAME STATE ────────────────────────────────────────────
let gameState = {
  phase: 'WAITING', // WAITING | COUNTDOWN | PLAYING | ROUND_END | FINISHED
  players: {},      // socketId -> playerData
  currentRound: 0,
  roundStartTime: null,
  roundTimer: null,
  countdownTimer: null
};

function resetGame() {
  gameState = {
    phase: 'WAITING',
    players: {},
    currentRound: 0,
    roundStartTime: null,
    roundTimer: null,
    countdownTimer: null
  };
}

// ─── TÍNH ĐIỂM (100đ CƠ BẢN + ĐIỂM TỐC ĐỘ GIẢM DẦN TRONG 10S) ───
function calculateScore(timeMs, isCorrect) {
  if (!isCorrect) return 0;
  const timeSec = Math.min(10, Math.max(0, timeMs / 1000));
  // Điểm tốc độ giảm từ 100đ về 0đ trong 10 giây
  const speedBonus = Math.round(100 * Math.max(0, 1 - (timeSec / TIME_LIMIT_SECONDS)));
  return 100 + speedBonus; // Tổng từ 100đ đến 200đ
}

function getLeaderboard() {
  const playerList = Object.values(gameState.players);
  const sorted = playerList
    .map(p => ({
      id: p.id,
      name: p.name,
      totalPoints: p.totalPoints,
      lastRoundPoints: p.lastRoundPoints || 0,
      roundScores: p.roundScores,
      roundTimes: p.roundTimes
    }))
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      const aTime = (a.roundTimes || []).reduce((s, t) => s + t, 0);
      const bTime = (b.roundTimes || []).reduce((s, t) => s + t, 0);
      return aTime - bTime;
    });

  sorted.forEach((p, i) => {
    p.rank = i + 1;
    if (i === 0) p.prize = '🥇 Giải Nhất';
    else if (i <= 2) p.prize = '🥈 Giải Nhì';
    else if (i <= 5) p.prize = '🥉 Giải Ba';
    else p.prize = '🎖️ Chiến Binh A13';
  });

  return sorted;
}

// ─── SOCKET.IO EVENTS ──────────────────────────────────────
io.on('connection', (socket) => {
  // Người chơi tham gia phòng từ điện thoại
  socket.on('join-room', ({ playerName, password }) => {
    if (!playerName || !playerName.trim()) {
      socket.emit('error-msg', { message: 'Vui lòng nhập tên của bạn!' });
      return;
    }

    if (password !== ROOM_PASSWORD) {
      socket.emit('error-msg', { message: 'Sai mật khẩu! Hãy nhập ABC13' });
      return;
    }

    if (gameState.phase !== 'WAITING') {
      socket.emit('error-msg', { message: 'Trận đấu đang diễn ra! Hãy đợi ván tiếp theo nhé.' });
      return;
    }

    const existing = Object.values(gameState.players).some(
      p => p.name.toLowerCase() === playerName.trim().toLowerCase()
    );
    if (existing) {
      socket.emit('error-msg', { message: 'Tên này đã có bạn dùng rồi!' });
      return;
    }

    const isHost = Object.keys(gameState.players).length === 0;

    gameState.players[socket.id] = {
      id: socket.id,
      name: playerName.trim(),
      isHost,
      totalPoints: 0,
      lastRoundPoints: 0,
      roundScores: [],
      roundTimes: [],
      answeredThisRound: false
    };

    const playerList = Object.values(gameState.players).map(p => ({
      name: p.name,
      isHost: p.isHost
    }));

    socket.emit('room-joined', {
      players: playerList,
      isHost,
      playerName: playerName.trim()
    });

    io.emit('lobby-update', {
      players: playerList,
      playerCount: playerList.length
    });

    console.log(`👤 ${playerName.trim()} đã tham gia A13! Tổng: ${playerList.length}`);
  });

  // Màn hình Tivi kết nối
  socket.on('register-tv', () => {
    socket.join('tv-room');
    const playerList = Object.values(gameState.players).map(p => ({
      name: p.name,
      isHost: p.isHost
    }));
    socket.emit('tv-init', {
      phase: gameState.phase,
      currentRound: gameState.currentRound,
      players: playerList,
      leaderboard: getLeaderboard()
    });
    console.log('📺 Màn hình Tivi / Máy chiếu đã kết nối!');
  });

  // Host bấm Bắt đầu trận đấu
  socket.on('host-start', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.isHost) {
      socket.emit('error-msg', { message: 'Chỉ có Chủ phòng mới có quyền bắt đầu!' });
      return;
    }

    QUESTIONS = loadQuestions(); // Tải lại câu hỏi mới nhất từ file nếu người dùng vừa sửa
    if (QUESTIONS.length === 0) {
      socket.emit('error-msg', { message: 'Chưa có câu hỏi nào trong questions.json!' });
      return;
    }

    gameState.phase = 'COUNTDOWN';
    gameState.currentRound = 0;

    let countdown = 5;
    io.emit('game-countdown', { seconds: countdown });

    gameState.countdownTimer = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        io.emit('game-countdown', { seconds: countdown });
      } else {
        clearInterval(gameState.countdownTimer);
        startRound(0);
      }
    }, 1000);

    console.log('⚔️ Trận Chiến A13 bắt đầu!');
  });

  // Người chơi nộp đáp án trong vòng 10s
  socket.on('submit-answer', ({ roundIndex, answer, timeMs }) => {
    const player = gameState.players[socket.id];
    if (!player || gameState.phase !== 'PLAYING') return;
    if (player.answeredThisRound) return;

    player.answeredThisRound = true;
    const currentQ = QUESTIONS[roundIndex];
    if (!currentQ) return;

    const isCorrect = (answer || '').trim() === currentQ.answer.trim();
    const points = calculateScore(timeMs, isCorrect);

    player.lastRoundPoints = points;
    player.totalPoints += points;
    player.roundScores[roundIndex] = points;
    player.roundTimes[roundIndex] = timeMs;

    // Gửi kết quả về riêng người chơi đó
    socket.emit('answer-result', {
      isCorrect,
      points,
      totalPoints: player.totalPoints,
      correctAnswer: currentQ.answer
    });

    // Cập nhật số người đã trả lời cho màn hình Tivi & mọi người
    const totalPlayers = Object.keys(gameState.players).length;
    const answeredCount = Object.values(gameState.players).filter(p => p.answeredThisRound).length;

    io.emit('answered-progress', {
      answeredCount,
      totalPlayers,
      justAnsweredName: player.name
    });

    // Nếu tất cả người chơi đã trả lời xong trước 10s -> kết thúc vòng luôn
    if (answeredCount >= totalPlayers) {
      endRound();
    }
  });

  // Reset Game
  socket.on('host-reset', () => {
    if (gameState.roundTimer) clearTimeout(gameState.roundTimer);
    if (gameState.countdownTimer) clearInterval(gameState.countdownTimer);
    resetGame();
    io.emit('game-reset', {});
    console.log('🔄 Đã Reset Trận Chiến A13');
  });

  // Người chơi ngắt kết nối
  socket.on('disconnect', () => {
    const player = gameState.players[socket.id];
    if (player) {
      const wasHost = player.isHost;
      delete gameState.players[socket.id];

      const remaining = Object.values(gameState.players);
      if (wasHost && remaining.length > 0) {
        remaining[0].isHost = true;
        io.to(remaining[0].id).emit('you-are-host', {});
      }

      const playerList = remaining.map(p => ({
        name: p.name,
        isHost: p.isHost
      }));

      io.emit('lobby-update', {
        players: playerList,
        playerCount: playerList.length
      });
    }
  });
});

// ─── QUẢN LÝ VÒNG ĐẤU 10 GIÂY ──────────────────────────────
function startRound(roundIdx) {
  gameState.phase = 'PLAYING';
  gameState.currentRound = roundIdx;
  gameState.roundStartTime = Date.now();

  const currentQ = QUESTIONS[roundIdx];
  if (!currentQ) {
    endGame();
    return;
  }

  // Reset trạng thái từng người chơi
  Object.values(gameState.players).forEach(p => {
    p.answeredThisRound = false;
    p.lastRoundPoints = 0;
  });

  // Phát sóng câu hỏi cho màn hình Tivi và Điện thoại
  // Giấu đáp án đúng
  const qForClients = {
    roundIndex: roundIdx,
    totalRounds: QUESTIONS.length,
    bossName: currentQ.bossName || `Vòng ${roundIdx + 1}`,
    question: currentQ.question,
    options: currentQ.options,
    timeLimit: TIME_LIMIT_SECONDS
  };

  io.emit('round-start', qForClients);

  // Bộ đếm thời gian 10s
  gameState.roundTimer = setTimeout(() => {
    // Xử lý những ai chưa trả lời khi hết 10s
    Object.values(gameState.players).forEach(p => {
      if (!p.answeredThisRound) {
        p.answeredThisRound = true;
        p.lastRoundPoints = 0;
        p.roundScores[roundIdx] = 0;
        p.roundTimes[roundIdx] = TIME_LIMIT_SECONDS * 1000;
        io.to(p.id).emit('answer-result', {
          isCorrect: false,
          points: 0,
          totalPoints: p.totalPoints,
          timeout: true,
          correctAnswer: currentQ.answer
        });
      }
    });

    endRound();
  }, TIME_LIMIT_SECONDS * 1000);

  console.log(`⏱️ Bắt đầu Vòng ${roundIdx + 1} (${TIME_LIMIT_SECONDS}s)!`);
}

function endRound() {
  if (gameState.roundTimer) {
    clearTimeout(gameState.roundTimer);
    gameState.roundTimer = null;
  }

  gameState.phase = 'ROUND_END';
  const leaderboard = getLeaderboard();
  const currentQ = QUESTIONS[gameState.currentRound];

  // Phát sóng bảng xếp hạng ngay lập tức cho Tivi và người chơi
  io.emit('round-end', {
    roundIndex: gameState.currentRound,
    totalRounds: QUESTIONS.length,
    correctAnswer: currentQ ? currentQ.answer : '',
    leaderboard,
    topPlayer: leaderboard[0] || null
  });

  console.log(`🏁 Kết thúc Vòng ${gameState.currentRound + 1}. Top 1 hiện tại: ${leaderboard[0]?.name} (${leaderboard[0]?.totalPoints}đ)`);

  // Sau 7 giây nghỉ ngơi và xem bảng xếp hạng trên Tivi -> qua vòng tiếp theo
  if (gameState.currentRound < QUESTIONS.length - 1) {
    setTimeout(() => {
      startRound(gameState.currentRound + 1);
    }, 7000);
  } else {
    // Kết thúc toàn bộ trò chơi
    setTimeout(() => {
      endGame();
    }, 4000);
  }
}

function endGame() {
  gameState.phase = 'FINISHED';
  const finalRankings = getLeaderboard();
  io.emit('game-over', {
    finalRankings
  });
  console.log('🏆 Trận Chiến A13 kết thúc! Vinh danh nhà vô địch!');
}

// ─── START SERVER ──────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n💖 ═══════════════════════════════════════════`);
  console.log(`   ⚔️ TRẬN CHIẾN A13 - TONE HỒNG HOÀNG GIA`);
  console.log(`   Cổng: ${PORT} | Mật khẩu: ${ROOM_PASSWORD}`);
  console.log(`   Màn hình Tivi: http://localhost:${PORT}/tv`);
  console.log(`💖 ═══════════════════════════════════════════\n`);
});
