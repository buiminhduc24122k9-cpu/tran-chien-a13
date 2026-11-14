/* ============================================================
   🍭 CANDY KINGDOM: TÌM KIẾM DI SẢN (PHIÊN BẢN 3D BOSS ARENA)
   Server-side game engine with Socket.IO multiplayer
   ============================================================ */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── CONFIG ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const ROOM_PASSWORD = process.env.GAME_PASSWORD || 'ABC13';
const ROUND_COUNT = 5;
const ROUND_TIME_LIMITS = [45, 45, 45, 45, 60]; // Thời gian vừa phải, tạo cảm giác kịch tính
const BASE_POINTS = [300, 400, 500, 600, 800];
const MAX_HINTS_PER_ROUND = 1;
const HINT_PENALTY = 30;

// ─── GAME STATE ────────────────────────────────────────────
let gameState = {
  phase: 'WAITING', // WAITING | COUNTDOWN | PLAYING | FINISHED
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

// ─── KHO CÂU HỎI SIÊU DỄ & VUI NHỘN (DỄ HIỂU, 1 CHẠM LÀ XONG) ─────────────

// VÒNG 1: ĐỐ MẸO KẸO NGỌT (Hài hước, dễ thương, ai cũng biết)
const ROUND1_QUESTIONS = [
  {
    q: "Kẹo gì có que cắm ở dưới để cầm ăn cho khỏi dính tay?",
    opts: ["Kẹo Mút 🍭", "Kẹo Kéo", "Kẹo Dừa", "Bánh Quy"],
    ans: "Kẹo Mút 🍭",
    hint: "Trẻ con rất thích cầm cây que tròn tròn xoay xoay!"
  },
  {
    q: "Con gì thích ăn đồ ngọt nhất trong nhà?",
    opts: ["Con Kiến 🐜", "Con Muỗi", "Con Gián", "Con Thằn Lằn"],
    ans: "Con Kiến 🐜",
    hint: "Loài vật bé xíu hay bò thành hàng tìm đường!"
  },
  {
    q: "Món kẹo bồng bềnh nhẹ tênh như đám mây trắng hồng gọi là gì?",
    opts: ["Kẹo Bông Gòn ☁️", "Kẹo Lạc", "Kẹo Kéo", "Kẹo Dồi"],
    ans: "Kẹo Bông Gòn ☁️",
    hint: "Quay tròn cây que quanh máy xoay đường nóng!"
  },
  {
    q: "Bánh gì tròn vo có một cái lỗ tròn xoe ở chính giữa?",
    opts: ["Bánh Donut 🍩", "Bánh Chưng", "Bánh Bao", "Bánh Mì"],
    ans: "Bánh Donut 🍩",
    hint: "Thường phủ socola và đường rắc nhiều màu!"
  },
  {
    q: "Cái gì càng nếm càng ngọt, bạn bè gặp nhau cười tươi trao tặng?",
    opts: ["Nụ cười & Kẹo 🍬", "Quả Chanh", "Muối Ớt", "Giấm Chua"],
    ans: "Nụ cười & Kẹo 🍬",
    hint: "Đem lại niềm vui và sự ngọt ngào!"
  },
  {
    q: "Vào ngày lễ Tình nhân (Valentine), món quà ngọt ngào nhất là gì?",
    opts: ["Socola 🍫", "Bánh Mì Kẹp", "Củ Khoai Lang", "Bát Cháo Lòng"],
    ans: "Socola 🍫",
    hint: "Món quà màu nâu vừa ngọt vừa thơm ngào ngạt!"
  },
  {
    q: "Cốc trà sữa thơm lừng dưới đáy thường có những viên gì dai dai?",
    opts: ["Trân Châu 🧋", "Đá Tảng", "Kẹo Cao Su", "Hạt Tiêu"],
    ans: "Trân Châu 🧋",
    hint: "Hạt đen hoặc trắng dai dai nhai sần sật!"
  },
  {
    q: "Bánh sinh nhật luôn có thứ gì cắm ở trên để thổi ước mơ?",
    opts: ["Cây Nến 🕯️", "Cái Muỗng", "Bông Hoa Giấy", "Cây Đũa"],
    ans: "Cây Nến 🕯️",
    hint: "Thắp lửa lên và thổi tắt sau khi hát Happy Birthday!"
  },
  {
    q: "Món kem mát lạnh thường được đặt trong cái bánh gì hình nón giòn rụm?",
    opts: ["Ốc Quế 🍦", "Bánh Bò", "Bánh Gai", "Bánh Tẻ"],
    ans: "Ốc Quế 🍦",
    hint: "Hình cái phễu giòn tan cầm vừa tay!"
  },
  {
    q: "Thứ gì làm cho nước chanh đá chua thành nước chanh ngọt lịm?",
    opts: ["Đường Cát 🍬", "Muối Tinh", "Nước Mắm", "Tiêu Bột"],
    ans: "Đường Cát 🍬",
    hint: "Hạt màu trắng vị ngọt tinh khiết!"
  },
  {
    q: "Con ong chăm chỉ bay lượn trên vườn hoa để hút thứ gì ngọt ngào?",
    opts: ["Mật Hoa 🍯", "Nước Mưa", "Lá Cây", "Phấn Đất"],
    ans: "Mật Hoa 🍯",
    hint: "Thứ tinh túy biến thành mật ong thơm phức!"
  },
  {
    q: "Bánh gì hình tam giác xếp tầng phủ kem dâu thơm lừng?",
    opts: ["Bánh Kem Dâu 🍰", "Bánh Tráng Trộn", "Bánh Cuốn", "Bánh Bèo"],
    ans: "Bánh Kem Dâu 🍰",
    hint: "Cắt từ chiếc bánh sinh nhật hình tròn!"
  }
];

// VÒNG 2: TOÁN KẸO HÌNH HỌC SIÊU DỄ (Cộng trừ vui mắt, số tròn chục nhỏ)
const ROUND2_QUESTIONS = [
  {
    q: "🍬 + 🍬 = 10 viên. Hỏi 🍬 bằng mấy viên kẹo?",
    opts: ["5 viên 🍬", "4 viên", "6 viên", "8 viên"],
    ans: "5 viên 🍬",
    hint: "10 chia đều cho 2 viên bằng mấy nhỉ?"
  },
  {
    q: "🍓 + 🍓 + 🍓 = 15 quả dâu. Hỏi 1 quả 🍓 bằng mấy?",
    opts: ["5", "3", "4", "6"],
    ans: "5",
    hint: "Ba số giống nhau cộng lại bằng 15!"
  },
  {
    q: "Bạn có 8 chiếc kẹo mút 🍭, bạn ăn mất 3 chiếc. Còn lại mấy chiếc?",
    opts: ["5 chiếc 🍭", "4 chiếc", "6 chiếc", "7 chiếc"],
    ans: "5 chiếc 🍭",
    hint: "8 trừ đi 3 bằng bao nhiêu?"
  },
  {
    q: "🍩 + 5 = 12 chiếc bánh. Hỏi 🍩 bằng mấy?",
    opts: ["7", "6", "8", "9"],
    ans: "7",
    hint: "Lấy 12 trừ đi 5 là ra kết quả ngay!"
  },
  {
    q: "Một hộp có 4 viên kẹo đỏ 🔴 và 6 viên kẹo hồng 💖. Tổng cộng có mấy viên?",
    opts: ["10 viên", "9 viên", "11 viên", "12 viên"],
    ans: "10 viên",
    hint: "4 cộng 6 là một số tròn chục!"
  },
  {
    q: "🍫 Socola thanh có 6 miếng, bẻ chia đôi cho bạn 1 nửa. Bạn được mấy miếng?",
    opts: ["3 miếng", "2 miếng", "4 miếng", "1 miếng"],
    ans: "3 miếng",
    hint: "Một nửa của 6 là bao nhiêu?"
  },
  {
    q: "🧁 Cupcake: 3 cái + 3 cái + 3 cái = bao nhiêu cái?",
    opts: ["9 cái 🧁", "6 cái", "8 cái", "10 cái"],
    ans: "9 cái 🧁",
    hint: "3 lần 3 là mấy?"
  },
  {
    q: "Bé có 20 viên kẹo dẻo 🐻, bé tặng 10 viên cho mẹ. Bé còn lại mấy viên?",
    opts: ["10 viên", "5 viên", "12 viên", "15 viên"],
    ans: "10 viên",
    hint: "20 bớt đi 10 còn lại bao nhiêu?"
  },
  {
    q: "🍒 + 🍒 = 8. Vậy 🍒 + 2 = mấy?",
    opts: ["6", "4", "7", "8"],
    ans: "6",
    hint: "🍒 = 4, cộng thêm 2 nữa!"
  },
  {
    q: "Có 5 hộp kẹo, mỗi hộp chứa 2 viên kẹo dâu. Tổng có bao nhiêu viên kẹo?",
    opts: ["10 viên", "8 viên", "12 viên", "7 viên"],
    ans: "10 viên",
    hint: "5 nhân 2 bằng bao nhiêu?"
  }
];

// VÒNG 3: ĐOÁN MÓN NGON XỨ KẸO (Bánh kẹo tuổi thơ & ẩm thực ngọt ngào)
const ROUND3_QUESTIONS = [
  {
    q: "Kẹo gì nổi tiếng ở Bến Tre, thơm lừng vị nước cốt béo ngậy?",
    opts: ["Kẹo Dừa 🥥", "Kẹo Lạc", "Kẹo Bạc Hà", "Kẹo Dâu"],
    ans: "Kẹo Dừa 🥥",
    hint: "Được gói bằng giấy bánh tráng ăn được luôn!"
  },
  {
    q: "Loại bánh ngọt nhỏ nhắn trong cốc giấy phủ kem màu hồng xinh xắn gọi là?",
    opts: ["Cupcake 🧁", "Bánh Bao", "Bánh Tiêu", "Bánh Dày"],
    ans: "Cupcake 🧁",
    hint: "Bánh nướng nhỏ đựng vừa trong chiếc cốc giấy!"
  },
  {
    q: "Bánh gì của nước Pháp gồm hai nửa tròn kẹp lớp kem mềm, nhiều màu pastel?",
    opts: ["Bánh Macaron 🥮", "Bánh Mì Kẹp", "Bánh Xèo", "Bánh Khọt"],
    ans: "Bánh Macaron 🥮",
    hint: "Chiếc bánh tròn xinh xắn lãng mạn như nước Pháp!"
  },
  {
    q: "Thạch gì trong veo mát lạnh ăn vào mùa hè giòn giòn sần sật?",
    opts: ["Thạch Rau Câu 🍮", "Bánh Bông Lan", "Bánh Chưng", "Bánh Gai"],
    ans: "Thạch Rau Câu 🍮",
    hint: "Nấu từ bột rau câu hoa quả nhiều tầng rực rỡ!"
  },
  {
    q: "Kẹo gì dẻo quẹo kéo dài từ đường mạch nha cuộn đậu phộng giòn tan?",
    opts: ["Kẹo Kéo 🍬", "Kẹo Mút", "Kẹo Bông", "Kẹo Cay"],
    ans: "Kẹo Kéo 🍬",
    hint: "'Cô nào chồng bỏ chồng chê, ăn cây kẹo kéo chồng mê tới già'!"
  },
  {
    q: "Bánh gì tròn dẹt nướng vàng rộm có mè rang và gừng ngào đường ở miền Trung?",
    opts: ["Kẹo Cu-đơ 🥜", "Kẹo Bông", "Kẹo Dừa", "Bánh Bò"],
    ans: "Kẹo Cu-đơ 🥜",
    hint: "Đặc sản nức tiếng Hà Tĩnh kẹp giữa hai miếng bánh tráng!"
  },
  {
    q: "Món kẹo dẻo hình con vật nào được trẻ em toàn thế giới yêu thích nhất?",
    opts: ["Gấu Kẹo Dẻo 🐻", "Cá Sấu", "Sư Tử", "Hươu Cao Cổ"],
    ans: "Gấu Kẹo Dẻo 🐻",
    hint: "Gummy Bear nổi tiếng trong suốt!"
  },
  {
    q: "Bánh xốp giòn tan có từng ô vuông đều tăm tắp rưới mật ong thơm phức?",
    opts: ["Bánh Waffle 🧇", "Bánh Rán", "Bánh Trôi", "Bánh Chay"],
    ans: "Bánh Waffle 🧇",
    hint: "Bánh quế tổ ong nướng nóng hổi ăn sáng!"
  }
];

// VÒNG 4: TINH MẮT BẮT KẸO (Câu hỏi loại trừ siêu vui, phản xạ 1 chạm)
const ROUND4_QUESTIONS = [
  {
    q: "Món nào sau đây KHÔNG PHẢI là món ngọt?",
    opts: ["Cá Kho Tộ 🐟", "Kem Vani 🍦", "Chè Bưởi 🥣", "Kẹo Mút 🍭"],
    ans: "Cá Kho Tộ 🐟",
    hint: "Món mặn ăn với cơm mẹ nấu mỗi ngày!"
  },
  {
    q: "Màu nào sau đây là màu của Trái Dâu Tây chín mọng ngọt lịm?",
    opts: ["Màu Đỏ Hồng 🍓", "Màu Xanh Lá", "Màu Tím Thẫm", "Màu Đen Thui"],
    ans: "Màu Đỏ Hồng 🍓",
    hint: "Màu sắc quả dâu tây chín đỏ au hấp dẫn!"
  },
  {
    q: "Trái cây nào sau đây có vị ngọt lịm như mật, ruột vàng ươm?",
    opts: ["Quả Xoài Chín 🥭", "Quả Mướp Đắng", "Quả Khế Chua", "Quả Ớt Cay"],
    ans: "Quả Xoài Chín 🥭",
    hint: "Mùi thơm lừng mùa hè ngọt mát!"
  },
  {
    q: "Trong các vị kẹo sau, vị nào tạo cảm giác mát lạnh thơm the sảng khoái?",
    opts: ["Vị Bạc Hà 🌿", "Vị Ớt Cay", "Vị Tiêu Đen", "Vị Nước Mắm"],
    ans: "Vị Bạc Hà 🌿",
    hint: "Ăn vào the the mát lạnh cổ họng!"
  },
  {
    q: "Đâu là thức uống ấm áp thường uống vào mùa đông có bọt marshmallow?",
    opts: ["Cacao Nóng ☕", "Nước Chanh Đá", "Nước Canh Chua", "Nước Khoáng Có Ga"],
    ans: "Cacao Nóng ☕",
    hint: "Ly socola sữa nóng thơm ngọt ngào!"
  },
  {
    q: "Hạt gì giòn bùi thường được bọc socola làm kẹo sang trọng?",
    opts: ["Hạt Hạnh Nhân 🌰", "Hạt Ớt", "Hạt Cơm", "Hạt Tiêu"],
    ans: "Hạt Hạnh Nhân 🌰",
    hint: "Hạt dẻ, hạnh nhân hoặc hạt điều giòn tan!"
  }
];

// VÒNG 5: TRẬN CHIẾN BOSS CUỐI (Combo 3 đòn tấn công liên hoàn siêu tốc)
const ROUND5_COMBOS = [
  {
    bossTitle: "👑 Nữ Hoàng Kẹo Bông (Final Boss)",
    steps: [
      {
        q: "⚡ Đòn 1: Nước cốt của cây gì được dùng để nấu thành đường phèn ngọt thanh?",
        opts: ["Cây Mía 🎋", "Cây Tre", "Cây Chuối", "Cây Dừa"],
        ans: "Cây Mía 🎋"
      },
      {
        q: "⚡ Đòn 2: 10 viên kẹo dâu + 10 viên kẹo socola = bao nhiêu viên kẹo?",
        opts: ["20 viên 🍬", "15 viên", "25 viên", "30 viên"],
        ans: "20 viên 🍬"
      },
      {
        q: "⚡ Đòn 3: Vương Quốc Kẹo trao chiếc cúp Vàng danh dự cho ai?",
        opts: ["Người Giỏi Nhất! 🏆", "Người Bỏ Cuộc", "Người Ngủ Quên", "Không Cho Ai"],
        ans: "Người Giỏi Nhất! 🏆"
      }
    ]
  },
  {
    bossTitle: "👑 Nữ Hoàng Kẹo Bông (Final Boss)",
    steps: [
      {
        q: "⚡ Đòn 1: Màu sắc chủ đạo ngọt ngào nhất của Vương Quốc Kẹo là màu gì?",
        opts: ["Màu Hồng Pastel 💖", "Màu Xám Tro", "Màu Nâu Đất", "Màu Xanh Đen"],
        ans: "Màu Hồng Pastel 💖"
      },
      {
        q: "⚡ Đòn 2: Có 12 chiếc bánh cupcake, ăn mất 2 chiếc thì còn mấy chiếc?",
        opts: ["10 chiếc 🧁", "8 chiếc", "9 chiếc", "11 chiếc"],
        ans: "10 chiếc 🧁"
      },
      {
        q: "⚡ Đòn 3: Trái tim của Di Sản Kẹo Ngọt tượng trưng cho điều gì?",
        opts: ["Niềm Vui & Hạnh Phúc! ✨", "Sự Giận Dữ", "Nỗi Buồn Bã", "Sự Cô Đơn"],
        ans: "Niềm Vui & Hạnh Phúc! ✨"
      }
    ]
  }
];

// ─── THÔNG TIN BOSS TỪNG VÒNG ──────────────────────────────
const BOSS_DATA = [
  {
    name: "🍭 Kẹo Mút Khổng Lồ",
    title: "Chúa Tể Kẹo Mút Ngọt Ngào",
    subtitle: "Vòng 1: Đố Vui Kẹo Ngọt Siêu Vui",
    maxHp: 1000,
    color: "#FF69B4",
    emoji: "🍭",
    dialogue: "Hahaha! Muốn qua ải của ta, hãy trả lời câu đố ngọt ngào này!"
  },
  {
    name: "🍩 Vua Bánh Donut",
    title: "Vua Bánh Vòng Socola",
    subtitle: "Vòng 2: Toán Kẹo Hình Học Cực Dễ",
    maxHp: 1500,
    color: "#FF8FAB",
    emoji: "🍩",
    dialogue: "Đừng đùa với ta! Hãy tính xem có bao nhiêu viên kẹo thơm ngon!"
  },
  {
    name: "🧁 Đại Hầu Tước Cupcake",
    title: "Bậc Thầy Bánh Kem Cầu Vồng",
    subtitle: "Vòng 3: Đoán Tên Món Ngon Xứ Kẹo",
    maxHp: 2000,
    color: "#FB6F92",
    emoji: "🧁",
    dialogue: "Ta là chuyên gia ẩm thực ngọt ngào! Hãy đoán xem món gì đây!"
  },
  {
    name: "🐻 Chúa Tể Kẹo Gummy",
    title: "Gấu Kẹo Dẻo Khổng Lồ",
    subtitle: "Vòng 4: Nhanh Tay Tinh Mắt Bắt Kẹo",
    maxHp: 2500,
    color: "#FF4D94",
    emoji: "🐻",
    dialogue: "Phản xạ của bạn có nhanh bằng cú nhảy của ta không?!"
  },
  {
    name: "👑 Nữ Hoàng Kẹo Bông",
    title: "Nữ Vương Di Sản Tối Cao",
    subtitle: "Vòng 5: Đại Quyết Đấu Di Sản Kẹo",
    maxHp: 3500,
    color: "#E60073",
    emoji: "👑",
    dialogue: "Chỉ người thông thái và nhanh nhất mới xứng đáng chạm vào Di Sản!"
  }
];

// ─── HÀM RANDOM HỖ TRỢ ──────────────────────────────────────
function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function shuffleArray(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ─── TẠO BỘ CÂU ĐỐ CHO TỪNG NGƯỜI CHƠI ──────────────────────
function generatePuzzlesForPlayer(playerName, roundIndex) {
  const seed = hashString(playerName + '_r' + roundIndex + '_v3_candy');
  const rng = seededRandom(seed);

  if (roundIndex === 0) {
    const idx = Math.floor(rng() * ROUND1_QUESTIONS.length);
    const item = ROUND1_QUESTIONS[idx];
    return {
      type: 'quiz',
      question: item.q,
      options: shuffleArray(item.opts, rng),
      answer: item.ans,
      hint: item.hint
    };
  } else if (roundIndex === 1) {
    const idx = Math.floor(rng() * ROUND2_QUESTIONS.length);
    const item = ROUND2_QUESTIONS[idx];
    return {
      type: 'math',
      question: item.q,
      options: shuffleArray(item.opts, rng),
      answer: item.ans,
      hint: item.hint
    };
  } else if (roundIndex === 2) {
    const idx = Math.floor(rng() * ROUND3_QUESTIONS.length);
    const item = ROUND3_QUESTIONS[idx];
    return {
      type: 'treat',
      question: item.q,
      options: shuffleArray(item.opts, rng),
      answer: item.ans,
      hint: item.hint
    };
  } else if (roundIndex === 3) {
    const idx = Math.floor(rng() * ROUND4_QUESTIONS.length);
    const item = ROUND4_QUESTIONS[idx];
    return {
      type: 'reflex',
      question: item.q,
      options: shuffleArray(item.opts, rng),
      answer: item.ans,
      hint: item.hint
    };
  } else {
    const comboIdx = Math.floor(rng() * ROUND5_COMBOS.length);
    const combo = ROUND5_COMBOS[comboIdx];
    const steps = combo.steps.map(step => ({
      question: step.q,
      options: shuffleArray(step.opts, rng),
      answer: step.ans
    }));
    return {
      type: 'final_boss',
      bossTitle: combo.bossTitle,
      steps: steps,
      hint: "Hãy bình tĩnh trả lời từng câu để tung 3 đòn chí mạng hạ gục Boss!"
    };
  }
}

// ─── SCORING & TÍNH ĐIỂM ───────────────────────────────────
function calculateScore(roundIndex, timeMs, correct, hintsUsed, stepsCorrect) {
  if (!correct && stepsCorrect === undefined) return 0;

  const timeLimit = ROUND_TIME_LIMITS[roundIndex] * 1000;
  const base = BASE_POINTS[roundIndex];

  // Thưởng tốc độ: càng nhanh càng được nhiều điểm (tối đa x2 điểm base)
  const speedRatio = Math.max(0, 1 - (timeMs / timeLimit));
  const speedBonus = Math.floor(base * speedRatio);

  const penalty = (hintsUsed || 0) * HINT_PENALTY;

  if (stepsCorrect !== undefined) {
    const stepRatio = stepsCorrect / 3;
    const earned = Math.floor(base * stepRatio) + Math.floor(speedBonus * stepRatio) - penalty;
    return Math.max(50, earned);
  }

  return Math.max(50, base + speedBonus - penalty);
}

function getLeaderboard() {
  const players = Object.values(gameState.players);
  const sorted = players
    .map(p => ({
      name: p.name,
      totalPoints: p.totalPoints,
      roundScores: p.roundScores,
      roundTimes: p.roundTimes,
      comboStreak: p.comboStreak || 0
    }))
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      const aTime = a.roundTimes.reduce((s, t) => s + t, 0);
      const bTime = b.roundTimes.reduce((s, t) => s + t, 0);
      return aTime - bTime;
    });

  sorted.forEach((p, i) => {
    p.rank = i + 1;
    if (i === 0) p.prize = '🥇 Giải Nhất';
    else if (i <= 2) p.prize = '🥈 Giải Nhì';
    else if (i <= 5) p.prize = '🥉 Giải Ba';
    else p.prize = '🎖️ Hoàn Thành';
  });

  return sorted;
}

