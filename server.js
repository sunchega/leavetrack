'use strict';
const path     = require('path');
const express  = require('express');
const bcrypt   = require('bcryptjs');
const session  = require('express-session');
const cors     = require('cors');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');

// ── MongoDB ───────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || '';
if (!MONGO_URI) { console.error('ERROR: MONGO_URI not set'); process.exit(1); }
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Atlas connected — data preserved permanently'))
  .catch(err => { console.error('MongoDB error:', err); process.exit(1); });

// ── Schemas ───────────────────────────────────────────────────────────────────
const EmpSchema = new mongoose.Schema({
  id:       { type: String, required: true, unique: true },
  name:     { type: String, required: true },
  email:    { type: String, required: true },
  vendor:   String, role: String, doj: String,
  cf:       { type: Number, default: 0 },
  intake:   { type: Number, default: 21 },
  bal:      { type: Number, default: 21 },
  pw:       { type: String, required: true },
  inactive: { type: Boolean, default: false }
});

const LeaveSchema = new mongoose.Schema({
  id:              { type: String, required: true, unique: true },
  eid:             String, cat: String, type: String,
  from:            String, to: String, days: Number,
  reason:          String,
  status:          { type: String, default: 'Pending' },
  // Cancellation fields
  cancelRequested: { type: Boolean, default: false },
  cancelReason:    String,
  cancelRequestedAt: String,
  cancelledBy:     String,
  cancelledAt:     String,
  cancelRejected:  { type: Boolean, default: false },
  cancelRejectedBy: String,
  // Comp-off flag
  isCompOff:       { type: Boolean, default: false },
  applied:         String, appliedBy: String,
  remark:          String, actionBy: String, actionAt: String
});

const LogSchema = new mongoose.Schema({
  ts: String, action: String, by: String, detail: String
});

const Employee = mongoose.model('Employee', EmpSchema);
const Leave    = mongoose.model('Leave', LeaveSchema);
const Log      = mongoose.model('Log', LogSchema);

