import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const port = Number(process.env.PORT || 8080);
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'employees',
  user: process.env.DB_USER || 'employees',
  password: process.env.DB_PASSWORD || 'change-me',
});
const app = express();
app.use(express.json());

const fields = ['name', 'email', 'dateOfBirth', 'location', 'department', 'jobTitle'];
function employeeValues(body) {
  const values = fields.map((field) => String(body[field] || '').trim());
  if (values.some((value) => !value)) throw new Error('name, email, dateOfBirth, location, department, and jobTitle are required');
  if (!/^\S+@\S+\.\S+$/.test(values[1])) throw new Error('email must be valid');
  if (Number.isNaN(Date.parse(values[2]))) throw new Error('dateOfBirth must be a valid date');
  return values;
}

app.get('/healthz', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }
  catch { res.status(503).json({ status: 'database unavailable' }); }
});
app.get('/api/employees', async (_req, res, next) => {
  try { const { rows } = await pool.query('SELECT id, name, email, date_of_birth AS "dateOfBirth", location, department, job_title AS "jobTitle" FROM employees ORDER BY id'); res.json(rows); }
  catch (error) { next(error); }
});
app.post('/api/employees', async (req, res, next) => {
  try {
    const values = employeeValues(req.body);
    const { rows } = await pool.query('INSERT INTO employees (name, email, date_of_birth, location, department, job_title) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, date_of_birth AS "dateOfBirth", location, department, job_title AS "jobTitle"', values);
    res.status(201).json(rows[0]);
  } catch (error) { next(error); }
});
app.delete('/api/employees/:id', async (req, res, next) => {
  try { const result = await pool.query('DELETE FROM employees WHERE id = $1', [req.params.id]); res.sendStatus(result.rowCount ? 204 : 404); }
  catch (error) { next(error); }
});
app.use((error, _req, res, _next) => {
  const status = error.code === '23505' ? 409 : error.message?.includes('required') || error.message?.includes('valid') ? 400 : 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : error.message });
});
app.listen(port, () => console.log(`Employee API listening on ${port}`));
