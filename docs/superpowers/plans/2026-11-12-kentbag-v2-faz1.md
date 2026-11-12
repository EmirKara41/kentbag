# KentBağ v2 · Faz 1 (ana akış) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vatandaş bildirir → ajan kuruma ve ekibe atar → ekip yola çıkar/varır/bitirir → vatandaş canlı izler ve bildirim alır; ajan kapatılıp elle yapılabilir. Canlı bulutta ve iki Android uygulamasında çalışır.

**Architecture:** `v2/` altında npm workspaces. Saf iş kuralları (`shared`: katalog, durum makinesi, ETA, ekip seçimi) hem API'de hem istemcilerde aynı kodla çalışır. API Express + PostgreSQL; ajan talep oluşturulunca eşzamanlı çalışır, ayrıca bir "süpürme" uç noktası takılı kalan talepleri yeniden işler. Web (merkez + kurum) ve iki Capacitor uygulaması aynı API'ye bearer oturumla bağlanır.

**Tech Stack:** TypeScript, Node 24, Express 5, pg, Better Auth (bearer), zod 4, @vercel/blob (private), @ai-sdk/google + ai (Gemini), firebase-admin (FCM), React 19 + Vite 8, Leaflet, Capacitor 8 (@capacitor/camera, geolocation, push-notifications, app), Vitest (shared/web birim), node:test + supertest + PGlite (API), Playwright (web duman testi).

**Spec:** `docs/superpowers/specs/2026-11-12-kentbag-v2-design.md`

## Global Constraints