// ─── SOCKET.IO EVENTS ──────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Kết nối: ${socket.id}`);

  // Tham gia phòng
  socket.on('join-room', ({ playerName, password }) => {
    if (!playerName || !playerName.trim()) {
      socket.emit('error-msg', { message: 'Vui lòng nhập tên của bạn!' });
      return;
    }

    if (password !== ROOM_PASSWORD) {
      socket.emit('error-msg', { message: 'Mật khẩu chưa chính xác! Hãy nhập ABC13' });
      return;
    }

    if (gameState.phase !== 'WAITING') {
      socket.emit('error-msg', { message: 'Trò chơi đang diễn ra! Hãy đợi ván tiếp theo nhé.' });
      return;
    }

    const existingNames = Object.values(gameState.players).map(p => p.name.toLowerCase());
    if (existingNames.includes(playerName.trim().toLowerCase())) {
      socket.emit('error-msg', { message: 'Tên này đã có người đặt, bạn chọn tên khác nhé!' });
      return;
    }

    const isHost = Object.keys(gameState.players).length === 0;

    gameState.players[socket.id] = {
      id: socket.id,
      name: playerName.trim(),
      isHost,
      totalPoints: 0,
      roundScores: [],
      roundTimes: [],
      hintsUsed: [],
      comboStreak: 0,
      currentPuzzle: null,
      currentRoundAnswered: false
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

    socket.broadcast.emit('player-joined', {
      playerName: playerName.trim(),
      playerCount: playerList.length,
      players: playerList
    });

    console.log(`👤 ${playerName} đã vào phòng (${isHost ? 'HOST' : 'Player'}). Tổng: ${playerList.length}`);
  });

  // Bắt đầu game (Host)
  socket.on('host-start', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.isHost) {
      socket.emit('error-msg', { message: 'Chỉ có Chủ phòng mới có quyền bắt đầu!' });
      return;
    }

    gameState.phase = 'COUNTDOWN';
    gameState.currentRound = 0;

    let countdown = 4;
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

    console.log(`🎮 Game bắt đầu bởi Host ${player.name}`);
  });

  // Gửi câu trả lời
  socket.on('submit-answer', ({ roundIndex, answer, timeMs }) => {
    const player = gameState.players[socket.id];
    if (!player || gameState.phase !== 'PLAYING') return;
    if (player.currentRoundAnswered) return;

    const puzzle = player.currentPuzzle;
    if (!puzzle) return;

    let correct = false;
    let stepsCorrect = 0;

    if (puzzle.type === 'final_boss') {
      const answers = Array.isArray(answer) ? answer : [answer];
      puzzle.steps.forEach((st, idx) => {
        if ((answers[idx] || '').trim() === st.answer) {
          stepsCorrect++;
        }
      });
      correct = stepsCorrect === puzzle.steps.length;
    } else {
      correct = (answer || '').trim() === puzzle.answer;
    }

    if (correct) {
      player.comboStreak = (player.comboStreak || 0) + 1;
    } else {
      player.comboStreak = 0;
    }

    const hintsUsed = player.hintsUsed[roundIndex] || 0;
    const points = calculateScore(roundIndex, timeMs, correct, hintsUsed, stepsCorrect);

    player.totalPoints += points;
    player.roundScores[roundIndex] = points;
    player.roundTimes[roundIndex] = timeMs;
    player.currentRoundAnswered = true;

    // Gửi thông báo tấn công Boss tới toàn phòng để tạo hiệu ứng hào hứng
    io.emit('boss-hit', {
      playerName: player.name,
      damage: points,
      correct,
      comboStreak: player.comboStreak
    });

    socket.emit('answer-result', {
      correct,
      points,
      totalPoints: player.totalPoints,
      comboStreak: player.comboStreak,
      correctAnswer: correct ? null : (puzzle.type === 'final_boss' ? puzzle.steps.map(s => s.answer) : puzzle.answer)
    });

    // Kiểm tra xem tất cả người chơi đã trả lời xong chưa
    const allAnswered = Object.values(gameState.players).every(p => p.currentRoundAnswered);
    if (allAnswered) {
      endRound();
    }
  });

  // Yêu cầu gợi ý
  socket.on('request-hint', ({ roundIndex }) => {
    const player = gameState.players[socket.id];
    if (!player || gameState.phase !== 'PLAYING') return;

    if (!player.hintsUsed[roundIndex]) player.hintsUsed[roundIndex] = 0;
    if (player.hintsUsed[roundIndex] >= MAX_HINTS_PER_ROUND) {
      socket.emit('error-msg', { message: 'Bạn đã dùng gợi ý của vòng này rồi!' });
      return;
    }

    const puzzle = player.currentPuzzle;
    if (!puzzle) return;

    player.hintsUsed[roundIndex]++;
    socket.emit('hint-result', {
      hint: puzzle.hint || 'Hãy chọn đáp án bạn cảm thấy ngọt ngào và hợp lý nhất!',
      hintsRemaining: 0,
      pointsPenalty: HINT_PENALTY
    });
  });

  // Reset Game
  socket.on('host-reset', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.isHost) return;

    if (gameState.roundTimer) clearTimeout(gameState.roundTimer);
    if (gameState.countdownTimer) clearInterval(gameState.countdownTimer);

    io.emit('game-reset', {});
    resetGame();
    console.log('🔄 Game reset');
  });

  // Mất kết nối
  socket.on('disconnect', () => {
    const player = gameState.players[socket.id];
    if (player) {
      console.log(`👋 ${player.name} đã rời phòng`);
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

      io.emit('player-left', {
        playerName: player.name,
        playerCount: playerList.length,
        players: playerList
      });
    }
  });
});

