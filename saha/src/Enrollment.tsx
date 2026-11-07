import {useEffect,useState,type FormEvent} from 'react';
import {HardHat,Clock,RefreshCw,LogOut} from 'lucide-react';
import {api,ApiError} from './api';
import type {Account,Enrollment} from './domain';
export function EnrollmentPage({data,onAccount,logout}:{data:Enrollment;onAccount:(a:Account|null)=>void;logout:()=>Promise<void>}){
 const [unitId,setUnit]=useState(data.application?.unitId??''),[teamId,setTeam]=useState(data.application?.teamId??''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
   let active=true;
   const check=()=>void api.account().then(a=>{if(active)onAccount(a);}).catch(e=>{if(active){setError(e.message);if(e instanceof ApiError&&e.status===401)onAccount(null);}});
   const timer=setInterval(()=>{if(document.visibilityState==='visible')check();},15000);
   window.addEventListener('focus',check);window.addEventListener('online',check);
   return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',check);window.removeEventListener('online',check);};
 },[onAccount]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{onAccount(await api.enroll(unitId,teamId));}catch(e){setError(e instanceof Error?e.message:'Başvuru gönderilemedi.');}finally{setBusy(false);}}
 async function refresh(){setBusy(true);setError('');try{onAccount(await api.account());}catch(e){setError(e instanceof Error?e.message:'Durum yenilenemedi.');if(e instanceof ApiError&&e.status===401)onAccount(null);}finally{setBusy(false);}}
 const profile=data.profiles.find(p=>p.id===unitId);
 const canApply=['unassigned','rejected'].includes(data.state);
 return <main className="login enrollment"><div className="login-brand"><HardHat size={35}/><span>KentBağ <b>Saha</b></span></div>
 <span className="eyebrow">SAHA HESABI</span><h1>{data.state==='pending'?'Başvurun alındı.':canApply?'Ekibini seç, başvurunu tamamla.':data.state==='disabled'?'Erişimin kapalı.':'Bu hesap başka bir çalışma alanına ait.'}</h1>
 {data.state==='pending'&&<><p><Clock size={18}/> Belediye merkezinin onayı bekleniyor. Onaylandığında görevlerin bu ekranda açılacak.</p><section className="section"><strong>{data.profiles.find(p=>p.id===data.application?.unitId)?.name}</strong><p>{data.profiles.find(p=>p.id===data.application?.unitId)?.teams.find(t=>t.id===data.application?.teamId)?.name}</p></section></>}
 {data.state==='rejected'&&<div className="notice">Önceki başvurun onaylanmadı.{data.application?.note&&<p>{data.application.note}</p>} Bilgilerini kontrol ederek tekrar başvurabilirsin.</div>}
 {canApply&&<><p>Hesabın hazır. Kurumunu ve ekibini seç; belediye merkezi görev erişimini onaylasın.</p><form onSubmit={e=>void submit(e)}><label>Kurum<select required disabled={busy} value={unitId} onChange={e=>{setUnit(e.target.value);setTeam('');}}><option value="">Kurum seç</option>{data.profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Ekip<select required disabled={busy||!profile} value={teamId} onChange={e=>setTeam(e.target.value)}><option value="">Ekip seç</option>{profile?.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button className="primary" disabled={busy||!unitId||!teamId}>{busy?'Gönderiliyor…':'Başvuruyu merkeze gönder'}</button></form></>}
 {['disabled','other_role'].includes(data.state)&&<p>Kurum veya ekip erişimi için merkez sorumlusuyla görüş. Bu ekrandan mevcut personel yetkin değiştirilemez.</p>}
 {error&&<div className="notice error" role="alert">{error}</div>}
 <button className="secondary full" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={17}/>Durumu yenile</button><button className="back" disabled={busy} onClick={()=>void logout()}><LogOut size={17}/>Oturumu kapat</button></main>;
}