// ── Seed employees (only if collection is empty) ──────────────────────────────
const DEFAULT_EMPS = [
  {id:"533019",name:"Akash Maruti Nanaware",email:"akash.nanaware@company.com",vendor:"Aforeserve",role:"Team Lead - RRA Ops",doj:"2026-05-01",cf:0,intake:14,bal:14},
  {id:"4728",name:"Umesh Shivaji Thakare",email:"umesh.thakare@company.com",vendor:"CTDI",role:"Data Lake",doj:"2025-01-01",cf:5.5,intake:21,bal:26.5},
  {id:"541288",name:"Pravin Landge",email:"pravin.landge@company.com",vendor:"CTDI",role:"DSS",doj:"2025-01-01",cf:9.5,intake:21,bal:30.5},
  {id:"801144",name:"Suhas Bharat Sathe",email:"suhas.sathe@company.com",vendor:"Quess Corp",role:"Data Lake",doj:"2025-01-01",cf:9,intake:21,bal:30},
  {id:"812346",name:"Kishor Ashok Bhoknal",email:"kishor.bhoknal@company.com",vendor:"Quess Corp",role:"Data Lake",doj:"2025-01-01",cf:9,intake:21,bal:30},
  {id:"541137",name:"Akshay Arunrao Ambatkar",email:"akshay.ambatkar@company.com",vendor:"CTDI",role:"DSS",doj:"2025-01-01",cf:5.5,intake:21,bal:26.5},
  {id:"809305",name:"Gaurav Sunil More",email:"gaurav.more@company.com",vendor:"Quess Corp",role:"Data Lake",doj:"2025-01-01",cf:10,intake:21,bal:31},
  {id:"810217",name:"Yogesh Maruti Shelar",email:"yogesh.shelar@company.com",vendor:"Quess Corp",role:"Data Lake",doj:"2025-01-01",cf:9,intake:21,bal:30},
  {id:"819762",name:"Rahul Shivaji Thakare",email:"rahul.thakare@company.com",vendor:"Quess Corp",role:"Data Lake",doj:"2025-01-01",cf:9.5,intake:21,bal:30.5},
  {id:"541538",name:"Mayur Salve",email:"mayur.salve@company.com",vendor:"CTDI",role:"DSS",doj:"2025-01-01",cf:8.75,intake:21,bal:29.75},
  {id:"531446",name:"Santosh Kumar",email:"santosh.kumar@company.com",vendor:"Aforeserve",role:"DSS",doj:"2025-01-01",cf:2,intake:21,bal:23},
  {id:"RRL1E0144",name:"Uday Dalvi",email:"uday.dalvi@company.com",vendor:"Eagle",role:"DSS",doj:"2025-01-01",cf:9,intake:21,bal:30},
  {id:"ITHPL10160570",name:"Anas Mulla",email:"anas.mulla@company.com",vendor:"Inovative",role:"DSS",doj:"2025-01-01",cf:5.5,intake:21,bal:26.5},
  {id:"542155",name:"Prasad Patil",email:"prasad.patil@company.com",vendor:"CTDI",role:"DSS",doj:"2026-06-01",cf:0,intake:12.25,bal:12.25},
  {id:"793721",name:"Nilesh Kundlik Shelar",email:"nilesh.shelar@company.com",vendor:"Quess Corp",role:"POS DM",doj:"2025-01-01",cf:10,intake:21,bal:31},
  {id:"RRL1E0108",name:"Pritam Pawar",email:"pritam.pawar@company.com",vendor:"Eagle",role:"POS DM",doj:"2025-01-01",cf:10,intake:21,bal:31},
  {id:"RRL1E0105",name:"Vaibhav Bodhale",email:"vaibhav.bodhale@company.com",vendor:"Eagle",role:"POS DM",doj:"2025-01-01",cf:10,intake:21,bal:31},
  {id:"10160769",name:"Shubhamkumar Badgujar",email:"shubham.badgujar@company.com",vendor:"Inovative",role:"POS DM",doj:"2026-05-01",cf:0,intake:14,bal:14},
  {id:"793713",name:"Vikas Narayan Ghorpade",email:"vikas.ghorpade@company.com",vendor:"Quess Corp",role:"POS DM",doj:"2025-01-01",cf:7,intake:21,bal:28},
  {id:"541912",name:"Vaibhav Patil",email:"vaibhav.patil@company.com",vendor:"CTDI",role:"POS DM",doj:"2025-01-01",cf:2.75,intake:21,bal:23.75},
  {id:"532869",name:"Pranav Patil",email:"pranav.patil@company.com",vendor:"Aforeserve",role:"POS DM",doj:"2026-03-01",cf:0,intake:17.5,bal:17.5},
  {id:"532868",name:"Aashish Pise",email:"aashish.pise@company.com",vendor:"Aforeserve",role:"POS DM",doj:"2026-03-01",cf:0,intake:17.5,bal:17.5},
  {id:"RRL1E0204",name:"Harish Kalmegh",email:"harish.kalmegh@company.com",vendor:"Eagle",role:"POS DM",doj:"2026-02-01",cf:0,intake:19.25,bal:19.25},
  {id:"793728",name:"Abhishek Sunilsingh Pardeshi",email:"abhishek.pardeshi@company.com",vendor:"Quess Corp",role:"Team Lead - middleware",doj:"2025-01-01",cf:7,intake:21,bal:28},
  {id:"4813",name:"Prathmesh Anil Patil",email:"prathmesh.patil@company.com",vendor:"CTDI",role:"middleware",doj:"2025-01-01",cf:7.75,intake:21,bal:28.75},
  {id:"818622",name:"Anush Vijay Agrawal",email:"anush.agrawal@company.com",vendor:"Quess Corp",role:"middleware",doj:"2025-01-01",cf:9,intake:21,bal:30},
  {id:"819396",name:"Saurabh Sunil Mhaske",email:"saurabh.mhaske@company.com",vendor:"Quess Corp",role:"middleware",doj:"2025-01-01",cf:10,intake:21,bal:31},
  {id:"819763",name:"Harshad Bhausaheb Antre",email:"harshad.antre@company.com",vendor:"Quess Corp",role:"middleware",doj:"2025-01-01",cf:7,intake:21,bal:28},
  {id:"819967",name:"Kailash Popat Bhonde",email:"kailash.bhonde@company.com",vendor:"Quess Corp",role:"middleware",doj:"2025-01-01",cf:4,intake:21,bal:25},
  {id:"541523",name:"Pritesh Wadile",email:"pritesh.wadile@company.com",vendor:"CTDI",role:"middleware",doj:"2025-01-01",cf:6.75,intake:21,bal:27.75},
  {id:"817141",name:"Vandana Sabhajit Yadav",email:"vandana.yadav@company.com",vendor:"Quess Corp",role:"RRA Analytics L1",doj:"2025-01-01",cf:0,intake:21,bal:21},
  {id:"818731",name:"Sanjana Sharma",email:"sanjana.sharma@company.com",vendor:"Quess Corp",role:"RRA Analytics L1",doj:"2025-01-01",cf:3.5,intake:21,bal:24.5},
  {id:"531808",name:"Nisha Ambekar",email:"nisha.ambekar@company.com",vendor:"Aforeserve",role:"RRA Analytics L1",doj:"2025-01-01",cf:7.25,intake:21,bal:28.25}
];

