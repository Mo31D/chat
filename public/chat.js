const socket = io();
const params = new URLSearchParams(window.location.search);
const name = params.get('name') || ('Guest' + Math.floor(Math.random()*1000));
const age = params.get('age') || '';
const country = params.get('country') || '';
let currentRoom = params.get('room') || 'chat1';

// Join with user info
socket.emit('join', { name, age, country, room: currentRoom });

// UI elements
const userListEl = document.getElementById('userList');
const messagesEl = document.getElementById('messages');
const roomTitle = document.getElementById('roomTitle');
const youInfo = document.getElementById('youInfo');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');

youInfo.innerText = name + (age ? (' — ' + age) : '') + (country ? (' — ' + country) : '');
roomTitle.innerText = (currentRoom === 'chat1' ? 'Chat 1 (Public)' : currentRoom === 'chat2' ? 'Chat 2' : 'Chat 3');

function addMessage(text, opts = {}) {
  const div = document.createElement('div');
  div.className = 'msg ' + (opts.me ? 'me' : 'other');
  if (opts.meta) {
    const m = document.createElement('div');
    m.className = 'meta';
    m.textContent = opts.meta;
    div.appendChild(m);
  }
  const c = document.createElement('div');
  c.className = 'content';
  if (opts.isImage) {
    const img = document.createElement('img');
    img.src = text;
    img.style.maxWidth = '100%';
    img.style.borderRadius = '6px';
    c.appendChild(img);
  } else {
    c.innerHTML = text.replace(/\n/g, '<br>');
  }
  div.appendChild(c);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Handle room messages
socket.on('roomMessage', (m) => {
  addMessage(m.text, { meta: m.fromName, me: m.fromId === socket.id });
});
socket.on('systemMessage', (m) => {
  const s = document.createElement('div');
  s.className = 'system';
  s.textContent = m.text;
  messagesEl.appendChild(s);
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

// Online users
let users = []; // array of user objects {id, name, age, country, room}
socket.on('userList', (list) => {
  users = list;
  userListEl.innerHTML = '';
  list.forEach(u => {
    const li = document.createElement('li');
    const av = document.createElement('span');
    av.className = 'avatar';
    av.textContent = (u.name || 'G').slice(0,2).toUpperCase();
    const txt = document.createElement('div');
    txt.innerHTML = '<strong>' + (u.name || 'Guest') + '</strong><div class="meta">' + (u.country || '') + ' ' + (u.age ? ('• ' + u.age) : '') + (u.room ? (' • ' + u.room) : '') + '</div>';
    li.appendChild(av);
    li.appendChild(txt);
    li.onclick = () => openPrivateChat(u);
    userListEl.appendChild(li);
  });
});

// Sending public room message
sendBtn.addEventListener('click', () => {
  const text = msgInput.value.trim();
  if (!text) return;
  socket.emit('roomMessage', { room: currentRoom, text: text });
  msgInput.value = '';
});
msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendBtn.click();
});

// Room switch buttons
document.querySelectorAll('.room-buttons button').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.room-buttons button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const newRoom = b.dataset.room;
    if (newRoom === currentRoom) return;
    currentRoom = newRoom;
    roomTitle.innerText = (currentRoom === 'chat1' ? 'Chat 1 (Public)' : currentRoom === 'chat2' ? 'Chat 2' : 'Chat 3');
    // Notify server to switch rooms
    socket.emit('switchRoom', { newRoom });
    messagesEl.innerHTML = ''; // clear local messages view (simple approach)
  });
});

// PRIVATE CHAT logic
const privateContainer = document.getElementById('privateContainer');
const openChats = {}; // key: userId -> DOM

function openPrivateChat(user) {
  if (user.id === socket.id) return; // don't open chat with self
  if (openChats[user.id]) {
    // bring to front
    openChats[user.id].style.display = 'block';
    return;
  }
  const pc = document.createElement('div');
  pc.className = 'private-chat';
  pc.innerHTML = `
    <div class="pc-header">
      <div>${escapeHtml(user.name || 'Guest')} <span class="meta">(${user.country || ''})</span></div>
      <div>
        <button class="close-btn">Close</button>
      </div>
    </div>
    <div class="pc-messages" id="pc-messages-${user.id}"></div>
    <div class="pc-input">
      <input type="text" id="pc-input-${user.id}" placeholder="Message to ${escapeHtml(user.name)}">
      <input type="file" id="pc-file-${user.id}" accept="image/*">
      <button id="pc-send-${user.id}">Send</button>
    </div>
  `;
  privateContainer.appendChild(pc);
  openChats[user.id] = pc;

  // Close handler
  pc.querySelector('.close-btn').addEventListener('click', () => {
    pc.remove();
    delete openChats[user.id];
  });

  // Send text
  pc.querySelector('#pc-send-' + user.id).addEventListener('click', () => {
    const input = document.getElementById('pc-input-' + user.id);
    const fileInput = document.getElementById('pc-file-' + user.id);
    const text = input.value.trim();
    if (fileInput.files.length > 0) {
      // send image as base64
      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const base = reader.result;
        socket.emit('privateMessage', { toId: user.id, text: base, isImage: true });
        fileInput.value = '';
        input.value = '';
      };
      reader.readAsDataURL(file);
    } else if (text) {
      socket.emit('privateMessage', { toId: user.id, text, isImage: false });
      input.value = '';
    }
  });

  // Enter key for private input
  pc.querySelector('#pc-input-' + user.id).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') pc.querySelector('#pc-send-' + user.id).click();
  });
}

// Receive private message
socket.on('privateMessage', (p) => {
  // p: { fromId, fromName, text, isImage, ts } or echoed variant
  const otherId = p.fromId === socket.id ? p.toId : p.fromId;
  const partnerId = otherId || (p.fromId === socket.id ? p.toId : p.fromId);
  const senderId = p.fromId;
  const partner = users.find(u => u.id === (senderId === socket.id ? p.toId : senderId));
  const idToOpen = senderId === socket.id ? p.toId : senderId;

  let userObj = users.find(u => u.id === idToOpen);
  if (!userObj) {
    // create a stub user if unknown
    userObj = { id: idToOpen, name: (p.fromName || 'Guest') };
  }
  if (!openChats[idToOpen]) {
    openPrivateChat(userObj);
  }
  const messagesDom = document.getElementById('pc-messages-' + idToOpen);
  const div = document.createElement('div');
  div.className = 'msg ' + (p.fromId === socket.id ? 'me' : 'other');
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = (p.fromName || (p.fromId === socket.id ? 'You' : 'Them'));
  div.appendChild(meta);
  if (p.isImage) {
    const img = document.createElement('img');
    img.src = p.text;
    img.style.maxWidth = '100%';
    img.style.borderRadius = '6px';
    div.appendChild(img);
  } else {
    const txt = document.createElement('div');
    txt.innerHTML = escapeHtml(p.text).replace(/\n/g, '<br>');
    div.appendChild(txt);
  }
  messagesDom.appendChild(div);
  messagesDom.scrollTop = messagesDom.scrollHeight;
});

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]);
}
