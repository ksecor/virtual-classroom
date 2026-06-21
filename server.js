const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const users = new Map();

const COLORS = ['#f97362', '#f4b942', '#65c6a7', '#66a6d9', '#a78bda', '#ed7bab'];

app.use(express.static(path.join(__dirname, 'public')));

function roomState() {
  return Array.from(users.values());
}

io.on('connection', (socket) => {
  socket.on('join', ({ name } = {}) => {
    const cleanName = String(name || '').trim().slice(0, 24) || 'Guest';
    const index = users.size;
    const user = {
      id: socket.id,
      name: cleanName,
      color: COLORS[index % COLORS.length],
      position: { x: ((index % 4) - 1.5) * 1.5, y: 1.6, z: 5 + Math.floor(index / 4) * 1.5 },
      rotation: 0
    };

    users.set(socket.id, user);
    socket.emit('joined', user);
    io.emit('room-state', roomState());
    socket.broadcast.emit('system-message', `${cleanName} joined the classroom`);
  });

  socket.on('move', ({ position, rotation } = {}) => {
    const user = users.get(socket.id);
    if (!user || !position) return;

    const x = Number(position.x);
    const z = Number(position.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;

    user.position = {
      x: Math.max(-9, Math.min(9, x)),
      y: 1.6,
      z: Math.max(-7, Math.min(9, z))
    };
    user.rotation = Number.isFinite(Number(rotation)) ? Number(rotation) : 0;
    socket.broadcast.emit('user-moved', user);
  });

  socket.on('chat-message', (message) => {
    const user = users.get(socket.id);
    const text = String(message || '').trim().slice(0, 280);
    if (!user || !text) return;
    io.emit('chat-message', {
      id: `${socket.id}-${Date.now()}`,
      userId: socket.id,
      name: user.name,
      color: user.color,
      text,
      time: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (!user) return;
    users.delete(socket.id);
    io.emit('user-left', socket.id);
    io.emit('room-state', roomState());
    io.emit('system-message', `${user.name} left the classroom`);
  });
});

server.listen(PORT, () => {
  console.log(`Commons Classroom is ready at http://localhost:${PORT}`);
});
