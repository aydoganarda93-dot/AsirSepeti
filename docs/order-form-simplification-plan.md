# Catering sipariş formu sadeleştirme — Implementation planı

**Kural:** Bir faz tamamlanmadan ve **paydaş açıkça “bir sonraki faza geç” demeden** sonraki fazın işleri başlamaz. Bu dosya her faz bitince güncellenir (tamamlanan maddeler işaretlenir).

---

## Hedef (tüm fazlar)

Fabrika kullanıcıları için WhatsApp/kara düzen alışkanlığını kırmadan:

- Tek ana iş net olsun: sipariş vermek.
- Teknik ve süreç kelimeleri (supplement, mod, vb.) kullanıcıya gösterilmesin.
- Mümkün olduğunca az adım, az metin; kritik bilgi görünür kalsın.

---

## Faz 1 — Kopyalama + dil + küçük UX (düşük risk)

**Amaç:** Davranışı çok değiştirmeden algıyı yumuşatmak; “son siparişi tekrarla” ile tekrarlayan kullanıcı yükünü azaltmak.

### Yapılacaklar

1. **Kullanıcıya görünen metinleri yeniden yaz**
   - “Ek talep”, “supplement”, “düzenleme modu”, “ana sipariş” gibi ifadeleri operasyon diline çevir (örn. “Üzerine ekle”, “Gönderdiğimi düzelt”, “Siparişim”).
   - Toast ve hata mesajlarını kısalt; tek cümle.

2. **`CustomerOrdersPanel` + ana sayfa akışını sadeleştir (layout değişmeden mümkün olduğunca)**
   - Üst bilgi kutularını birleştir veya tek paragraf yap.
   - “Modu kapat” yerine “Vazgeç / Yeni sipariş” veya benzeri tek anlam.

3. **“Son siparişi tekrarla”**
   - Kaynak: `GET /api/orders/my` ile son teslim tarihine göre **en son oluşturulan** sipariş (veya seçilen tarih için son STANDARD).
   - Buton: formu o siparişin miktarları + notu ile doldurur; kullanıcı tarihi değiştirip gönderebilir.
   - API gerekirse: `GET /api/orders/my?latest=1` veya mevcut liste üzerinden istemci tarafında “son” seçimi (tercihen tek endpoint ile netleştir).

4. **Admin tarafı**
   - Tablo rozeti metni: “Ek talep” kalabilir veya “Üzerine ek” ile uyumlu kısa etiket.

### Dokunulabilecek dosyalar (tahmini)

- `src/app/page.tsx`
- `src/components/customer-orders-panel.tsx`
- `src/app/api/orders/my/route.ts` (sorgu parametresi veya sıralama garantisi)

### Faz 1 kabul kriterleri

- [x] Kullanıcı arayüzünde “supplement”, “SUPPLEMENT”, İngilizce teknik terim yok.
- [x] Ana akışta “Son siparişi tekrarla” çalışıyor ve formu anlamlı dolduruyor (`GET /api/orders/my?latest=1`, önce ana sipariş).
- [x] Mevcut POST/PATCH/`asSupplement` mantığı bozulmadan kalıyor (sadece kopyalama + metin).

### Faz 1 sonrası durma

Paydaş onayı olmadan **Faz 2’ye geçilmez.**

---

## Faz 2 — Tek ekran / iki katmanlı form (orta risk)

**Amaç:** İlk bakışta az kontrol; detay isteyen “Detaylı gir” ile genişlesin.

### Özet → detay dağılım kuralı (uygulandı)

`src/lib/order-form.ts` içinde **`distributeShiftTarget`**:

- Hedef toplam **0** ise tüm kategoriler **0**.
- Önceki satır **tamamen boşsa** (toplam 0): yeni toplam tek başına **öğle yemeği (`OGLEN_YEMEGI`)** satırına yazılır.
- Aksi halde: önceki kategori oranları korunarak **en büyük kalanlı (Hamilton)** yöntemiyle tam sayılara yuvarlanır.

### Yapılacaklar

1. **Varsayılan görünüm**
   - Üstte: tarih (büyük veya tek satır).
   - Ortada: **özet mod** — örn. vardiya başına tek toplam kişi (3 alan) VEYA iş kurallarına göre “öğün başına tek rakam” şeması (ürün kararı).

2. **“Detaylı gir”**
   - Mevcut kategori × vardiya grid’ini buraya taşı; kapalıyken gizli.

