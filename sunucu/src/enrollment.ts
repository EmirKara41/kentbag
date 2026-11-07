import { z } from 'zod';
import type { Database } from './database.js';
import { institutionProfiles } from './institution-domain.js';
import { HttpError } from './validation.js';
export class CrewEnrollment {
  constructor(private db: Database) {}
  async status(userId: string) {
    const member=(await this.db.query('SELECT role,active FROM staff_member WHERE user_id=$1',[userId])).rows[0];
    const application=(await this.db.query('SELECT unit_id AS "unitId",team_id AS "teamId",state,review_note AS note,updated_at AS "updatedAt" FROM crew_enrollment WHERE user_id=$1',[userId])).rows[0];
    return {kind:'enrollment',state:member ? (!member.active?'disabled':member.role==='crew'?'approved':'other_role') : application?.state??'unassigned',application,profiles:institutionProfiles.map(p=>({id:p.id,name:p.name,teams:p.teams}))};
  }
  async submit(userId:string,input:unknown){
    const data=z.object({unitId:z.string(),teamId:z.string()}).parse(input);
    if(!institutionProfiles.find(p=>p.id===data.unitId)?.teams.some(t=>t.id===data.teamId)) throw new HttpError(400,'Geçerli bir kurum ve ekip seçin.');
    await this.db.transaction(async sql=>{
      await sql.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE',[userId]);
      if((await sql.query('SELECT user_id FROM staff_member WHERE user_id=$1',[userId])).rows.length) throw new HttpError(409,'Personel erişiminiz için merkez sorumlusuyla görüşün.');
      const current=(await sql.query('SELECT * FROM crew_enrollment WHERE user_id=$1 FOR UPDATE',[userId])).rows[0];
      if(current?.state==='pending'){
        if(current.unit_id===data.unitId&&current.team_id===data.teamId) return;
        throw new HttpError(409,'Bekleyen başvurunuz var. Merkez değerlendirmesini bekleyin.');
      }
      await sql.query("INSERT INTO crew_enrollment(user_id,unit_id,team_id) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET unit_id=$2,team_id=$3,state='pending',review_note=NULL,updated_at=now()",[userId,data.unitId,data.teamId]);
    });
    return this.status(userId);
  }
  async list(){return (await this.db.query('SELECT e.user_id AS id,u.name,u.email,e.unit_id AS "unitId",e.team_id AS "teamId",e.updated_at AS "updatedAt" FROM crew_enrollment e JOIN "user" u ON u.id=e.user_id WHERE e.state=\'pending\' ORDER BY e.updated_at')).rows;}
  async review(input:unknown){
    const data=z.object({id:z.string().min(1),updatedAt:z.string(),decision:z.enum(['approve','reject']),note:z.string().trim().max(500).default('')}).parse(input);
    await this.db.transaction(async sql=>{
      await sql.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE',[data.id]);
      const current=(await sql.query('SELECT * FROM crew_enrollment WHERE user_id=$1 FOR UPDATE',[data.id])).rows[0];
      if(!current||current.state!=='pending'||new Date(current.updated_at).toISOString()!==new Date(data.updatedAt).toISOString()) throw new HttpError(409,'Başvuru değişti veya değerlendirildi. Listeyi yenileyin.');
      if((await sql.query('SELECT user_id FROM staff_member WHERE user_id=$1',[data.id])).rows.length) throw new HttpError(409,'Bu hesap için personel kaydı zaten var.');
      if(data.decision==='approve'){
        if(!institutionProfiles.find(p=>p.id===current.unit_id)?.teams.some(t=>t.id===current.team_id)) throw new HttpError(409,'Kurum ve ekip artık geçerli değil.');
        await sql.query("INSERT INTO staff_member(user_id,role,unit_id,team_id) VALUES($1,'crew',$2,$3)",[data.id,current.unit_id,current.team_id]);
      }
      await sql.query('UPDATE crew_enrollment SET state=$1,review_note=$2,updated_at=now() WHERE user_id=$3',[data.decision==='approve'?'approved':'rejected',data.note,data.id]);
    });
    return {ok:true};
  }
}
