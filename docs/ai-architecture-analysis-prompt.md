# Asır Sepeti — Yapay zeka mimari analiz promptu

Bu dosyayı bir AI aracına (Cursor Agent, ChatGPT + repo, Claude Projects vb.) **tek mesaj** olarak yapıştırın. İlk turda yalnızca “Executive summary + P0 riskler” isteyin; ikinci turda “Roadmap + 7 günlük checklist” isteyin.

---

## Rol

Kıdemli Yazılım Mimarı ve Ürün Yönetimi lideri olarak **mevcut kod tabanını** analiz et. Varsayım yapma; repoda olmayan modülleri “zaten var” diye yazma.

---

## Bağlam

**Asır Sepeti** — B2B fabrika/işletme yemek siparişi.

**Stack:** Next.js 16 App Router, TypeScript, Prisma 6, PostgreSQL (Supabase), NextAuth (credentials), Supabase Storage (aylık menü PDF), Vercel deploy + cron.

**Analiz öncesi oku (zorunlu):**

- `prisma/schema.prisma`
- `src/app/admin/*`, `src/app/api/*`
- `src/app/page.tsx`, `src/app/kayit/page.tsx`, `src/app/giris/page.tsx`
- `src/lib/company-*.ts`, `src/lib/parse-quick-order-text.ts`, `src/lib/inbound-promote.ts`
- `src/proxy.ts`, `vercel.json`, `.env.example`

**Kısıtlar:**

1. Mutfak paneli ve `/kitchen` bu repoda **yok**; `KITCHEN` rolü legacy. Mutfak modülü önerme.
2. Stok, reçete, faturalandırma, AI tahmin **kodda yok** — bunları “gelecek fikir” diye uydurma; yalnızca gap/teknik borç olarak değerlendir.
3. Monolith Next uygulamasını koru; mikroservis önerme (gerekçeli istisna yoksa).
4. Çıktı: Türkçe, teknik markdown. Her iddia için dosya yolu veya Prisma model adı ver.

**Amaç (mevcut ürün):** İşletmelerin teslim gününe göre vardiya×kategori adet siparişi; admin catering onayı; işletmeler operasyon grid’i; WhatsApp/manuel giriş; sipariş geçmişi; aylık menü.

**Kapsam dışı (uygulama önerme):** mutfak ekranı, malzeme stoku, üretim kapasite motoru, otomatik fatura.

---

## 1. Mimari inceleme (mevcut kod)

- Sipariş yaşam döngüsü: oluşturma (müşteri / supplement / admin / inbound promote) → status geçişleri → `gridAppliedAt` / arşiv cron. Tek kaynak (source of truth) neresi?
- İşletmeler grid (`Company.adminNote` JSON) ile `Order`/`OrderItem` çift kayıt riski ve sadeleştirme.
- SSE, webhook, cron: hangileri gerekli, hangileri sadeleştirilebilir?
- `src/proxy.ts` auth matcher: güvenlik boşlukları (`/kayit` herkese açık vb.).
- Gereksiz karmaşıklık / dead code (`KITCHEN`, kullanılmayan `OrderStatus` değerleri).

## 2. Mevcut özelliklerin olgunluğu

- Müşteri: hızlı sipariş metni, supplement, geçmiş düzenleme — eksik UX / edge case.
- Admin: toplu onay, grid arşiv, order hints, Excel — operasyonel boşluklar.
- WhatsApp: parse, `NO_COMPANY`, rate limit.
- Bu codebase’e uygun **5–10** küçük/orta özellik (problem | çözüm | dosyalar | efor S/M/L).

## 3. Veritabanı ve eşzamanlılık

- İndeksler, unique, `adminNote` JSON vs normalize tablo.
- Race: çift STANDARD sipariş, grid patch + cron.
- Migration/seed/deploy: `migrate deploy`, baseline (P3005), Vercel `prisma generate`.
- `RateLimitLog` / `SseEvent` büyümesi.

## 4. Roadmap (3 faz)

- **Faz A** — Production-ready: env, migration, auth/kayıt, cron, Supabase bucket, güvenlik.
- **Faz B** — Operasyonel sağlamlık: grid↔sipariş, inbound, raporlama, testler.
- **Faz C** — Ölçek ve kalite: gözlemlenebilirlik, yük testi.

Her faz: 1–2 haftalık görev listesi, P0/P1, risk.

---

## Çıktı şablonu

```markdown
## Executive summary (5 madde)
## Mevcut mimari haritası
## Kritik akışlar
## Teknik borç ve riskler (P0/P1/P2)
## Veritabanı notları
## Önerilen iyileştirmeler (tablo)
## 3 fazlı roadmap
## İlk 7 gün yapılacaklar (günlük checklist)
```

---

## İsteğe bağlı bağlam satırı

Canlı: `<vercel-url>`, DB: Supabase, bilinen sorunlar: migration baseline, kayıt/giriş hataları.
