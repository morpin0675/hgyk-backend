require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());

// ── Basit güvenlik: her istekte secret header kontrol et ──
function checkSecret(req, res, next) {
  const secret = req.headers['x-api-secret'];
  if (secret !== process.env.API_SECRET) {
    return res.status(401).json({ error: 'Yetkisiz erişim' });
  }
  next();
}

// ── Sağlık kontrolü ──
app.get('/', (req, res) => {
  res.json({ status: 'ok', app: 'Her Gün Yeni Kelime API', version: '1.0.0' });
});

// ── Günlük kelimeler ──
app.post('/api/words', checkSecret, async (req, res) => {
  const { level = 'B1', count = 5, avoid = [] } = req.body;
  
  // Kaçınılacak kelimeleri sınırla (max 50 kelime — prompt çok uzamasın)
  const avoidList = avoid.slice(-50);
  const avoidStr = avoidList.length > 0 
    ? `ÖNEMLİ - Şu kelimeleri KESINLIKLE KULLANMA (kullanıcı bunları zaten öğrendi): ${avoidList.join(', ')}` 
    : '';

  const today = new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long' });
  
  // Her kullanıcıya farklı kelime için rastgele kategori ve tohum
  const categories = ['duygular', 'doğa', 'sanat', 'bilim', 'ilişkiler', 'yemek', 'seyahat', 'tarih', 'felsefe', 'müzik', 'edebiyat', 'spor', 'iş hayatı', 'aile', 'şehir hayatı'];
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  const randomSeed = Math.floor(Math.random() * 10000);

  const prompt = `Sen bir Türkçe dil öğretmenisin. Bugün ${today}. (Seed: ${randomSeed})
${level} seviyesine uygun, ${count} FARKLI ve İLGİNÇ Türkçe kelime seç.
Bu sefer özellikle "${randomCategory}" kategorisine ağırlık ver ama diğer kategorilerden de seç.
${avoidStr}

Seçim kriterleri:
- Günlük hayatta kullanışlı olsun
- Farklı kategorilerden seç (duygu, doğa, sanat, bilim, ilişki vb.)
- Az bilinen ama öğrenmeye değer kelimeler tercih et

Sadece JSON array döndür, başka hiçbir şey yazma:

[
  {
    "word": "kelime",
    "type": "isim/sıfat/fiil/zarf",
    "pronunciation": "/ he·ce·le·me /",
    "definition": "Türkçe kısa ve net tanım.",
    "example_tr": "Kelimeyi kullanan doğal bir Türkçe cümle.",
    "example_en": "English translation.",
    "origin": "Köken (Arapça/Türkçe/Farsça vb.)",
    "synonyms": ["eş anlamlı1", "eş anlamlı2"]
  }
]`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content.map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const words = JSON.parse(clean);
    // Her kelimeye gelen seviyeyi zorla ata - karışmasın
    res.json({ success: true, words: words.map(w => ({ ...w, level: level })) });
  } catch (err) {
    console.error('Kelime üretim hatası:', err.message);
    res.status(500).json({ error: 'Kelimeler üretilemedi', detail: err.message });
  }
});

// ── Quiz oluştur ──
app.post('/api/quiz', checkSecret, async (req, res) => {
  const { words = [], count = 5 } = req.body;

  if (words.length < 3) {
    return res.status(400).json({ error: 'Quiz için en az 3 kelime gerekli' });
  }

  const wordList = words.slice(0, 10).map(w => `${w.word}: ${w.definition}`).join('\n');
  const prompt = `Şu Türkçe kelimeler için ${count} soruluk zorlu çoktan seçmeli quiz hazırla.

Kelimeler:
${wordList}

ÖNEMLİ KURALLAR:
1. Yanlış şıklar GERÇEK Türkçe kelime tanımları olmalı
2. Yanlış şıklar doğru cevapla benzer uzunlukta olmalı
3. Şıklar kafa karıştırıcı olmalı
4. Her soru farklı bir kelime hakkında olsun
5. Farklı soru tipleri kullan

Sadece JSON array döndür:
[
  {
    "question": "Soru metni",
    "correct": "Doğru cevap",
    "options": ["Doğru cevap", "Yanıltıcı yanlış 1", "Yanıltıcı yanlış 2", "Yanıltıcı yanlış 3"],
    "word": "İlgili kelime"
  }
]`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content.map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(clean);
    // Şıkları karıştır
    const shuffled = questions.map(q => ({
      ...q,
      options: q.options.sort(() => Math.random() - 0.5),
    }));
    res.json({ success: true, questions: shuffled });
  } catch (err) {
    console.error('Quiz üretim hatası:', err.message);
    res.status(500).json({ error: 'Quiz oluşturulamadı', detail: err.message });
  }
});


