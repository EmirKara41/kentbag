import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { App as NativeApp } from "@capacitor/app";
import {
  HardHat,
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Images,
  Check,
  ClipboardList,
  Clock,
  MapPin,
  LogOut,
  RefreshCw,
  Send,
  Plus,
  X,
  ShieldCheck,
} from "lucide-react";
import { get, set, del } from "idb-keyval";
import { api, ApiError } from "./api";
import { capturePhoto, preparePhoto, native } from "./native";
import { EnrollmentPage } from './Enrollment';
import {
  date,
  stages,
  priorities,
  needsFix,
  workable,
  type Draft,
  type Job,
  type Workspace,
  type Enrollment,
  type Account,
} from "./domain";
const empty: Draft = { body: "", photos: [] };
export default function App() {
  const [data, setData] = useState<Workspace | null>(null),
    [enrollment,setEnrollment]=useState<Enrollment|null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [tab, setTab] = useState("active"),
    [sync, setSync] = useState("");
  const identity = useRef(0);
  const enter=useCallback((value:Account|null)=>{
    if(value&&'kind' in value){setEnrollment(value);setData(null);}
    else{setEnrollment(null);setData(value);}
  },[]);
  const authenticated=!!data;
  const refresh = useCallback(async () => {
    const expected = identity.current;
    try {
      const value = await api.workspace();
      if (expected !== identity.current) return;
      setData(value);
      setError("");
      setSync(new Date().toISOString());
    } catch (e) {
      if(e instanceof ApiError&&e.status===401&&expected===identity.current){setData(null);setSelected(null);}
      if (expected === identity.current)
        setError(e instanceof Error ? e.message : "Sunucuya ulaşılamadı.");
    }
  }, []);
  useEffect(() => {
    let active = true;
    void api
      .restore()
      .then((value) => {
        if (active) enter(value);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enter]);
  useEffect(() => {
    if (!authenticated) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15000);
    const focus = () => void refresh();
    window.addEventListener("online", focus);
    window.addEventListener("focus", focus);
    const listener = native
      ? NativeApp.addListener("appStateChange", (s) => {
          if (s.isActive) void refresh();
        })
      : null;
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", focus);
      window.removeEventListener("focus", focus);
      void listener?.then((l) => l.remove());
    };
  }, [authenticated, refresh]);
  useEffect(() => {
    if (!native) return;
    const handler = NativeApp.addListener("backButton", () => {
      if (selected) setSelected(null);
      else void NativeApp.minimizeApp();
    });
    return () => {
      void handler.then((l) => l.remove());
    };
  }, [selected]);
  async function logout() {
    if (
      data &&
      !window.confirm(
        "Oturum kapatılsın mı? Kaydedilmemiş taslakların bu cihazda kalır.",
      )
    )
      return;
    identity.current++;
    await api.logout().catch(() => {});
    setData(null);
    setEnrollment(null);
    setSelected(null);
    setError("");
  }
  if (loading)
    return (
      <main className="loading">
        <HardHat size={40} />
        <p>Çalışma alanı açılıyor…</p>
      </main>
    );
  if(enrollment) return <EnrollmentPage data={enrollment} onAccount={enter} logout={logout}/>;
  if (!data)
    return (
      <Login
        onLogin={(value) => {
          identity.current++;
          enter(value);
          setError("");
        }}
      />
    );
  const chosen = data.jobs.find((j) => j.id === selected);
  const rank = { urgent: 0, high: 1, normal: 2, low: 3 };
  // Results sent back for correction come first, then by priority.
  const jobs = data.jobs
    .filter((j) => (tab === "active" ? workable(j) : true))
    .sort(
      (a, b) =>
        Number(needsFix(b)) - Number(needsFix(a)) ||
        rank[a.priority] - rank[b.priority],
    );
  return (
    <div className="field-app">
      <header className="app-header">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setSelected(null);
          }}
        >
          <span className="brand-icon">
            <HardHat size={23} />
          </span>
          <strong>
            Kent<span>Bağ</span>
            <small>SAHA EKİBİ</small>
          </strong>
        </a>
        <button
          className="icon-button"
          aria-label="Oturumu kapat"
          onClick={() => void logout()}
        >
          <LogOut size={20} />
        </button>
      </header>
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button onClick={() => void refresh()}>Yenile</button>
        </div>
      )}
      {chosen ? (
        <JobDetail
          key={`${data.member.userId}:${chosen.id}`}
          job={chosen}
          ownerId={data.member.userId}
          refresh={refresh}
          back={() => setSelected(null)}
        />
      ) : (
        <main className="jobs-page">
          <div className="team-tag">
            <span className="online-dot" />
            {data.institution} · {data.team}
          </div>
          <div className="greeting">
            <div>
              <p>Kolay gelsin, {data.member.name.split(" ")[0]}.</p>
              <h1>Sahada bugün</h1>
            </div>
            <button
              className="icon-button"
              aria-label="Görevleri yenile"
              onClick={() => void refresh()}
            >
              <RefreshCw size={20} />
            </button>
          </div>
          <section className="shift-card">
            <span>EKİBİNİN İŞ LİSTESİ</span>
            <strong>
              {data.jobs.filter(workable).length} aktif görev
            </strong>
            <p>
              Kurumundan gelen görevleri kabul et, yapılan işlemi fotoğrafıyla
              kuruma ilet.
            </p>
            <div>
              <ShieldCheck size={16} />
              Sonuçlar kurum ve merkez kontrolünden geçer.
            </div>
          </section>
          <div className="tabs" role="tablist" aria-label="Görev görünümü">
            <button
              role="tab"
              aria-selected={tab === "active"}
              onClick={() => setTab("active")}
            >
              Yapılacaklar
            </button>
            <button
              role="tab"
              aria-selected={tab === "all"}
              onClick={() => setTab("all")}
            >
              Tüm görevler
            </button>
          </div>
          <div className="list-heading">
            <h2>{tab === "active" ? "Görevlerin" : "Tüm görevler"}</h2>
            <span>{jobs.length} kayıt</span>
          </div>
          {!jobs.length ? (
            <section className="empty">
              <ClipboardList size={34} />
              <h3>Bu görünümde görev yok.</h3>
              <p>Kurumunun ekibine atadığı işler burada görünecek.</p>
            </section>
          ) : (
            jobs.map((job) => (
              <button
                className="job-card"
                key={job.id}
                onClick={() => setSelected(job.id)}
              >
                <div>
                  <small>{job.reference}</small>
                  <span className={`priority ${job.priority}`}>
                    {priorities[job.priority]}
                  </span>
                </div>
                {needsFix(job) && (
                  <span className="fix-badge">Düzeltme istendi</span>
                )}
                <h3>{job.title}</h3>
                <p>
                  <MapPin size={15} />
                  {placeText(job)}
                </p>
                <footer>
                  <span>
                    {job.state === "cancelled"
                      ? "Görev iptal edildi"
                      : stages[job.crewState]}
                  </span>
                  <ArrowUpRight size={19} />
                </footer>
              </button>
            ))
          )}
          <p className="sync">
            <Clock size={13} />
            {sync
              ? `Son yenileme ${date(sync)}`
              : "Kurumundan atanmış gerçek görev kayıtları"}
          </p>
          <footer className="app-footer">KentBağ Saha · 0.1.3</footer>
        </main>
      )}
    </div>
  );
}
const placeText = (job: Job) =>
  job.address ||
  (job.point ? "Konum haritada işaretlendi" : "Adres bilgisi yok");
