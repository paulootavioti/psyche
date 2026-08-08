import { postgresPool, withTenant } from './db/postgres.js';

export function postgresPatientStore(pool=postgresPool()){
  return{
    kind:'postgres',
    async list(clinicId,{q='',status=null,professionalId=null,actorRole,actorId}){
      return withTenant(pool,clinicId,async client=>{
        const conditions=['clinic_id=$1','name ILIKE $2'],values=[clinicId,`%${q.slice(0,80)}%`];
        if(actorRole==='professional'){values.push(actorId);conditions.push(`professional_id=$${values.length}`);}
        else if(professionalId){values.push(professionalId);conditions.push(`professional_id=$${values.length}`);}
        if(status){values.push(status);conditions.push(`status=$${values.length}`);}
        const where=conditions.join(' AND ');
        const [count,patients]=await Promise.all([
          client.query(`SELECT COUNT(*)::int total FROM patients WHERE ${where}`,values),
          client.query(`SELECT id,name,email,phone,birth_date,status,professional_id,created_at,updated_at FROM patients WHERE ${where} ORDER BY name LIMIT 200`,values)
        ]);
        return{data:patients.rows,meta:{total:count.rows[0].total}};
      });
    },
    async create(clinicId,patient){
      return withTenant(pool,clinicId,async client=>{
        const{rows}=await client.query(`INSERT INTO patients(id,clinic_id,professional_id,name,email,phone,cpf_encrypted,birth_date,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$9) RETURNING id,name,email,phone,birth_date,status,professional_id,created_at`,[patient.id,clinicId,patient.professionalId,patient.name,patient.email,patient.phone,patient.cpfEncrypted,patient.birthDate,patient.createdAt]);
        return rows[0];
      });
    },
    async get(clinicId,id,{actorRole,actorId}={}){
      return withTenant(pool,clinicId,async client=>{
        const values=[id,clinicId],scope=actorRole==='professional'?(values.push(actorId),` AND p.professional_id=$${values.length}`):'';
        const{rows}=await client.query(`SELECT p.id,p.name,p.email,p.phone,p.birth_date,p.status,p.professional_id,p.created_at,p.updated_at,u.name professional_name,pp.gender,pp.occupation,pp.emergency_name_encrypted,pp.emergency_phone_encrypted,pp.address_encrypted FROM patients p LEFT JOIN users u ON u.id=p.professional_id LEFT JOIN patient_profiles pp ON pp.patient_id=p.id AND pp.clinic_id=p.clinic_id WHERE p.id=$1 AND p.clinic_id=$2${scope}`,values);
        return rows[0]||null;
      });
    },
    async update(clinicId,id,patient,profile){
      return withTenant(pool,clinicId,async client=>{
        const{rows}=await client.query(`UPDATE patients SET name=$3,email=$4,phone=$5,birth_date=$6,status=$7,professional_id=$8,updated_at=$9 WHERE id=$1 AND clinic_id=$2 RETURNING id,name,email,phone,birth_date,status,professional_id,created_at,updated_at`,[id,clinicId,patient.name,patient.email,patient.phone,patient.birthDate,patient.status,patient.professionalId,patient.updatedAt]);
        if(!rows[0])return null;
        if(profile)await client.query(`INSERT INTO patient_profiles(patient_id,clinic_id,gender,occupation,emergency_name_encrypted,emergency_phone_encrypted,address_encrypted,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8) ON CONFLICT(patient_id) DO UPDATE SET gender=excluded.gender,occupation=excluded.occupation,emergency_name_encrypted=excluded.emergency_name_encrypted,emergency_phone_encrypted=excluded.emergency_phone_encrypted,address_encrypted=excluded.address_encrypted,updated_at=excluded.updated_at`,[id,clinicId,profile.gender,profile.occupation,profile.emergencyNameEncrypted,profile.emergencyPhoneEncrypted,profile.addressEncrypted,patient.updatedAt]);
        return rows[0];
      });
    },
    async consents(clinicId,patientId){return withTenant(pool,clinicId,async client=>(await client.query('SELECT * FROM patient_consents WHERE patient_id=$1 AND clinic_id=$2 ORDER BY created_at DESC',[patientId,clinicId])).rows);},
    async history(clinicId,patientId,{actorRole,actorId}={}){
      return withTenant(pool,clinicId,async client=>{
        const values=[patientId,clinicId],scope=actorRole==='professional'?(values.push(actorId),` AND p.professional_id=$${values.length}`):'';
        const patient=(await client.query(`SELECT p.id,p.name,p.email,p.phone,p.birth_date,p.status,p.professional_id,p.created_at,p.updated_at,u.name professional_name,pp.gender,pp.occupation,pp.emergency_name_encrypted,pp.emergency_phone_encrypted,pp.address_encrypted FROM patients p LEFT JOIN users u ON u.id=p.professional_id LEFT JOIN patient_profiles pp ON pp.patient_id=p.id AND pp.clinic_id=p.clinic_id WHERE p.id=$1 AND p.clinic_id=$2${scope}`,values)).rows[0];
        if(!patient)return null;
        const[appointments,clinical,finance,consents,documents]=await Promise.all([
          client.query(`SELECT a.id,a.starts_at,a.duration_minutes,a.modality,a.status,u.name professional_name FROM appointments a JOIN users u ON u.id=a.professional_id WHERE a.patient_id=$1 AND a.clinic_id=$2 ORDER BY a.starts_at DESC LIMIT 50`,[patientId,clinicId]),
          client.query(`SELECT id,appointment_id,professional_id,started_at,finished_at,duration_seconds,created_at FROM clinical_sessions WHERE patient_id=$1 AND clinic_id=$2 ORDER BY started_at DESC LIMIT 50`,[patientId,clinicId]),
          client.query(`SELECT COALESCE(SUM(amount_cents) FILTER(WHERE type='income' AND status='paid'),0)::bigint paid,COALESCE(SUM(amount_cents) FILTER(WHERE type='income' AND status!='paid'),0)::bigint pending FROM financial_entries WHERE patient_id=$1 AND clinic_id=$2`,[patientId,clinicId]),
          client.query('SELECT * FROM patient_consents WHERE patient_id=$1 AND clinic_id=$2 ORDER BY created_at DESC',[patientId,clinicId]),
          client.query('SELECT id,name,mime_type,size_bytes,created_at FROM patient_documents WHERE patient_id=$1 AND clinic_id=$2 ORDER BY created_at DESC',[patientId,clinicId])
        ]);
        return{patient,appointments:appointments.rows,clinical_sessions:clinical.rows,finance:{paid_cents:Number(finance.rows[0].paid),pending_cents:Number(finance.rows[0].pending)},consents:consents.rows,documents:documents.rows};
      });
    },
    async addConsent(clinicId,consent){return withTenant(pool,clinicId,async client=>(await client.query('INSERT INTO patient_consents(id,clinic_id,patient_id,type,accepted,accepted_at,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[consent.id,clinicId,consent.patientId,consent.type,consent.accepted,consent.acceptedAt,consent.expiresAt,consent.createdAt])).rows[0]);},
    async removeConsent(clinicId,id){return withTenant(pool,clinicId,client=>client.query('DELETE FROM patient_consents WHERE id=$1 AND clinic_id=$2',[id,clinicId]));},
    async remove(clinicId,id){return withTenant(pool,clinicId,client=>client.query('DELETE FROM patients WHERE id=$1 AND clinic_id=$2',[id,clinicId]));},
    close(){return pool.end();}
  };
}
