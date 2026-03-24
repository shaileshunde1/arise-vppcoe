import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // We will restrict this in production
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'arise-backend' });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  // Leaderboard sockets and related events will be handled here
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 ARISE API Server running on port ${PORT}`);
});
