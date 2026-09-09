const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const app = express();
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || (isProduction ? null : 'splitflow-development-secret-change-me');
if (!jwtSecret) throw new Error('JWT_SECRET must be set in production.');
const pool = mysql.createPool({
  host: process.env.DB_HOST || (isProduction ? '' : 'localhost'),
  user: process.env.DB_USER || (isProduction ? '' : 'root'),
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'splitflow_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true
});

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

function tokenFor(user) { return jwt.sign({ id: user.id, email: user.email, name: user.name }, jwtSecret, { expiresIn: '7d' }); }
function safeUser(user) { return { id: user.id, name: user.name, email: user.email }; }
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try { req.user = jwt.verify(token, jwtSecret); next(); } catch { res.status(401).json({ error: 'Your session has expired. Please sign in again.' }); }
}

app.post('/api/auth/signup', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (name.length < 2 || !email.includes('@') || password.length < 8) return res.status(400).json({ error: 'Use a name, valid email, and password of at least 8 characters.' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hash]);
    const user = { id: result.insertId, name, email };
    res.status(201).json({ token: tokenFor(user), user });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'An account with that email already exists.' });
    if (error.code === 'ECONNREFUSED') return res.status(503).json({ error: 'Database is unavailable. Start MySQL and import database.sql, then try again.' });
    if (error.code === 'ER_ACCESS_DENIED_ERROR') return res.status(503).json({ error: 'MySQL rejected the configured credentials. Set DB_PASSWORD to your MySQL root password and restart the server.' });
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_DB_ERROR') return res.status(503).json({ error: 'SplitFlow database tables are missing. Import database.sql, then restart the server.' });
    console.error(error); res.status(500).json({ error: 'Unable to create your account right now.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  try {
    const [rows] = await pool.execute('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    const result = safeUser(user); res.json({ token: tokenFor(result), user: result });
  } catch (error) { if (error.code === 'ECONNREFUSED') return res.status(503).json({ error: 'Database is unavailable. Start MySQL and import database.sql, then try again.' }); if (error.code === 'ER_ACCESS_DENIED_ERROR') return res.status(503).json({ error: 'MySQL rejected the configured credentials. Set DB_PASSWORD to your MySQL root password and restart the server.' }); if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_DB_ERROR') return res.status(503).json({ error: 'SplitFlow database tables are missing. Import database.sql, then restart the server.' }); console.error(error); res.status(500).json({ error: 'Unable to sign in right now.' }); }
});

app.get('/api/group/default', authRequired, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute(`SELECT g.id, g.name, g.invite_code, g.created_at FROM groups_table g INNER JOIN group_members gm ON gm.group_id = g.id WHERE gm.user_id = ? ORDER BY g.created_at ASC LIMIT 1`, [req.user.id]);
    let group = existing[0];
    if (!group) {
      const prefix = req.user.name.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'FLOW';
      const inviteCode = `${prefix}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const [result] = await connection.execute('INSERT INTO groups_table (name, invite_code, created_by) VALUES (?, ?, ?)', [`${req.user.name}'s group`, inviteCode, req.user.id]);
      await connection.execute('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [result.insertId, req.user.id]);
      group = { id: result.insertId, name: `${req.user.name}'s group`, invite_code: inviteCode, created_at: new Date() };
    }
    const [members] = await connection.execute('SELECT u.id, u.name, u.email FROM users u INNER JOIN group_members gm ON gm.user_id = u.id WHERE gm.group_id = ? ORDER BY u.name', [group.id]);
    await connection.commit(); res.json({ group, members });
  } catch (error) { await connection.rollback(); console.error(error); res.status(500).json({ error: 'Unable to load your group.' }); } finally { connection.release(); }
});

