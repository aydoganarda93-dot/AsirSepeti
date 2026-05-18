# Asır Sepeti — Production deploy checklist

Bu doküman, mevcut canlı Supabase veritabanı `db push` ile oluşturulduğu için
geleneksel `prisma migrate deploy` akışını **bir defaya mahsus baseline** ile
hizalamak için gerekli adımları açıklar.

Bundan sonraki tüm şema değişiklikleri **`prisma/migrations/`** üzerinden
ilerleyecek; `db push` artık production'da kullanılmayacak.

---

## 0. Önkoşullar

- `DATABASE_URL` (pooler, port 6543) ve `DIRECT_URL` (direct, port 5432) Vercel ve `.env` içinde doğru.
- `.env`'de `NEXTAUTH_URL` **protokol** ile yazılı: `https://asir-sepeti.vercel.app` (PR-2'de düzeltilecek).
- Yerelde `npx prisma --version` çalışıyor.
- Production yedeği: Supabase Dashboard → Database → Backups → manuel snapshot al.

---

## 1. Migration mimarisi (bu PR ile değişti)

Repo durumu:

```
prisma/migrations/
  0_init_baseline/                        # tüm mevcut tablolar + index + FK (production aynı durumda)
  20260518214500_add_order_standard_unique/   # YENİ: partial unique index, Order(companyId, orderDate) WHERE kind='STANDARD'
```

**Önceki iki migration** (`20260513194500_company_grid_daily_archive`,
`20260518120000_add_duz_ekmek_category`) baseline'ın içine alındı ve klasörleri
silindi. Production'da bu iki SQL zaten uygulanmış olduğundan veri kaybı yok.

---

## 2. İlk seferlik baseline damgalaması (production)

> **Yalnızca bir kez** ve `migrate deploy`'dan önce.
> Bu adım Supabase'de hiçbir DDL çalıştırmaz; sadece `_prisma_migrations`
> tablosuna `0_init_baseline` satırını ekler.

```bash
# 1) Direct connection ile bağlan (pooler değil — port 5432).
export DATABASE_URL="$DIRECT_URL"

# 2) Baseline'ı uygulanmış olarak işaretle.
npx prisma migrate resolve --applied 0_init_baseline

# 3) Doğrulama: _prisma_migrations tablosunda satır var mı?
#    Supabase SQL Editor:
#      SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at;
#    Çıktı: 0_init_baseline | <timestamp>
```

Yerel `.env`'de `DATABASE_URL` zaten pooler. Direct'e geçici geçmek için
PowerShell:

```powershell
$env:DATABASE_URL = $env:DIRECT_URL
npx prisma migrate resolve --applied 0_init_baseline
```

---

## 3. Yeni migration'ı uygula

Yalnızca `20260518214500_add_order_standard_unique` çalışacak:

```bash
npx prisma migrate deploy
```

Beklenen çıktı:

```
Applying migration `20260518214500_add_order_standard_unique`
The following migration(s) have been applied: ...
```

**Eğer üretimde önceden mükerrer `STANDARD` kayıt varsa** bu adım
`unique_violation` ile patlar. Önce şu SQL ile temizleyin:

```sql
-- Bul:
SELECT "companyId", "orderDate", COUNT(*) c, array_agg(id) ids
FROM "Order"
WHERE kind = 'STANDARD'
GROUP BY 1, 2
HAVING COUNT(*) > 1;

-- Manuel olarak en yenisini tutup eskileri sil veya birleştir.
```

Sonra `migrate deploy` tekrarlanır.

---

## 4. Vercel build ayarı

`package.json`'da build script'i zaten `prisma generate && next build`.
Vercel ortam değişkenlerinde **`DATABASE_URL`** pooler URL'i (port 6543,
`pgbouncer=true`) olmalı; `DIRECT_URL` ise direct connection (port 5432).
Prisma Client runtime'da `DATABASE_URL`'i, migration'lar ise `DIRECT_URL`'i kullanır.

### 4.1 Vercel Production env değişkenleri (zorunlu liste)

Aşağıdaki değişkenlerin **tamamı** Vercel → Project Settings → Environment
Variables → **Production** scope'unda tanımlı olmalı. Eksik veya bozuk olanlar
boot'ta `[env]` uyarısı olarak Vercel function log'larına yazılır
(`src/instrumentation.ts` → `validateEnv()`).

