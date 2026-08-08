import { postgresPool, withTenant } from './db/postgres.js';

export function postgresSessionStore(pool=postgresPool()){
  return{
    kind:'postgres',
    async create(clinicId,session){
      return withTenant(pool,clinicId,async client=>{
        if(session.appointmentId){const appointment=(await client.query('SELECT id,patient_id,professional_id,status FROM appointments WHERE id=$1 AND clinic_id=$2',[session.appointmentId,clinicId])).rows[0];if(!appointment||appointment.patient_id!==session.patientId||appointment.professional_id!==session.professionalId)throw Object.assign(new Error('Agendamento inválido para este atendimento'),{status:400});}
        const{rows}=await client.query(`INSERT INTO clinical_sessions(id,clinic_id,appointment_id,patient_id,professional_id,started_at,finished_at,duration_seconds,notes_encrypted,sud_history_encrypted,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING *`,[session.id,clinicId,session.appointmentId,session.patientId,session.professionalId,session.startedAt,session.finishedAt,session.durationSeconds,session.notesEncrypted,session.sudHistoryEncrypted,session.createdAt]);
        if(session.finishedAt&&session.appointmentId)await client.query("UPDATE appointments SET status='completed',updated_at=$1 WHERE id=$2 AND clinic_id=$3",[session.createdAt,session.appointmentId,clinicId]);
        return rows[0];
      });
    },
    async get(clinicId,id){return withTenant(pool,clinicId,async client=>(await client.query('SELECT * FROM clinical_sessions WHERE id=$1 AND clinic_id=$2',[id,clinicId])).rows[0]||null);},
    async update(clinicId,id,changes){
      return withTenant(pool,clinicId,async client=>{
        const current=(await client.query('SELECT * FROM clinical_sessions WHERE id=$1 AND clinic_id=$2 FOR UPDATE',[id,clinicId])).rows[0];
        if(!current)return null;
        if(current.finished_at)throw Object.assign(new Error('Sessões finalizadas não podem ser alteradas'),{status:409});
        const{rows}=await client.query(`UPDATE clinical_sessions SET duration_seconds=$3,notes_encrypted=$4,sud_history_encrypted=$5,finished_at=$6,updated_at=$7 WHERE id=$1 AND clinic_id=$2 RETURNING *`,[id,clinicId,changes.durationSeconds,changes.notesEncrypted,changes.sudHistoryEncrypted,changes.finishedAt,changes.updatedAt]);
        if(changes.finishedAt&&current.appointment_id)await client.query("UPDATE appointments SET status='completed',updated_at=$1 WHERE id=$2 AND clinic_id=$3",[changes.updatedAt,current.appointment_id,clinicId]);
        return rows[0];
      });
    },
    async remove(clinicId,id){return withTenant(pool,clinicId,client=>client.query('DELETE FROM clinical_sessions WHERE id=$1 AND clinic_id=$2',[id,clinicId]));},
    close(){return pool.end();}
  };
}