- Arayüz metinleri Türkçe. Ekranlar 360 px genişlikte yatay kaydırma olmadan çalışır.
- Sürümler mevcut projeyle aynı aileden: react 19.3.1, vite 8.3.4, typescript 6.0.3 (istemciler) / 7.0.2 (api), express ^5.3.0, better-auth ^1.7.9, pg ^8.23.1, zod ^4.6.7, @capacitor/* ^8.
- Android: vatandaş `com.kentbag.vatandas` 2.0.0 (versionCode 1), ekip `com.kentbag.ekip` 1.0.0 (versionCode 1); imza `%USERPROFILE%\.cache\kentyanimda-android\signing\kent-mobile-preview.keystore`, alias `kentyanimda-preview`, şifreler `android` (mevcut gradle ile aynı).
- Veritabanı: mevcut Neon projesinde ayrı `kentbag2` veritabanı. Fotoğraflar özel Blob, yol öneki `v2/`. Vercel projeleri `kentbag2-api`, `kentbag2-web`, bölge `fra1`.
- Gizli anahtarlar yalnız sunucu ortam değişkeninde: `DATABASE_URL`, `BETTER_AUTH_SECRET` (≥32), `BETTER_AUTH_URL`, `WEB_ORIGINS`, `BLOB_READ_WRITE_TOKEN`, `GEMINI_API_KEY`, `GEMINI_MODEL` (varsayılan `gemini-3.5-flash-lite`), `FIREBASE_SERVICE_ACCOUNT` (base64 JSON, yoksa push kapalı), `DEMO_LOGIN` (`on` ise demo girişi açık), `DEMO_PASSWORD`.
- Kategori → kurum: electricity, lighting → `electricity`; water → `water`; waste → `cleaning`; road, pavement, accessibility, ice → `public-works`; park → `parks`.
- Ekipler: electricity: `elk-ariza` Elektrik arıza ekibi, `elk-bakim` Şebeke bakım ekibi, `elk-trafo` Trafo müdahale ekibi; water: `su-ariza` Su arıza ekibi, `su-kanal` Kanalizasyon ekibi; cleaning: `tmz-toplama` Atık toplama ekibi, `tmz-bolge` Bölge temizlik ekibi; public-works: `fen-yol` Yol bakım ekibi, `fen-kis` Kış bakım ekibi; parks: `prk-bakim` Park bakım ekibi, `prk-alan` Ortak alan ekibi.
- Varsayılan iş süresi (dk): electricity 60, water 90, waste 30, road 120, ice 45, lighting 60, pavement 120, accessibility 120, park 90.
- Gecikme payı: yol süresinin %20'si, en az 5 dk. Yedek yol tahmini: düz mesafe × 1,4 ÷ 30 km/sa. Ekip konumu 30 dk'dan eskiyse kullanılmaz.
- Ajan bir talepte yalnız `agent.center` ve `agent.institution.<id>` ikisi de açıkken çalışır.
- Ekip "bitti" → talep anında `resolved`; açıklama ≥10 karakter, fotoğraf isteğe bağlı (≤3, JPEG/PNG, ≤3 MB).
- Demo bölgesi Oltu (Erzurum); harita merkezi 40.5450, 41.9930.

## Review Focus

1. Çift gönderim (ağ tekrarı, çift dokunuş) → tek talep; ikinci istek aynı talebi döndürür. Test: Task 6.
2. Gemini hatası/zaman aşımı veya ajan çökmesi → talep kategori eşlemesiyle yönlendirilir; hiçbir talep `received` durumunda 60 sn'den fazla kalmaz (süpürme). Test: Task 7.
3. Mesaide ekip yokken gelen talep → `routed` ("atama bekliyor") kurum kuyruğunda görünür; bir ekip mesaiye girince ajan atar. Test: Task 7 ve 8.
4. Ekip, bu arada başka ekibe atanmış veya iptal edilmiş talepte işlem yapar → 409 ve anlaşılır mesaj; durum bozulmaz. Test: Task 8.
5. Haritası olmayan ve adresi bulunamayan talep → ETA "hesaplanamadı" (null), atama ve akış sürer. Test: Task 3 ve 10.

---

## Dosya yapısı

```
v2/
  package.json                 # workspaces: shared, api, web, citizen, crew
  tsconfig.base.json
  shared/
    package.json  vitest.config.ts
    src/catalog.ts             # kategoriler, kurumlar, ekipler, süreler, Oltu mahalleleri
    src/types.ts               # Request, RequestStatus, Event, Team, Role, Point
    src/workflow.ts            # durum makinesi: applyTransition
    src/eta.ts                 # yol tahmini yedeği, kuyruk ETA
    src/assign.ts              # en erken varan ekip seçimi
    src/labels.ts              # durumların vatandaş metinleri
    test/*.test.ts
  api/
    package.json  vercel.json  app.js  tsconfig.json
    migrations/001_init.sql
    src/config.ts  db.ts  auth.ts  app.ts  index.ts  errors.ts
    src/access.ts              # oturum + rol çözümü
    src/requests.ts            # talep deposu (SQL) + olay yazma
    src/citizen.ts             # vatandaş uç noktaları
    src/crew.ts                # ekip uç noktaları
    src/staff.ts               # merkez + kurum uç noktaları
    src/agent.ts               # Gemini sınıflama + yönlendirme + atama + süpürme
    src/geo.ts                 # OSRM yol süresi, Nominatim adres → konum
    src/push.ts                # FCM gönderimi + jeton kaydı
    src/photos.ts              # fotoğraf yükleme/okuma (Blob)
    src/seed.ts                # ekipler + demo hesaplar
    src/demo.ts                # demo girişi
    scripts/migrate.ts  scripts/seed.ts
    test/harness.ts  test/*.test.ts
  web/                          # merkez + kurum (tek site)
    package.json  vite.config.ts  index.html
    src/api.ts  src/session.ts  src/App.tsx  src/Login.tsx
    src/center/CenterPage.tsx  src/institution/InstitutionPage.tsx
    src/components/RequestDrawer.tsx  Timeline.tsx  StatusBadge.tsx  Map.tsx
    tests/smoke.spec.ts
  citizen/                      # Android vatandaş
    package.json  capacitor.config.ts  vite.config.ts  index.html
    src/api.ts  src/native.ts  src/App.tsx
    src/screens/Home.tsx  Report.tsx  RequestDetail.tsx  Login.tsx  Settings.tsx
    android/ (cap add android sonrası)
  crew/                         # Android ekip
    package.json  capacitor.config.ts  vite.config.ts  index.html
    src/api.ts  src/native.ts  src/App.tsx
    src/screens/Queue.tsx  JobDetail.tsx  Login.tsx
    android/
  scripts/build-android.ps1     # iki uygulama için imzalı APK
```

`shared` paket adı `@kentbag/shared`; API ve istemciler `import { ... } from "@kentbag/shared"` ile kullanır. Vite ve esbuild workspace kaynağını doğrudan derler.

---

### Task 1: Monorepo iskeleti ve katalog

**Files:**
- Create: `v2/package.json`, `v2/tsconfig.base.json`, `v2/.gitignore`, `v2/shared/package.json`, `v2/shared/vitest.config.ts`, `v2/shared/src/catalog.ts`, `v2/shared/src/types.ts`, `v2/shared/src/index.ts`
- Test: `v2/shared/test/catalog.test.ts`

**Interfaces:**
- Produces:
  - `type CategoryId = "electricity"|"water"|"waste"|"road"|"ice"|"lighting"|"pavement"|"accessibility"|"park"`
  - `type InstitutionId = "electricity"|"water"|"cleaning"|"public-works"|"parks"`
  - `categories: Record<CategoryId, { name: string; kind: "issue"|"improvement"; institution: InstitutionId; defaultMinutes: number }>` (kind: electricity, water, waste, road, ice → issue; lighting, pavement, accessibility, park → improvement)
  - `institutions: Record<InstitutionId, { name: string; teams: { id: string; name: string }[] }>` (adlar: Elektrik Dağıtımı, Su ve Kanalizasyon, Temizlik İşleri, Yol ve Fen İşleri, Park ve Bahçeler)
  - `institutionFor(category: CategoryId): InstitutionId`
  - `oltuNeighborhoods: string[]` (en az 10 mahalle) ve `oltuCenter: Point`
  - types.ts: `Point = { lat: number; lng: number }`, `Role = "citizen"|"center"|"institution"|"crew"`, `RequestStatus = "received"|"routed"|"assigned"|"en_route"|"on_site"|"resolved"|"reopened"|"cancelled"|"returned"`, `Priority = "urgent"|"high"|"normal"|"low"`, `CitizenRequest`, `RequestEvent`, `TeamState` (alanlar Task 2–4'te kullanıldığı gibi; tek kaynak burası)

- [ ] **Step 1:** `v2/package.json` workspaces (`shared`, `api`, `web`, `citizen`, `crew`), betikler: `test` (tüm workspace testleri), `typecheck`. `.gitignore`: node_modules, dist, .env*, android/app/build, android/.gradle, artifacts.
- [ ] **Step 2: Failing test** `catalog.test.ts`:
```ts
test("every category maps to an institution that has teams", () => {
  for (const id of Object.keys(categories) as CategoryId[]) {
    const inst = institutionFor(id);
    expect(institutions[inst].teams.length).toBeGreaterThan(0);
  }
  expect(institutionFor("lighting")).toBe("electricity");
  expect(institutionFor("ice")).toBe("public-works");
  expect(institutions.electricity.teams.map((t) => t.id)).toEqual(["elk-ariza", "elk-bakim", "elk-trafo"]);
  expect(categories.water.defaultMinutes).toBe(90);
});
```
- [ ] **Step 3:** `npm i` (kökte), `npm -w shared test` → FAIL.
- [ ] **Step 4:** catalog.ts ve types.ts'yi Global Constraints değerleriyle yaz.
- [ ] **Step 5:** `npm -w shared test` → PASS. Commit `v2: workspace and shared catalog`.

### Task 2: Durum makinesi

**Files:** Create `v2/shared/src/workflow.ts`, `v2/shared/src/labels.ts`; Test `v2/shared/test/workflow.test.ts`

**Interfaces:**
- Consumes: Task 1 tipleri.
- Produces:
  - `type Action = { type: "route"; institution: InstitutionId; reason: string } | { type: "assign"; teamId: string; reason: string } | { type: "depart" } | { type: "arrive"; remainingMinutes: number } | { type: "update_remaining"; remainingMinutes: number } | { type: "resolve"; note: string; photoIds: string[] } | { type: "reopen"; note: string; photoIds: string[] } | { type: "cancel"; reason: string } | { type: "decline"; reason: string }`
  - `type Actor = { role: Role | "agent"; userId?: string; teamId?: string; institution?: InstitutionId }`
  - `applyTransition(req: CitizenRequest, action: Action, actor: Actor, now: Date): { request: CitizenRequest; event: Omit<RequestEvent, "id"> }` — geçersizse `TransitionError` (code `"invalid_state"|"forbidden"|"invalid_input"`) fırlatır.
  - `statusLabel(req: CitizenRequest, institutionName?: string, teamName?: string): string` — "Alındı", "Elektrik Dağıtımı'na iletildi", "Trafo müdahale ekibine atandı", "Ekip yolda", "Ekip sahada", "Çözüldü", "Sorun devam ediyor", "İptal edildi", "Yeniden atanıyor".

İzinli geçişler (tablo testin kendisi):
| Aksiyon | Kaynak durumlar | Hedef | Kim |
|---|---|---|---|
| route | received, reopened, returned, routed | routed (team null) | agent, center |
| assign | routed, assigned, returned, reopened | assigned | agent, center, institution (kendi kurumu) |
| depart | assigned | en_route | crew (atanan ekip) |
| arrive | assigned, en_route | on_site | crew (atanan ekip) |
| update_remaining | on_site | on_site | crew (atanan ekip) |
| resolve | assigned, en_route, on_site | resolved | crew (atanan ekip) |
| reopen | resolved | reopened (team null) | citizen (sahibi) |
| cancel | received…on_site, reopened, returned | cancelled | citizen (sahibi), center, institution |
| decline | assigned, en_route, on_site | returned (team null) | crew (atanan ekip) |

Doğrulamalar: resolve.note ≥10 karakter; reopen.note ≥5; decline/cancel reason ≥10; remainingMinutes 1–600; photoIds ≤3.

- [ ] **Step 1: Failing tests** — tablodaki her satır için bir geçerli geçiş; şu reddedilmeler: başka ekibin `depart`'ı → forbidden; `resolved` talepte `depart` → invalid_state; 9 karakterlik resolve notu → invalid_input; citizen'ın başkasının talebini reopen etmesi → forbidden. Olay `public: true` olmalı (cancel ve decline gerekçesi hariç `public: false`), event.status hedef durum.
- [ ] **Step 2:** `npm -w shared test` → FAIL.
- [ ] **Step 3:** `applyTransition` ve `statusLabel`'ı yaz. `resolve` `resolvedAt`, `resolutionNote`, `resolutionPhotoIds` alanlarını doldurur; `reopen`/`decline`/`route` `teamId` ve ETA alanlarını boşaltır.
- [ ] **Step 4:** PASS. Commit `v2: request state machine`.

### Task 3: ETA hesabı

**Files:** Create `v2/shared/src/eta.ts`; Test `v2/shared/test/eta.test.ts`

**Interfaces:**
- Produces:
  - `fallbackTravelMinutes(a: Point, b: Point): number` — haversine km × 1,4 ÷ 30 × 60, yukarı yuvarla.
  - `withBuffer(travel: number): number` — `travel + max(5, ceil(travel*0.2))`.
  - `type QueueJob = { requestId: string; status: RequestStatus; point: Point | null; category: CategoryId; remainingMinutes: number | null; remainingSetAt: Date | null; etaArrival: Date | null }`
  - `type TravelFn = (a: Point, b: Point) => number` (dakika, tampon hariç)
  - `queueEta(input: { now: Date; teamPoint: Point | null; teamPointAt: Date | null; jobs: QueueJob[]; travel: TravelFn }): { requestId: string; arrival: Date | null; finish: Date | null }[]`

Algoritma (implementer seçemez, burada sabit):
```
cursorTime = now; cursorPoint = (teamPointAt && now - teamPointAt <= 30dk) ? teamPoint : null
for job in jobs (sıra korunur):
  if job.status == on_site:
     elapsed = now - remainingSetAt; left = max(5, remaining - elapsed)
     arrival = null (zaten orada); finish = now + left; cursorPoint = job.point
  else if job.status == en_route and job.etaArrival:
     arrival = job.etaArrival; finish = arrival + defaultMinutes(category)
  else:
     from = cursorPoint ?? previous job point ?? null
     if from == null or job.point == null: arrival = null; finish = null; (sonrakiler de null)
     else arrival = cursorTime + withBuffer(travel(from, job.point)); finish = arrival + defaultMinutes
  cursorTime = finish ?? cursorTime; cursorPoint = job.point ?? cursorPoint
```
Bir iş için arrival null olduysa ondan sonraki işler de null döner (zincir kırılır).

- [ ] **Step 1: Failing tests:** (a) boştaki ekip, konum 10 dk önce, iş 20 dk yol → arrival = now + 25 dk (20 + 5 min tampon); (b) elindeki iş on_site kalan 60 dk (10 dk önce girildi) + sıradaki iş 20 dk yol → arrival = now + 50 + 25; (c) ekip konumu 31 dk eski ve önceki iş yok → arrival null; (d) konumsuz iş → o ve sonrakiler null; (e) `withBuffer(50) === 60`, `withBuffer(10) === 15`.
- [ ] **Step 2:** FAIL. **Step 3:** yaz. **Step 4:** PASS. Commit `v2: queue ETA`.

### Task 4: Ekip seçimi (ajanın ikinci kararı)

**Files:** Create `v2/shared/src/assign.ts`; Test `v2/shared/test/assign.test.ts`

**Interfaces:**
- Consumes: `queueEta`, `withBuffer`, `TravelFn` (Task 3).
- Produces:
  - `type CandidateTeam = { id: string; name: string; onShift: boolean; active: boolean; point: Point | null; pointAt: Date | null; jobs: QueueJob[] }`
  - `chooseTeam(input: { now: Date; request: { id: string; point: Point | null; category: CategoryId; priority: Priority }; teams: CandidateTeam[]; travel: TravelFn }): { teamId: string; position: number; arrival: Date | null; reason: string } | null`

Kurallar: yalnız `active && onShift` ekipler. Yeni iş sıranın sonuna; `urgent` ise elindeki (on_site/en_route) işten hemen sonraya eklenir. Her aday için `queueEta` ile yeni işin varışı hesaplanır; en erken varış seçilir; tüm varışlar null ise en kısa sıradaki ekip seçilir; eşitlikte ekip id alfabetik. Aday yoksa `null`. `reason` Türkçe, örn: `"Trafo müdahale ekibi seçildi: sırada 2. iş, tahmini varış 14:30 (elindeki işin bitmesine 40 dk, yol 15 dk)."` ya da `"… varış süresi hesaplanamadı, en kısa sıra seçildi."`

- [ ] **Step 1: Failing tests:** iki ekip, biri boş ve 30 dk uzakta, öbürü elindeki iş 10 dk sonra bitiyor ve 5 dk yakın → ikincisi seçilir; mesai dışı ekip asla seçilmez; urgent talep sıranın 2. sırasına girer; aday yok → null; reason ekip adını içerir.
- [ ] **Step 2–4:** FAIL → yaz → PASS. Commit `v2: team selection`.

### Task 5: API temeli — veritabanı, giriş, roller, tohum veri, test düzeneği

**Files:**
- Create: `v2/api/package.json`, `tsconfig.json`, `vercel.json` (framework express, buildCommand `npm run build:cloud`, regions fra1), `app.js` (dist/server.js'i saran giriş, eski `sunucu/app.js` ile aynı desen), `migrations/001_init.sql`, `src/config.ts`, `src/db.ts`, `src/auth.ts`, `src/errors.ts`, `src/access.ts`, `src/app.ts`, `src/index.ts`, `src/seed.ts`, `scripts/migrate.ts`, `scripts/seed.ts`, `test/harness.ts`
- Test: `v2/api/test/access.test.ts`

**Interfaces:**
- Produces:
  - Tablolar (001_init.sql): Better Auth tabloları migrasyonla (`getMigrations`), ayrıca `staff(user_id pk, role check in center|institution|crew, institution_id, team_id, active bool)`, `team(id pk, institution_id, name, on_shift bool default false, active bool default true, lat, lng, located_at)`, `request(id uuid pk, reference text unique, citizen_id, client_request_id, kind, category, priority, description, address, lat, lng, status, institution_id, team_id, queue_order int, remaining_minutes, remaining_set_at, eta_arrival, eta_finish, agent_reason, resolution_note, resolution_photo_ids text[], resolved_at, photo_ids text[], created_at, updated_at, unique(citizen_id, client_request_id))`, `request_event(id, request_id, status, type, body, public bool, actor_role, actor_id, created_at)`, `photo(id pk, owner_id, request_id, path, content_type, created_at)`, `setting(key pk, value jsonb)`, `push_token(token pk, user_id, enabled bool, updated_at)`.
  - `type Db = { query(sql, params?): Promise<{ rows: any[] }>; tx<T>(fn: (q: Db) => Promise<T>): Promise<T> }` (`db.ts`), `createPgDb(url: string): Db`.
  - `createAuth(pool, config)` — eski `sunucu/src/auth.ts` ile aynı ayarlar (bearer requireSignature, minPasswordLength 8, rate limit), `trustedOrigins` = baseUrl + `https://localhost` + WEB_ORIGINS.
  - `access.ts`: `requireUser(req): Promise<{ userId; role: Role; institution?: InstitutionId; teamId?: string }>` — staff kaydı yoksa role `citizen`; pasif staff → 403.
  - `seed.ts`: `seedTeams(db)` (katalogdaki tüm ekipler, idempotent), `seedDemo(db, auth, password)` → hesaplar: `demo-vatandas@kentbag.app` (citizen), `demo-merkez@kentbag.app` (center), `demo-<institutionId>@kentbag.app` (institution, her kurum), `demo-<teamId>@kentbag.app` (crew, her ekip). Demo ekiplerinin `on_shift` değeri true ve konumları Oltu merkezine yakın farklı noktalar.
  - `test/harness.ts`: `startTestApi(): Promise<{ app: Express; db: Db; close(): Promise<void>; login(email: string): Promise<Record<string,string>> /* Authorization + Origin başlıkları */; signUpCitizen(email): Promise<headers> }>` — PGlite + `PGLiteSocketServer` rastgele portta, pg Pool, migrasyon + seedTeams + seedDemo (şifre `Test-only-password-123`), fotoğraf deposu bellek içi.
- `GET /api/health` → `{ ok: true, version: "2.0.0" }`; `GET /api/me` → `{ role, institution?, teamId?, name }`.

- [ ] **Step 1: Failing test** `access.test.ts`: `/api/health` 200; demo merkez ile `/api/me` → role center; demo `elk-trafo` → role crew, teamId `elk-trafo`, institution `electricity`; yeni kayıt vatandaş → role citizen; oturumsuz `/api/me` → 401.
- [ ] **Step 2:** `npm -w api test` → FAIL.
- [ ] **Step 3:** Dosyaları yaz. CORS: yalnız WEB_ORIGINS + `https://localhost`. Hata gövdesi her zaman `{ error: string }` (Türkçe).
- [ ] **Step 4:** PASS. Commit `v2: api foundation, auth, roles, seed`.