| Değişken | Zorunluluk | Format / örnek | Doğrulama notu |
|----------|-----------|----------------|----------------|
| `DATABASE_URL` | Zorunlu | `postgresql://...pooler...:6543/postgres?pgbouncer=true&sslmode=require` | Port **6543**, `pgbouncer=true` şart. |
| `DIRECT_URL` | Önerilen | `postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres?sslmode=require` | Migration için (port **5432**). |
| `NEXTAUTH_SECRET` | Zorunlu | `openssl rand -base64 32` | En az 16 karakter; üretim ≠ development. |
| `NEXTAUTH_URL` | **Production'da zorunlu** | `https://asir-sepeti.vercel.app` | **Başında `https://`** olmalı, sonunda `/` olmamalı. Yalnız host yazmak (örn. `asir-sepeti.vercel.app`) callback'i kırar. |
| `ADMIN_EMAIL` | Zorunlu | `admin@asirsepeti.com` | `npm run db:seed` bunu kullanır. |
| `ADMIN_PASSWORD` | Zorunlu | min. 8 karakter | Seed sırasında bcrypt'lenir; rotasyon planlayın. |
| `CRON_SECRET` | Zorunlu | `openssl rand -base64 32` | Yoksa `/api/cron/close-company-grid-day` 401 döner ve grid arşivi oluşmaz. |
| `INBOUND_WEBHOOK_SECRET` | Zorunlu | rastgele 32+ karakter | WhatsApp / SMS webhook'u yetkilendirir. |
| `WHATSAPP_AUTO_CREATE_ORDER` | Opsiyonel | `"false"` (default) | `"true"` ise parse başarılı mesajlar otomatik STANDARD sipariş açar. |
| `SUPABASE_URL` veya `NEXT_PUBLIC_SUPABASE_URL` | Aylık menü için | `https://<ref>.supabase.co` | Boşsa müşteri ekranında menü butonu **gizlenir**. |
| `SUPABASE_SERVICE_ROLE_KEY` | Aylık menü için | service_role JWT | Asla `NEXT_PUBLIC_` öneki ile **paylaşılmaz**. |
| `TURNSTILE_SECRET_KEY` | Opsiyonel (bot koruması) | Cloudflare Turnstile secret | Tanımlıysa `/api/auth/register` `turnstileToken` zorunlu olur. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Opsiyonel (bot koruması) | Cloudflare Turnstile site key | İkisi de dolu olmalı: yoksa widget render edilmez, sunucu Turnstile'ı atlar. |

### 4.2 Hızlı doğrulama

Vercel CLI yüklüyse:

```bash
vercel env ls production
```

Veya UI'dan tek tek bakın. Bir değişken eksik veya bozuksa, build log'unda:

```
[env] PRODUCTION ortamında ENV uyarıları:
  - [GEÇERSİZ] NEXTAUTH_URL: NEXTAUTH_URL https:// veya http:// ile başlamalı (Vercel: https://...).
```

gibi bir uyarı görünür (`src/lib/env.ts`).

### 4.3 Cron ve webhook smoke test

```bash
# Cron (admin grid arşivi):
curl -i -H "Authorization: Bearer $CRON_SECRET" \
  https://asir-sepeti.vercel.app/api/cron/close-company-grid-day

# Webhook (gelen mesaj):
curl -i -X POST \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $INBOUND_WEBHOOK_SECRET" \
  -d '{"from":"+905551234567","body":"yarın 5 öğle"}' \
  https://asir-sepeti.vercel.app/api/webhooks/whatsapp
```

Beklenen: ikisi de `200`. `401` alıyorsanız secret eksik veya yanlış.

---

## 5. Bundan sonra her şema değişikliği

```bash
# Yerel
npx prisma migrate dev --name aciklayici_isim

# Üretim deploy
git push   # Vercel build çalıştırır, ancak migration ayrı:
DATABASE_URL=$DIRECT_URL npx prisma migrate deploy
```

`db push` **artık production'da kullanılmayacak**. Yerelde hızlı denemeler için
`npx prisma db push` yerine `migrate dev` kullanın ki migration tarihçesi kaybolmasın.

---

## 6. Smoke testleri

Baseline + yeni migration uygulandıktan sonra:

| Test | Komut / Aksiyon | Beklenen |
|------|-----------------|----------|
| Sipariş oluşturma | `/giris` → müşteri ile sipariş ver | 201 + `/success?orderId=...` |
| Çift sipariş engeli | Aynı oturumda aynı gün için ikinci sipariş | 409 + `code: PENDING_STANDARD_EXISTS` |
| Eşzamanlı race | İki sekmede aynı anda submit | Biri 201, diğeri 409 `PENDING_STANDARD_EXISTS` |
| Supplement | "Üzerine ekle" akışı | 201 + yeni SUPPLEMENT sipariş (engel yok) |
| Cron | `curl -H "Authorization: Bearer $CRON_SECRET" https://asir-sepeti.vercel.app/api/cron/close-company-grid-day` | `{ archived: [...] }` veya `{ skipped: ... }` |
| Webhook | `curl -X POST -H "x-webhook-secret: $INBOUND_WEBHOOK_SECRET" ...` | 200 + `InboundMessage` satırı |

