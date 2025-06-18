const socket = io();

const form = document.getElementById('chatForm');
const input = document.getElementById('msg');
const messages = document.getElementById('messages');

socket.on('chat message', function(data) {
  const li = document.createElement('li');
  li.textContent = data.msg;

  // Add class depending on sender
  li.classList.add(data.username === window.username ? 'self' : 'other');

  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight; // auto-scroll
});

form.addEventListener('submit', function(e) {
  e.preventDefault();
  if (input.value.trim()) {
    socket.emit('chat message', input.value);
    input.value = '';
  }
});
