const { ABNORMAL_VITALS } = require('../config/cdssConfig.cjs');

function extractAbnormalVitals(visit) {
    const parts = [];

    const t = visit.temperature;
    if (t !== null && t !== undefined) {
        const temp = Number(t);
        if (!Number.isNaN(temp) && temp >= ABNORMAL_VITALS.temperatureC) {
            parts.push(`температура ${temp}°C`);
        }
    }

    const sp = visit.oxygenSaturation;
    if (sp !== null && sp !== undefined) {
        const spo2 = Number(sp);
        if (!Number.isNaN(spo2) && spo2 < ABNORMAL_VITALS.oxygenSaturation) {
            parts.push(`SpO2 ${spo2}%`);
        }
    }

    const rr = visit.respiratoryRate;
    if (rr !== null && rr !== undefined) {
        const rate = Number(rr);
        if (!Number.isNaN(rate) && rate > 0) {
            parts.push(`ЧДД ${rate}`);
        }
    }

    const pulse = visit.pulse;
    if (pulse !== null && pulse !== undefined) {
        const p = Number(pulse);
        if (!Number.isNaN(p) && p > 0) {
            parts.push(`пульс ${p}`);
        }
    }

    if (visit.bloodPressureSystolic && visit.bloodPressureDiastolic) {
        parts.push(`АД ${visit.bloodPressureSystolic}/${visit.bloodPressureDiastolic}`);
    }

    return parts;
}

function buildClinicalQuery(visit) {
    const parts = [];

    if (visit.complaints && String(visit.complaints).trim()) {
        parts.push(String(visit.complaints).trim());
    }

    if (visit.physicalExam && String(visit.physicalExam).trim()) {
        parts.push(String(visit.physicalExam).trim());
    }

    const systems = [
        visit.generalCondition,
        visit.respiratory,
        visit.cardiovascular,
        visit.abdomen,
        visit.nervousSystem,
    ].filter(v => v && String(v).trim());

    if (systems.length > 0) {
        parts.push(systems.map(v => String(v).trim()).join('; '));
    }

    const abnormals = extractAbnormalVitals(visit);
    if (abnormals.length > 0) {
        parts.push(abnormals.join(', '));
    }

    return parts.join('\n');
}

module.exports = {
    buildClinicalQuery,
    extractAbnormalVitals,
};