async function seedEmployees() {
  const count = await Employee.countDocuments();
  if (count === 0) {
    const hashed = await Promise.all(DEFAULT_EMPS.map(async e => ({
      ...e, pw: await bcrypt.hash('Pass@123', 10)
    })));
    await Employee.insertMany(hashed);
    console.log(`✅ Seeded ${hashed.length} employees`);
  } else {
    console.log(`✅ ${count} employees in MongoDB — existing data preserved`);
  }
}
mongoose.connection.once('open', seedEmployees);

// ── CHANGE 1: Cross-month leave split helper ──────────────────────────────────
// Splits a leave range into per-day entries grouped by month
// Returns array of {year, month, days} — used for reports
function splitByMonth(fromStr, toStr) {
  const result = [];
  const from = new Date(fromStr + 'T00:00:00');
  const to   = new Date(toStr   + 'T00:00:00');
  let cur = new Date(from);
  while (cur <= to) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    // Count days in this month within range
    const monthEnd = new Date(y, m + 1, 0); // last day of month
    const segEnd   = monthEnd < to ? monthEnd : to;
    const segStart = cur > from ? cur : from;
    const days = Math.round((segEnd - segStart) / 86400000) + 1;
    result.push({ year: y, month: m, days });
    // Move to first day of next month
    cur = new Date(y, m + 1, 1);
  }
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function auditLog(action, by, detail) {
  try { await Log.create({ ts: new Date().toISOString(), action, by, detail }); } catch(e) {}
}
function authRequired(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: 'Not authenticated' });
}
function adminRequired(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  res.status(403).json({ error: 'Admin access required' });
}