### Task 6: Fotoğraflar ve vatandaş uç noktaları

**Files:** Create `v2/api/src/photos.ts`, `v2/api/src/requests.ts`, `v2/api/src/citizen.ts`; Test `v2/api/test/citizen.test.ts`

**Interfaces:**
- Consumes: Task 2 `applyTransition`, Task 5 `Db`, `requireUser`.
- Produces:
  - `requests.ts`: `getRequest(db, id)`, `saveTransition(db, id, action, actor, now): Promise<CitizenRequest>` (satırı `FOR UPDATE` kilitler, `applyTransition` çağırır, olayı yazar, `TransitionError`'ı 409/403/400'e çevirir; kaydettikten sonra `onChange` kancalarını çağırır — Task 10/11 burada ETA ve push ekler), `listForCitizen(db, userId)`, `toCitizenView(req, events)`.
  - `PUT /api/photos/:clientId` (gövde ham JPEG/PNG ≤3 MB) → `{ id }`; `GET /api/photos/:id?expires&signature` (imzalı 30 dk). Tür ve boyut eski `sunucu` doğrulamasıyla aynı (file-type + image-size).
  - `POST /api/requests` `{ clientRequestId, category, description (10–1000), address (≤300), point?: Point, photoIds ≤3 }` → `201 { request }`; aynı `clientRequestId` tekrarı → `200 { request }` (aynı id). Kaydettikten sonra `agent.processRequest(id)` beklenir (Task 7; bu görevde boş fonksiyon).
  - `GET /api/requests/mine` → `{ requests: CitizenView[] }` (yeniden eskiye).
  - `GET /api/requests/:id` → `{ request: CitizenView }` (yalnız sahibi; başkası 404). `CitizenView` = talep alanları + `statusLabel` + `events` (yalnız public) + `institutionName` + `teamName` + `etaArrival`, `etaFinish` + `resolutionPhotos` (imzalı URL) — personel adı/kişisel veri yok.
  - `POST /api/requests/:id/reopen` `{ note, photoIds }`, `POST /api/requests/:id/cancel` `{ reason }`.