// ─── QUẢN LÝ VÒNG ĐẤU (ROUND MANAGEMENT) ───────────────────
function startRound(roundIndex) {
  gameState.phase = 'PLAYING';
  gameState.currentRound = roundIndex;
  gameState.roundStartTime = Date.now();

  const boss = BOSS_DATA[roundIndex];
  const timeLimit = ROUND_TIME_LIMITS[roundIndex];

  Object.values(gameState.players).forEach(player => {
    player.currentRoundAnswered = false;
    const puzzle = generatePuzzlesForPlayer(player.name, roundIndex);
    player.currentPuzzle = puzzle;

    // Giữ bí mật đáp án gửi về client
    const puzzleClient = JSON.parse(JSON.stringify(puzzle));
    delete puzzleClient.answer;
    delete puzzleClient.hint;
    if (puzzleClient.steps) {
      puzzleClient.steps.forEach(s => delete s.answer);
    }

    io.to(player.id).emit('round-start', {
      roundIndex,
      boss,
      puzzle: puzzleClient,
      timeLimit,
      maxPoints: BASE_POINTS[roundIndex] * 2
    });
  });

  // Hết giờ tự động kết thúc vòng
  gameState.roundTimer = setTimeout(() => {
    Object.values(gameState.players).forEach(player => {
      if (!player.currentRoundAnswered) {
        player.currentRoundAnswered = true;
        player.roundScores[roundIndex] = 0;
        player.roundTimes[roundIndex] = timeLimit * 1000;
        player.comboStreak = 0;

        io.to(player.id).emit('answer-result', {
          correct: false,
          points: 0,
          totalPoints: player.totalPoints,
          timeout: true,
          correctAnswer: player.currentPuzzle?.answer
        });
      }
    });
    endRound();
  }, timeLimit * 1000);

  console.log(`⚔️ Vòng ${roundIndex + 1}: ${boss.name} bắt đầu!`);
}

