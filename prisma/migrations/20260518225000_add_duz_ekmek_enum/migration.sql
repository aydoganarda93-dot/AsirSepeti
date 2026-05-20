-- ItemCategory enum'una DUZ_EKMEK değerini ekle (idempotent).
ALTER TYPE "ItemCategory" ADD VALUE IF NOT EXISTS 'DUZ_EKMEK';
