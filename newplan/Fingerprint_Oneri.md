# Workspace Fingerprint Sistemi — Öneri

Plan.md'deki senaryo üzerinden: workspace → galeri (geçmiş başarılı statikler) + brand kit (logo, cta, promo, renk paleti, tipografi) → kullanıcı AI ile üretim yapıyor. Şu an workspace'e özel bir "fingerprint" (marka parmak izi) yok; hedef, yeni üretimlerin markaya otomatik uyum sağlaması.

## 1. Fingerprint'i neyin oluşturduğu

İki farklı kaynak var ve bunlar birbirinden çok farklı işlenmeli:

- **Brand kit (yapılandırılmış / deterministik veri)**: logo dosyası, renk paleti (hex kodları), tipografi (font ailesi), CTA metinleri/stilleri, promo içerikleri. Bunlar zaten temiz veri — ekstra bir "çıkarım" gerektirmez, doğrudan kurala dönüştürülebilir.
- **Galeri (örtük / görsel veri)**: geçmişte başarılı olmuş statik görseller. Buradan çıkarılması gereken şey kompozisyon, layout kalıpları, görsel ton, karakter kullanımı, arka plan stili gibi brand kit'te yazılı olmayan "stil" bilgisi. Bu kısım tahmine/analize dayalı.

Fingerprint = bu ikisinin birleşimi olmalı; sadece brand kit'e bakmak yetersiz kalır çünkü "başarılı" olmanın sebebi genelde brand kit'te olmayan stil tercihleridir (kompozisyon, ton, referans görsellerin havası).

## 2. Üç olası yaklaşım

**A) Kural tabanlı yapılandırılmış profil (prompt conditioning)**
Brand kit verilerini + galeriden LLM/vision modeliyle çıkarılan stil etiketlerini (örn. "yüksek kontrast, koyu arka plan, büyük CTA butonu, spor temalı görseller") bir JSON "brand profile" haline getirip, her üretimde prompt'a otomatik enjekte etmek.
- Artı: Hızlı kurulur, ML altyapısı gerektirmez, açıklanabilir (kullanıcı fingerprint'i görüp düzenleyebilir).
- Eksi: Görsel sadakat sınırlı — modelin "yorumuna" bağlı, tutarlılık garanti değil.

**B) Embedding tabanlı stil/benzerlik**
Galerideki görsellerden bir vision modeliyle (CLIP benzeri) embedding çıkarıp workspace'e özel bir "stil vektörü" oluşturmak. Üretim sırasında bu vektöre en yakın geçmiş görselleri referans olarak seçip image-to-image / IP-Adapter benzeri bir teknikle fal.ai'ye referans görsel olarak vermek.
- Artı: Brand kit'te yazılmayan ince stil benzerliklerini yakalar, retraining gerekmez, yeni galeri görseli eklendikçe otomatik güncellenir.
- Eksi: Doğru similarity/retrieval mantığı kurulmalı, embedding depolamak için altyapı (pgvector vb.) gerekir.

**C) Workspace'e özel fine-tuning (LoRA)**
Galerideki görselleri kullanarak fal.ai üzerinden workspace'e özel bir LoRA eğitmek; üretimlerde bu LoRA otomatik uygulanır.
- Artı: En yüksek marka sadakati — model gerçekten o markanın "tarzını" öğrenir.
- Eksi: Galeri boyutu yetersizse (çok az görsel) işe yaramaz, eğitim maliyeti + versiyon yönetimi + "brand kit değişince ne olacak" sorunu, her workspace için ayrı model bakımı.

## 3. Önerilen yol: Hibrit, aşamalı

Üçünü birden en baştan kurmaya çalışmak riskli. Aşamalandırmayı öneriyorum:

**Faz 1 — Yapılandırılmış profil (A)**
- `BrandFingerprint` modeli: workspace'e bağlı, brand kit alanlarından deterministik dolan + galeriden bir vision/LLM çağrısıyla çıkarılan stil etiketleri (JSON).
- Brand kit veya galeri güncellendiğinde async (Celery) yeniden hesaplanır.
- Üretimde: kullanıcı prompt'u + fingerprint'ten türetilen sabit talimatlar (renk, font, CTA metni, stil etiketleri) birleştirilip fal.ai'ye gönderilir.
- Bu faz kod tarafında en az riskli, hızlı teslim edilebilir ve kullanıcıya "işte fingerprint böyle oluştu" diye gösterilebilir (şeffaflık, düzenlenebilirlik).

**Faz 2 — Embedding/retrieval katmanı (B)**
- Galerideki görseller embedding'e çevrilir, workspace bazında saklanır.
- Üretim isteği geldiğinde en alakalı geçmiş görseller referans olarak seçilir, fal.ai'nin görsel-referanslı üretim moduna (varsa) verilir.
- Faz 1'in üstüne eklenir, onu geçersiz kılmaz.

**Faz 3 — LoRA fine-tuning (C)**
- Sadece yeterli galeri hacmi olan (ör. 15-20+ onaylı statik) ve/veya kurumsal/yüksek değerli workspace'ler için opsiyonel.
- Maliyet ve bakım yükü net konuşulmalı; otomatik tetiklenmemeli, bir eşik + onay adımı olmalı.

## 4. Dikkat edilmesi gereken noktalar

- **Bahis sitesi reklamı olduğu için**: fingerprint'e zorunlu uyumluluk öğeleri de (yaş sınırı ibaresi, sorumlu bahis uyarısı, bölgesel yasal metin) dahil edilmeli — bunlar "stil tercihi" değil, üretimden hiçbir zaman düşmemesi gereken sabitler olarak ayrı tutulmalı.
- **Versiyonlama**: brand kit değiştiğinde fingerprint otomatik bayatlamamalı; eski versiyon + yeni versiyon ayrımı ve gerekirse manuel onay adımı olmalı.
- **Geri besleme döngüsü**: yeni üretilen ve kullanıcı tarafından "başarılı/kullanıldı" olarak işaretlenen görseller galeriye geri dönüp fingerprint'i güçlendirmeli (sürekli öğrenme).
- **Şeffaflık**: kullanıcı fingerprint'in ne olduğunu görebilmeli/düzenleyebilmeli — tamamen kara kutu olursa güven sorunu çıkar.

## 5. Karşılaştırma için açık sorular

Mevcut planınla kıyaslamadan önce netleştirmek istediğim noktalar:
1. Galeri şu an ortalama kaç görsel içeriyor (workspace başına)? Bu, Faz 3'ün (LoRA) ne zaman anlamlı olacağını belirler.
2. fal.ai üzerinden zaten kullanılan model(ler) image-to-image / referans görsel / IP-Adapter destekliyor mu, yoksa şu an sadece text-to-image mi kullanılıyor?
3. Var olan planında fingerprint'i "otomatik üretim" için mi (kullanıcı hiç prompt yazmadan) yoksa "üretime yardımcı/yönlendirici" olarak mı düşünüyorsun?
