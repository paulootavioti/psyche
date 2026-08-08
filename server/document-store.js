import { postgresPool, withTenant } from './db/postgres.js';

export function postgresDocumentStore(pool=postgresPool()){
  return{
    kind:'postgres',
    async verify(code){return(await pool.query('SELECT * FROM psyche_verify_document($1)',[code])).rows[0]||null;},
    async list(clinicId,patientId){return withTenant(pool,clinicId,async client=>(await client.query('SELECT * FROM psychological_documents WHERE patient_id=$1 AND clinic_id=$2 ORDER BY created_at DESC',[patientId,clinicId])).rows);},
    async create(clinicId,document){
      return withTenant(pool,clinicId,async client=>{
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[clinicId,`${document.type}:${document.year}`]);
        const total=Number((await client.query('SELECT COUNT(*)::int total FROM psychological_documents WHERE clinic_id=$1 AND type=$2 AND EXTRACT(YEAR FROM created_at)=$3',[clinicId,document.type,Number(document.year)])).rows[0].total),number=`${document.prefix}-${document.year}-${String(total+1).padStart(6,'0')}`;
        const{rows}=await client.query(`INSERT INTO psychological_documents(id,clinic_id,patient_id,professional_id,type,number,verification_code,title,recipient,purpose,content_encrypted,professional_name,professional_registration,status,issued_at,cancelled_at,cancellation_reason,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NULL,NULL,$16,$16) RETURNING *`,[document.id,clinicId,document.patientId,document.professionalId,document.type,number,document.verificationCode,document.title,document.recipient,document.purpose,document.contentEncrypted,document.professionalName,document.professionalRegistration,document.status,document.issuedAt,document.createdAt]);
        return rows[0];
      });
    },
    async get(clinicId,id){return withTenant(pool,clinicId,async client=>(await client.query('SELECT * FROM psychological_documents WHERE id=$1 AND clinic_id=$2',[id,clinicId])).rows[0]||null);},
    async transition(clinicId,id,action,{at,reason=null}){
      return withTenant(pool,clinicId,async client=>{
        const current=(await client.query('SELECT * FROM psychological_documents WHERE id=$1 AND clinic_id=$2 FOR UPDATE',[id,clinicId])).rows[0];if(!current)return null;
        if(action==='issue'){if(current.status!=='draft')throw Object.assign(new Error('Somente rascunhos podem ser emitidos'),{status:409});return(await client.query("UPDATE psychological_documents SET status='issued',issued_at=$3,updated_at=$3 WHERE id=$1 AND clinic_id=$2 RETURNING *",[id,clinicId,at])).rows[0];}
        if(action==='cancel'){if(current.status!=='issued')throw Object.assign(new Error('Somente documentos emitidos podem ser cancelados'),{status:409});return(await client.query("UPDATE psychological_documents SET status='cancelled',cancelled_at=$3,cancellation_reason=$4,updated_at=$3 WHERE id=$1 AND clinic_id=$2 RETURNING *",[id,clinicId,at,reason])).rows[0];}
        throw Object.assign(new Error('Ação inválida'),{status:400});
      });
    },
    async remove(clinicId,id){return withTenant(pool,clinicId,client=>client.query('DELETE FROM psychological_documents WHERE id=$1 AND clinic_id=$2',[id,clinicId]));},
    close(){return pool.end();}
  };
}
