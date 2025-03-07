# Kur'an'dan Mesaj

Rastgele bir Kur'an mealinden, rastgele bir pasaj paylaşır.

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
