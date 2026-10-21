import { useState, type FormEvent } from "react";
import { Button, Brand, Icon, Message, Sheet } from "../ui";
import { useStore } from "../store";
import { useNav } from "../navigation";
import { api, serviceReady } from "../api";
import { currentLocation } from "../native";
import type { Profile } from "../domain";
import { LocationMap } from "../Map";
export function Auth({ onComplete }: { onComplete: () => void }) {
  const store = useStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [input, setInput] = useState({
      name: "",
      email: "",
      password: "",
      neighborhood: "",
    }),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (
      mode === "register" &&
      (input.name.trim().length < 2 || input.name.trim().length > 80)
    ) {
      setError("Adını ve soyadını yaz.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      setError("Geçerli bir e-posta adresi yaz.");
      return;
    }
    if (!input.password || (mode === "register" && input.password.length < 8)) {
      setError("En az 8 karakterli bir şifre belirle.");
      return;
    }
    setBusy(true);
    try {
      await store.login(mode, input);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Giriş yapılamadı.");
    } finally {
      setBusy(false);
    }
  }
  function field(key: keyof typeof input, value: string) {
    setInput((previous) => ({ ...previous, [key]: value }));
    setError("");
  }
  return (
    <div className="page auth-page">
      <div className="auth-brand">
        <Brand compact />
      </div>
      <h1>
        {mode === "login" ? "Tek hesap, her adım." : "Mahallene bir adım daha."}
      </h1>
      <p className="page-description">
        {mode === "login"
          ? "Bildirimlerine ve son gelişmelere güvenle ulaş."
          : "Hesabını oluştur, bildirimlerini kolayca takip et."}
      </p>
      <div className="segmented" aria-label="Hesap işlemi">
        <button
          className={mode === "login" ? "active" : ""}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          Giriş yap
        </button>
        <button
          className={mode === "register" ? "active" : ""}
          onClick={() => {
            setMode("register");
            setError("");
          }}
        >
          Hesap oluştur
        </button>
      </div>
      {!serviceReady && (
        <Message>
          Hesap hizmeti henüz kullanıma açılmadı. Bildirimini taslak olarak
          hazırlayabilirsin.
        </Message>
      )}
      <form onSubmit={(event) => void submit(event)}>
        {mode === "register" && (
          <label className="field">
            <span>Ad soyad</span>
            <input
              autoComplete="name"
              maxLength={80}
              value={input.name}
              onChange={(e) => field("name", e.target.value)}
              placeholder="Adın ve soyadın"
              required
            />
          </label>
        )}
        <label className="field">
          <span>E-posta adresi</span>
          <div className="input-icon">
            <Icon name="mail" size={19} />
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              maxLength={254}
              value={input.email}
              onChange={(e) => field("email", e.target.value)}
              placeholder="ornek@eposta.com"
              required
            />
          </div>
        </label>
        <label className="field">
          <span>Şifre</span>
          <div className="input-icon">
            <Icon name="lock" size={19} />
            <input
              type={show ? "text" : "password"}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              maxLength={128}
              value={input.password}
              onChange={(e) => field("password", e.target.value)}
              placeholder={mode === "register" ? "En az 8 karakter" : "Şifren"}
              required
            />
            <button
              type="button"
              aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}
              onClick={() => setShow((value) => !value)}
            >
              <Icon name={show ? "hidden" : "eye"} size={19} />
            </button>
          </div>
        </label>
        {mode === "register" && (
          <label className="field">
            <span>
              Mahalle <small>İsteğe bağlı</small>
            </span>
            <input
              autoComplete="address-level3"
              value={input.neighborhood}
              maxLength={120}
              onChange={(e) => field("neighborhood", e.target.value)}
              placeholder="Örn. Cumhuriyet Mahallesi · Oltu"
            />
          </label>
        )}
        {error && <Message error>{error}</Message>}
        <Button
          type="submit"
          busy={busy}
          disabled={!store.online || !serviceReady}
          icon="arrow"
        >
          {mode === "login" ? "Giriş yap" : "Hesabımı oluştur"}
        </Button>
      </form>
      <p className="auth-footer">
        <Icon name="shield" size={17} />
        Hesap bilgilerin yalnızca sana aittir.
      </p>
    </div>
  );
}
export function Account() {
  const store = useStore(),
    nav = useNav();
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false);
  const profile = store.profile;
  async function logout() {
    setBusy(true);
    try {
      await store.logout();
    } catch {
      /* Device session is cleared even when the server is unreachable. */
    } finally {
      setBusy(false);
      setConfirm(false);
      nav.tab("home");
      nav.toast("Bu cihazdan çıkış yapıldı.");
    }
  }
  return (
    <div className="page">
      <h1>Hesabım</h1>
      <p className="page-description">Sana ait bilgiler, sana özel bir alan.</p>
      {profile ? (
        <section className="profile-card">
          <span className="avatar">
            {profile.name
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toLocaleUpperCase("tr")}
          </span>
          <h2>{profile.name}</h2>
          <p>{profile.email}</p>
          {profile.neighborhood && (
            <span className="profile-area">
              <Icon name="pin" size={14} />
              {profile.neighborhood}
            </span>
          )}
          <Button
            variant="secondary"
            icon="edit"
            onClick={() => nav.go({ name: "edit-profile" })}
          >
            Bilgilerimi düzenle
          </Button>
        </section>
      ) : (
        <section className="profile-card guest-profile">
          <span className="avatar">
            <Icon name="user" size={32} />
          </span>
          <h2>Her adımı hesabından takip et.</h2>
          <p>Taleplerin ve güncellemelerin tek yerde olsun.</p>
          <Button onClick={() => nav.go({ name: "auth" })} icon="user">
            Giriş yap veya hesap oluştur
          </Button>
        </section>
      )}
      <div className="menu-card">
        <button onClick={() => nav.tab("reports")}>
          <Icon name="file" />
          <span>
            Taleplerim<small>Bildirimler ve taslaklar</small>
          </span>
          <Icon name="chevron" size={17} />
        </button>
        <button
          onClick={() => nav.go({ name: "reports", filter: "completed" })}
        >
          <Icon name="done" />
          <span>
            Tamamlanan taleplerim<small>Sonuç aldığın kayıtların arşivi</small>
          </span>
          <Icon name="chevron" size={17} />
        </button>
        <button onClick={() => nav.go({ name: "updates" })}>
          <Icon name="bell" />
          <span>
            Güncellemeler<small>Talebinle ilgili gelişmeler</small>
          </span>
          <Icon name="chevron" size={17} />
        </button>
      </div>
      <div className="menu-card">
        <button onClick={() => nav.go({ name: "help" })}>
          <Icon name="help" />
          <span>
            Yardım ve kullanım<small>Bildirimin nasıl ilerler?</small>
          </span>
          <Icon name="chevron" size={17} />
        </button>
        <button onClick={() => nav.go({ name: "privacy" })}>
          <Icon name="shield" />
          <span>
            İzinler ve gizlilik
            <small>Fotoğraf, konum ve kişisel bilgiler</small>
          </span>
          <Icon name="chevron" size={17} />
        </button>
      </div>
      {profile && (
        <button className="logout-button" onClick={() => setConfirm(true)}>
          <Icon name="logout" size={19} />
          Hesabımdan çıkış yap
        </button>
      )}
      <div className="app-version">
        <Brand compact />
        <strong>KentYanımda</strong>
        <small>Sürüm 1.2.1 · Yaşadığın yer için.</small>
      </div>
      {confirm && (
        <Sheet
          title="Hesabından çıkılsın mı?"
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <p className="muted">
            Bu cihazdaki oturumun kapanacak. Sunucuya kaydedilen taleplerin
            hesabında kalacak.
          </p>
          <Button
            variant="danger"
            busy={busy}
            onClick={() => void logout()}
            icon="logout"
          >
            Çıkış yap
          </Button>
          <Button
            variant="ghost"
            onClick={() => setConfirm(false)}
            disabled={busy}
          >
            Vazgeç
          </Button>
        </Sheet>
      )}
    </div>
  );
}
export function EditProfile() {
  const store = useStore(),
    nav = useNav();
  const profile = store.profile;
  const [name, setName] = useState(profile?.name ?? ""),
    [neighborhood, setNeighborhood] = useState(profile?.neighborhood ?? ""),
    [point, setPoint] = useState<Profile["homeLocation"]>(
      profile?.homeLocation,
    ),
    [mapOpen, setMapOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    if (name.trim().length < 2) {
      setError("Adını ve soyadını yaz.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.profile(
        {
          name: name.trim(),
          neighborhood: neighborhood.trim(),
          homeLocation: point,
        },
        profile.id,
      );
      await store.refresh();
      nav.back();
      nav.toast("Profil bilgilerin kaydedildi.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilgiler kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page">
      <h1>Profil bilgilerin</h1>
      <p className="page-description">Seni nasıl tanıyalım?</p>
      <form onSubmit={(event) => void save(event)}>
        <label className="field">
          <span>Ad soyad</span>
          <input
            value={name}
            autoComplete="name"
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>E-posta adresi</span>
          <input value={profile?.email ?? ""} disabled />
          <small>Hesabının giriş adresi.</small>
        </label>
        <label className="field">
          <span>
            Mahalle <small>İsteğe bağlı</small>
          </span>
          <input
            value={neighborhood}
            maxLength={120}
            onChange={(e) => setNeighborhood(e.target.value)}
            placeholder="Örn. Cumhuriyet Mahallesi · Oltu"
          />
        </label>
        <button
          type="button"
          className="location-setting"
          onClick={() => setMapOpen(true)}
        >
          <Icon name="pin" />
          <span>
            <strong>Mahalle konumum</strong>
            <small>
              {point
                ? `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`
                : "Haritadan seç · İsteğe bağlı"}
            </small>
          </span>
          <Icon name="chevron" size={17} />
        </button>
        {error && <Message error>{error}</Message>}
        <Button type="submit" busy={busy} disabled={!store.online}>
          Değişiklikleri kaydet
        </Button>
      </form>
      {mapOpen && (
        <Sheet title="Mahalle konumun" onClose={() => setMapOpen(false)}>
          <LocationMap point={point ?? null} onChange={setPoint} />
          <Button
            variant="secondary"
            icon="locate"
            onClick={() => {
              void currentLocation()
                .then(setPoint)
                .catch((e) =>
                  setError(e instanceof Error ? e.message : "Konum alınamadı."),
                );
            }}
          >
            Mevcut konumumu kullan
          </Button>
          <Button onClick={() => setMapOpen(false)} disabled={!point}>
            Bu konumu kullan
          </Button>
        </Sheet>
      )}
    </div>
  );
}
