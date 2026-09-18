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
    <a target="_blank" href="https://github.com/ziegfiroyt/acikkuran-api" class="link-info">Açık Kuran API</a> kullanır.
    <a target="_blank" href="https://www.postman.com/canbax/workspace/ak-kuran/overview"
      class="link-info">Postman'de</a> Açık Kuran API
    incelenebilir.
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
| `src/acikkuran.js` | Açık Kuran API istemcisi |
| `src/telegram.js` | Telegram Bot API istemcisi |
| `src/twitter.js` | Twitter v2 istemcisi (OAuth 1.0a) |
| `src/random.js` | Rastgelelik (testlerde sabitlenebilir) |
| `src/data.js` | Sure/ayet/meal statik verisi |

Her modül bağımlılıklarını dışarıdan alır (`fetchVerse`, `rng`, HTTP
fonksiyonları), bu yüzden testler ağ erişimi olmadan çalışır.