---

## 7. Rollback planı

`add_order_standard_unique` problem çıkarırsa:

```sql
DROP INDEX IF EXISTS "Order_companyId_orderDate_standard_key";
```

Ve `_prisma_migrations` tablosundan satırı kaldır:

```sql
DELETE FROM _prisma_migrations WHERE migration_name = '20260518214500_add_order_standard_unique';
```

Baseline rollback edilmez; o yalnızca damgadır, hiçbir DDL içermez (uygulanmadı).

---

## 8. Production cutover kabul kriterleri

Aşağıdaki adımların **tamamı** ✅ olduğunda P0 production cutover tamamlanmış sayılır.

### 8.1 DB tarafı

- [ ] Supabase Dashboard → Database → Backups → manuel snapshot alındı (cutover öncesi).
- [ ] `npx prisma migrate resolve --applied 0_init_baseline` çalıştırıldı (bir kez).
- [ ] `npx prisma migrate deploy` başarılı: `Applying migration 20260518214500_add_order_standard_unique`.
- [ ] Supabase SQL Editor'da doğrulama:
  ```sql
  SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at;
  -- Beklenen: 0_init_baseline, 20260518214500_add_order_standard_unique (en az 2 satır).

  SELECT indexname FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'Order'
    AND indexname = 'Order_companyId_orderDate_standard_key';
  -- Beklenen: 1 satır.
  ```

### 8.2 Vercel env

- [ ] Production scope'unda `NEXTAUTH_URL` = `https://asir-sepeti.vercel.app` (protokol + sondaki `/` yok).
- [ ] `CRON_SECRET`, `INBOUND_WEBHOOK_SECRET`, `NEXTAUTH_SECRET` dolu ve uzun (≥16 karakter).
- [ ] `KITCHEN_ACCESS_TOKEN` Vercel UI'dan silindi (legacy).
- [ ] (Opsiyonel) `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` ikisi birlikte tanımlı (veya ikisi de boş).
- [ ] Deploy log'unda `[env] Tüm kontroller geçti.` görüldü veya yalnızca beklenen "ÖNERİLEN" satırları kaldı.

### 8.3 Fonksiyonel smoke

- [ ] **Auth:** `/giris` admin ile başarılı giriş; `/admin/catering` 200.
- [ ] **Kayıt:** `/kayit` oturumsuzken erişilebilir; aynı IP'den 4. denemede 429.
- [ ] **Sipariş (müşteri):** Form gönderildi → `/success?orderId=…&t=…` tam detay görüntüleniyor.
- [ ] **Sipariş güvenliği:** Aynı URL'den `&t=…` kısmı silinince minimal "Siparişiniz Alındı" ekranı.
- [ ] **Race koruması:** İki sekmede aynı anda submit → biri 201, diğeri 409 `PENDING_STANDARD_EXISTS`.
- [ ] **SUPPLEMENT:** "Üzerine ekle" akışı 201 + yeni SUPPLEMENT (engellenmemeli).
- [ ] **Catering onayı:** `PATCH /api/orders/[id]/status` → `CONFIRMED` → `Company.adminNote` JSON'unda hücreler güncellendi.
- [ ] **Cron:**
  ```bash
  curl -i -H "Authorization: Bearer $CRON_SECRET" \
    https://asir-sepeti.vercel.app/api/cron/close-company-grid-day
  ```
  200 ile dönüş; `app_settings.gridLastArchivedPeriodStart` (Istanbul öğle dönemini geçtiyse) ilerledi.
- [ ] **Webhook:**
  ```bash
  curl -i -X POST \
    -H "Content-Type: application/json" \
    -H "x-webhook-secret: $INBOUND_WEBHOOK_SECRET" \
    -d '{"from":"+905551234567","body":"yarın 5 öğle"}' \
    https://asir-sepeti.vercel.app/api/webhooks/whatsapp
  ```
  200; `InboundMessage` tablosunda yeni satır.

### 8.4 Genel sağlık

- [ ] Vercel deploy log'unda Prisma uyarısı dışında kritik hata yok.
- [ ] Yerelde `npm run lint` temiz.
- [ ] `npx prisma validate` temiz.

Hepsi ✅ ise P0 cutover tamam. P1 listesi (`docs/ai-architecture-analysis-report.md` §P1) için bir sonraki sprint planlanabilir.