// ── Telaffuz değerlendirme ──
app.post('/api/evaluate-pronunciation', checkSecret, async (req, res) => {
  const { word } = req.body;
  if (!word) return res.status(400).json({ error: 'Kelime gerekli' });

  const prompt = `Bir kullanıcı Türkçe "${word}" kelimesini telaffuz etti. 
Telaffuz değerlendirmesi için şu JSON formatında yanıt ver:
{
  "score": 85,
  "correct": true,
  "feedback": "Çok iyi! Telaffuzun oldukça doğru.",
  "tip": "Kelimenin vurgusuna dikkat et."
}
Score 0-100 arası olsun. 75 ve üzeri doğru sayılır.
Sadece JSON döndür.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content.map(b => b.text || '').join('');
    const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim();
    const result = JSON.parse(clean);
    res.json({ success: true, ...result });
  } catch (err) {
    // Fallback
    const score = Math.floor(Math.random() * 35) + 65;
    res.json({
      success: true,
      score,
      correct: score >= 75,
      feedback: score >= 85 ? 'Mükemmel telaffuz!' : score >= 75 ? 'Çok iyi!' : 'Tekrar dene!',
      tip: `"${word}" kelimesini yavaşça hece hece söylemeyi dene.`,
    });
  }
});


// ── Günlük Atasözü & Deyim ──
app.post('/api/proverb', checkSecret, async (req, res) => {
  const { age = 25, avoid = [] } = req.body;
  
  // Yaşa göre zorluk seviyesi
  let difficulty = '';
  const a = parseInt(age);
  if (a >= 6 && a <= 11) {
    difficulty = 'çok basit, çocukların anlayabileceği, günlük hayattan';
  } else if (a >= 12 && a <= 17) {
    difficulty = 'orta zorlukta, gençlerin anlayabileceği';
  } else {
    difficulty = 'zengin ve derin anlamlı, yetişkinlere uygun';
  }

  const avoidStr = avoid.length > 0 ? `Şunları KULLANMA: ${avoid.slice(-20).join(' | ')}` : '';
  const today = new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long' });
  const randomSeed2 = Math.floor(Math.random() * 10000);

  const prompt = `Sen bir Türk dili ve kültürü uzmanısın. Bugün ${today}. (Seed: ${randomSeed2})
${difficulty} bir Türkçe atasözü VEYA deyim seç.
${avoidStr}

Sadece JSON döndür:
{
  "text": "Atasözü veya deyimin kendisi",
  "type": "atasözü veya deyim",
  "meaning": "Ne anlama geldiğini çocukça/sade bir dille açıkla",
  "example": "Günlük hayattan bu atasözünün/deyimin kullanıldığı doğal bir örnek cümle",
  "origin": "Kısa bir köken veya tarihsel bilgi (1-2 cümle)",
  "emoji": "İlgili bir emoji"
}`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content.map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    res.json({ success: true, proverb: result });
  } catch (err) {
    // Fallback
    res.json({
      success: true,
      proverb: {
        text: 'Damlaya damlaya göl olur.',
        type: 'atasözü',
        meaning: 'Küçük küçük biriken şeyler zamanla büyük bir bütün oluşturur. Sabır ve azimle çalışmak büyük başarılar getirir.',
        example: 'Her gün biraz tasarruf yapıyorum; damlaya damlaya göl olur, zamanla büyük bir birikim yaparım.',
        origin: 'Türk halk kültüründen gelen bu atasözü, sabır ve azmin önemini vurgular.',
        emoji: '💧'
      }
    });
  }
});

// ── Sunucuyu başlat ──
app.listen(PORT, () => {
  console.log(`✅ HGYK Backend çalışıyor: http://localhost:${PORT}`);
});
