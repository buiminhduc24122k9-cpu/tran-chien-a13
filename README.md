# 🍭 Candy Kingdom: Tìm Kiếm Di Sản

> Game giải mã multiplayer trong Vương Quốc Kẹo - Chơi trên điện thoại (Android & iPhone)

## 🎮 Giới Thiệu

**Candy Kingdom: Tìm Kiếm Di Sản** là trò chơi giải mã cạnh tranh cho nhiều người chơi.
Mỗi người chơi sẽ chiến đấu qua 5 vòng (Boss Battle) với các câu đố khác nhau.
Người nhanh nhất và giỏi nhất sẽ giành chiến thắng!

### 🏆 Giải Thưởng
| Hạng | Số lượng | Giải |
|------|----------|------|
| 🥇 Nhất | 1 người | Giải Nhất |
| 🥈 Nhì | 2 người | Giải Nhì |
| 🥉 Ba | 3 người | Giải Ba |

### ⚔️ 5 Vòng Đấu (Boss Battle)
1. **🍭 Kẹo Mút Khổng Lồ** - Giải mã Caesar (60 giây)
2. **🐉 Rồng Sô-cô-la** - Tìm quy luật dãy số (75 giây)
3. **🏰 Pháo Đài Bánh Quy** - Câu đố logic (90 giây)
4. **👾 Quái Vật Marshmallow** - Đoán từ bí ẩn (90 giây)
5. **👑 Nữ Hoàng Đường Phèn** - Tổng hợp 3 thử thách (120 giây)

## 🚀 Cách Cài Đặt & Chạy

### Yêu cầu
- **Node.js** phiên bản 18 trở lên ([Tải tại đây](https://nodejs.org))

### Bước 1: Cài đặt dependencies
```bash
cd candy-kingdom-game
npm install
```

### Bước 2: Đặt mật khẩu phòng chơi
Mở file `server.js`, tìm dòng:
```javascript
const ROOM_PASSWORD = process.env.GAME_PASSWORD || 'ABC13';
```
Thay `'ABC13'` bằng mật khẩu bạn muốn.

Hoặc dùng biến môi trường:
```bash
# Windows CMD
set GAME_PASSWORD=matkhaucuaban
node server.js

# Windows PowerShell
$env:GAME_PASSWORD="matkhaucuaban"
node server.js

# Linux/Mac
GAME_PASSWORD=matkhaucuaban node server.js
```

### Bước 3: Chạy server
```bash
npm start
```

Server sẽ chạy tại `http://localhost:3000`

## 📱 Cách Chơi Trên Điện Thoại

### Chơi trong mạng LAN (cùng WiFi):
1. Tìm IP máy tính chạy server (ví dụ: `192.168.1.100`)
2. Trên điện thoại, mở trình duyệt (Chrome/Safari)
3. Truy cập: `http://192.168.1.100:3000`

### Deploy online (ai cũng truy cập được):

#### Cách 1: Render.com (Miễn phí)
1. Tạo tài khoản tại [render.com](https://render.com)
2. Đẩy code lên GitHub
3. Tạo "Web Service" mới, kết nối GitHub repo
4. Build command: `npm install`
5. Start command: `npm start`
6. Thêm Environment Variable: `GAME_PASSWORD` = mật khẩu bạn muốn

#### Cách 2: Railway.app
1. Tạo tài khoản tại [railway.app](https://railway.app)
2. Import từ GitHub
3. Thêm `GAME_PASSWORD` trong Variables
4. Deploy tự động

#### Cách 3: Glitch.com (Nhanh nhất)
1. Truy cập [glitch.com](https://glitch.com)
2. Tạo project mới → Import from GitHub
3. Thêm `GAME_PASSWORD` trong `.env`
4. Game tự động chạy

## 🎯 Hướng Dẫn Tổ Chức Sự Kiện

### Trước sự kiện:
1. Deploy game lên một trong các nền tảng trên
2. Gửi link game cho tất cả người chơi để họ tải/truy cập trước
3. **KHÔNG** gửi mật khẩu cho đến khi bắt đầu

### Khi bắt đầu:
1. Công bố mật khẩu cho tất cả người chơi cùng lúc
2. Người đầu tiên vào phòng sẽ là **Chủ phòng** (Host)
3. Chủ phòng đợi mọi người vào đủ, rồi nhấn **"Bắt Đầu Trận Đấu"**
4. Game tự động chạy qua 5 vòng

### Sau khi kết thúc:
1. Bảng xếp hạng hiển thị tự động
2. Trao giải cho Top 6 (1 Nhất, 2 Nhì, 3 Ba)

## ⚙️ Tùy Chỉnh

### Thay đổi thời gian mỗi vòng:
```javascript
// server.js
const ROUND_TIME_LIMITS = [60, 75, 90, 90, 120]; // giây
```

### Thay đổi điểm cơ bản mỗi vòng:
```javascript
// server.js
const BASE_POINTS = [200, 300, 400, 500, 600];
```

### Thay đổi số gợi ý:
```javascript
// server.js
const MAX_HINTS_PER_ROUND = 2;
const HINT_PENALTY = 50; // trừ điểm khi dùng gợi ý
```

### Thay đổi port:
```javascript
const PORT = process.env.PORT || 3000;
```

## 📝 Cách Tính Điểm

- **Điểm cơ bản**: Trả lời đúng nhận điểm cơ bản (200-600 tùy vòng)
- **Thưởng tốc độ**: Trả lời nhanh hơn = nhiều điểm hơn (tối đa x2)
- **Phạt gợi ý**: Mỗi gợi ý -50 điểm
- **Vòng cuối**: Mỗi bước đúng nhận 1/3 điểm cơ bản
- **Tổng điểm tối đa**: ~3000 điểm (nếu trả lời tất cả đúng + nhanh nhất)

## 🛡️ Bảo Mật

- Game được bảo vệ bằng mật khẩu
- Mỗi người chơi nhận câu đố khác nhau (không thể copy đáp án)
- Điểm được tính và lưu trên server (không thể hack từ client)
- Thời gian được đo từ server

## 📄 License

MIT - Tự do sử dụng cho mục đích cá nhân và tổ chức sự kiện.
