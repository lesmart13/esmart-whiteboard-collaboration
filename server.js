const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;

let rooms = new Map();

app.use(express.static('public'));

io.on('connection', (socket) => {
    socket.on('create-room', (roomId) => {
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                owner: socket.id,
                users: new Map([[socket.id, { canWrite: true }]]),
                drawings: []
            });
            socket.join(roomId);
            socket.emit('room-created', roomId);
        }
    });

    socket.on('join-room', (roomId) => {
        if (rooms.has(roomId)) {
            rooms.get(roomId).users.set(socket.id, { canWrite: false });
            socket.join(roomId);
            socket.emit('joined-room', { 
                roomId, 
                drawings: rooms.get(roomId).drawings,
                isOwner: rooms.get(roomId).owner === socket.id
            });
            io.to(roomId).emit('user-list', Array.from(rooms.get(roomId).users.entries()));
        }
    });

    socket.on('draw', (data) => {
        const room = rooms.get(data.roomId);
        if (room && room.users.get(socket.id).canWrite) {
            room.drawings.push(data);
            socket.broadcast.to(data.roomId).emit('draw', data);
        }
    });

    socket.on('clear-board', (roomId) => {
        const room = rooms.get(roomId);
        if (room && room.owner === socket.id) {
            room.drawings = []; // Clear the stored drawings
            io.to(roomId).emit('board-cleared');
        }
    });

    socket.on('toggle-write-permission', ({ roomId, userId, canWrite }) => {
        const room = rooms.get(roomId);
        if (room && room.owner === socket.id) {
            room.users.set(userId, { canWrite });
            io.to(roomId).emit('user-list', Array.from(room.users.entries()));
            io.to(userId).emit('permission-changed', canWrite);
        }
    });

    socket.on('disconnect', () => {
        rooms.forEach((room, roomId) => {
            if (room.users.has(socket.id)) {
                room.users.delete(socket.id);
                if (room.owner === socket.id) {
                    rooms.delete(roomId);
                    io.to(roomId).emit('room-closed');
                } else {
                    io.to(roomId).emit('user-list', Array.from(room.users.entries()));
                }
            }
        });
    });
});

http.listen(PORT, () => console.log(`Server running on port ${PORT}`));