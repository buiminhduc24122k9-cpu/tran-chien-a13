/* ============================================================
   🍭 CANDY KINGDOM: TÌM KIẾM DI SẢN
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
const ROUND_TIME_LIMITS = [60, 75, 90, 90, 120]; // seconds per round
const BASE_POINTS = [200, 300, 400, 500, 600];
const MAX_HINTS_PER_ROUND = 2;
const HINT_PENALTY = 50;

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

// ─── VIETNAMESE PUZZLE DATA ────────────────────────────────

const VIETNAMESE_SENTENCES = [
  'hạnh phúc là khi bạn tìm thấy điều mình yêu thương',
  'con đường ngàn dặm bắt đầu từ một bước chân nhỏ',
  'mỗi ngày là một cơ hội mới để tỏa sáng rực rỡ',
  'trái tim dũng cảm sẽ luôn tìm được lối đi riêng',
  'nụ cười là ngôn ngữ đẹp nhất trên thế giới này',
  'hãy là phiên bản tốt nhất của chính mình mỗi ngày',
  'sức mạnh thật sự đến từ sự kiên nhẫn và nỗ lực',
  'tình bạn chân thành là kho báu quý giá nhất đời',
  'ước mơ lớn bắt đầu từ những hành động nhỏ hàng ngày',
  'ánh sáng luôn xuất hiện sau cơn mưa bão dữ dội',
  'cuộc sống tươi đẹp khi ta biết trân trọng từng phút giây',
  'người chiến thắng không bao giờ bỏ cuộc trên hành trình',
  'đằng sau mỗi thành công là hàng ngàn giờ luyện tập',
  'hãy đối xử với mọi người bằng lòng tốt và sự thấu hiểu',
  'tri thức là ánh đèn soi sáng con đường tương lai',
  'sự sáng tạo là sức mạnh thay đổi thế giới quanh ta',
  'mỗi thất bại là bài học quý giá trên đường đời',
  'niềm tin vào bản thân là chìa khóa mở mọi cánh cửa',
  'hãy sống hết mình với đam mê và khát vọng lớn lao',
  'tương lai thuộc về những ai dám ước mơ và hành động'
];

const PATTERN_SEQUENCES = [
  { seq: [2, 6, 18, 54], answer: '162', rule: 'x3' },
  { seq: [3, 7, 15, 31], answer: '63', rule: 'x2+1' },
  { seq: [1, 4, 9, 16], answer: '25', rule: 'n²' },
  { seq: [5, 8, 13, 20], answer: '29', rule: '+3,+5,+7,+9' },
  { seq: [1, 1, 2, 3, 5], answer: '8', rule: 'fibonacci' },
  { seq: [2, 3, 5, 7, 11], answer: '13', rule: 'primes' },
  { seq: [100, 95, 85, 70], answer: '50', rule: '-5,-10,-15,-20' },
  { seq: [1, 3, 7, 15, 31], answer: '63', rule: '2^n - 1' },
  { seq: [4, 9, 16, 25, 36], answer: '49', rule: '(n+1)²' },
  { seq: [1, 8, 27, 64], answer: '125', rule: 'n³' },
  { seq: [2, 5, 10, 17, 26], answer: '37', rule: 'n²+1' },
  { seq: [3, 6, 11, 18, 27], answer: '38', rule: 'n²+2' },
  { seq: [1, 2, 4, 8, 16], answer: '32', rule: 'x2' },
  { seq: [10, 21, 43, 87], answer: '175', rule: 'x2+1' },
  { seq: [0, 1, 3, 6, 10], answer: '15', rule: 'triangular' },
  { seq: [2, 6, 12, 20, 30], answer: '42', rule: 'n(n+1)' },
  { seq: [7, 11, 19, 35], answer: '67', rule: 'x2-3' },
  { seq: [99, 92, 78, 57], answer: '29', rule: '-7,-14,-21,-28' },
  { seq: [1, 4, 10, 22, 46], answer: '94', rule: 'x2+2' },
  { seq: [5, 10, 20, 40, 80], answer: '160', rule: 'x2' }
];

const LOGIC_PUZZLES_VN = [
  {
    question: 'Trong Vương Quốc Kẹo: Kẹo Đỏ ngọt hơn Kẹo Xanh. Kẹo Vàng ngọt hơn Kẹo Đỏ. Kẹo Tím ít ngọt nhất. Hỏi kẹo nào ngọt nhất?',
    options: ['Kẹo Đỏ', 'Kẹo Xanh', 'Kẹo Vàng', 'Kẹo Tím'],
    answer: 'Kẹo Vàng'
  },
  {
    question: 'Có 5 lọ kẹo. Lọ A nặng hơn lọ B. Lọ C nhẹ hơn lọ B. Lọ D nặng hơn lọ A. Lọ E nhẹ hơn lọ C. Lọ nào nặng nhất?',
    options: ['Lọ A', 'Lọ B', 'Lọ C', 'Lọ D'],
    answer: 'Lọ D'
  },
  {
    question: 'Nếu tất cả Bánh Quy đều tròn, và một số thứ tròn là Kẹo Mút, thì có chắc chắn rằng một số Bánh Quy là Kẹo Mút không?',
    options: ['Chắc chắn đúng', 'Không chắc chắn', 'Chắc chắn sai', 'Thiếu dữ kiện'],
    answer: 'Không chắc chắn'
  },
  {
    question: 'Ba bạn Lan, Mai, Hoa mỗi người thích 1 loại kẹo: sô-cô-la, kẹo bông, kẹo dẻo. Lan không thích sô-cô-la. Mai không thích kẹo bông và sô-cô-la. Hoa thích loại gì?',
    options: ['Sô-cô-la', 'Kẹo bông', 'Kẹo dẻo', 'Không xác định'],
    answer: 'Sô-cô-la'
  },
  {
    question: 'Trong 1 hộp có 3 kẹo đỏ, 5 kẹo xanh, 2 kẹo vàng. Lấy ngẫu nhiên, cần lấy ít nhất bao nhiêu viên để chắc chắn có 2 viên cùng màu?',
    options: ['2', '3', '4', '5'],
    answer: '4'
  },
  {
    question: 'Một cửa hàng kẹo giảm giá 20%, sau đó giảm thêm 10% trên giá đã giảm. Hỏi tổng giảm giá là bao nhiêu %?',
    options: ['30%', '28%', '25%', '32%'],
    answer: '28%'
  },
  {
    question: 'Nếu hôm nay là thứ Tư, thì 100 ngày sau là thứ mấy?',
    options: ['Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'],
    answer: 'Thứ Sáu'
  },
  {
    question: 'Có 8 viên kẹo giống hệt nhau, trong đó 1 viên nhẹ hơn. Dùng cân thăng bằng, cần ít nhất mấy lần cân để tìm ra viên nhẹ?',
    options: ['1', '2', '3', '4'],
    answer: '2'
  },
  {
    question: 'An có gấp đôi số kẹo của Bình. Bình có nhiều hơn Chi 3 viên. Chi có 5 viên. Hỏi An có bao nhiêu viên?',
    options: ['13', '16', '10', '15'],
    answer: '16'
  },
  {
    question: 'Một bánh kẹo hình tròn được cắt bằng 4 đường thẳng. Hỏi số miếng nhiều nhất có thể cắt được là bao nhiêu?',
    options: ['8', '10', '11', '12'],
    answer: '11'
  },
  {
    question: 'Kim đồng hồ chỉ 3 giờ. Góc giữa kim giờ và kim phút là bao nhiêu độ?',
    options: ['60°', '90°', '120°', '180°'],
    answer: '90°'
  },
  {
    question: 'Một ốc sên leo cột cao 10m. Mỗi ngày leo 3m, đêm trượt 2m. Hỏi sau bao nhiêu ngày ốc sên lên đỉnh?',
    options: ['7', '8', '9', '10'],
    answer: '8'
  },
  {
    question: 'Số nào tiếp theo: 1, 11, 21, 1211, ?',
    options: ['111221', '12211', '22111', '1221'],
    answer: '111221'
  },
  {
    question: 'Có 3 hộp ghi sai nhãn: "Kẹo Đỏ", "Kẹo Xanh", "Hỗn Hợp". Lấy 1 viên từ hộp nào để biết tất cả?',
    options: ['Kẹo Đỏ', 'Kẹo Xanh', 'Hỗn Hợp', 'Bất kỳ hộp nào'],
    answer: 'Hỗn Hợp'
  },
  {
    question: 'Tìm số: ? × 7 + 5 = 54. Giá trị của ? là:',
    options: ['6', '7', '8', '9'],
    answer: '7'
  },
  {
    question: 'Một kẹo có giá 500đ. Mua 3 tặng 1. Hỏi mua 12 kẹo cần bao nhiêu tiền?',
    options: ['4500đ', '5000đ', '6000đ', '4000đ'],
    answer: '4500đ'
  },
  {
    question: 'Nếu A > B, B > C, C > D, D > E. Khi nào A < E?',
    options: ['Khi B = C', 'Khi C = D', 'Không bao giờ', 'Khi A = D'],
    answer: 'Không bao giờ'
  },
  {
    question: 'Có 5 người xếp hàng. An không đứng đầu cũng không đứng cuối. Bình đứng sau An. Có bao nhiêu cách xếp An và Bình?',
    options: ['6', '9', '12', '3'],
    answer: '9'
  },
  {
    question: 'Năm 2026, ngày 1 tháng 1 là thứ Năm. Hỏi ngày 14 tháng 2 năm 2026 là thứ mấy?',
    options: ['Thứ Bảy', 'Chủ Nhật', 'Thứ Hai', 'Thứ Sáu'],
    answer: 'Thứ Bảy'
  },
  {
    question: 'Một quả bóng rơi từ độ cao 16m, mỗi lần nảy lên bằng 1/2 lần trước. Hỏi tổng quãng đường sau 3 lần nảy?',
    options: ['40m', '44m', '46m', '48m'],
    answer: '40m'
  }
];

const RIDDLE_WORDS = [
  { word: 'CHOCOLATE', clues: ['Vị ngọt đắng hòa quyện', 'Tan chảy khi gặp hơi ấm', 'Món quà Valentine phổ biến nhất'] },
  { word: 'LOLLIPOP', clues: ['Có que cầm phía dưới', 'Tròn và nhiều màu sắc', 'Trẻ em rất yêu thích'] },
  { word: 'CARAMEL', clues: ['Đường nấu chảy thành vàng', 'Dẻo và thơm ngọt béo', 'Phủ trên bánh flan'] },
  { word: 'MARSHMALLOW', clues: ['Mềm xốp như đám mây', 'Nướng trên lửa trại', 'Trắng hồng và ngọt dịu'] },
  { word: 'GUMMY', clues: ['Dai dai dẻo dẻo vui miệng', 'Hình con gấu nổi tiếng', 'Làm từ gelatin ngọt ngào'] },
  { word: 'TAFFY', clues: ['Kéo dài ra được rất vui', 'Kẹo truyền thống bờ biển', 'Nhiều hương vị trái cây'] },
  { word: 'MACARON', clues: ['Hai nửa tròn kẹp nhân', 'Đặc sản nước Pháp xinh xắn', 'Nhiều màu pastel đáng yêu'] },
  { word: 'CUPCAKE', clues: ['Bánh nhỏ xinh trong cốc giấy', 'Phủ kem trang trí rực rỡ', 'Hoàn hảo cho tiệc sinh nhật'] },
  { word: 'DONUT', clues: ['Hình tròn có lỗ chính giữa', 'Chiên giòn phủ đường hoặc kem', 'Cảnh sát hay ăn trong phim'] },
  { word: 'WAFFLE', clues: ['Ô vuông đều trên bề mặt', 'Ăn sáng kiểu Bỉ nổi tiếng', 'Rưới mật ong hoặc siro'] },
  { word: 'COOKIE', clues: ['Giòn tan trong miệng thơm lừng', 'Ông già Noel rất thích', 'Có chấm socola bên trong'] },
  { word: 'PUDDING', clues: ['Mềm mịn như nhung mát lạnh', 'Tráng miệng kiểu Anh quốc', 'Vị vani caramel phổ biến'] },
  { word: 'BROWNIE', clues: ['Đặc sệt socola đậm đà', 'Mềm ẩm bên trong giòn ngoài', 'Vuông vức cắt từ khay lớn'] },
  { word: 'MUFFIN', clues: ['Bánh nở phồng lên đáng yêu', 'Ăn kèm cà phê buổi sáng', 'Có vị việt quất thơm ngon'] },
  { word: 'JELLYBEAN', clues: ['Nhỏ xinh hình hạt đậu ngọt', 'Rất nhiều màu sắc lung linh', 'Hàng trăm hương vị bất ngờ'] },
  { word: 'BONBON', clues: ['Kẹo viên bọc giấy xinh xắn', 'Tên gọi tiếng Pháp ngọt ngào', 'Thường có nhân mềm bên trong'] },
  { word: 'TRUFFLE', clues: ['Viên tròn phủ bột cacao', 'Socola thượng hạng đắt tiền', 'Tan mềm mịn trên đầu lưỡi'] },
  { word: 'TOFFEE', clues: ['Cứng giòn bơ đường cháy vàng', 'Kẹo truyền thống nước Anh', 'Dính răng nhưng rất nghiện'] },
  { word: 'SUNDAE', clues: ['Kem chất đống trong cốc lớn', 'Phủ siro quả cherry đỏ', 'Tên gọi theo ngày chủ nhật'] },
  { word: 'PARFAIT', clues: ['Xếp lớp kem trái cây granola', 'Hoàn hảo trong tiếng Pháp', 'Đựng trong cốc thủy tinh cao'] }
];

// ─── PUZZLE GENERATION ─────────────────────────────────────

function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function shuffleWithSeed(arr, rng) {
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

function generateCaesarPuzzle(seed) {
  const rng = seededRandom(seed);
  const idx = Math.floor(rng() * VIETNAMESE_SENTENCES.length);
  const shift = Math.floor(rng() * 10) + 3; // shift 3-12
  const original = VIETNAMESE_SENTENCES[idx];
  
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let encrypted = '';
  for (const ch of original) {
    const lower = ch.toLowerCase();
    const pos = alphabet.indexOf(lower);
    if (pos !== -1) {
      const newPos = (pos + shift) % 26;
      encrypted += ch === lower ? alphabet[newPos] : alphabet[newPos].toUpperCase();
    } else {
      encrypted += ch;
    }
  }
  
  return {
    type: 'caesar',
    encrypted,
    shift,
    answer: original,
    hints: [
      `Mỗi chữ cái được dịch chuyển đi một số vị trí trong bảng chữ cái`,
      `Số bước dịch chuyển là: ${shift}`
    ]
  };
}

function generatePatternPuzzle(seed) {
  const rng = seededRandom(seed);
  const idx = Math.floor(rng() * PATTERN_SEQUENCES.length);
  const p = PATTERN_SEQUENCES[idx];
  
  return {
    type: 'pattern',
    sequence: p.seq,
    answer: p.answer,
    rule: p.rule,
    hints: [
      `Hãy quan sát mối quan hệ giữa các số liên tiếp`,
      `Quy luật: ${p.rule}`
    ]
  };
}

function generateLogicPuzzle(seed) {
  const rng = seededRandom(seed);
  const idx = Math.floor(rng() * LOGIC_PUZZLES_VN.length);
  const p = LOGIC_PUZZLES_VN[idx];
  
  return {
    type: 'logic',
    question: p.question,
    options: shuffleWithSeed(p.options, rng),
    answer: p.answer,
    hints: [
      `Hãy loại trừ những đáp án không hợp lý trước`,
      `Đọc kỹ từng điều kiện và suy luận từng bước`
    ]
  };
}

function generateRiddlePuzzle(seed) {
  const rng = seededRandom(seed);
  const idx = Math.floor(rng() * RIDDLE_WORDS.length);
  const p = RIDDLE_WORDS[idx];
  
  // Create letter mask with some revealed
  const word = p.word;
  const revealCount = Math.max(1, Math.floor(word.length * 0.3));
  const positions = Array.from({length: word.length}, (_, i) => i);
  const revealed = shuffleWithSeed(positions, rng).slice(0, revealCount);
  
  let mask = '';
  for (let i = 0; i < word.length; i++) {
    mask += revealed.includes(i) ? word[i] : '_';
  }
  
  return {
    type: 'riddle',
    clues: p.clues,
    mask,
    wordLength: word.length,
    answer: word,
    hints: [
      `Từ này có ${word.length} chữ cái`,
      `Chữ cái đầu tiên là: ${word[0]}`
    ]
  };
}

function generateFinalPuzzle(seed) {
  const rng = seededRandom(seed);
  
  // Multi-step puzzle: decode + math + word
  const sentIdx = Math.floor(rng() * VIETNAMESE_SENTENCES.length);
  const patIdx = Math.floor(rng() * PATTERN_SEQUENCES.length);
  const riddleIdx = Math.floor(rng() * RIDDLE_WORDS.length);
  
  const shift = Math.floor(rng() * 8) + 2;
  const original = VIETNAMESE_SENTENCES[sentIdx];
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  
  // Extract a key word from the sentence (first word with >3 chars)
  const words = original.split(' ').filter(w => w.length > 3);
  const keyWord = words[Math.floor(rng() * words.length)] || words[0];
  
  let encryptedKey = '';
  for (const ch of keyWord) {
    const lower = ch.toLowerCase();
    const pos = alphabet.indexOf(lower);
    if (pos !== -1) {
      encryptedKey += alphabet[(pos + shift) % 26];
    } else {
      encryptedKey += ch;
    }
  }
  
  const pat = PATTERN_SEQUENCES[patIdx];
  const riddle = RIDDLE_WORDS[riddleIdx];
  
  return {
    type: 'final',
    steps: [
      { type: 'caesar_mini', encrypted: encryptedKey, shift, answer: keyWord },
      { type: 'pattern_mini', sequence: pat.seq, answer: pat.answer },
      { type: 'riddle_mini', clues: riddle.clues.slice(0, 2), answer: riddle.word }
    ],
    hints: [
      `Bước 1 là giải mã Caesar với bước dịch ${shift}`,
      `Mỗi bước đúng cho bạn thêm điểm thưởng`
    ]
  };
}

function generatePuzzlesForPlayer(playerName, roundIndex) {
  const baseSeed = hashString(playerName + '_round_' + roundIndex + '_2026');
  
  switch (roundIndex) {
    case 0: return generateCaesarPuzzle(baseSeed);
    case 1: return generatePatternPuzzle(baseSeed);
    case 2: return generateLogicPuzzle(baseSeed);
    case 3: return generateRiddlePuzzle(baseSeed);
    case 4: return generateFinalPuzzle(baseSeed);
    default: return generateCaesarPuzzle(baseSeed);
  }
}

// ─── BOSS NAMES ────────────────────────────────────────────
const BOSS_NAMES = [
  { name: '🍭 Kẹo Mút Khổng Lồ', subtitle: 'Vòng 1: Giải Mã Bí Ẩn' },
  { name: '🐉 Rồng Sô-cô-la', subtitle: 'Vòng 2: Tìm Quy Luật' },
  { name: '🏰 Pháo Đài Bánh Quy', subtitle: 'Vòng 3: Thử Thách Logic' },
  { name: '👾 Quái Vật Marshmallow', subtitle: 'Vòng 4: Truy Tìm Mật Khẩu' },
  { name: '👑 Nữ Hoàng Đường Phèn', subtitle: 'Vòng 5: Trận Chiến Cuối Cùng' }
];

// ─── SCORING ───────────────────────────────────────────────

function calculateScore(roundIndex, timeMs, correct, hintsUsed, stepsCorrect) {
  if (!correct && stepsCorrect === undefined) return 0;
  
  const timeLimit = ROUND_TIME_LIMITS[roundIndex] * 1000;
  const base = BASE_POINTS[roundIndex];
  
  // Time bonus: up to 2x for fastest answers
  const timeRatio = Math.max(0, 1 - (timeMs / timeLimit));
  const timeBonus = Math.floor(base * timeRatio);
  
  // Hint penalty
  const hintPenalty = (hintsUsed || 0) * HINT_PENALTY;
  
  // For final round with multiple steps
  if (stepsCorrect !== undefined) {
    const stepPoints = Math.floor(base * (stepsCorrect / 3));
    return Math.max(0, stepPoints + timeBonus - hintPenalty);
  }
  
  return Math.max(0, base + timeBonus - hintPenalty);
}

function getLeaderboard() {
  const players = Object.values(gameState.players);
  const sorted = players
    .map(p => ({
      name: p.name,
      totalPoints: p.totalPoints,
      roundScores: p.roundScores,
      roundTimes: p.roundTimes
    }))
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      // Tiebreak: total time (less is better)
      const aTime = a.roundTimes.reduce((s, t) => s + t, 0);
      const bTime = b.roundTimes.reduce((s, t) => s + t, 0);
      return aTime - bTime;
    });
  
  // Assign ranks and prizes
  sorted.forEach((p, i) => {
    p.rank = i + 1;
    if (i === 0) p.prize = '🥇 Giải Nhất';
    else if (i <= 2) p.prize = '🥈 Giải Nhì';
    else if (i <= 5) p.prize = '🥉 Giải Ba';
    else p.prize = '🎖️ Hoàn Thành';
  });
  
  return sorted;
}

// ─── SOCKET HANDLERS ───────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  // ── JOIN ROOM ──
  socket.on('join-room', ({ playerName, password }) => {
    if (!playerName || !playerName.trim()) {
      socket.emit('error-msg', { message: 'Vui lòng nhập tên của bạn!' });
      return;
    }
    
    if (password !== ROOM_PASSWORD) {
      socket.emit('error-msg', { message: 'Sai mật khẩu! Vui lòng thử lại.' });
      return;
    }
    
    if (gameState.phase !== 'WAITING') {
      socket.emit('error-msg', { message: 'Trò chơi đã bắt đầu! Vui lòng đợi ván tiếp theo.' });
      return;
    }
    
    // Check duplicate name
    const existingNames = Object.values(gameState.players).map(p => p.name.toLowerCase());
    if (existingNames.includes(playerName.trim().toLowerCase())) {
      socket.emit('error-msg', { message: 'Tên này đã có người dùng! Vui lòng chọn tên khác.' });
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
    
    console.log(`👤 ${playerName} joined (${isHost ? 'HOST' : 'player'}). Total: ${playerList.length}`);
  });

  // ── HOST START GAME ──
  socket.on('host-start', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.isHost) {
      socket.emit('error-msg', { message: 'Chỉ chủ phòng mới có thể bắt đầu!' });
      return;
    }
    
    const playerCount = Object.keys(gameState.players).length;
    if (playerCount < 1) {
      socket.emit('error-msg', { message: 'Cần ít nhất 1 người chơi!' });
      return;
    }
    
    gameState.phase = 'COUNTDOWN';
    gameState.currentRound = 0;
    
    // Countdown 5 seconds
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
    
    console.log(`🎮 Game starting with ${playerCount} players!`);
  });

  // ── SUBMIT ANSWER ──
  socket.on('submit-answer', ({ roundIndex, answer, timeMs }) => {
    const player = gameState.players[socket.id];
    if (!player || gameState.phase !== 'PLAYING') return;
    if (player.currentRoundAnswered) {
      socket.emit('error-msg', { message: 'Bạn đã trả lời vòng này rồi!' });
      return;
    }
    
    const puzzle = player.currentPuzzle;
    if (!puzzle) return;
    
    let correct = false;
    let stepsCorrect;
    
    if (puzzle.type === 'final') {
      // For final round, answer is an array
      const answers = Array.isArray(answer) ? answer : [answer];
      stepsCorrect = 0;
      puzzle.steps.forEach((step, i) => {
        const playerAns = (answers[i] || '').trim().toLowerCase();
        const correctAns = step.answer.toLowerCase();
        if (playerAns === correctAns) stepsCorrect++;
      });
      correct = stepsCorrect === puzzle.steps.length;
    } else if (puzzle.type === 'logic') {
      correct = answer.trim() === puzzle.answer;
    } else {
      correct = answer.trim().toLowerCase() === puzzle.answer.toLowerCase();
    }
    
    const hintsUsed = player.hintsUsed[roundIndex] || 0;
    const points = calculateScore(roundIndex, timeMs, correct, hintsUsed, stepsCorrect);
    
    player.totalPoints += points;
    player.roundScores[roundIndex] = points;
    player.roundTimes[roundIndex] = timeMs;
    player.currentRoundAnswered = true;
    
    socket.emit('answer-result', {
      correct,
      points,
      totalPoints: player.totalPoints,
      stepsCorrect,
      correctAnswer: correct ? null : (puzzle.type === 'final' ? puzzle.steps.map(s => s.answer) : puzzle.answer)
    });
    
    // Check if all players answered
    const allAnswered = Object.values(gameState.players).every(p => p.currentRoundAnswered);
    if (allAnswered) {
      endRound();
    }
  });

  // ── REQUEST HINT ──
  socket.on('request-hint', ({ roundIndex }) => {
    const player = gameState.players[socket.id];
    if (!player || gameState.phase !== 'PLAYING') return;
    
    if (!player.hintsUsed[roundIndex]) player.hintsUsed[roundIndex] = 0;
    
    if (player.hintsUsed[roundIndex] >= MAX_HINTS_PER_ROUND) {
      socket.emit('error-msg', { message: 'Bạn đã dùng hết gợi ý cho vòng này!' });
      return;
    }
    
    const puzzle = player.currentPuzzle;
    if (!puzzle) return;
    
    const hintIdx = player.hintsUsed[roundIndex];
    const hint = puzzle.hints[hintIdx] || 'Không còn gợi ý nào!';
    player.hintsUsed[roundIndex]++;
    
    socket.emit('hint-result', {
      hint,
      hintsRemaining: MAX_HINTS_PER_ROUND - player.hintsUsed[roundIndex],
      pointsPenalty: HINT_PENALTY
    });
  });

  // ── HOST RESET ──
  socket.on('host-reset', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.isHost) return;
    
    if (gameState.roundTimer) clearTimeout(gameState.roundTimer);
    if (gameState.countdownTimer) clearInterval(gameState.countdownTimer);
    
    io.emit('game-reset', {});
    resetGame();
    console.log('🔄 Game reset by host');
  });

  // ── DISCONNECT ──
  socket.on('disconnect', () => {
    const player = gameState.players[socket.id];
    if (player) {
      console.log(`👋 ${player.name} disconnected`);
      
      // If host disconnects, assign new host
      if (player.isHost) {
        delete gameState.players[socket.id];
        const remaining = Object.values(gameState.players);
        if (remaining.length > 0) {
          remaining[0].isHost = true;
          io.to(remaining[0].id).emit('you-are-host', {});
        }
      } else {
        delete gameState.players[socket.id];
      }
      
      const playerList = Object.values(gameState.players).map(p => ({
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

// ─── ROUND MANAGEMENT ──────────────────────────────────────

function startRound(roundIndex) {
  gameState.phase = 'PLAYING';
  gameState.currentRound = roundIndex;
  gameState.roundStartTime = Date.now();
  
  const boss = BOSS_NAMES[roundIndex];
  const timeLimit = ROUND_TIME_LIMITS[roundIndex];
  
  // Generate unique puzzle for each player
  Object.values(gameState.players).forEach(player => {
    player.currentRoundAnswered = false;
    const puzzle = generatePuzzlesForPlayer(player.name, roundIndex);
    player.currentPuzzle = puzzle;
    
    // Send puzzle to player (without answer)
    const puzzleForClient = { ...puzzle };
    delete puzzleForClient.answer;
    delete puzzleForClient.hints;
    if (puzzleForClient.steps) {
      puzzleForClient.steps = puzzleForClient.steps.map(s => {
        const sc = { ...s };
        delete sc.answer;
        return sc;
      });
    }
    
    io.to(player.id).emit('round-start', {
      roundIndex,
      boss,
      puzzle: puzzleForClient,
      timeLimit,
      maxPoints: BASE_POINTS[roundIndex] * 2
    });
  });
  
  // Auto-end round after time limit
  gameState.roundTimer = setTimeout(() => {
    // Auto-submit for players who haven't answered
    Object.values(gameState.players).forEach(player => {
      if (!player.currentRoundAnswered) {
        player.currentRoundAnswered = true;
        player.roundScores[roundIndex] = 0;
        player.roundTimes[roundIndex] = timeLimit * 1000;
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
  
  console.log(`⚔️ Round ${roundIndex + 1}: ${boss.name} started!`);
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
  
  console.log(`✅ Round ${gameState.currentRound + 1} ended. Top: ${leaderboard[0]?.name} (${leaderboard[0]?.totalPoints}pts)`);
  
  // Next round or game over
  if (gameState.currentRound < ROUND_COUNT - 1) {
    setTimeout(() => {
      startRound(gameState.currentRound + 1);
    }, 8000); // 8 second break between rounds
  } else {
    // Game over!
    gameState.phase = 'FINISHED';
    io.emit('game-over', {
      finalRankings: leaderboard
    });
    console.log('🏆 Game Over!');
    console.log('Rankings:', leaderboard.map(p => `${p.rank}. ${p.name}: ${p.totalPoints}pts ${p.prize}`).join(' | '));
  }
}

// ─── START SERVER ──────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🍭 ═══════════════════════════════════════════`);
  console.log(`   CANDY KINGDOM: TÌM KIẾM DI SẢN`);
  console.log(`   Server running on port ${PORT}`);
  console.log(`   Game password: ${ROOM_PASSWORD}`);
  console.log(`🍭 ═══════════════════════════════════════════\n`);
});
