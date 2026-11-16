/* ============================================================
   ⚔️ TRẬN CHIẾN A13 - PHIÊN BẢN STUDIO HOÀNG GIA 3D
   Server-side: MC Laptop điều hành, Lưu Session Reconnect & Cho Vào Tự Do
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
  pingTimeout: 30000,
  pingInterval: 10000,
  transports: ['websocket', 'polling']
});

app.use(express.static(path.join(__dirname, 'public')));

// Tuyến đường chuyên dụng cho Laptop kết nối Tivi
app.get('/tv', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tv.html'));
});

// ─── CONFIG ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const ROOM_PASSWORD = process.env.GAME_PASSWORD || 'ABC13';
const TIME_LIMIT_SECONDS = 10; // 10 giây mỗi câu

// ─── LOAD CÂU HỎI TỰ ĐỘNG TỪ FILE JSON ───────────────────────
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
  players: {},      // playerId -> playerData
  socketToPlayer: {}, // socketId -> playerId
  currentRound: 0,
  roundStartTime: null,
  roundTimer: null,
  countdownTimer: null
};

function resetGame(keepPlayers = true) {
  if (gameState.roundTimer) clearTimeout(gameState.roundTimer);
  if (gameState.countdownTimer) clearInterval(gameState.countdownTimer);
  gameState.roundTimer = null;
  gameState.countdownTimer = null;
  gameState.phase = 'WAITING';
  gameState.currentRound = 0;
  gameState.roundStartTime = null;

  if (keepPlayers) {
    // Giữ danh sách người chơi trong phòng nhưng RESET TOÀN BỘ ĐIỂM SỐ VỀ 0
    Object.values(gameState.players).forEach(p => {
      p.totalPoints = 0;
      p.lastRoundPoints = 0;
      p.lastAnswerTime = 0;
      p.isCorrectLast = false;
      p.roundScores = [];
      p.roundTimes = [];
      p.answeredThisRound = false;
    });
  } else {
    gameState.players = {};
    gameState.socketToPlayer = {};
  }
}

// ─── TÍNH ĐIỂM (100đ CƠ BẢN + ĐIỂM TỐC ĐỘ GIẢM DẦN TRONG 10S) ───
function calculateScore(timeMs, isCorrect) {
  if (!isCorrect) return 0;
  const timeSec = Math.min(10, Math.max(0, timeMs / 1000));
  const speedBonus = Math.round(100 * Math.max(0, 1 - (timeSec / TIME_LIMIT_SECONDS)));
  return 100 + speedBonus;
}

function getLeaderboard() {
  const playerList = Object.values(gameState.players);
  const sorted = playerList
    .map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar || '🐰',
      totalPoints: p.totalPoints || 0,
      lastRoundPoints: p.lastRoundPoints || 0,
      lastAnswerTime: p.lastAnswerTime || 0,
      roundScores: p.roundScores || [],
      roundTimes: p.roundTimes || [],
      isCorrectLast: p.isCorrectLast || false,
      connected: p.connected !== false
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
  const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;

  // 1. NGƯỜI CHƠI THAM GIA / VÀO LẠI PHÒNG TỪ ĐIỆN THOẠI
  socket.on('join-room', ({ playerId, playerName, password, avatar }) => {
    if (!playerName || !playerName.trim()) {
      socket.emit('error-msg', { message: 'Vui lòng nhập tên của bạn!' });
      return;
    }

    if (password !== ROOM_PASSWORD) {
      socket.emit('error-msg', { message: 'Sai mật khẩu! Hãy nhập ABC13' });
      return;
    }

    let cleanName = playerName.trim();
    const effectivePlayerId = playerId || `p_${cleanName.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 1. Tìm chính xác theo Player ID của máy
    let existingPlayer = gameState.players[effectivePlayerId];

    // 2. Nếu chưa thấy theo ID, tìm theo Tên nhưng CHỈ nhận lại nếu người đó đang bị mất kết nối (offline)
    if (!existingPlayer) {
      const matchByName = Object.values(gameState.players).find(
        p => p.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (matchByName) {
        if (!matchByName.connected) {
          // Người chơi này trước đó bị rớt mạng -> cho kết nối lại tài khoản cũ
          existingPlayer = matchByName;
        } else {
          // Người mang tên này đang chơi online -> không cướp phiên, thêm số phân biệt
          cleanName = `${cleanName} (${Math.floor(Math.random() * 89 + 11)})`;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // TRƯỜNG HỢP A: NGƯỜI CHƠI CŨ VÀO LẠI (F5, MẤT MẠNG, THOÁT RA VÀO LẠI)
    // ─────────────────────────────────────────────────────────────
    if (existingPlayer) {
      existingPlayer.socketId = socket.id;
      existingPlayer.connected = true;
      existingPlayer.ip = clientIp;
      if (avatar) existingPlayer.avatar = avatar;

      gameState.socketToPlayer[socket.id] = existingPlayer.id;

      console.log(`♻️ Người chơi ${existingPlayer.name} (${existingPlayer.avatar}) ĐÃ KẾT NỐI LẠI! Giữ nguyên ${existingPlayer.totalPoints}đ`);

      // Báo về máy người chơi: khôi phục phiên chơi thành công
      socket.emit('room-joined', {
        playerId: existingPlayer.id,
        playerName: existingPlayer.name,
        avatar: existingPlayer.avatar,
        totalPoints: existingPlayer.totalPoints,
        isReconnection: true,
        phase: gameState.phase,
        currentRound: gameState.currentRound
      });

      // Nếu trận đấu đang chạy vòng 10s: cấp ngay câu hỏi và số giây còn lại!
      if (gameState.phase === 'PLAYING') {
        const currentQ = QUESTIONS[gameState.currentRound];
        if (currentQ) {
          const elapsedMs = Date.now() - (gameState.roundStartTime || Date.now());
          const remainSec = Math.max(1, Math.ceil((TIME_LIMIT_SECONDS * 1000 - elapsedMs) / 1000));

          socket.emit('round-start', {
            roundIndex: gameState.currentRound,
            totalRounds: QUESTIONS.length,
            bossName: currentQ.bossName || `Vòng ${gameState.currentRound + 1}`,
            question: currentQ.question,
            options: currentQ.options,
            timeLimit: remainSec,
            alreadyAnswered: existingPlayer.answeredThisRound
          });
        }
      } else if (gameState.phase === 'ROUND_END') {
        const currentQ = QUESTIONS[gameState.currentRound];
        socket.emit('round-end', {
          roundIndex: gameState.currentRound,
          totalRounds: QUESTIONS.length,
          correctAnswer: currentQ ? currentQ.answer : '',
          leaderboard: getLeaderboard(),
          topPlayer: getLeaderboard()[0] || null
        });
      }

      // Cập nhật sảnh chờ cho Tivi
      broadcastLobbyUpdate();
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // TRƯỜNG HỢP B: NGƯỜI CHƠI MỚI (CHO PHÉP VÀO KỂ CẢ KHI GAME ĐANG CHƠI)
    // ─────────────────────────────────────────────────────────────
    const cuteAvatars = ['🐰', '🐱', '🐻', '🐼', '🦊', '🦄', '🐥', '🍬', '🍓', '🍭', '🦁', '🐨', '🐯', '🐧'];
    const chosenAvatar = avatar || cuteAvatars[Object.keys(gameState.players).length % cuteAvatars.length];

    const newPlayer = {
      id: effectivePlayerId,
      socketId: socket.id,
      name: cleanName,
      avatar: chosenAvatar,
      ip: clientIp,
      isHost: false, // Người chơi không bao giờ là Host
      totalPoints: 0,
      lastRoundPoints: 0,
      lastAnswerTime: 0,
      isCorrectLast: false,
      roundScores: [],
      roundTimes: [],
      answeredThisRound: false,
      connected: true
    };

    gameState.players[effectivePlayerId] = newPlayer;
    gameState.socketToPlayer[socket.id] = effectivePlayerId;

    console.log(`👤 Người chơi mới ${cleanName} (${chosenAvatar}) tham gia A13. Tổng: ${Object.keys(gameState.players).length}`);

    socket.emit('room-joined', {
      playerId: effectivePlayerId,
      playerName: cleanName,
      avatar: chosenAvatar,
      totalPoints: 0,
      isReconnection: false,
      phase: gameState.phase,
      currentRound: gameState.currentRound
    });

    // Nếu game đang trong vòng đấu: cho người mới tham gia ngay từ câu hỏi hiện tại!
    if (gameState.phase === 'PLAYING') {
      const currentQ = QUESTIONS[gameState.currentRound];
      if (currentQ) {
        const elapsedMs = Date.now() - (gameState.roundStartTime || Date.now());
        const remainSec = Math.max(1, Math.ceil((TIME_LIMIT_SECONDS * 1000 - elapsedMs) / 1000));

        socket.emit('round-start', {
          roundIndex: gameState.currentRound,
          totalRounds: QUESTIONS.length,
          bossName: currentQ.bossName || `Vòng ${gameState.currentRound + 1}`,
          question: currentQ.question,
          options: currentQ.options,
          timeLimit: remainSec,
          alreadyAnswered: false
        });
      }
    } else if (gameState.phase === 'ROUND_END') {
      const currentQ = QUESTIONS[gameState.currentRound];
      socket.emit('round-end', {
        roundIndex: gameState.currentRound,
        totalRounds: QUESTIONS.length,
        correctAnswer: currentQ ? currentQ.answer : '',
        leaderboard: getLeaderboard(),
        topPlayer: getLeaderboard()[0] || null
      });
    }

    broadcastLobbyUpdate();
  });

  // 2. MÀN HÌNH TIVI (LAPTOP MC) ĐĂNG KÝ
  socket.on('register-tv', () => {
    socket.join('tv-control-room');
    socket.emit('tv-init', {
      phase: gameState.phase,
      currentRound: gameState.currentRound,
      players: getPublicPlayerList(),
      leaderboard: getLeaderboard()
    });
    console.log('📺 Màn hình Tivi / Laptop MC đã kết nối và sẵn sàng điều hành!');
  });

  // 3. CHỈ LAPTOP MỞ MÀN HÌNH TIVI MỚI CÓ QUYỀN BẮT ĐẦU TRÒ CHƠI
  socket.on('tv-start-game', () => {
    QUESTIONS = loadQuestions();
    if (QUESTIONS.length === 0) {
      socket.emit('error-msg', { message: 'Chưa có câu hỏi nào trong questions.json!' });
      return;
    }

    const playerList = Object.values(gameState.players);
    if (playerList.length < 1) {
      socket.emit('error-msg', { message: 'Cần ít nhất 1 bạn tham gia trên điện thoại để bắt đầu!' });
      return;
    }

    // Dọn dẹp mọi timer đang chạy
    if (gameState.roundTimer) clearTimeout(gameState.roundTimer);
    if (gameState.countdownTimer) clearInterval(gameState.countdownTimer);
    gameState.roundTimer = null;
    gameState.countdownTimer = null;

    // QUAN TRỌNG: RESET TOÀN BỘ ĐIỂM CỦA CÁC CHIẾN BINH VỀ 0 KHI BẮT ĐẦU TRẬN MỚI!
    playerList.forEach(p => {
      p.totalPoints = 0;
      p.lastRoundPoints = 0;
      p.lastAnswerTime = 0;
      p.isCorrectLast = false;
      p.roundScores = [];
      p.roundTimes = [];
      p.answeredThisRound = false;
    });

    gameState.phase = 'COUNTDOWN';
    gameState.currentRound = 0;

    // Báo cho toàn bộ máy điện thoại reset điểm về 0 ngay lập tức
    io.emit('game-started', { totalRounds: QUESTIONS.length });

    let countdown = 5;
    io.emit('game-countdown', { seconds: countdown });

    gameState.countdownTimer = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        io.emit('game-countdown', { seconds: countdown });
      } else {
        clearInterval(gameState.countdownTimer);
        gameState.countdownTimer = null;
        startRound(0);
      }
    }, 1000);

    console.log(`⚔️ Laptop MC khởi tranh Trận Chiến A13 mới! Đã reset điểm ${playerList.length} chiến binh về 0đ.`);
  });

  // 4. MC BẤM SANG VÒNG KẾ TIẾP
  socket.on('tv-next-round', () => {
    if (gameState.phase !== 'ROUND_END') return;
    gameState.phase = 'TRANSITIONING'; // Ngăn chặn bấm 2 lần liên tục

    if (gameState.currentRound < QUESTIONS.length - 1) {
      startRound(gameState.currentRound + 1);
    } else {
      endGame();
    }
  });

  // 5. MC RESET LÀM MỚI GAME (CHỈ KHI MC BẤM NÚT NÀY THÌ MỚI XÓA ĐIỂM)
  socket.on('tv-reset-game', () => {
    resetGame(true); // Giữ danh sách người chơi nhưng xóa sạch điểm về 0
    io.emit('game-reset', {});
    broadcastLobbyUpdate();
    console.log('🔄 Laptop MC đã Reset ván mới! Giữ nguyên người chơi, điểm đã về 0.');
  });

  // 6. NGƯỜI CHƠI NỘP ĐÁP ÁN TRONG 10S
  socket.on('submit-answer', ({ roundIndex, answer, timeMs }) => {
    const pId = gameState.socketToPlayer[socket.id];
    const player = pId ? gameState.players[pId] : null;
    if (!player || gameState.phase !== 'PLAYING') return;
    if (roundIndex !== gameState.currentRound) return;
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

    socket.emit('answer-result', {
      isCorrect,
      points,
      totalPoints: player.totalPoints,
      correctAnswer: currentQ.answer,
      timeSeconds: player.lastAnswerTime
    });

    // CHỈ gửi tiến độ nộp bài cho Tivi (KHÔNG spam điện thoại để chống nghẽn lag mạng)
    const allPlayers = Object.values(gameState.players);
    const totalCount = allPlayers.length;
    const answeredCount = allPlayers.filter(p => p.answeredThisRound).length;

    io.to('tv-control-room').emit('answered-progress', {
      answeredCount,
      totalPlayers: totalCount,
      justAnsweredName: player.name,
      justAnsweredAvatar: player.avatar
    });

    // Chỉ khi 100% tất cả người chơi trong phòng đã nộp bài mới kết thúc sớm
    if (answeredCount >= totalCount && totalCount > 0) {
      endRound();
    }
  });

  // 7. NGẮT KẾT NỐI: KHÔNG XÓA DỮ LIỆU ĐỂ BẢO ĐẢM VÀO LẠI KHÔNG BỊ MẤT ĐIỂM!
  socket.on('disconnect', () => {
    const pId = gameState.socketToPlayer[socket.id];
    if (pId && gameState.players[pId]) {
      const player = gameState.players[pId];
      player.connected = false;
      delete gameState.socketToPlayer[socket.id];
      console.log(`🔌 ${player.name} tạm rời mạng (Vẫn lưu nguyên ${player.totalPoints}đ và thứ hạng)`);
      broadcastLobbyUpdate();
    }
  });
});

// ─── HỖ TRỢ PHÁT SÓNG ──────────────────────────────────────
function getPublicPlayerList() {
  return Object.values(gameState.players).map(p => ({
    name: p.name,
    avatar: p.avatar,
    connected: p.connected !== false,
    totalPoints: p.totalPoints
  }));
}

function broadcastLobbyUpdate() {
  const list = getPublicPlayerList();
  io.emit('lobby-update', {
    players: list,
    playerCount: list.length
  });
}

// ─── ĐIỀU HÀNH VÒNG ĐẤU ─────────────────────────────────────
function startRound(roundIdx) {
  if (gameState.roundTimer) {
    clearTimeout(gameState.roundTimer);
    gameState.roundTimer = null;
  }

  gameState.phase = 'PLAYING';
  gameState.currentRound = roundIdx;
  gameState.roundStartTime = Date.now();

  const currentQ = QUESTIONS[roundIdx];
  if (!currentQ) {
    endGame();
    return;
  }

  // Reset cờ nộp bài của từng người cho vòng này
  Object.values(gameState.players).forEach(p => {
    p.answeredThisRound = false;
    p.lastRoundPoints = 0;
    p.isCorrectLast = false;
  });

  const qData = {
    roundIndex: roundIdx,
    totalRounds: QUESTIONS.length,
    bossName: currentQ.bossName || `Vòng ${roundIdx + 1}`,
    question: currentQ.question,
    options: currentQ.options,
    timeLimit: TIME_LIMIT_SECONDS
  };

  io.emit('round-start', qData);

  // Bộ đếm thời gian 10s chính xác
  gameState.roundTimer = setTimeout(() => {
    endRound();
  }, TIME_LIMIT_SECONDS * 1000);

  console.log(`⏱️ Bắt đầu Vòng ${roundIdx + 1}/${QUESTIONS.length} (${TIME_LIMIT_SECONDS}s)!`);
}

function endRound() {
  if (gameState.phase !== 'PLAYING') return; // Chặn gọi 2 lần!
  gameState.phase = 'ROUND_END';

  if (gameState.roundTimer) {
    clearTimeout(gameState.roundTimer);
    gameState.roundTimer = null;
  }

  const currentQ = QUESTIONS[gameState.currentRound];

  // Những người chưa kịp nộp bài thì tính 0đ cho vòng này
  Object.values(gameState.players).forEach(p => {
    if (!p.answeredThisRound) {
      p.answeredThisRound = true;
      p.isCorrectLast = false;
      p.lastRoundPoints = 0;
      p.roundScores[gameState.currentRound] = 0;
      p.roundTimes[gameState.currentRound] = TIME_LIMIT_SECONDS * 1000;
      p.lastAnswerTime = TIME_LIMIT_SECONDS;

      if (p.socketId) {
        io.to(p.socketId).emit('answer-result', {
          isCorrect: false,
          points: 0,
          totalPoints: p.totalPoints,
          timeout: true,
          correctAnswer: currentQ ? currentQ.answer : ''
        });
      }
    }
  });

  const leaderboard = getLeaderboard();

  io.emit('round-end', {
    roundIndex: gameState.currentRound,
    totalRounds: QUESTIONS.length,
    correctAnswer: currentQ ? currentQ.answer : '',
    leaderboard,
    topPlayer: leaderboard[0] || null,
    isLastRound: gameState.currentRound >= QUESTIONS.length - 1
  });

  console.log(`🏁 Kết thúc Vòng ${gameState.currentRound + 1}. Top 1: ${leaderboard[0]?.name} (${leaderboard[0]?.totalPoints}đ)`);
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
  console.log(`\n💖 ═════════════════════════════════════════════════════════`);
  console.log(`   ⚔️ TRẬN CHIẾN A13 - PHIÊN BẢN STUDIO HOÀNG GIA 3D`);
  console.log(`   Cổng: ${PORT} | Mật khẩu: ${ROOM_PASSWORD}`);
  console.log(`   💻 MÀN HÌNH TIVI (MC ĐIỀU KHIỂN): http://localhost:${PORT}/tv`);
  console.log(`   📱 ĐIỆN THOẠI NGƯỜI CHƠI:        http://localhost:${PORT}`);
  console.log(`💖 ═════════════════════════════════════════════════════════\n`);
});