function endRound() {
  if (gameState.roundTimer) {
    clearTimeout(gameState.roundTimer);
    gameState.roundTimer = null;
  }

  const leaderboard = getLeaderboard();
  io.emit('round-end', {
    roundIndex: gameState.currentRound,
    leaderboard
  });

  console.log(`✅ Kết thúc vòng ${gameState.currentRound + 1}. Top 1: ${leaderboard[0]?.name} (${leaderboard[0]?.totalPoints}đ)`);

  if (gameState.currentRound < ROUND_COUNT - 1) {
    setTimeout(() => {
      startRound(gameState.currentRound + 1);
    }, 7000); // 7 giây nghỉ ngơi ăn mừng giữa các vòng
  } else {
    gameState.phase = 'FINISHED';
    io.emit('game-over', {
      finalRankings: leaderboard
    });
    console.log('🏆 Cuộc thi kết thúc! Vinh danh người chiến thắng!');
  }
}

// ─── START SERVER ──────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🍭 ═══════════════════════════════════════════`);
  console.log(`   CANDY KINGDOM: TÌM KIẾM DI SẢN (3D ARENA)`);
  console.log(`   Cổng: ${PORT} | Mật khẩu: ${ROOM_PASSWORD}`);
  console.log(`🍭 ═══════════════════════════════════════════\n`);
});