- [ ] **Step 1: Failing tests:** talep oluştur → 201, status `received`, reference `KB-` + 6 karakter; aynı clientRequestId tekrar → 200 ve aynı id, toplam 1 kayıt (Review Focus 1); başka vatandaş detayı → 404; 9 karakterlik açıklama → 400; 4 fotoğraf → 400; başkasının fotoğrafı photoIds içinde → 409; reopen yalnız resolved'da (received'da 409).
- [ ] **Step 2–4:** FAIL → yaz → PASS. Commit `v2: citizen requests and photos`.

### Task 7: Ajan (yönlendirme + atama + süpürme) ve ayarlar

**Files:** Create `v2/api/src/agent.ts`, `v2/api/src/settings.ts`; Modify `v2/api/src/citizen.ts` (processRequest çağrısı); Test `v2/api/test/agent.test.ts`

**Interfaces:**
- Consumes: `chooseTeam` (Task 4), `saveTransition` (Task 6), `institutionFor` (Task 1), `travelMinutes` (Task 10; bu görevde `fallbackTravelMinutes` ile enjekte edilir).
- Produces:
  - `settings.ts`: `agentEnabled(db, institution: InstitutionId): Promise<boolean>` (center && institution; varsayılan ikisi de true), `setAgent(db, scope: "center" | InstitutionId, on: boolean)`.
  - `agent.ts`: `createAgent(deps: { db: Db; classify?: (input:{category;description;address}) => Promise<{ category?: CategoryId; priority: Priority; note: string }>; travel: TravelFn; now?: () => Date })` → `{ processRequest(id): Promise<void>; assignWaiting(institution: InstitutionId): Promise<number>; sweep(): Promise<{ processed: number }> ; suggest(id): Promise<{ institution; teamId: string|null; reason: string }> }`.
  - Davranış: `processRequest` — talep `received|reopened|returned` ise: `classify` 6 sn zaman aşımıyla çağrılır; hata/zaman aşımı → kategori aynen, priority `normal`, not "Yapay zekâ yanıt vermedi; kategoriye göre yönlendirildi." Kategori önerisi farklıysa yalnız `agent_reason` içine yazılır, kategori değiştirilmez. Kurum = `institutionFor(category)`. Kural: merkez ajanı kapalıysa talep `received` kalır ve merkez elle yönlendirir. Merkez açık, kurum kapalıysa `routed` yapılır ama ekip atanmaz (kurum elle atar). İkisi de açıksa route + `chooseTeam` ile assign; aday yoksa `routed` kalır.
  - `assignWaiting(institution)` — o kurumdaki `routed` talepleri oluşturulma sırasına göre atamayı dener (ekip mesaiye girince ve süpürmede çağrılır).
  - `sweep()` — 60 sn'den eski `received` (merkez ajanı açıksa) ve tüm kurumların `routed` talepleri için yeniden dener. `POST /api/agent/sweep` (merkez rolü veya `x-cron-secret` = BETTER_AUTH_SECRET'tan türetilmiş başlık) ve web panelleri her 30 sn'de bir çağırır.
  - Gemini: `@ai-sdk/google` + `generateObject` (zod şema `{ category?, priority, note }`), anahtar yoksa `classify` tanımsız → doğrudan kural.
