# HGYK Backend API

## Yerel test

```bash
npm install
cp .env.example .env
# .env dosyasını aç, API anahtarını gir
npm run dev
```

Test et:
```bash
curl http://localhost:3000/
```

---

## Railway'e Deploy (Ücretsiz)

### 1. GitHub'a yükle
```bash
git init
git add .
git commit -m "ilk commit"
```

GitHub.com'da yeni repo aç → push et:
```bash
git remote add origin https://github.com/KULLANICI_ADIN/hgyk-backend.git
git push -u origin main
```

### 2. Railway hesabı aç
→ https://railway.app (GitHub ile giriş yap)

### 3. Yeni proje oluştur
- "New Project" → "Deploy from GitHub repo"
- hgyk-backend reposunu seç

### 4. Ortam değişkenlerini ekle
Railway dashboard → Variables sekmesi:
```
ANTHROPIC_API_KEY = sk-ant-xxxxxxxx
API_SECRET        = hgyk-secret-2024
PORT              = 3000
```

### 5. Deploy et
Otomatik başlar! Birkaç dakika sonra URL alırsın:
`https://hgyk-backend-xxxx.up.railway.app`

### 6. Uygulamayı güncelle
`utils/api.js` dosyasında:
```js
const BACKEND_URL = 'https://hgyk-backend-xxxx.up.railway.app';
```

---

## API Endpoints

### GET /
Sağlık kontrolü

### POST /api/words
```json
{
  "level": "B1",
  "count": 5,
  "avoid": ["hüzün", "sabır"]
}
```

### POST /api/quiz
```json
{
  "words": [...],
  "count": 5
}
```

Her istekte header gerekli:
```
x-api-secret: hgyk-secret-2024
```
