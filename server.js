/* ============================================================
   ⚔️ TRẬN CHIẾN A13 - PHIÊN BẢN STUDIO HOÀNG GIA 3D
   Server-side: MC Laptop điều khiển độc quyền, Socket.IO real-time
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
const TIME_LIMIT_SECONDS = 10; // 10 giây mỗi câu theo yêu cầu

// ─── ĐỌC FILE CÂU HỎI TỰ ĐỘNG (DỄ DÀNG CHỈNH SỬA) ────────────
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
  countdownTimer: null,
  tvConnected: false
};

function resetGame() {
  gameState = {
    phase: 'WAITING',
    players: {},
    currentRound: 0,
    roundStartTime: null,
    roundTimer: null,
    countdownTimer: null,
    tvConnected: gameState.tvConnected
  };
}

// ─── TÍNH ĐIỂM (100đ CƠ BẢN + ĐIỂM TỐC ĐỘ GIẢM DẦN TRONG 10S) ───
function calculateScore(timeMs, isCorrect) {
  if (!isCorrect) return 0;
  const timeSec = Math.min(10, Math.max(0, timeMs / 1000));
  // Điểm tốc độ: tối đa 100đ, giảm đều theo mili-giây về 0đ trong 10 giây
  const speedBonus = Math.round(100 * Math.max(0, 1 - (timeSec / TIME_LIMIT_SECONDS)));
  return 100 + speedBonus; // Tổng từ 100đ đến 200đ
}

function getLeaderboard() {
  const playerList = Object.values(gameState.players);
  const sorted = playerList
    .map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar || '🐰',
      totalPoints: p.totalPoints,
      lastRoundPoints: p.lastRoundPoints || 0,
      lastAnswerTime: p.lastAnswerTime || 0,
      roundScores: p.roundScores,
      roundTimes: p.roundTimes,
      isCorrectLast: p.isCorrectLast || false
    }))
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      const aTime = (a.roundTimes || []).reduce((s, t) => s + t, 0);
      const bTime = (b.roundTimes || []).reduce((s, t) => s + t, 0);
      return aTime - bTime;
    });

  sorted.forEach((p, i) => {
    p.rank = i + 1;
    if (i === 0) p.prize = '🥇 Quán Quân Vàng';
    else if (i <= 2) p.prize = '🥈 Á Quân Bạc';
    else if (i <= 5) p.prize = '🥉 Giải Ba Đồng';
    else p.prize = '🎖️ Chiến Binh A13';
  });

  return sorted;
}

// ─── SOCKET.IO EVENTS ──────────────────────────────────────
io.on('connection', (socket) => {

  // 1. NGƯỜI CHƠI THAM GIA PHÒNG TỪ ĐIỆN THOẠI (KHÔNG CÓ QUYỀN BẮT ĐẦU)
  socket.on('join-room', ({ playerName, password, avatar }) => {
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

    const cuteAvatars = ['🐰', '🐱', '🐻', '🐼', '🦊', '🦄', '🐥', '🍬', '🍓', '🍭', '🦁', '🐨', '🐯', '🐧'];
    const chosenAvatar = avatar || cuteAvatars[Object.keys(gameState.players).length % cuteAvatars.length];

    gameState.players[socket.id] = {
      id: socket.id,
      name: playerName.trim(),
      avatar: chosenAvatar,
      isHost: false, // NGƯỜI CHƠI KHÔNG BAO GIỜ LÀ HOST
      totalPoints: 0,
      lastRoundPoints: 0,
      lastAnswerTime: 0,
      isCorrectLast: false,
      roundScores: [],
      roundTimes: [],
      answeredThisRound: false
    };

    const playerList = Object.values(gameState.players).map(p => ({
      name: p.name,
      avatar: p.avatar
    }));

    socket.emit('room-joined', {
      players: playerList,
      playerName: playerName.trim(),
      avatar: chosenAvatar
    });

    // Thông báo cho Tivi và toàn bộ phòng
    io.emit('lobby-update', {
      players: playerList,
      playerCount: playerList.length,
      newPlayer: { name: playerName.trim(), avatar: chosenAvatar }
    });

    console.log(`👤 ${playerName.trim()} (${chosenAvatar}) vào phòng A13. Tổng: ${playerList.length}`);
  });

  // 2. MÀN HÌNH TIVI (LAPTOP MC) KẾT NỐI - CÓ TOÀN QUYỀN ĐIỀU KHIỂN
  socket.on('register-tv', () => {
    socket.join('tv-control-room');
    gameState.tvConnected = true;

    const playerList = Object.values(gameState.players).map(p => ({
      name: p.name,
      avatar: p.avatar
    }));

    socket.emit('tv-init', {
      phase: gameState.phase,
      currentRound: gameState.currentRound,
      players: playerList,
      leaderboard: getLeaderboard()
    });

    console.log('📺 Màn hình Tivi / Laptop MC đã kết nối và nắm quyền điều hành!');
  });

  // 3. CHỈ LAPTOP MỞ MÀN HÌNH TIVI MỚI CÓ QUYỀN BẮT ĐẦU TRÒ CHƠI!
  socket.on('tv-start-game', () => {
    QUESTIONS = loadQuestions(); // Cập nhật ngay câu hỏi mới nhất từ file
    if (QUESTIONS.length === 0) {
      socket.emit('error-msg', { message: 'Chưa có câu hỏi nào trong questions.json!' });
      return;
    }

    const playerCount = Object.keys(gameState.players).length;
    if (playerCount < 1) {
      socket.emit('error-msg', { message: 'Cần ít nhất 1 bạn tham gia trên điện thoại để bắt đầu!' });
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

    console.log(`⚔️ Laptop MC đã bấm Bắt Đầu Trận Chiến A13 với ${playerCount} người chơi!`);
  });

  // 4. LAPTOP MC CHUYỂN SANG VÒNG KẾ TIẾP
  socket.on('tv-next-round', () => {
    if (gameState.phase !== 'ROUND_END') return;
    if (gameState.currentRound < QUESTIONS.length - 1) {
      startRound(gameState.currentRound + 1);
    } else {
      endGame();
    }
  });

  // 5. LAPTOP MC RESET LÀM MỚI GAME
  socket.on('tv-reset-game', () => {
    if (gameState.roundTimer) clearTimeout(gameState.roundTimer);
    if (gameState.countdownTimer) clearInterval(gameState.countdownTimer);
    resetGame();
    io.emit('game-reset', {});
    console.log('🔄 Laptop MC đã Reset game!');
  });

  // 6. NGƯỜI CHƠI NỘP ĐÁP ÁN TRONG 10 GIÂY
  socket.on('submit-answer', ({ roundIndex, answer, timeMs }) => {
    const player = gameState.players[socket.id];
    if (!player || gameState.phase !== 'PLAYING') return;
    if (player.answeredThisRound) return;

    player.answeredThisRound = true;
    const currentQ = QUESTIONS[roundIndex];
    if (!currentQ) return;

    const isCorrect = (answer || '').trim() === currentQ.answer.trim();
    const points = calculateScore(timeMs, isCorrect);

    player.isCorrectLast = isCorrect;
    player.lastRoundPoints = points;
    player.lastAnswerTime = (timeMs / 1000).toFixed(2);
    player.totalPoints += points;
    player.roundScores[roundIndex] = points;
    player.roundTimes[roundIndex] = timeMs;

    // Gửi kết quả về điện thoại của người chơi đó
    socket.emit('answer-result', {
      isCorrect,
      points,
      totalPoints: player.totalPoints,
      correctAnswer: currentQ.answer,
      timeSeconds: player.lastAnswerTime
    });

    // Báo cho màn hình Tivi cập nhật số người đã trả lời & hiệu ứng nộp bài
    const totalPlayers = Object.keys(gameState.players).length;
    const answeredCount = Object.values(gameState.players).filter(p => p.answeredThisRound).length;

    io.emit('answered-progress', {
      answeredCount,
      totalPlayers,
      justAnsweredName: player.name,
      justAnsweredAvatar: player.avatar
    });

    // Nếu TẤT CẢ người chơi đã nộp bài trước khi hết 10 giây -> Kết thúc vòng ngay lập tức!
    if (answeredCount >= totalPlayers) {
      endRound();
    }
  });

  // 7. NGẮT KẾT NỐI
  socket.on('disconnect', () => {
    const player = gameState.players[socket.id];
    if (player) {
      delete gameState.players[socket.id];
      const playerList = Object.values(gameState.players).map(p => ({
        name: p.name,
        avatar: p.avatar
      }));

      io.emit('lobby-update', {
        players: playerList,
        playerCount: playerList.length
      });
      console.log(`👋 ${player.name} đã rời phòng`);
    }
  });
});

// ─── ĐIỀU HÀNH VÒNG ĐẤU 10 GIÂY ─────────────────────────────
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
    p.isCorrectLast = false;
  });

  // Phát sóng câu hỏi cho màn hình Tivi và Điện thoại (giấu đáp án)
  const qData = {
    roundIndex: roundIdx,
    totalRounds: QUESTIONS.length,
    bossName: currentQ.bossName || `Vòng ${roundIdx + 1}`,
    question: currentQ.question,
    options: currentQ.options,
    timeLimit: TIME_LIMIT_SECONDS
  };

  io.emit('round-start', qData);

  // Bộ đếm thời gian 10 giây
  gameState.roundTimer = setTimeout(() => {
    // Xử lý những ai chưa trả lời khi hết giờ
    Object.values(gameState.players).forEach(p => {
      if (!p.answeredThisRound) {
        p.answeredThisRound = true;
        p.isCorrectLast = false;
        p.lastRoundPoints = 0;
        p.roundScores[roundIdx] = 0;
        p.roundTimes[roundIdx] = TIME_LIMIT_SECONDS * 1000;
        p.lastAnswerTime = TIME_LIMIT_SECONDS;

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

  console.log(`⏱️ Bắt đầu Vòng ${roundIdx + 1}/${QUESTIONS.length} (Thời gian: ${TIME_LIMIT_SECONDS}s)!`);
}

function endRound() {
  if (gameState.roundTimer) {
    clearTimeout(gameState.roundTimer);
    gameState.roundTimer = null;
  }

  gameState.phase = 'ROUND_END';
  const leaderboard = getLeaderboard();
  const currentQ = QUESTIONS[gameState.currentRound];

  // Phát sóng bảng xếp hạng ngay lập tức cho Tivi và Điện thoại
  io.emit('round-end', {
    roundIndex: gameState.currentRound,
    totalRounds: QUESTIONS.length,
    correctAnswer: currentQ ? currentQ.answer : '',
    leaderboard,
    topPlayer: leaderboard[0] || null,
    isLastRound: gameState.currentRound >= QUESTIONS.length - 1
  });

  console.log(`🏁 Kết thúc Vòng ${gameState.currentRound + 1}. Quán Quân hiện tại: ${leaderboard[0]?.name} (${leaderboard[0]?.totalPoints}đ)`);
}

function endGame() {
  gameState.phase = 'FINISHED';
  const finalRankings = getLeaderboard();
  io.emit('game-over', {
    finalRankings
  });
  console.log('🏆 Trận Chiến A13 kết thúc! Vinh quang thuộc về người xuất sắc nhất!');
}

// ─── START SERVER ──────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n💖 ═════════════════════════════════════════════════════════`);
  console.log(`   ⚔️ TRẬN CHIẾN A13 - PHIÊN BẢN STUDIO HOÀNG GIA 3D`);
  console.log(`   Cổng: ${PORT} | Mật khẩu: ${ROOM_PASSWORD}`);
  console.log(`   💻 MÀN HÌNH TIVI (MC ĐIỀU KHIỂN): http://localhost:${PORT}/tv`);
  console.log(`   📱 ĐIỆN THOẠI NGƯỜI CHƠI:        http://localhost:${PORT}`);
  console.log(`💖 ═════════════════════════════════════════════════════════\n`);
});