- [ ] **Step 1: Failing tests:** (a) classify yok, elektrik talebi → `assigned`, `team_id` dolu, `agent_reason` ekip adını içerir; (b) classify hata fırlatır → yine `assigned` ve not "yanıt vermedi" (Review Focus 2); (c) classify 7 sn sürer → zaman aşımıyla aynı sonuç, test sahte saatle; (d) tüm su ekipleri mesai dışı → `routed`; bir ekip `on_shift=true` + `assignWaiting("water")` → `assigned` (Review Focus 3); (e) merkez ajanı kapalı → `received` kalır; (f) kurum ajanı kapalı → `routed`, ekip yok; (g) `sweep` 61 sn önce oluşturulmuş `received` talebi işler.
- [ ] **Step 2–4:** FAIL → yaz → PASS. Commit `v2: agent routing, assignment and sweep`.

### Task 8: Ekip uç noktaları

**Files:** Create `v2/api/src/crew.ts`; Test `v2/api/test/crew.test.ts`

**Interfaces:**
- Consumes: `saveTransition`, `agent.assignWaiting`, `requireUser` (role crew).
- Produces:
  - `GET /api/crew/queue` → `{ team: { id, name, institutionName, onShift }, jobs: CrewJob[] }` sıralı (`queue_order`); `CrewJob` = id, reference, category adı, priority, status, description, address, point, photos (imzalı URL), etaArrival, etaFinish, remainingMinutes, createdAt.
  - `POST /api/crew/shift` `{ onShift: boolean }` → açılınca `assignWaiting(team.institution)` çağrılır.
  - `POST /api/crew/location` `{ point: Point }` → team.lat/lng/located_at; 204.
  - `POST /api/crew/jobs/:id/depart|arrive|remaining|resolve|decline` gövdeleri Task 2 aksiyonlarıyla aynı; yanıt `{ job }`. Talep artık bu ekipte değilse → 409 `"Bu iş artık ekibinizde değil. Liste yenilendi."` (Review Focus 4).
  - `queue_order`: assign sırasında `chooseTeam.position`'a göre yerleştirilir ve sonrakiler kaydırılır; resolve/decline/reassign'da sıra sıkıştırılır (yardımcı `reorderQueue(db, teamId)` `requests.ts` içinde).
