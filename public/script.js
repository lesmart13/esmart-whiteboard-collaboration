const socket = io();
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
let drawing = false;
let currentRoom = null;
let canWrite = false;
let isOwner = false;
let lastPos = null;

function resizeCanvas() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCanvas.getContext('2d').drawImage(canvas, 0, 0);
    
    canvas.width = canvas.parentElement.clientWidth - 40; // Account for padding
    canvas.height = canvas.parentElement.clientHeight - 150; // Account for toolbar and user list
    ctx.drawImage(tempCanvas, 0, 0);
}

window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);

document.getElementById('createRoom').addEventListener('click', () => {
    const roomId = document.getElementById('roomIdInput').value || Date.now().toString();
    socket.emit('create-room', roomId);
});

document.getElementById('joinRoom').addEventListener('click', () => {
    const roomId = document.getElementById('roomIdInput').value;
    if (roomId) socket.emit('join-room', roomId);
});

socket.on('room-created', (roomId) => {
    setupRoom(roomId, true);
});

socket.on('joined-room', ({ roomId, drawings, isOwner: owner }) => {
    setupRoom(roomId, owner);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawings.forEach(draw => drawOnCanvas(draw));
});

socket.on('draw', drawOnCanvas);

socket.on('permission-changed', (newCanWrite) => {
    canWrite = newCanWrite;
});

socket.on('user-list', (users) => {
    const userList = document.getElementById('userList');
    userList.innerHTML = '';
    users.forEach(([id, { canWrite }]) => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.innerHTML = `
            <span>User ${id.slice(0, 8)}</span>
            ${isOwner && id !== socket.id ? 
                `<button onclick="togglePermission('${id}', ${!canWrite})">
                    ${canWrite ? 'Revoke' : 'Grant'}
                </button>` : 
                `<span>${canWrite ? 'Can Write' : 'Read Only'}</span>`}
        `;
        userList.appendChild(div);
    });
});

socket.on('room-closed', () => {
    alert('Room closed by owner');
    location.reload();
});

socket.on('board-cleared', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

function setupRoom(roomId, owner) {
    currentRoom = roomId;
    isOwner = owner;
    canWrite = owner;
    document.getElementById('roomControls').classList.add('hidden');
    document.getElementById('whiteboardContainer').classList.remove('hidden');
    resizeCanvas();
}

function togglePermission(userId, canWrite) {
    socket.emit('toggle-write-permission', { roomId: currentRoom, userId, canWrite });
}

function drawOnCanvas(data) {
    ctx.beginPath();
    ctx.moveTo(data.startX, data.startY);
    ctx.lineTo(data.endX, data.endY);
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
}

function getPosition(e) {
    const rect = canvas.getBoundingClientRect();
    const event = e.touches ? e.touches[0] : e;
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function startDrawing(e) {
    if (!canWrite) return;
    e.preventDefault();
    drawing = true;
    lastPos = getPosition(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
}

function draw(e) {
    if (!drawing || !canWrite) return;
    e.preventDefault();
    const pos = getPosition(e);
    const data = {
        roomId: currentRoom,
        startX: lastPos.x,
        startY: lastPos.y,
        endX: pos.x,
        endY: pos.y,
        color: document.getElementById('colorPicker').value,
        lineWidth: document.getElementById('lineWidth').value
    };
    drawOnCanvas(data);
    socket.emit('draw', data);
    lastPos = pos;
}

function stopDrawing() {
    drawing = false;
    lastPos = null;
}

// Mouse events
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// Touch events
canvas.addEventListener('touchstart', startDrawing);
canvas.addEventListener('touchmove', draw);
canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('touchcancel', stopDrawing);

document.getElementById('clearBoard').addEventListener('click', () => {
    if (isOwner) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        socket.emit('clear-board', currentRoom);
    }
});