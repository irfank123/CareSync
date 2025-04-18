import express from 'express';

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ message: 'Backend is connected and running!' });
});

export default router; 