function Login({ onLogin }: { onLogin: (data: Account) => void }) {
  const [email, setEmail] = useState(""),
    [name,setName]=useState(''),
    [register,setRegister]=useState(false),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(await (register?api.register(name,email,password):api.login(email, password)));
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Giriş yapılamadı.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <div className="login-brand">
        <HardHat size={35} />
        <span>
          KentBağ <b>Saha</b>
        </span>
      </div>
      <span className="eyebrow">İŞİN BAŞINDA, EKİBİN YANINDA.</span>
      <h1>
        {register?'Ekibine katıl,':'Bugünün işleri'}
        <br />
        {register?'hesabını oluştur.':'buradan başlar.'}
      </h1>
      <p>
        {register?'Adın, e-postan ve şifrenle kayıt ol. Sonraki adımda kurumunu ve ekibini seçerek merkez onayına gönderebilirsin.':'Saha hesabınla giriş yap. Hesabın yoksa aşağıdan hesap oluşturabilirsin.'}
      </p>
      <form onSubmit={(e) => void submit(e)}>
        {register&&<label>Ad soyad<input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label>}
        <label>
          E-posta
          <input
            type="email"
            autoComplete="username"
            maxLength={254}
            disabled={busy}
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="personel@kurum.com"
          />
        </label>
        <label>
          Şifre
          <input
            type="password"
            autoComplete={register?'new-password':'current-password'}
            minLength={register?12:undefined}
            maxLength={128}
            disabled={busy}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {register&&<small>En az 12 karakter kullan.</small>}
        </label>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "İşlem yapılıyor…" : register?'Hesap oluştur':"Çalışma alanına gir"}
          <ArrowUpRight size={19} />
        </button>
      </form>
      <button className="secondary full" disabled={busy} onClick={()=>{setRegister(!register);setPassword('');setError('');}}>{register?'Zaten hesabım var · Giriş yap':'Hesabım yok · Hesap oluştur'}</button>
      {!register&&<a className="back" href="https://kentbag-panel-emir-kara-s-projects.vercel.app/sifre-sifirla" target="_blank" rel="noreferrer">Şifremi unuttum</a>}
      <div className="login-note">
        <ShieldCheck size={20} />
        <span>
          Hesap oluşturmak tek başına görev yetkisi vermez. Kurum ve ekip
          başvurun belediye merkezi tarafından onaylanır. Mevcut vatandaş hesabınla da giriş yapıp saha başvurusu yapabilirsin.
        </span>
      </div>
      <small>İnternet bağlantısı gerekir · KentBağ Saha 0.1.3</small>
    </main>
  );
}
function JobDetail({
  job,
  ownerId,
  refresh,
  back,
}: {
  job: Job;
  ownerId: string;
  refresh: () => Promise<void>;
  back: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(empty),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [earlyResult, setEarlyResult] = useState(false),
    [declining, setDeclining] = useState(false),
    [reason, setReason] = useState("");
  const key = `kent.field.draft:${ownerId}:${job.id}`;
  useEffect(() => {
    let active = true;
    void get<Draft>(key)
      .then((value) => {
        if (active) {
          setDraft(value ?? empty);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setError("Taslak okunamadı. Kayıtların üzerine yazılmadı.");
      });
    return () => {
      active = false;
    };
  }, [key]);
  const saves = useRef<Promise<unknown>>(Promise.resolve());
  function save(next: Draft) {
    setDraft(next);
    saves.current = saves.current
      .then(() => set(key, next))
      .catch(() =>
        setError(
          "Taslak cihazda saklanamadı. Bu ekranı kapatmadan bağlantıyı kontrol edin.",
        ),
      );
  }
  async function run(type: "accept" | "start") {
    setBusy(true);
    setError("");
    try {
      await api.act(job.id, type);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  }
  async function photo(source: "camera" | "gallery", file?: File) {
    setBusy(true);
    setError("");
    try {
      const p = file ? await preparePhoto(file) : await capturePhoto(source);
      if (p) save({ ...draft, photos: [...draft.photos, p].slice(0, 3) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fotoğraf eklenemedi.");
    } finally {
      setBusy(false);
    }
  }
  async function decline() {
    if (
      !window.confirm(
        "Görev kuruma iade edilsin mi? Kurum görevi başka ekibe verebilir veya yeniden hazırlayabilir.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api.decline(job.id, reason.trim());
      setNotice("Görev gerekçenle birlikte kuruma iade edildi.");
      setDeclining(false);
      setReason("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Görev iade edilemedi.");
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    setBusy(true);
    setError("");
    try {
      await saves.current;
      await api.result(job.id, draft);
      setNotice(
        "Sonuç kurum kontrolüne gönderildi. Belediye merkezi onayından sonra vatandaşla paylaşılacak.",
      );
      await del(key).catch(()=>setNotice("Sonuç iletildi. Sunucudaki kayıt korunuyor; yerel taslak temizlenemedi."));
      setDraft(empty);
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Sonuç iletilemedi; taslağınız korunuyor.",
      );
    } finally {
      setBusy(false);
    }
  }
  const canResult =
    job.actionable &&
    (job.crewState === "in_progress" ||
      (job.crewState === "accepted" && earlyResult));
  const photoReady = job.photoOptional || draft.photos.length > 0;
  return (
    <main className="job-detail">
      <button className="back" onClick={back}>
        <ArrowLeft size={18} />
        Görevlerim
      </button>
      <div className="detail-meta">
        <small>{job.reference}</small>
        <span className={`priority ${job.priority}`}>
          {priorities[job.priority]}
        </span>
      </div>
      <h1>{job.title}</h1>
      <span className="stage">
        <span className="online-dot" />
        {job.state === "cancelled"
          ? "Görev iptal edildi"
          : stages[job.crewState]}
      </span>
      <section className="section instruction">
        <span className="eyebrow">KURUMUNDAN GELEN GÖREV</span>
        <p>{job.instruction}</p>
      </section>
      <section className="section">
        <h2>
          <MapPin size={18} />
          Konum ve bildirim
        </h2>
        <p>{placeText(job)}</p>
        {job.point && (
          <a
            className="map-link"
            href={`https://www.google.com/maps/search/?api=1&query=${job.point.latitude},${job.point.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            Konumu haritada aç
            <ArrowUpRight size={15} />
          </a>
        )}
        <p>{job.description}</p>
        <div className="photos">
          {job.photos.map((p) => (
            <a href={p.uri} key={p.id} target="_blank" rel="noreferrer">
              <img src={p.uri} alt="Bildirime eklenen fotoğraf" />
            </a>
          ))}
        </div>
      </section>
      {needsFix(job) ? (
        <div className="notice fix" role="alert">
          <strong>Kurum düzeltme istedi</strong>
          <p>{job.reviewNote}</p>
          <small>Sonucu düzeltip aşağıdan yeniden gönder.</small>
        </div>
      ) : (
        job.reviewNote && (
          <div className="notice">
            <strong>Kontrol notu</strong>
            <p>{job.reviewNote}</p>
          </div>
        )
      )}
      {job.crewState === "declined" && job.declineReason && (
        <div className="notice">
          <strong>Kuruma iade ettin</strong>
          <p>{job.declineReason}</p>
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {job.actionable && job.crewState === "assigned" && (
        <section className="section accept">
          <h2>Görev ekibine atandı.</h2>
          <p>Kabul ettiğinde kurumun görevi gördüğünü bilecek.</p>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void run("accept")}
          >
            <Check size={19} />
            Görevi kabul et
          </button>
        </section>
      )}
      {job.actionable && job.crewState === "accepted" && (
        <section className="section accept">
          <h2>Görevi kabul ettin.</h2>
          <p>Sahaya çıkıp işe başladığında kaydet; kurum ilerlemeyi görür.</p>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void run("start")}
          >
            <ArrowUpRight size={18} />
            Çalışmaya başladım
          </button>
          {!earlyResult && (
            <button
              className="link-button"
              disabled={busy}
              onClick={() => setEarlyResult(true)}
            >
              İş zaten bitti mi? Sonucu şimdi gönder
            </button>
          )}
        </section>
      )}
      {canResult && (
        <section className="section result-form">
          <span className="eyebrow">İŞLEMİN SONUCU</span>
          <h2>Yapılan işi belgeleyelim.</h2>
          <p>
            {job.photoOptional
              ? "Kısa bir açıklama yaz. Kesintiler fotoğrafla kanıtlanamadığı için fotoğraf isteğe bağlı."
              : "En az bir sonuç fotoğrafı ve kısa açıklama ekle."}{" "}
            İlk kontrolü kurumun yapacak.
          </p>
          <label>
            Yapılan işlem
            <textarea
              rows={5}
              maxLength={2000}
              minLength={15}
              disabled={!ready || busy}
              value={draft.body}
              onChange={(e) => save({ ...draft, body: e.target.value })}
              placeholder="Neyi kontrol ettiniz, hangi işlem yapıldı?"
            />
          </label>
          <div className="photos draft-photos">
            {draft.photos.map((p) => (
              <div key={p.id}>
                <img src={p.uri} alt="Sonuca eklenecek fotoğraf" />
                <button
                  aria-label="Fotoğrafı kaldır"
                  disabled={busy}
                  onClick={() =>
                    save({
                      ...draft,
                      photos: draft.photos.filter((x) => x.id !== p.id),
                    })
                  }
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          {draft.photos.length < 3 && (
            <div className="photo-actions">
              {native ? (
                <>
                  <button
                    className="secondary"
                    disabled={busy || !ready}
                    onClick={() => void photo("camera")}
                  >
                    <Camera size={18} />
                    Fotoğraf çek
                  </button>
                  <button
                    className="secondary"
                    disabled={busy || !ready}
                    onClick={() => void photo("gallery")}
                  >
                    <Images size={18} />
                    Galeriden seç
                  </button>
                </>
              ) : (
                <label className="photo-input">
                  <Plus size={18} />
                  Fotoğraf ekle
                  <input
                    aria-label="Sonuç fotoğrafı seç"
                    type="file"
                    accept="image/*"
                    disabled={busy || !ready}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void photo("gallery", file);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          )}
          <small>
            {draft.body.trim().length < 15
              ? `Açıklama: en az 15 karakter · ${15 - draft.body.trim().length} karakter daha · `
              : ""}
            {draft.photos.length}/3 fotoğraf
            {job.photoOptional ? " (isteğe bağlı)" : ""} · Taslak bu cihazda
            korunur.
          </small>
          <button
            className="primary"
            disabled={
              busy ||
              !ready ||
              draft.body.trim().length < 15 ||
              !photoReady
            }
            onClick={() => void send()}
          >
            <Send size={18} />
            {busy ? "Gönderiliyor…" : "Sonucu kurum kontrolüne gönder"}
          </button>
        </section>
      )}
      {workable(job) && (
        <section className="section decline">
          {!declining ? (
            <button
              className="link-button"
              disabled={busy}
              onClick={() => setDeclining(true)}
            >
              Bu görevi yapamıyor musunuz? Kuruma iade et
            </button>
          ) : (
            <>
              <h2>Görevi kuruma iade et</h2>
              <p>
                Adres bulunamadı, malzeme yok veya iş başka bir kurumun gibi
                durumlarda kullan. Kurum görevi başka ekibe verebilir.
              </p>
              <label>
                İade gerekçesi
                <textarea
                  rows={3}
                  maxLength={2000}
                  disabled={busy}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Örn. Adreste böyle bir arıza bulunamadı; vatandaşla iletişim gerekiyor."
                />
              </label>
              <small>
                {reason.trim().length < 15
                  ? `En az 15 karakter · ${15 - reason.trim().length} karakter daha`
                  : `${reason.length}/2000`}
              </small>
              <button
                className="secondary full"
                disabled={busy || reason.trim().length < 15}
                onClick={() => void decline()}
              >
                Görevi kuruma iade et
              </button>
              <button
                className="link-button"
                disabled={busy}
                onClick={() => {
                  setDeclining(false);
                  setReason("");
                }}
              >
                Vazgeç
              </button>
            </>
          )}
        </section>
      )}
      {job.result && (
        <section className="section">
          <h2>Gönderdiğin sonuç</h2>
          <p>{job.result.body}</p>
          <div className="photos">
            {job.result.photos.map((p) => (
              <a href={p.uri} target="_blank" rel="noreferrer" key={p.id}>
                <img src={p.uri} alt="Gönderilen sonuç fotoğrafı" />
              </a>
            ))}
          </div>
          <small>{date(job.result.submittedAt)}</small>
        </section>
      )}
      <section className="section history">
        <h2>Görev geçmişi</h2>
        <div className="history-item">
          <Clock size={15} />
          <div>
            <small>{date(job.createdAt)}</small>
            <p>Kurum görevi ekibine atadı.</p>
          </div>
        </div>
        {job.events.map((e) => (
          <div className="history-item" key={e.id}>
            <Check size={15} />
            <div>
              <small>{date(e.createdAt)}</small>
              <p>{e.body}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