app.post('/api/groups', authRequired, async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (name.length < 2 || name.length > 120) return res.status(400).json({ error: 'Choose a group name between 2 and 120 characters.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let inviteCode = '';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `${req.user.name.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'FLOW'}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const [matches] = await connection.execute('SELECT id FROM groups_table WHERE invite_code = ?', [candidate]);
      if (!matches.length) { inviteCode = candidate; break; }
    }
    if (!inviteCode) throw new Error('Could not create a unique invite code.');
    const [result] = await connection.execute('INSERT INTO groups_table (name, invite_code, created_by) VALUES (?, ?, ?)', [name, inviteCode, req.user.id]);
    await connection.execute('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [result.insertId, req.user.id]);
    await connection.commit();
    res.status(201).json({ group: { id: result.insertId, name, invite_code: inviteCode } });
  } catch (error) { await connection.rollback(); console.error(error); res.status(500).json({ error: 'Unable to create the group right now.' }); } finally { connection.release(); }
});

app.post('/api/groups/join', authRequired, async (req, res) => {
  const inviteCode = String(req.body.inviteCode || '').trim().toUpperCase();
  if (!inviteCode) return res.status(400).json({ error: 'Enter a group invite code.' });
  try {
    const [groups] = await pool.execute('SELECT id, name, invite_code FROM groups_table WHERE invite_code = ?', [inviteCode]);
    const group = groups[0];
    if (!group) return res.status(404).json({ error: 'No group was found with that invite code.' });
    await pool.execute('INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)', [group.id, req.user.id]);
    res.json({ group });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to join the group right now.' }); }
});

app.get('/api/groups/:groupId', authRequired, async (req, res) => {
  try {
    const [membership] = await pool.execute('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [req.params.groupId, req.user.id]);
    if (!membership.length) return res.status(403).json({ error: 'You are not a member of this group.' });
    const [groups] = await pool.execute('SELECT id, name, invite_code, created_at FROM groups_table WHERE id = ?', [req.params.groupId]);
    const [members] = await pool.execute('SELECT u.id, u.name, u.email FROM users u INNER JOIN group_members gm ON gm.user_id = u.id WHERE gm.group_id = ? ORDER BY u.name', [req.params.groupId]);
    if (!groups.length) return res.status(404).json({ error: 'Group not found.' });
    res.json({ group: groups[0], members });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to load this group.' }); }
});

app.get('/api/expenses/:groupId', authRequired, async (req, res) => {
  try {
    const [membership] = await pool.execute('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [req.params.groupId, req.user.id]);
    if (!membership.length) return res.status(403).json({ error: 'You are not a member of this group.' });
    const [expenses] = await pool.execute(`SELECT e.id, e.title, e.amount, e.category, e.created_at, e.paid_by, u.name AS paid_by_name FROM expenses e INNER JOIN users u ON u.id = e.paid_by WHERE e.group_id = ? ORDER BY e.created_at DESC, e.id DESC`, [req.params.groupId]);
    res.json({ expenses });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to load expenses.' }); }
});

app.post('/api/expenses', authRequired, async (req, res) => {
  const groupId = Number(req.body.groupId); const title = String(req.body.title || '').trim(); const amount = Number(req.body.amount); const category = String(req.body.category || 'Other').trim();
  if (!Number.isInteger(groupId) || !title || !Number.isFinite(amount) || amount <= 0 || amount > 99999999 || !category) return res.status(400).json({ error: 'Enter a title, a valid amount, and a category.' });
  try {
    const [membership] = await pool.execute('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, req.user.id]);
    if (!membership.length) return res.status(403).json({ error: 'You are not a member of this group.' });
    const [result] = await pool.execute('INSERT INTO expenses (group_id, paid_by, title, amount, category) VALUES (?, ?, ?, ?, ?)', [groupId, req.user.id, title, amount.toFixed(2), category]);
    const [rows] = await pool.execute(`SELECT e.id, e.title, e.amount, e.category, e.created_at, e.paid_by, u.name AS paid_by_name FROM expenses e INNER JOIN users u ON u.id = e.paid_by WHERE e.id = ?`, [result.insertId]);
    res.status(201).json({ expense: rows[0] });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to add this expense.' }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(port, '0.0.0.0', () => console.log(`SplitFlow running on port ${port}`));
