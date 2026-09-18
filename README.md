# Kur'an'dan Mesaj

Rastgele bir Kur'an mealinden, rastgele bir kesit paylaşır.

  <h2> Açıklama </h2>
  <p>
    <a target="_blank" href="https://t.me/kurandanmesaj" class="link-primary">
      <img src="doc/telegram.svg" style="background: white; border-radius: 50%;"> Telegram kanalına</a> katılabilirsiniz. Her gün sadece 1 mesaj atar.
  </p>

  <h2> Hakkında </h2>
  <p>
    Ücretsiz, reklamsız ve izleyicisizdir (tracker ya da analytics scriptleri kullanmaz).
  </p>

  <p>
    Mealler depoda gömülü olarak gelir; çalışırken hiçbir dış API'ye bağlı değildir.
    27 Türkçe meal
    <a target="_blank" href="https://github.com/fawazahmed0/quran-api" class="link-info">fawazahmed0/quran-api</a>
    deposundan alınmıştır. Kaynakların tam listesi için
    <a target="_blank" href="data/quran/ATTRIBUTION.md" class="link-info">data/quran/ATTRIBUTION.md</a>.
  </p>
  <p>
    Her gün Türkiye saati ile 19'da bir private <a target="_blank" href="https://gitlab.com/canbax/daily-webhooker"
      class="link-info">GitLab</a> projesinde tanımlı bir pipeline schedule sayesinde Vercel'deki ücretsiz sunucuya
    (burası oluyor) HTTP
    isteği gönderir. Bu istek gelince twitter ve telegramda pasaj paylaşılır.
  </p>

## Geliştirme

```bash
npm install
npm test          # node:test ile birim + HTTP testleri
npm run test:watch
npm start         # http://localhost:3000
```

Meal verisi `data/quran/` altında depoda gömülü gelir, yani normal geliştirmede
bir şey indirmeye gerek yoktur. Veriyi kaynağından yeniden üretmek için:

```bash
npm run build:data   # data/quran/*.qdb ve src/editions.js dosyalarını yeniden yazar
```

Gerekli ortam değişkenleri: `TELEGRAM_BOT_TOKEN` (zorunlu),
`TWITTER_CONSUMER_KEY`, `TWITTER_CONSUMER_SECRET`, `TWITTER_OAUTH_TOKEN`,
`TWITTER_TOKEN_SECRET`, `PORT` (varsayılan 3000).

### Dosya yapısı

| Dosya | Sorumluluk |
| --- | --- |
| `api/index.js` | Vercel giriş noktası; sadece `src`'i ayağa kaldırır |
| `src/index.js` | Composition root: gerçek istemcileri kurar ve birbirine bağlar |
| `src/config.js` | Sabitler ve ortam değişkenlerinin okunması |
| `src/app.js` | Express uygulaması ve HTTP uçları |
| `src/bot.js` | Telegram komutlarının işlenmesi (`/pasaj`, `/start`) |
| `src/passage.js` | Rastgele pasajın seçilmesi ve karakter sınırına sığdırılması |
| `src/quran.js` | Gömülü meallerden ayet okuyan istemci (tembel, önbellekli) |
| `src/qdb.js` | `.qdb` dosya biçimi (paketleme ve çözme) |
| `src/telegram.js` | Telegram Bot API istemcisi |
| `src/twitter.js` | Twitter v2 istemcisi (OAuth 1.0a) |
| `src/random.js` | Rastgelelik (testlerde sabitlenebilir) |
| `src/data.js` | Sure adları ve ayet sayıları |
| `src/editions.js` | Meal listesi (üretilmiştir, elle düzenlenmez) |
| `scripts/build-quran-data.js` | Mealleri indirip `data/quran/*.qdb` üretir |
| `data/quran/*.qdb` | 27 meal, toplam ~10 MB |

Her modül bağımlılıklarını dışarıdan alır (`fetchVerse`, `rng`, HTTP
fonksiyonları), bu yüzden testler ağ erişimi olmadan çalışır.

### Meal verisi nasıl saklanır

Her meal tek bir `.qdb` dosyasıdır: 920 baytlık bir indeks, ardından her sure
için ayrı ayrı sıkıştırılmış 114 blok. Bir ayet okumak, dosyanın tamamını
çözmek yerine tek bir `seek` ve ~3 KB'lık bir açma işlemine mal olur; okunan
sure küçük bir LRU önbellekte tutulduğu için aynı pasajın kalan ayetleri
diske hiç dönmez. Ham metne göre 27 MB yerine ~10 MB yer kaplar.
