import { Resend } from 'resend';
import { createHash } from 'node:crypto';
export const resetPage='https://kentbag-panel-emir-kara-s-projects.vercel.app/sifre-sifirla';
export async function sendPasswordReset(data:{user:{email:string};token:string}) {
  if(!process.env.RESEND_API_KEY||!process.env.MAIL_FROM) throw new Error('Password reset mail is not configured');
  // Fragments are not sent to the web server or written into its request logs.
  const link=resetPage+'#token='+encodeURIComponent(data.token);
  const result=await new Resend(process.env.RESEND_API_KEY).emails.send({
    from:process.env.MAIL_FROM,to:data.user.email,
    subject:'KentBağ · Şifreni yenile',
    text:`KentBağ hesabının şifresini yenilemek için aşağıdaki bağlantıyı aç:\n\n${link}\n\nBu bağlantı 30 dakika geçerlidir ve bir kez kullanılabilir. Yeni şifreni belirledikten sonra uygulamadan tekrar giriş yap.\n\nBu isteği sen yapmadıysan e-postayı dikkate alma; şifren değişmez.`,
  },{idempotencyKey:'password-reset-'+createHash('sha256').update(data.token).digest('hex')});
  if(result.error||!result.data?.id) throw new Error('Password reset mail delivery failed');
}
