// Creates explicitly labelled synthetic records only; never closes existing citizen reports.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,appendFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
const base=process.env.KENT_VERIFY_URL;
if(!base?.startsWith('https://')) throw new Error('Set KENT_VERIFY_URL');
const origin='https://kentbag-panel-emir-kara-s-projects.vercel.app';
async function call(path,body,token,method,expected=200,attempt=0){
 const r=await fetch(base+path,{method:method??(body===undefined?'GET':'POST'),headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(90000)});
 if(r.status===429&&attempt<2){await new Promise(resolve=>setTimeout(resolve,Math.min(60,Number(r.headers.get('retry-after'))||60)*1000));return call(path,body,token,method,expected,attempt+1);}
 const data=await r.json();assert.equal(r.status,expected,`${path}: ${r.status} ${JSON.stringify(data).slice(0,150)}`);return {body:data,token:r.headers.get('set-auth-token')};
}
const accounts=JSON.parse(readFileSync('.local/cloud-staff.json','utf8'));
async function login(a){return (await call('/api/auth/sign-in/email',{email:a.email,password:a.password})).token;}
const center=await login(accounts.find(a=>a.role==='center'));
for(const [slug,unitId,teamId,name] of [
 ['trafo','electricity-external','elektrik-trafo','Trafo müdahale ekibi'],
 ['yol','public-works','fen-yol','Yol bakım ekibi'],
 ['su','water','su-ariza','Su arıza ekibi'],
 ['temizlik','cleaning','temizlik-toplama','Atık toplama ekibi'],
 ['park','parks','park-bakim','Park bakım ekibi']]){
 const email=`saha-${slug}@demo.kentbag.test`;
 if(accounts.some(a=>a.email===email)) continue;
 const a={name:`${name} · Demo`,email,password:randomBytes(18).toString('base64url'),role:'crew',unitId,teamId};
 await call('/api/municipality/staff',a,center);
 accounts.push(a);writeFileSync('.local/cloud-staff.json',JSON.stringify(accounts,null,2),{mode:0o600});
 appendFileSync('.local/KENTBAG_DEMO_HESAPLARI.md',`\n\n### ${a.name}\n- E-posta: ${email}\n- Şifre: ${a.password}\n- Ekip: ${teamId}\n- Uygulama: https://kentbag-panel-emir-kara-s-projects.vercel.app/saha/indir/\n`);
}
const ownerAccount=JSON.parse(readFileSync('.local/cloud-verification.json','utf8'));
const owner=await login(ownerAccount);
const followerFile='.local/field-follower.json';
if(!existsSync(followerFile)){
 const a={name:'Saha akışı demo takipçisi',email:'saha-takipci@demo.kentbag.test',password:randomBytes(18).toString('base64url')};
 await call('/api/auth/sign-up/email',a);writeFileSync(followerFile,JSON.stringify(a),{mode:0o600});
}
const follower=await login(JSON.parse(readFileSync(followerFile,'utf8')));
const crew=await login(accounts.find(a=>a.teamId==='fen-yol'));
const institution=await login(accounts.find(a=>a.role==='institution'&&a.unitId==='public-works'));
const wrongCrew=await login(accounts.find(a=>a.teamId==='elektrik-trafo'));
const report=(await call('/api/reports',{requestId:'field-cloud-flow-20261105-v1',kind:'issue',category:'road',description:'DEMO SAHA AKIŞI: Fotoğraflı sonuç ve iki kurum onayı denemesi. Gerçek yol arızası veya onarım değildir.',location:{source:'manual',address:'DEMO: Oltu sunum alanı'},photos:[],sharePublicly:true,publicArea:'Oltu'},owner)).body;
let shared=(await call('/api/community',undefined,owner)).body;
const recordFile='.local/field-cloud-record.json';
const issue=existsSync(recordFile)?JSON.parse(readFileSync(recordFile,'utf8')):shared.items.find(i=>i.own&&i.category==='road');
assert.ok(issue,'Shared test issue exists');
writeFileSync(recordFile,JSON.stringify(issue));
await call(`/api/community/${issue.id}/subscription`,{subscribed:true},follower,'PUT');
let workspace=(await call('/api/field/workspace',undefined,crew)).body;
let job=workspace.jobs.find(j=>j.reference===report.reference);
if(!job){
 await call('/api/municipality/institutions/forward',{id:report.id,unitId:'public-works',instruction:'DEMO: Sahadan fotoğraflı test sonucu alın. Gerçek onarım değildir.',channel:'portal'},center);
 await call('/api/institutions/public-works/actions',{id:report.id,type:'accept'},institution);
 await call('/api/institutions/public-works/actions',{id:report.id,type:'order',teamId:'fen-yol',priority:'normal',instruction:'DEMO TESTİ: Saha akışını deneyin; gerçek müdahale değildir.'},institution);
 job=(await call('/api/field/workspace',undefined,crew)).body.jobs.find(j=>j.reference===report.reference);
}
assert.ok(job);
await call('/api/field/actions',{type:'accept',orderId:job.id},wrongCrew,undefined,404);
if(job.crewState!=='published'){
 await call('/api/field/actions',{type:'accept',orderId:job.id},crew);
 if(['assigned','accepted'].includes(job.crewState)) await call('/api/field/actions',{type:'start',orderId:job.id},crew);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=','base64');
 if(['assigned','accepted','in_progress'].includes(job.crewState)){
  const upload=await fetch(base+'/api/photos/field-cloud-demo-v1',{method:'PUT',headers:{Origin:origin,Authorization:`Bearer ${crew}`,'Content-Type':'image/png'},body:png});assert.equal(upload.status,200);const photo=await upload.json();
  await call('/api/field/actions',{type:'submit-result',orderId:job.id,body:'DEMO: Saha test fotoğrafı yüklendi. Gerçek bir onarım yapılmamıştır.',photos:[photo.id]},crew);
  const pending=(await call('/api/municipality/workspace',undefined,center)).body.data.reports.find(r=>r.id===report.id);
  assert.equal(pending.fieldOrders.find(o=>o.id===job.id).result,undefined);
  assert.equal((await call('/api/community/'+issue.id,undefined,follower)).body.resolution,undefined);
 }
 await call('/api/institutions/public-works/actions',{id:report.id,type:'review-result',orderId:job.id,decision:'forward',body:'DEMO: Kurum test sonucunu kontrol etti; merkezin onayına sunuluyor.'},institution);
 assert.equal((await call('/api/community/'+issue.id,undefined,follower)).body.resolution,undefined);
 await call('/api/municipality/field-review',{orderId:job.id,decision:'publish',body:'DEMO: Belediye merkezi fotoğraflı saha sonucunu onayladı. Bu bir sunum testidir; gerçek onarım değildir.'},center);
}
const own=(await call('/api/workspace',undefined,owner)).body.reports.find(r=>r.id===report.id);
const followed=(await call('/api/community/'+issue.id,undefined,follower)).body;
assert.equal(own.status,'resolved');assert.equal(own.resolution.photos.length,1);assert.equal(followed.resolution.photos.length,1);assert.equal(own.resolution.body,followed.resolution.body);assert.equal(followed.resolution.orderId,undefined);
assert.equal((await call('/api/community/'+issue.id)).body.resolution,undefined);
const image=await fetch(followed.resolution.photos[0].uri);assert.equal(image.status,200);assert.ok((await image.arrayBuffer()).byteLength>20);
console.log(JSON.stringify({verified:true,reference:report.reference,orderId:job.id,crewAccounts:accounts.filter(a=>a.role==='crew').length,ownerAndFollowerPhotos:true}));
