-- Aynı (companyId, orderDate) için yalnızca tek STANDARD sipariş olabilsin.
-- SUPPLEMENT siparişler partial WHERE koşulu sayesinde sınırsız kalır.
-- Eşzamanlı çift create denemesinde Postgres unique_violation → Prisma P2002 üretir;
-- handler tarafı bunu yakalayıp 409 PENDING_STANDARD_EXISTS / STANDARD_LOCKED yanıtına çevirir.

-- ÖNCE: eski mükerrer STANDARD kayıt varsa index oluşturma adımı patlar.
-- Beklenmeyen mükerrer için doğrulama (sadece bilgi — başarısız olursa SELECT ile temizleyin):
-- SELECT "companyId", "orderDate", COUNT(*)
-- FROM "Order"
-- WHERE "kind" = 'STANDARD'
-- GROUP BY 1, 2
-- HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_companyId_orderDate_standard_key"
  ON "Order" ("companyId", "orderDate")
  WHERE "kind" = 'STANDARD';
