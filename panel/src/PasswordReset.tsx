import {useEffect,useState,type FormEvent} from 'react';
const generic='Bu adresle kayıtlı bir hesap varsa şifre yenileme bağlantısı e-postana gönderilir. Gelen kutunu ve spam klasörünü kontrol et.';
export function PasswordReset(){
 const [token]=useState(()=>new URLSearchParams(location.hash.slice(1)).get('token')??''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[invalid,setInvalid]=useState(false);
 useEffect(()=>{history.replaceState(null,'',location.pathname);},[]);
 async function submit(e:FormEvent){
  e.preventDefault();setError('');setNotice('');
  if(token&&!invalid&&password!==confirmation){setError('İki şifre aynı olmalı.');return;}
  setBusy(true);
  try{
   const resetting=!!token&&!invalid;
   const r=await fetch('/api/auth/'+(resetting?'reset-password':'request-password-reset'),{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(resetting?{token,newPassword:password}:{email:email.trim().toLowerCase(),redirectTo:location.origin+location.pathname}),signal:AbortSignal.timeout(30000)});
   const result=await r.json().catch(()=>null);
   if(!r.ok){if(result?.code==='INVALID_TOKEN'){setInvalid(true);setPassword('');setConfirmation('');throw new Error('Bağlantı geçersiz, kullanılmış veya süresi dolmuş. Yeni bağlantı iste.');}throw new Error(r.status===429?'Çok sık deneme yaptın. Bir dakika bekleyip tekrar dene.':'İşlem tamamlanamadı. Bağlantını kontrol edip tekrar dene.');}
   if(resetting){setDone(true);setPassword('');setConfirmation('');}else setNotice(generic);
  }catch(e){setError(e instanceof Error?e.message:'İşlem tamamlanamadı.');}finally{setBusy(false);}
 }
 return <div className="staff-login-shell"><form className="staff-login" onSubmit={e=>void submit(e)}><a className="institution-brand" href="/saha/">Kent<span>Bağ</span></a><span className="staff-eyebrow">HESAP KURTARMA</span><h1>{done?'Şifren yenilendi.':token&&!invalid?'Yeni şifreni belirle':'Şifremi unuttum'}</h1>
 {done?<><p>Hesabın ve kayıtların korundu. Kullandığın uygulamaya dönüp yeni şifrenle giriş yap.</p><a href="/indir/">Vatandaş uygulaması · İndirme sayfası</a><a href="/saha/">Saha girişine dön</a><a href="/giris">Merkez / kurum girişine dön</a></>:<><p>{token&&!invalid?'En az 12 karakter kullan. İşlem tamamlandığında mevcut oturumların kapatılır.':'Hesabında kullandığın e-posta adresini yaz. Şifre yenileme bağlantısı 30 dakika geçerlidir.'}</p>{token&&!invalid?<><label className="field">Yeni şifre<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="field">Yeni şifre tekrar<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label></>:<label className="field">E-posta<input type="email" autoComplete="email" autoCapitalize="none" required maxLength={254} disabled={busy} value={email} onChange={e=>setEmail(e.target.value)}/></label>}
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}<button className="button primary" disabled={busy}>{busy?'İşlem yapılıyor…':token&&!invalid?'Yeni şifreyi kaydet':'Yenileme bağlantısı gönder'}</button><p>Şifre yenileme işlemi bitince uygulamana dönüp giriş yapabilirsin.</p></>}
 </form></div>;
}
