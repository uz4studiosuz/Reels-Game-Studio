# Reels Lab

Instagram Reels / TikTok uchun o'yinlar studiyasi. `index.html` ni brauzerda oching (server shart emas),
o'yinni tanlang, sozlang va **Yozish** bilan 9:16 video (MP4/WebM, 720p yoki 1080p) oling.

## Ikki toifa

**Obunachilar bilan** (komment yozdiring — nik o'yinda qatnashadi): Yo'l poygasi 3D, **Armiya jangi 3D**
(obunachilar yarmi qizil, yarmi ko'k jamoada jang qiladi, har kim o'z jangchi turini tanlaydi), Omadli g'ildirak,
Oxirgi tirik, Shisha ko'prik, Nik Plinko, Bomba, Sumo, Qizil chiroq, **Arqon tortish** (jamoa saqlanadi), **Penalti seriyasi** (saralash bilan).

**ASMR · obunachisiz**: Qavatlarni sindirish, Halqalardan qochish, Boss jangi, Qora teshik, Hudud jangi
(katta to'p = ko'p hudud), Tosh·Qaychi·Qog'oz, To'plar ko'payishi, Mayatnik to'lqini, Musiqali halqa, **Domino** (spiral / ilon / yurak).

## Obunachilarni kommentga undash

- Pastdagi lenta **aylanib turadi**: komment chaqiruvi 💬 (urg'u rangida), obuna chaqiruvi 🔔, qo'shimcha chaqiriq.
- Qatnashuvchi nik-lar yo'lagi (marquee) lentadan yuqorida aylanadi.
- G'olib kartasida katta "Kommentga yoz" tugmasi.
- Matnlarning hammasi **Video** tabida sozlanadi.

## Obunachilar ro'yxati

Kommentlardagi nik-larni **Obunachilar** tabiga joylang. Jangchi turini ham yozish mumkin
(Armiya jangi uchun): `nik ritsar`, `nik:kamonchi`, `jodugar`, `otliq`, `shifokor`.

## Obunachi profillari va zaxira

Armiya jangida har obunachining **jangchi turi** va **jamoasi** saqlanadi: u har safar o'sha jamoada va o'sha
jangchi bo'lib chiqadi (yangi qo'shilganlar kichikroq jamoaga tushadi, jamoalar teng bo'ladi). Statistika
(g'alaba / o'yin / o'ldirgan) ham yig'iladi. Hammasi **Obunachilar** tabidagi jadvalda ko'rinadi va tahrirlanadi.

Boshqa kompyuterda davom etish: **Faylga saqlash** → `reels-lab-zaxira-….json` ni ko'chiring → u yerda
**Tiklash (qo'shish)** yoki **Tiklash (almashtirish)**. Fayl ro'yxat, turlar, jamoalar, statistika va sozlamalarni saqlaydi.
Eslatma: ma'lumot brauzer xotirasida turadi, shuning uchun doim bir xil usulda oching
(yo `index.html` ni ikki marta bosib, yo `localhost` orqali), aks holda boshqa xotira ochiladi.

## Yo'l poygasi 3D: qiziqarli qoidalar

Sovg'a qutilari (⚡ turbo, 🚀 raketa, 🛡️ qalqon, 🛢️ moy), harakatlanuvchi to'siqlar, **saralash** (nazorat
nuqtalarida oxirgi shar chiqib ketadi, kamida 3 ta qoladi), boosterlar, loy, sakrash joylari, voqealar lentasi.
Hammasi sozlamalarda yoqiladi/o'chiriladi.

## Diktor ovozi va videoga yozish

**Ishonchli yo'l — Azure Speech** (Video tabi → Ovoz manbai → Azure). Ovoz audio sifatida keladi va o'yin
ovozlari bilan bir yo'ldan o'ynaladi, shuning uchun MP4 ga avtomatik yoziladi (tab audio kerak emas).
Sozlash: portal.azure.com → "Speech service" yarating → Pricing tier: **Free F0** (oyiga 500 ming belgi bepul)
→ "Keys and Endpoint" dan **KEY 1** va **Region** ni Video tabiga qo'ying → "Ovozni sinash".
Ovozlar: uz-UZ-SardorNeural (erkak), uz-UZ-MadinaNeural (ayol). Kalit faqat shu kompyuterda saqlanadi.

**Oflayn yo'l — eSpeak** (Ovoz manbai → eSpeak). Internet va kalit kerak emas, ovoz MP4 ga avtomatik yoziladi,
lekin ovozi robotroq. Fayllar `lib/espeak/` da (eSpeak-NG, GPL-3.0 litsenziyasi, `LICENSE.txt`). Birinchi gapda ~0.5 s yuklanadi.

Brauzer ovozi (speechSynthesis) yozuv oqimiga tushmaydi, shuning uchun u uchun qo'shimcha yo'llar:
1. **Brauzer audiosi:** yozish boshlanganda brauzer so'raydi (Tab yoki Butun tizim ovozi). Katakchani yoqsangiz, diktor MP4 ga tushadi.
2. **Ekranda sarlavha:** diktor gapi har doim ekranda matn bo'lib chiqadi (Video tabida o'chirish mumkin).
3. **`.srt` fayl:** yozuvdan keyin "Diktor matni (.srt)" havolasi chiqadi: montaj dasturiga subtitr yoki ovoz uchun.

## Video oxiri

G'olib kartasi (5 s) → yakuniy ekran (4 s): logotip, kanal nomi, "Obuna bo'l" va komment tugmalari → yumshoq so'nish.
Diktor g'olibni qisqa e'lon qiladi, yakuniy ekranda obuna/kommentga chaqiradi va so'nishdan oldin jim bo'ladi.
Hamma yozuvlar sig'ishi uchun shrift kichrayadi yoki ikki qatorga bo'linadi (hech qachon "…" bilan kesilmaydi).

**Armiya jangida faqat obunachilar jang qiladi, bot yo'q.** Kamida 2 ta nik kerak, aks holda ko'rsatma ekrani chiqadi.

## O'zbekcha diktor (TTS)

Default ovoz **erkak** (Sardor / Ahmet va h.k.); jinsni Video tabida almashtirish mumkin.

Ovoz tanlash tartibi: tanlangan ovoz → o'zbek ovozi → zaxira **turk** ovozi (o'zbekchaga yaqin, matn turkcha imloga
moslab o'qitiladi). Panelda hozir qaysi ovoz ishlatilishi va xato bo'lsa sababi ko'rsatiladi.

**Video** tabi → "Ovozli diktor". Brauzerning o'zbek ovozidan foydalanadi:
**Microsoft Edge** da bepul "Microsoft Madina/Sardor Online (Natural) — Uzbek" bor. Chrome'da odatda o'zbek ovozi yo'q.
Diktor o'yin boshida komment/obunaga chaqiradi, chiqib ketganlar va g'olibni e'lon qiladi.

Ovozni videoga yozish: "Ovozni yozuvga qo'shish" ni yoqing. Yozish boshlanganda brauzer so'raydi:
shu oynani tanlab **Tab audio** ni belgilang. Brauzer diktor ovozini tab audioga qo'shmasa, ovoz yozuvga tushmaydi:
bunda videoni tahrirlashda ovoz qo'shing.

## Sifat va kino

- Saqlangan MP4 oddiy (faststart) ko'rinishga qayta yig'iladi: telefon galereyasi, Instagram va boshqa pleyerlar
  to'liq davomiylikni ko'radi (brauzerning xom yozuvi bo'laklangan bo'lib, ba'zi joylarda "2 soniya" ko'rinardi).
- 1080p (1080×1920) yoki 720p; kino effekti: vinyetka, sekin paydo bo'lish va so'nish.
- Three.js: bloom (nur), soyalar, neon chetlar, sharlar izi, yulduzlar, tezlikka qarab kengayuvchi ko'rish burchagi,
  marra paytida sekin harakat, Armiya jangida kino kameralar (umumiy reja, yon, jangchi yonida, yuqoridan).

## Arxitektura

Qatlamlar: `core` → `features` → `games` → `ui`. Build yo'q: oddiy `<script>` fayllar (`window.App`).

```
index.html · css/app.css · lib/ (three.js + postprocessing, lokal)
js/
  core/      util draw audio fx gl registry recorder session
  features/  roster narrator video-settings overlay
  games/     track3d/ army/ vs/ + wheel royale glass-bridge nick-plinko bomb sumo red-light
             hole territory rps multiply pendulum note-ring
  ui/        form shell
legacy/      eski bir fayllik versiya
```

### Yangi o'yin qo'shish

```js
App.registry.register({
  id: 'mening-oyinim', name: 'Nomi', tagline: 'Qisqa izoh',
  roster: false,              // true = obunachili toifada chiqadi
  settings: [{ key: 'count', label: 'Soni', type: 'range', min: 1, max: 20, default: 8 }],
  create(env) {
    // env: ctx, arena, cfg, speed, sched(), participants(n), fx, audio, say(matn), finish({...})
    return { update() {}, draw() {}, dispose() {} };
  },
});
```
