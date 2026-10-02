const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
const statuses = new Set(['todo', 'in_progress', 'done']);
const priorities = new Set(['low', 'medium', 'high']);

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, title, description, status, priority, DATE_FORMAT(due_date, "%Y-%m-%d") AS due_date, created_at, updated_at FROM tasks WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    return res.json({ tasks: rows });
  } catch (error) { return next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const priority = req.body.priority || 'medium';
    const status = req.body.status || 'todo';
    const dueDate = req.body.due_date || null;
    if (!title || title.length > 160) return res.status(400).json({ error: 'Task title must be 1–160 characters.' });
    if (description.length > 1000) return res.status(400).json({ error: 'Description must be at most 1000 characters.' });
    if (!statuses.has(status)) return res.status(400).json({ error: 'Choose a valid status.' });
    if (!priorities.has(priority)) return res.status(400).json({ error: 'Choose a valid priority.' });
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return res.status(400).json({ error: 'Due date must use YYYY-MM-DD.' });
    const [result] = await pool.execute('INSERT INTO tasks (user_id, title, description, status, priority, due_date) VALUES (?, ?, ?, ?, ?, ?)', [req.user.id, title, description || null, status, priority, dueDate]);
    const [rows] = await pool.execute('SELECT id, title, description, status, priority, DATE_FORMAT(due_date, "%Y-%m-%d") AS due_date, created_at, updated_at FROM tasks WHERE id = ? AND user_id = ?', [result.insertId, req.user.id]);
    return res.status(201).json({ task: rows[0] });
  } catch (error) { return next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid task id.' });
    const fields = []; const values = [];
    if (Object.hasOwn(req.body, 'title')) {
      const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
      if (!title || title.length > 160) return res.status(400).json({ error: 'Task title must be 1–160 characters.' });
      fields.push('title = ?'); values.push(title);
    }
    if (Object.hasOwn(req.body, 'description')) {
      const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
      if (description.length > 1000) return res.status(400).json({ error: 'Description must be at most 1000 characters.' });
      fields.push('description = ?'); values.push(description || null);
    }
    if (Object.hasOwn(req.body, 'status')) {
      if (!statuses.has(req.body.status)) return res.status(400).json({ error: 'Choose a valid status.' });
      fields.push('status = ?'); values.push(req.body.status);
    }
    if (Object.hasOwn(req.body, 'priority')) {
      if (!priorities.has(req.body.priority)) return res.status(400).json({ error: 'Choose a valid priority.' });
      fields.push('priority = ?'); values.push(req.body.priority);
    }
    if (Object.hasOwn(req.body, 'due_date')) {
      const dueDate = req.body.due_date || null;
      if (dueDate && (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) return res.status(400).json({ error: 'Due date must use YYYY-MM-DD.' });
      fields.push('due_date = ?'); values.push(dueDate);
    }
    if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });
    values.push(id, req.user.id);
    const [result] = await pool.execute(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
    if (!result.affectedRows) return res.status(404).json({ error: 'Task not found.' });
    const [rows] = await pool.execute('SELECT id, title, description, status, priority, DATE_FORMAT(due_date, "%Y-%m-%d") AS due_date, created_at, updated_at FROM tasks WHERE id = ? AND user_id = ?', [id, req.user.id]);
    return res.json({ task: rows[0] });
  } catch (error) { return next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid task id.' });
    const [result] = await pool.execute('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Task not found.' });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

module.exports = router;