// ── Express setup ─────────────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'leavetrack-mongo-2026',
  resave: false,
  saveUninitialized: false,
  // FEATURE 9: Store sessions in MongoDB — no more MemoryStore warning
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    ttl: 8 * 60 * 60, // 8 hours
    autoRemove: 'native'
  }),
  cookie: {
    maxAge: 8 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const uL = username.trim().toLowerCase();
    if (role === 'admin') {
      const ok = (uL === 'suhas unchegaonkar' || uL === 'unchegaonkar' || uL === 'admin') && password === 'Secure@007';
      if (!ok) return res.status(401).json({ error: 'Invalid admin credentials' });
      req.session.user = { name: 'Suhas Unchegaonkar', role: 'admin', id: 'ADMIN' };
      await auditLog('LOGIN', 'ADMIN', 'Admin logged in');
      return res.json({ ok: true, user: req.session.user });
    }
    const emp = await Employee.findOne({
      inactive: { $ne: true },
      $or: [{ id: username.trim() }, { name: new RegExp('^' + uL.split(' ')[0], 'i') }]
    });
    if (!emp || !await bcrypt.compare(password, emp.pw))
      return res.status(401).json({ error: 'Invalid credentials. Use first name + Pass@123' });
    req.session.user = { name: emp.name, role: 'employee', id: emp.id };
    await auditLog('LOGIN', emp.id, emp.name + ' logged in');
    res.json({ ok: true, user: req.session.user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/logout', async (req, res) => {
  const who = req.session.user ? req.session.user.id : '?';
  await auditLog('LOGOUT', who, 'Logged out');
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', authRequired, (req, res) => res.json(req.session.user));

// ── PASSWORD ──────────────────────────────────────────────────────────────────
app.post('/api/reset-password', authRequired, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.session.user;
    if (user.role === 'admin') return res.status(400).json({ error: 'Admin password is fixed' });
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Min 6 characters' });
    const emp = await Employee.findOne({ id: user.id });
    if (!emp || !await bcrypt.compare(currentPassword, emp.pw))
      return res.status(401).json({ error: 'Current password is incorrect' });
    emp.pw = await bcrypt.hash(newPassword, 10);
    await emp.save();
    await auditLog('PW_RESET', user.id, user.name + ' changed password');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/reset-password', adminRequired, async (req, res) => {
  try {
    const { empId, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Min 6 chars' });
    const emp = await Employee.findOne({ id: empId });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    emp.pw = await bcrypt.hash(newPassword, 10);
    await emp.save();
    await auditLog('ADMIN_PW_RESET', 'ADMIN', 'Reset password for ' + emp.name);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── EMPLOYEES ─────────────────────────────────────────────────────────────────
app.get('/api/employees', authRequired, async (req, res) => {
  try {
    const emps = await Employee.find({}, { pw: 0, __v: 0 });
    res.json(emps);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/employees', adminRequired, async (req, res) => {
  try {
    const { id, name, email, vendor, role, doj, cf, intake, password } = req.body;
    if (!id || !name || !email) return res.status(400).json({ error: 'ID, name and email required' });
    if (await Employee.findOne({ id })) return res.status(400).json({ error: 'Employee ID already exists' });
    const cfN = parseFloat(cf) || 0, intakeN = parseFloat(intake) || 21;
    const emp = new Employee({ id, name, email, vendor, role, doj, cf: cfN, intake: intakeN, bal: cfN + intakeN, pw: await bcrypt.hash(password || 'Pass@123', 10) });
    await emp.save();
    await auditLog('EMP_ADD', 'ADMIN', 'Added: ' + name);
    const { pw, ...safe } = emp.toObject();
    res.json({ ok: true, employee: safe });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/employees/:id', adminRequired, async (req, res) => {
  try {
    const { name, email, vendor, role, doj, cf, intake } = req.body;
    const cfN = parseFloat(cf) || 0, intakeN = parseFloat(intake) || 21;
    await Employee.findOneAndUpdate({ id: req.params.id }, { name, email, vendor, role, doj, cf: cfN, intake: intakeN, bal: cfN + intakeN });
    await auditLog('EMP_EDIT', 'ADMIN', 'Edited: ' + name);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/employees/:id', adminRequired, async (req, res) => {
  try {
    const emp = await Employee.findOne({ id: req.params.id });
    if (!emp) return res.status(404).json({ error: 'Not found' });
    emp.inactive = true;
    await emp.save();
    await auditLog('EMP_DEACTIVATE', 'ADMIN', 'Deactivated: ' + emp.name);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── LEAVES ────────────────────────────────────────────────────────────────────
app.get('/api/leaves', authRequired, async (req, res) => {
  try {
    const query = req.session.user.role === 'employee' ? { eid: req.session.user.id } : {};
    const leaves = await Leave.find(query, { __v: 0 }).sort({ applied: -1 });
    res.json(leaves);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CHANGE 1: Month-wise split API — returns per-month breakdown of a leave range
app.get('/api/leaves/monthly-split', authRequired, async (req, res) => {
  try {
    const query = req.session.user.role === 'employee' ? { eid: req.session.user.id } : {};
    const leaves = await Leave.find({ ...query, status: 'Approved' }, { __v: 0 });
    // For each leave, split across months
    const monthMap = {}; // key: "YYYY-M" => { year, month, days, leaves[] }
    leaves.forEach(l => {
      const segments = splitByMonth(l.from, l.to);
      segments.forEach(seg => {
        const key = seg.year + '-' + seg.month;
        if (!monthMap[key]) monthMap[key] = { year: seg.year, month: seg.month, totalDays: 0, leaves: [] };
        monthMap[key].totalDays += seg.days;
        monthMap[key].leaves.push({ ...l.toObject(), splitDays: seg.days });
      });
    });
    res.json(Object.values(monthMap).sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/leaves', authRequired, async (req, res) => {
  try {
    const user = req.session.user;
    const { eid, cat, type, from, to, days, reason } = req.body;
    const targetId = user.role === 'employee' ? user.id : eid;
    if (user.role === 'employee' && eid !== user.id) return res.status(403).json({ error: 'You can only apply for yourself' });
    if (!from || !to || from > to) return res.status(400).json({ error: 'Invalid dates' });

    // Overlap check — skip for Comp-Off (they can overlap with other types)
    if (type !== 'Comp-Off') {
      const overlap = await Leave.findOne({
        eid: targetId,
        type: { $ne: 'Comp-Off' },
        status: { $nin: ['Rejected', 'Cancelled'] },
        $or: [
          { from: { $lte: to }, to: { $gte: from } },
          { from: from, to: to }
        ]
      });
      if (overlap) return res.status(400).json({
        error: `Leave already exists for this period (${overlap.type} - ${overlap.from} to ${overlap.to} - ${overlap.status})`
      });
    }

    // CHANGE 2: Comp-Off flag
    const isCompOff = type === 'Comp-Off';

    const leave = new Leave({
      id: 'LV' + Date.now(), eid: targetId, cat, type,
      from, to, days: parseFloat(days) || 1,
      reason: reason || '', status: 'Pending',
      isCompOff,
      applied: new Date().toISOString().split('T')[0],
      appliedBy: user.id
    });
    await leave.save();
    await auditLog('LEAVE_APPLY', user.id, `${user.name} applied ${type} ${from} to ${to}`);
    res.json({ ok: true, leave });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/leaves/:id', adminRequired, async (req, res) => {
  try {
    const { status, remark } = req.body;
    const leave = await Leave.findOne({ id: req.params.id });
    if (!leave) return res.status(404).json({ error: 'Leave not found' });
    leave.status = status;
    leave.remark = remark || '';
    leave.actionBy = 'ADMIN';
    leave.actionAt = new Date().toISOString();
    await leave.save();
    await auditLog('LEAVE_' + status.toUpperCase(), 'ADMIN', `Leave ${req.params.id} ${status}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CHANGE 3a: Employee requests cancellation
app.post('/api/leaves/:id/request-cancel', authRequired, async (req, res) => {
  try {
    const user = req.session.user;
    const { reason } = req.body;
    const leave = await Leave.findOne({ id: req.params.id });
    if (!leave) return res.status(404).json({ error: 'Leave not found' });
    if (user.role === 'employee' && leave.eid !== user.id) return res.status(403).json({ error: 'Access denied' });
    if (!['Approved', 'Pending'].includes(leave.status)) return res.status(400).json({ error: 'This leave cannot be cancelled' });
    if (leave.cancelRequested) return res.status(400).json({ error: 'Cancellation already requested' });
    leave.cancelRequested = true;
    leave.cancelReason = reason || '';
    leave.cancelRequestedAt = new Date().toISOString();
    await leave.save();
    await auditLog('CANCEL_REQUEST', user.id, `${user.name} requested cancel for leave ${req.params.id}`);
    res.json({ ok: true, message: 'Cancellation request submitted to admin' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CHANGE 3b: Admin approves/rejects cancellation request OR directly cancels
app.post('/api/leaves/:id/process-cancel', adminRequired, async (req, res) => {
  try {
    const { action, remark } = req.body; // 'approve' or 'reject' or 'direct'
    const leave = await Leave.findOne({ id: req.params.id });
    if (!leave) return res.status(404).json({ error: 'Leave not found' });
    if (remark) leave.remark = remark; // save admin remarks

    if (action === 'approve' || action === 'direct') {
      leave.status = 'Cancelled';
      leave.cancelledBy = 'ADMIN';
      leave.cancelledAt = new Date().toISOString();
      leave.cancelRequested = false;
      leave.cancelRejected = false;
      await leave.save();
      await auditLog('CANCEL_APPROVED', 'ADMIN', `Cancelled leave ${req.params.id} — balance credited back`);
      res.json({ ok: true, message: 'Leave cancelled. Balance credited back automatically.' });
    } else if (action === 'reject') {
      leave.cancelRequested = false;
      leave.cancelRejected = true;
      leave.cancelRejectedBy = 'ADMIN';
      await leave.save();
      await auditLog('CANCEL_REJECTED', 'ADMIN', `Rejected cancel request for leave ${req.params.id}`);
      res.json({ ok: true, message: 'Cancellation request rejected. Leave remains active.' });
    } else {
      res.status(400).json({ error: 'Invalid action. Use approve, reject or direct.' });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CHANGE 4: Carry forward API — Admin can roll over balances for new year
app.post('/api/admin/carry-forward', adminRequired, async (req, res) => {
  try {
    const { year } = req.body; // e.g. 2027
    const emps = await Employee.find({ inactive: { $ne: true } });
    let updated = 0;
    for (const emp of emps) {
      // Current remaining balance = bal - days used (approved non-compoff)
      const used = await Leave.aggregate([
        { $match: { eid: emp.id, status: 'Approved', isCompOff: { $ne: true } } },
        { $group: { _id: null, total: { $sum: '$days' } } }
      ]);
      const usedDays = used.length > 0 ? used[0].total : 0;
      const remaining = Math.max(0, emp.bal - usedDays);
      const newCF = Math.min(remaining, 10); // max 10 days carry forward — rest lapses
      const newIntake = 21;
      const newBal = newCF + newIntake;
      await Employee.findOneAndUpdate(
        { id: emp.id },
        { cf: newCF, intake: newIntake, bal: newBal }
      );
      updated++;
    }
    await auditLog('CARRY_FORWARD', 'ADMIN', `Carry forward processed for ${year} — ${updated} employees updated`);
    res.json({ ok: true, message: `Carry forward done for ${updated} employees for year ${year}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PHASE 1: Data Correction API ─────────────────────────────────────────────
// Non-deductible categories — these should NEVER deduct from leave balance
const NON_DEDUCTIBLE_CATS = [
  'Comp-Off',
  'Overtime', 
  'Other Time Off',
  'Volunteer Hours',
  'Leave of Absence'
];

const NON_DEDUCTIBLE_TYPES = [
  'Comp-Off','Overtime',
  'Birthday/Wedding Anniversary Leave','Casual Leave','Leave Without Pay',
  'Optional Festival Holiday','Unapproved Absence','Onsite Leave',
  'Paternity Leave','Bereavement Leave','Maternity Leave',
  'Volunteer Hours: Business Hours','Volunteer Hours: Non Business Hours',
  'Disability/Sickness Long Term Disability','Disability/Sickness Long Term Sickness',
  'Disability/Sickness Short Term Disability','Disability/Sickness Short Term Sickness',
  'LOA Educational','LOA Furlough','LOA Maternity/Paternity No Payment',
  'LOA Maternity Payment','LOA Parental','LOA Parental No Payment',
  'LOA Parental Payment','LOA Personal Leave No Payment','LOA Personal Leave Payment',
  'LOA Sabbatical No Payment','LOA Family Medical Leave Act','LOA Jury Duty',
  'LOA Long Service Leave Payment','LOA Workers Compensation'
];

// One-time data correction — marks non-deductible leaves and reports affected employees
app.post('/api/admin/fix-nondeductible', adminRequired, async (req, res) => {
  try {
    // Find all approved leaves in non-deductible categories
    const affected = await Leave.find({
      status: 'Approved',
      $or: [
        { cat: { $in: NON_DEDUCTIBLE_CATS } },
        { type: { $in: NON_DEDUCTIBLE_TYPES } }
      ]
    });

    // Mark them as non-deductible
    let corrected = 0;
    let details = [];
    for (const leave of affected) {
      if (!leave.isCompOff) { // already handled
        const emp = await Employee.findOne({ id: leave.eid });
        details.push({
          emp: emp ? emp.name : leave.eid,
          type: leave.type,
          days: leave.days,
          from: leave.from,
          to: leave.to
        });
      }
      // Mark as non-deductible
      leave.isCompOff = true; // reuse this flag for all non-deductible
      await leave.save();
      corrected++;
    }

    await auditLog('DATA_CORRECTION', 'ADMIN', 
      `Non-deductible fix: ${corrected} records corrected. Employees: ${[...new Set(details.map(d=>d.emp))].join(', ')}`);

    res.json({ 
      ok: true, 
      corrected, 
      message: `${corrected} leave records corrected — balance restored for affected employees`,
      details 
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Monthly accrual calculation helper ───────────────────────────────────────
// Returns accrued days based on DOJ and current date
function calcAccrued(doj, year) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-based

  // Start of accrual — max of Jan 1st of year or DOJ
  const dojDate = doj ? new Date(doj) : new Date(year + '-01-01');
  const yearStart = new Date(year + '-01-01');
  const accrualStart = dojDate > yearStart ? dojDate : yearStart;

  // Only calculate for requested year
  if (accrualStart.getFullYear() > year) return 0;

  // Months accrued = months from accrualStart to current month (inclusive)
  let startMonth = accrualStart.getMonth(); // 0-based
  let startYear = accrualStart.getFullYear();

  // If accrual started in a previous year, start from Jan of requested year
  if (startYear < year) startMonth = 0;

  // End month — if current year, use current month; if past year, use Dec
  let endMonth = (currentYear === year) ? currentMonth : 11;

  const monthsAccrued = endMonth - startMonth + 1;
  if (monthsAccrued <= 0) return 0;

  // 1.75 per month, max 21 per year
  return Math.min(Math.round(monthsAccrued * 1.75 * 100) / 100, 21);
}

// Expose accrual calculation via API
app.get('/api/accrual/:empId/:year', authRequired, async (req, res) => {
  try {
    const emp = await Employee.findOne({ id: req.params.empId });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const year = parseInt(req.params.year) || new Date().getFullYear();
    const accrued = calcAccrued(emp.doj, year);
    res.json({ empId: emp.id, name: emp.name, doj: emp.doj, cf: emp.cf, accrued, available: emp.cf + accrued });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/audit', adminRequired, async (req, res) => {
  try {
    const logs = await Log.find({}, { __v: 0 }).sort({ ts: -1 }).limit(300);
    res.json(logs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  LeaveTrack v2.3 — Data Management Portal   ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  Port   : ${PORT}                                ║`);
  console.log(`║  Admin  : Suhas Unchegaonkar / Secure@007   ║`);
  console.log(`║  Data   : MongoDB Atlas (permanent)         ║`);
  console.log(`║  NEW    : Cross-month split, Comp-Off,      ║`);
  console.log(`║           Leave cancellation workflow        ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
});
