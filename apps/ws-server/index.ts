import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'websocket-server' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Adjust this in production to match your frontend domain
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // User joins a specific workspace room
  socket.on('join-room', (roomId: string) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
  });

  // Real-time message distribution
  socket.on('send-message', (data: { roomId: string; content: string; userId: string; userName: string; id: string; createdAt: string }) => {
    // Broadcast message to everyone in the room except the sender
    socket.to(data.roomId).emit('receive-message', data);
  });

  // Receive line coordinate update and broadcast to others in the room
  socket.on('draw-line', (data: { 
    roomId: string; 
    x0: number; 
    y0: number; 
    x1: number; 
    y1: number; 
    color: string; 
    size: number 
  }) => {
    socket.to(data.roomId).emit('draw-line', data);
  });

  // Broadcast clear command
  socket.on('clear-canvas', (roomId: string) => {
    socket.to(roomId).emit('clear-canvas');
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.io Server running on port ${PORT}`);
});