- [ ] **Step 1: Failing tests:** demo `elk-trafo` mesaide; elektrik talebi atanır → queue'da görünür; depart → en_route; arrive remaining 45 → on_site; resolve notla → resolved ve vatandaş detayında status `resolved`, resolutionNote görünür; diğer elektrik ekibinin aynı işe depart'ı → 409; decline → returned, ardından ajan başka mesaideki ekibe atar; mesai kapalı ekibe atama yapılmaz.
- [ ] **Step 2–4:** FAIL → yaz → PASS. Commit `v2: crew endpoints and queue order`.

### Task 9: Merkez ve kurum uç noktaları

**Files:** Create `v2/api/src/staff.ts`; Test `v2/api/test/staff.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/staff/requests?status&institution&q` → merkez tüm talepleri, kurum yalnız kendi kurumununkileri görür; filtre yoksa hepsi (Review Focus "kaybolmayan bildirim": `received` dahil). Her satır: id, reference, category, priority, status, statusLabel, institutionName, teamName, address, createdAt, etaArrival, agentReason.
  - `GET /api/staff/requests/:id` → tüm olaylar (iç olaylar dahil), fotoğraflar, vatandaşın adı **yalnız merkeze**.
  - `POST /api/staff/requests/:id/route` `{ institution }` (merkez), `/assign` `{ teamId }` (merkez veya o kurum), `/cancel` `{ reason }`, `/suggest` → `agent.suggest`.
  - `GET /api/staff/teams?institution` → ekipler + onShift + jobs sayısı + sıradaki işler (ETA'larıyla).
  - `PATCH /api/staff/teams/:id` `{ active }` (kurum kendi ekibi; merkez hepsi).
  - `GET/PUT /api/staff/agent` `{ center: boolean, institutions: Record<InstitutionId, boolean> }` — merkez hepsini, kurum yalnız kendi anahtarını değiştirebilir.
- [ ] **Step 1: Failing tests:** kurum başka kurumun talebini göremez (404) ve atayamaz (403); merkez ajanı kapat → yeni talep `received` listede görünür → merkez elle route + assign → crew queue'da; kurum ajan anahtarı kendi kurumunu değiştirir, merkezinkini değiştiremez (403); vatandaş adı kurum yanıtında yok.
- [ ] **Step 2–4:** FAIL → yaz → PASS. Commit `v2: center and institution endpoints`.

### Task 10: Yol süresi, adres → konum ve ETA güncelleme

**Files:** Create `v2/api/src/geo.ts`; Modify `v2/api/src/requests.ts` (onChange kancası), `v2/api/src/index.ts`; Test `v2/api/test/geo.test.ts`

**Interfaces:**
- Produces:
  - `createGeo(deps: { fetch: typeof fetch; now?: () => Date })` → `{ travel(a, b): Promise<number> ; geocode(address: string): Promise<Point | null> }`. OSRM `https://router.project-osrm.org/route/v1/driving/{lng},{lat};{lng},{lat}?overview=false` (2,5 sn zaman aşımı, sonuç dk, bellek önbelleği 10 dk); hata → `fallbackTravelMinutes`. Nominatim `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=<adres>, Oltu, Erzurum`, User-Agent `KentBag-ders-projesi/2.0`, 3 sn zaman aşımı, hata → null.
  - Talep oluşturulurken `point` yoksa `geocode(address)` denenir (Review Focus 5).
  - `recomputeTeamEta(db, teamId, geo, now)` — ekibin işleri için `queueEta` çağırır (travel için `Promise` sonuçlarını önceden hesaplar), `eta_arrival`/`eta_finish` yazar. `saveTransition` sonrası ve `crew/location`, `crew/shift` sonrası çağrılır.
  - `chooseTeam` senkron `TravelFn` istediği için agent, adaylar ve talep noktası arasındaki yol sürelerini önce `geo.travel` ile toplayıp bir harita üzerinden senkron fonksiyon verir.
- [ ] **Step 1: Failing tests (sahte fetch):** OSRM 1200 sn döner → `travel` 20; OSRM hata → fallback değeri; geocode bulunamaz → null ve talep yine `assigned`, `eta_arrival` null; ekip on_site kalan 60 → sıradaki işin `eta_arrival` ≈ now+60+travel+tampon.
- [ ] **Step 2–4:** FAIL → yaz → PASS. Commit `v2: travel times and live ETA`.

### Task 11: Telefon bildirimleri

**Files:** Create `v2/api/src/push.ts`; Modify `requests.ts` (onChange kancası); Test `v2/api/test/push.test.ts`

**Interfaces:**
- Produces:
  - `POST /api/push/token` `{ token, enabled }`, `DELETE /api/push/token/:token`.
  - `createPush(deps: { send?: (tokens: string[], msg: { title; body; data: { requestId: string } }) => Promise<void> })` — `FIREBASE_SERVICE_ACCOUNT` varsa firebase-admin `messaging().sendEachForMulticast`; yoksa no-op. Geçersiz jetonlar silinir.
  - Kim ne alır: vatandaş (talep sahibi) her public olayda; ekip üyeleri yeni atamada ("Yeni iş: Elektrik kesintisi · Cumhuriyet Mah.") ve işleri başka ekibe geçince. Gönderim hatası işlemi bozmaz (try/catch, log).
- [ ] **Step 1: Failing tests (sahte send):** atama → trafo ekibi üyelerinin jetonlarına 1 gönderim; resolve → vatandaşa "Sorununuz çözüldü" başlıklı 1 gönderim; `enabled:false` jetona gönderim yok; send hata fırlatır → resolve yine 200.
- [ ] **Step 2–4:** FAIL → yaz → PASS. Commit `v2: push notifications`.

### Task 12: Demo girişi ve uçtan uca akış testi

**Files:** Create `v2/api/src/demo.ts`; Test `v2/api/test/flow.test.ts`

**Interfaces:**
- Produces: `GET /api/demo/accounts` → `DEMO_LOGIN=on` iken `[{ key, label, role, app: "web"|"citizen"|"crew" }]` (key örn. `merkez`, `elektrik-kurumu`, `elk-trafo`, `vatandas`); kapalıyken 404. `POST /api/demo/login` `{ key }` → `{ token }` (sunucu `DEMO_PASSWORD` ile `signInEmail`; yalnız demo hesapları).
- [ ] **Step 1: Failing test** `flow.test.ts` — spec bölüm 2'deki 6 adım API üzerinden: vatandaş elektrik talebi → 3 sn içinde `assigned` + agentReason; ekip depart → vatandaş görünümünde "Ekip yolda" ve etaArrival; arrive (remaining 30) → "Ekip sahada" ve etaFinish; resolve (not + 1 fotoğraf) → vatandaş `resolved`, resolutionPhotos 1; vatandaş reopen → `reopened` → ajan yeniden `assigned`; merkez ajanı kapat → yeni talep `received` → merkez route + kurum assign → ekip resolve. Demo login: `DEMO_LOGIN` kapalı → 404, açık → token ile `/api/me` role center.
- [ ] **Step 2–4:** FAIL → yaz → PASS. `npm -w api test` tamamı PASS. Commit `v2: demo login and end-to-end flow test`.

### Task 13: Web — oturum, giriş, ortak bileşenler

**Files:** Create `v2/web/package.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/api.ts`, `src/session.ts`, `src/App.tsx`, `src/Login.tsx`, `src/components/StatusBadge.tsx`, `Timeline.tsx`, `Map.tsx`, `RequestDrawer.tsx`, `src/styles.css`; Test `v2/web/tests/smoke.spec.ts` (Playwright, API'yi `page.route` ile taklit eder)

**Interfaces:**
- Produces: `api<T>(path, init?)` (bearer `sessionStorage['kb.token']`, `VITE_API_URL`), `useMe()`, `App` rol yönlendirmesi: center → `CenterPage`, institution → `InstitutionPage`, diğer roller → "Bu hesap web paneline erişemez; Android uygulamasını kullanın." `Login`: e-posta/şifre + `GET /api/demo/accounts` doluysa "Demo olarak gir" düğmeleri (yalnız `app: "web"`). Üst bilgi: rol + kurum adı + çıkış. Rol kuralı metni girişte: "Her hesap tek role sahiptir: merkez, kurum veya saha ekibi."
- `RequestDrawer({ id, onClose })`: başlık, durum, aciliyet, adres + Leaflet harita (nokta varsa), fotoğraflar, ajan gerekçesi, zaman çizelgesi (`Timeline`), rolüne göre tek "Sıradaki adım" alanı (Task 14/15 doldurur).
- [ ] **Step 1: Failing smoke test:** demo düğmesi "Merkez" → `/api/demo/login` çağrılır → merkez sayfa başlığı görünür; crew rolü → uyarı metni; 375 px genişlikte yatay kaydırma yok.
- [ ] **Step 2–4:** FAIL → yaz → PASS. Commit `v2: web shell, login, shared components`.

### Task 14: Web — merkez ekranı

**Files:** Create `v2/web/src/center/CenterPage.tsx`, `AgentSwitch.tsx`; Test smoke'a ekle

**Davranış:** Tek sayfa: üstte ajan anahtarı (merkez + 5 kurum, açık/kapalı) ve sayaçlar (Onay bekleyen = `received`, Atama bekleyen = `routed`, Sahada = assigned/en_route/on_site, Bugün çözülen). Altta tek talep listesi (durum filtresi, arama), satıra tıklayınca `RequestDrawer`. Drawer'da sıradaki adım: `received` → kurum seçimi (varsayılan ajan önerisi `POST …/suggest`) + **Yönlendir**; `routed` → ekip seçimi (öneri + ETA'lar) + **Ata**; diğer aktif durumlar → **İptal** (gerekçe). 30 sn'de bir liste yenilenir ve `POST /api/agent/sweep` çağrılır.
- [ ] **Step 1: Failing smoke:** ajan kapalı + `received` talep → drawer'da "Yönlendir" → doğru istek gövdesi; anahtar tıklanınca `PUT /api/staff/agent` gövdesi doğru.
- [ ] **Step 2–4:** FAIL → yaz → PASS. Commit `v2: center page`.

### Task 15: Web — kurum ekranı

**Files:** Create `v2/web/src/institution/InstitutionPage.tsx`, `TeamBoard.tsx`; Test smoke'a ekle

**Davranış:** Sol: "Atama bekleyen" (`routed`, `returned`, `reopened`) kartları, her kartta ajan önerisi + **Öneriyi uygula** veya ekip seçip **Ata**. Sağ: ekip panosu — her ekip bir sütun: mesai durumu, aktif/pasif anahtarı, sıradaki işler (durum + ETA). Üstte kurumun ajan anahtarı. Talep kartı → `RequestDrawer`. 30 sn yenileme + sweep.
- [ ] **Step 1: Failing smoke:** atama bekleyen kartta "Öneriyi uygula" → `POST /assign` doğru teamId; ekip pasif anahtarı → PATCH gövdesi.
- [ ] **Step 2–4:** FAIL → yaz → PASS. Commit `v2: institution page`.

### Task 16: Vatandaş Android uygulaması

**Files:** Create `v2/citizen/*` (package.json, capacitor.config.ts appId `com.kentbag.vatandas` appName "KentBağ", webDir dist, androidScheme https), `src/api.ts`, `src/native.ts` (oturum Keystore eklentisi: eski `mobil/android/.../KentSessionPlugin.java` paket adı değiştirilerek kopyalanır; kamera/galeri; konum; push kaydı), `src/screens/*`; `android/` (`npx cap add android` + imza ayarı + KentSessionPlugin + MainActivity kaydı); Test `v2/citizen/test/report.test.ts` (Vitest: form doğrulama ve taslak saklama saf fonksiyonları)

**Davranış:**
- Giriş/kayıt ekranı (+ demo "Vatandaş olarak gir" düğmesi `app: "citizen"`); oturum Keystore'da.
- Ana ekran: büyük "Sorun bildir"; "Taleplerim" kartları (durum etiketi + ETA satırı: "Tahmini varış 14:30" / "Tahmini çözüm 16:00"); 20 sn'de bir ve uygulama öne gelince yenileme.
- Bildir (tek ekran): kategori ızgarası (arızalar), açıklama, konum (GPS / haritadan seç / adres yaz), ≤3 fotoğraf; gönder → `clientRequestId` (crypto.randomUUID, taslakla birlikte saklanır); yalnız 201/200 gelince başarı; hata → taslak korunur, "Tekrar dene".
- Detay: kargo takibi zaman çizelgesi, harita, ETA, kapanış notu + fotoğraf, "Sorun devam ediyor" (resolved iken; not + fotoğraf), "İptal et" (aktifken).
- Ayarlar: bildirimleri aç/kapat (`POST /api/push/token`), çıkış.
- Push dokununca ilgili detay açılır (`data.requestId`).
- [ ] **Step 1: Failing tests:** `validateReport({ category, description, address, point, photos })` — açıklama 9 karakter → hata "Sorunu en az 10 karakterle anlat."; konum ve adres yok → "Konum seç veya adres yaz."; geçerli → null. `draftStore` aynı clientRequestId'yi korur.
- [ ] **Step 2–4:** FAIL → yaz → PASS; `npm -w citizen run build` başarılı; `npx cap sync android`.
- [ ] **Step 5:** Commit `v2: citizen android app`.

### Task 17: Ekip Android uygulaması

**Files:** Create `v2/crew/*` (appId `com.kentbag.ekip`, appName "KentBağ Ekip"), `src/screens/Queue.tsx`, `JobDetail.tsx`, `Login.tsx`, `src/location.ts`; `android/` aynı desen; Test `v2/crew/test/next-action.test.ts`

**Interfaces:**
- Produces: `nextAction(job: CrewJob): { label: "Yola çıktım" | "Vardım" | "Bitti"; action: "depart" | "arrive" | "resolve" } | null` (assigned → depart, en_route → arrive, on_site → resolve).

**Davranış:**
- Giriş (+ demo düğmeleri `app: "crew"`). Ana ekran: üstte ekip adı + **Mesaideyiz / Mesai dışı** anahtarı; "Şimdiki iş" kartı tek büyük düğmeyle (`nextAction`); "Vardım" kalan süre seçtirir (15/30/45/60/90/120 dk); "Bitti" not (≥10) + ≤3 fotoğraf; on_site iken "Kalan süreyi güncelle". Altta sıradaki işler + tahmini başlama saatleri. "Yapamıyorum" (gerekçe ≥10) → decline. "Navigasyonda aç" → `geo:` bağlantısı.
- Konum: mesai açıkken uygulama ön plandayken 3 dk'da bir ve her aksiyondan önce `POST /api/crew/location` (izin yoksa uyarı, akış sürer).
- 15 sn yenileme; 409 alınca liste yenilenir ve mesaj gösterilir.
- Push: yeni iş bildirimi, dokununca kuyruk açılır.
- [ ] **Step 1: Failing test:** `nextAction` üç durum + resolved → null.
- [ ] **Step 2–4:** FAIL → yaz → PASS; build + `cap sync`. Commit `v2: crew android app`.

### Task 18: Canlıya alma

**Files:** Create `v2/scripts/build-android.ps1` (eski `saha/scripts/build-android.ps1` deseni; iki uygulamayı derler, `v2/artifacts/` altına `KentBag-Vatandas-2.0.0.apk`, `KentBag-Ekip-1.0.0.apk` koyar, SHA-256 yazar), `v2/web/public/indir/index.html` (iki APK bağlantısı + QR), `v2/DEMO.md` (sunum senaryosu, demo düğmeleri, sırayla ekranlar)

- [ ] **Step 1:** Neon'da `kentbag2` veritabanını oluştur (mevcut bağlantıyla `CREATE DATABASE kentbag2`), `DATABASE_URL`'i yeni veritabanına yönelt.
- [ ] **Step 2:** Vercel: `kentbag2-api` projesi (kök `v2/api`), ortam değişkenleri (Global Constraints), `npm run migrate` + `npm run seed` yeni veritabanına; `vercel deploy --prod`; `/api/health` → `{ ok: true, version: "2.0.0" }`.
- [ ] **Step 3:** `kentbag2-web` projesi (kök `v2/web`, `VITE_API_URL`), deploy; demo "Merkez" girişi çalışır.
- [ ] **Step 4:** APK'ları `VITE_API_URL` = canlı API ile derle, web `public/indir/` altına kopyala, web'i yeniden yayınla; indirme sayfası 200 ve APK boyutları doğru.
- [ ] **Step 5:** Canlı duman testi (script `v2/api/scripts/smoke-live.ts`, demo hesaplarla): talep → assigned → depart → arrive → resolve → vatandaş resolved; test talebi "DEMO TESTİ" açıklamasıyla, sonra iptal edilir.
- [ ] **Step 6:** Commit `v2: deploy scripts, download page, demo script`. Kullanıcıya: APK bağlantıları, demo girişleri, Firebase adımları (google-services.json iki uygulamaya, `FIREBASE_SERVICE_ACCOUNT` Vercel'e; sonra APK yeniden derlenir).

---

## Faz 2 (ayrı plan, Faz 1 canlıya çıkınca yazılır)

Spec bölüm 7: ortak sorunlar ve takip ("Ben de etkileniyorum", birleştirme), iyileştirme istekleri, duyurular, personel yönetimi ve saha başvuruları, şifre sıfırlama e-postası, raporlar ve CSV. Faz 1'in tabloları (`request.kind`, `staff`, `push_token`) bunlara hazırdır.
