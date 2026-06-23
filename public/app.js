const socket = io();
const joinOverlay = document.querySelector('#join-overlay');
const joinForm = document.querySelector('#join-form');
const nameInput = document.querySelector('#display-name');
const peopleList = document.querySelector('#people-list');
const peopleCount = document.querySelector('#people-count');
const messages = document.querySelector('#messages');
const chatForm = document.querySelector('#chat-form');
const chatInput = document.querySelector('#chat-input');
const remoteUsers = document.querySelector('#remote-users');
const player = document.querySelector('#player');
const sessionStatus = document.querySelector('#session-status');
const lessonVideo = document.querySelector('#lesson-video');
const videoToggle = document.querySelector('#video-toggle');



let me = null;
let users = [];
let lastSent = 0;

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));

function updateVideoButton() {
  videoToggle.textContent = lessonVideo.paused
    ? '▶ Play video'
    : '❚❚ Pause video';
}

videoToggle.addEventListener('click', async () => {
  if (lessonVideo.paused) {
    await lessonVideo.play();
  } else {
    lessonVideo.pause();
  }
});

lessonVideo.addEventListener('play', updateVideoButton);
lessonVideo.addEventListener('pause', updateVideoButton);
lessonVideo.addEventListener('ended', updateVideoButton);

updateVideoButton();




joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return nameInput.focus();
  
  localStorage.setItem('commons-display-name', name);

  const video = document.querySelector('#lesson-video');
  if (video) {
    video.muted = false;
    video.play().catch(console.error);
  }


  socket.emit('join', { name });
});

nameInput.value = localStorage.getItem('commons-display-name') || '';

socket.on('joined', (user) => {
  me = user;
  player.setAttribute('position', user.position);
  player.setAttribute('rotation', `0 ${user.rotation} 0`);
  joinOverlay.classList.add('hidden');
  chatInput.focus();
});

socket.on('room-state', (roomUsers) => {
  users = roomUsers;
  renderPeople();
  renderAvatars();
});

socket.on('user-moved', (user) => {
  const index = users.findIndex((item) => item.id === user.id);
  if (index >= 0) users[index] = user;
  else users.push(user);
  updateAvatar(user);
});

socket.on('user-left', (id) => {
  users = users.filter((user) => user.id !== id);
  document.querySelector(`#avatar-${CSS.escape(id)}`)?.remove();
  renderPeople();
});

socket.on('chat-message', (message) => {
  const article = document.createElement('article');
  article.className = 'message';
  const time = new Date(message.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  article.innerHTML = `<div class="message-head"><i style="background:${message.color}"></i><strong>${escapeHtml(message.name)}${message.userId === me?.id ? ' · You' : ''}</strong><time>${time}</time></div><p>${escapeHtml(message.text)}</p>`;
  messages.appendChild(article);
  messages.scrollTop = messages.scrollHeight;
});

socket.on('system-message', (text) => {
  const note = document.createElement('div');
  note.className = 'system-message';
  note.textContent = text;
  messages.appendChild(note);
  messages.scrollTop = messages.scrollHeight;
});

socket.on('disconnect', () => { sessionStatus.textContent = 'RECONNECTING'; });
socket.on('connect', () => {
  sessionStatus.textContent = 'ROOM OPEN';
  if (me) socket.emit('join', { name: me.name });
});

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text || !me) return;
  socket.emit('chat-message', text);
  chatInput.value = '';
});

function renderPeople() {
  peopleCount.textContent = users.length;
  peopleList.innerHTML = users.map((user) => `
    <div class="person">
      <span class="person-avatar" style="background:${user.color}">${escapeHtml(user.name.slice(0, 2).toUpperCase())}</span>
      <span>${escapeHtml(user.name)}</span>
      <em class="${user.id === me?.id ? 'you' : ''}">${user.id === me?.id ? 'YOU' : 'ONLINE'}</em>
    </div>`).join('');
}

function renderAvatars() {
  remoteUsers.innerHTML = '';
  users.filter((user) => user.id !== me?.id).forEach(createAvatar);
}

function createAvatar(user) {
  const avatarRotation = (Number(user.rotation) || 0) + 180;

  const entity = document.createElement('a-entity');
  entity.id = `avatar-${user.id}`;
  entity.setAttribute('position', `${user.position.x} 0 ${user.position.z}`);

  entity.setAttribute(
    'rotation',
    `0 ${avatarRotation} 0`
  );

  entity.innerHTML = `
    <a-cylinder position="0 .85 0" radius=".34" height="1.05" color="${user.color}"></a-cylinder>
    <a-sphere position="0 1.62 0" radius=".31" color="#d9a982"></a-sphere>
    <a-sphere position="0 1.72 -.18" radius=".29" theta-start="0" theta-length="105" color="#3a312b"></a-sphere>
    <a-circle position="0 2.15 0" rotation="0 0 0" radius=".48" color="#22241f" material="opacity:.82; transparent:true"></a-circle>
    <a-text position="0 2.12 .01" value="${escapeHtml(user.name)}" align="center" width="2.8" color="#ffffff"></a-text>`;
  remoteUsers.appendChild(entity);
}

function updateAvatar(user) {
  if (user.id === me?.id) return;
  let avatar = document.querySelector(`#avatar-${CSS.escape(user.id)}`);
  if (!avatar) { createAvatar(user); avatar = document.querySelector(`#avatar-${CSS.escape(user.id)}`); }
  avatar.setAttribute('animation__move', `property: position; to: ${user.position.x} 0 ${user.position.z}; dur: 90; easing: linear`);
  avatar.setAttribute('rotation', `0 ${user.rotation || 0} 0`);
}

setInterval(() => {
  if (!me || !player.object3D || Date.now() - lastSent < 45) return;
  const { x, z } = player.object3D.position;
  const rotation = player.object3D.rotation.y * (180 / Math.PI);
  socket.emit('move', { position: { x, z }, rotation });
  lastSent = Date.now();
}, 60);

document.querySelector('#dismiss-hint').addEventListener('click', () => document.querySelector('#move-hint').remove());
document.querySelector('#sound-toggle').addEventListener('click', (event) => {
  event.currentTarget.classList.toggle('muted');
  event.currentTarget.querySelector('span').textContent = event.currentTarget.classList.contains('muted') ? '×' : '⌁';
});


document.querySelectorAll('.video-choice').forEach((choice) => {
  choice.addEventListener('click', async () => {
    const video = document.querySelector('#lesson-video');

    video.pause();
    video.src = choice.dataset.video;
    video.load();

    try {
      await video.play();
    } catch (error) {
      console.error('Unable to play selected video:', error);
    }

    document.querySelectorAll('.video-choice').forEach((item) => {
      item.setAttribute('color', '#42675a');
    });

    choice.setAttribute('color', '#d86f55');
  });
});