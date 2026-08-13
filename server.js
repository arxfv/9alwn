const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ترويسات الحماية والأمان (Security Headers)
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

const dbPath = path.join(__dirname, 'meswak_clinic_db.json');

// قراءة قاعدة البيانات
function getDB() {
    if (!fs.existsSync(dbPath)) {
        const initialDB = {
            services: [
                { id: 1, name: "تنظيف وتلميع الأسنان", price: 180, doctor: "د. عبدالمجيد العنزي" },
                { id: 2, name: "تقويم الأسنان الشفاف", price: 3500, doctor: "د. نورة السديري" },
                { id: 3, name: "تبييض الأسنان بالليزر", price: 900, doctor: "د. عبدالمجيد العنزي" },
                { id: 4, name: "حشو عصب وعلاج جذور", price: 650, doctor: "د. رامي أحمد" }
            ],
            patients: [
                { id: 101, name: "خالد المنصور", phone: "0551122334", visits: [] },
                { id: 102, name: "ساره العتيبي", phone: "0502233445", visits: [] }
            ],
            visits: [
                { id: 1, patientName: "خالد المنصور", date: "2026-08-10", doctorNotes: "تم إجراء كشف عام وتنظيف الجير." }
            ],
            appointments: [
                { id: 1001, patientName: "خالد المنصور", phone: "0551122334", service: "تنظيف وتلميع الأسنان", date: "2026-08-11", time: "05:00 م", status: "مؤكد" }
            ]
        };
        fs.writeFileSync(dbPath, JSON.stringify(initialDB, null, 2));
        return initialDB;
    }
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// REST APIs
app.get('/api/services', (req, res) => res.json(getDB().services));
app.post('/api/services', (req, res) => {
    const db = getDB();
    const newService = { id: Date.now(), ...req.body };
    db.services.push(newService);
    saveDB(db);
    res.json({ success: true, service: newService });
});
app.delete('/api/services/:id', (req, res) => {
    const db = getDB();
    db.services = db.services.filter(s => s.id != req.params.id);
    saveDB(db);
    res.json({ success: true });
});

app.get('/api/patients', (req, res) => res.json(getDB().patients));
app.post('/api/patients', (req, res) => {
    const db = getDB();
    const newPatient = { id: Date.now(), ...req.body, visits: [] };
    db.patients.unshift(newPatient);
    saveDB(db);
    res.json({ success: true, patient: newPatient });
});

app.get('/api/visits', (req, res) => res.json(getDB().visits));
app.post('/api/visits', (req, res) => {
    const db = getDB();
    const newVisit = { id: Date.now(), ...req.body };
    db.visits.unshift(newVisit);
    saveDB(db);
    res.json({ success: true, visit: newVisit });
});

app.get('/api/appointments', (req, res) => res.json(getDB().appointments));
app.post('/api/appointments', (req, res) => {
    const db = getDB();
    const newAppt = { id: Date.now(), status: "بانتظار التأكيد", ...req.body };
    db.appointments.unshift(newAppt);
    saveDB(db);
    res.json({ success: true, appointment: newAppt });
});
app.delete('/api/appointments/:id', (req, res) => {
    const db = getDB();
    db.appointments = db.appointments.filter(a => a.id != req.params.id);
    saveDB(db);
    res.json({ success: true });
});
app.post('/api/appointments/:id/confirm', (req, res) => {
    const db = getDB();
    let appt = db.appointments.find(a => a.id == req.params.id);
    if (appt) {
        appt.status = "مؤكد";
        saveDB(db);
        return res.json({ success: true, appointment: appt });
    }
    res.status(404).json({ success: false, message: "الموعد غير موجود" });
});

// ================= WEBHOOKS للربط مع وكيل الذكاء الاصطناعي =================
app.post('/webhook/ai/register-patient', (req, res) => {
    const { name, phone } = req.body;
    const db = getDB();
    const newPatient = { id: Date.now(), name, phone, visits: [] };
    db.patients.unshift(newPatient);
    saveDB(db);
    res.json({ status: "success", message: "تم فتح ملف المريض بنجاح", patientId: newPatient.id });
});

app.post('/webhook/ai/book-appointment', (req, res) => {
    const { patientName, phone, service, date, time } = req.body;
    const db = getDB();
    const newAppt = { id: Date.now(), patientName, phone, service: service || "كشف أسنان", date: date || new Date().toISOString().split('T')[0], time: time || "04:00 م", status: "بانتظار التأكيد" };
    db.appointments.unshift(newAppt);
    saveDB(db);
    res.json({ status: "success", message: "تم حجز الموعد بنجاح", appointment: newAppt });
});

app.post('/webhook/ai/confirm-appointment', (req, res) => {
    const { appointmentId, phone } = req.body;
    const db = getDB();
    let appt = db.appointments.find(a => a.id == appointmentId || a.phone == phone);
    if (appt) {
        appt.status = "مؤكد";
        saveDB(db);
        return res.json({ status: "success", message: "تم تأكيد الموعد" });
    }
    res.status(404).json({ status: "error", message: "الموعد غير موجود" });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`سيرفر عيادة مسواك والـ Webhooks يعمل على: http://localhost:${PORT}`));