3. **Özet → detay senkron**
   - Özet alanları değişince detay grid’e dağılım kuralı (örn. orantılı, veya tümü ilk kategoriye — net kural dokümante edilir).

4. **“Siparişlerim”**
   - Liste sadeleştirilir: son N kayıt, tek satır özet; tam detay isteğe bağlı genişleyen satır.

### Dokunulabilecek dosyalar (tahmini)

- `src/app/page.tsx` (veya `src/components/order-form-simple.tsx` gibi yeni bileşen)
- `src/lib/order-form.ts` (dönüşüm yardımcıları)

### Faz 2 kabul kriterleri

- [x] İlk ekranda **en fazla 6 kontrol**: teslim günü + 3 vardiya toplamı + not + gönder (+ isteğe bağlı «Detaylı gir»). Detay kapalıyken kategori grid’i yok.
- [x] Detaylı grid opsiyonel; gönderim mevcut API ile aynı gövde (`quantities`).
- [x] Siparişlerim: son **8** kayıt, tek satır özet; satıra tıklayınca detay.

### Faz 2 sonrası durma

Onay olmadan **Faz 3’e geçilmez.**

---

## Faz 3 — Serbest metin / akıllı not (yüksek karmaşıklık, opsiyonel)

**Amaç:** WhatsApp tadında tek kutuya yazılan metinden **taslak** üretmek; yanlış parse’ta kullanıcı düzeltir.

### Uygulama özeti

- **İstemci tarafı parse:** `src/lib/parse-quick-order-text.ts` — satır/virgül/noktalı ayırıcı, rakam + sabah/akşam/gece + kumanya/yemek/ekmek anahtarları; vardiya aynı cümlede kalıtılır.
- **UI:** `src/components/quick-order-input.tsx` — «İstersen buraya yazın (WhatsApp gibi)», `Metni oku ve forma yaz`, isteğe bağlı «Yazdığımı not alanına da ekle» (mevcut `notes`, max 2000; şema genişletilmedi).
- **Form:** `src/app/page.tsx` — parse sonucu `quantities` ile **doğrudan** güncellenir; kullanıcı alttan düzeltir.

### Yapılacaklar

1. Büyük **“Nasıl yazarsanız yazın”** textarea (örnek placeholder’lar).
2. Sunucu veya istemci tarafında **kısıtlı kural seti** ile parse (sayı + anahtar kelime eşlemesi); güven için üst limit ve reddetme mesajı.
3. Parse sonucu form alanlarına **öneri** olarak yazılır; kullanıcı “Bunu kullan” der.
4. Ham metin `notes` veya ayrı `freeTextRequest` alanında saklanabilir (şema gerekiyorsa migration).

### Şema/API riski

- Gerekirse `Order` veya not alanı genişletilir; Faz 3 başlamadan önce netleştirilir.

### Faz 3 kabul kriterleri

- [x] Parse başarısız olduğunda sistem çökmez; kullanıcı manuel sayı girebilir (toast + atlanan satır ipucu).
- [x] Metin üst sınırı **2000** karakter; not alanı ile aynı üst sınır (`zod` + forma).

### Faz 3 sonrası durma

Onay olmadan **Faz 4’e geçilmez.**

---

## Faz 4 — WhatsApp / harici kanal köprüsü (uzun vadeli)

**Amaç:** Mesajın kanaldan gelmesi; sistemde taslak sipariş.

### Yapılacaklar (yüksek seviye)

- Twilio / Meta Cloud API / üçüncü parti seçimi.
- Gelen mesaj → tanımlı işletme eşlemesi → taslak sipariş + operatör onayı veya otomatik kural.
- Güvenlik: webhook imzası, rate limit, spam.

Bu faz ürün ve hukuk onayı gerektirir; teknik keşif ayrı dokümanda yapılır.

---

## Çakışma ve bağımlılıklar

| Faz | Önceki faza bağımlılık |
|-----|-------------------------|
| 2 | 1 tamamlanmış olmalı (metin ve “tekrarla” davranışı oturmuş olur). |
| 3 | 2’de özet/detay ayrımı netleşmiş olmalı (aksi halde iki karmaşık sistem üst üste binir). |
| 4 | İş süreci ve entegrasyon kararı. |

---

## Notlar

- Her faz PR’da tek başına review edilebilir olmalı.
- “Faz bitti” kararı: bu dosyadaki checkbox’lar + kısa demo notu yeterli.

---

*Son güncelleme: Faz 3 uygulandı (WhatsApp kutusu, `parse-quick-order-text`, nota ekleme opsiyonu).*
