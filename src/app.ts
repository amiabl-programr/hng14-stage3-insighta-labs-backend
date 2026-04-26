import express from 'express';
import profilesRouter from './routes/profile.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';
import authRouter from './routes/auth.route.js';

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());


app.use('/api/profiles', profilesRouter);
app.use('/auth', authRouter);


app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});


app.use(errorHandler);

export default app;
