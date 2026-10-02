const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (message.length < 10 || message.length > 2000) return res.status(400).json({ error: 'Feedback must be 10–2,000 characters.' });
    await pool.execute('INSERT INTO feedback (user_id, message) VALUES (?, ?)', [req.user.id, message]);
    return res.status(201).json({ message: 'Feedback received. Thank you!' });
  } catch (error) { return next(error); }
});
module.exports = router;
