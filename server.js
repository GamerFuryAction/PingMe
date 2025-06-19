const express = require('express');
const onlineUsers = new Map();
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const path = require('path');
const session = require('express-session');
const sharedsession = require('express-socket.io-session');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many login attempts. Please try again later.'
});

const users = [];
const messageHistory = [];

const sessionMiddleware = session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: true
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

io.use(sharedsession(sessionMiddleware, { autoSave: true }));

app.get('/', (req, res) => {
  if (req.session.username) {
    return res.redirect('/chat');
  }
  res.render('index');
});

app.get('/chat', (req, res) => {
  if (!req.session.username) return res.redirect('/');
  res.render('chat', { username: req.session.username });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.post('/register', async (req, res) => {
  const { username, password, confirmPassword } = req.body;
  
  if (password !== confirmPassword) {
    return res.send('Passwords do not match. <a href="/">Try again</a>');
  }

  const existingUser = users.find(u => u.username === username);
  if (existingUser) {
    return res.send('User already exists. <a href="/">Try again</a>');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  users.push({ username, passwordHash });
  req.session.username = username;
  res.redirect('/chat');
});

app.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);

  if (!user) {
    return res.send('User not found. <a href="/">Try again</a>');
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.send('Incorrect password. <a href="/">Try again</a>');
  }

  req.session.username = username;
  res.redirect('/chat');
});

let currentTarget = null;

socket.on('online users', (usernames) => {
  const userList = document.getElementById('user-list');
  userList.innerHTML = '';
  usernames.forEach(user => {
    if (user === currentUser) return;
    const li = document.createElement('li');
    li.textContent = user;
    li.onclick = () => {
      currentTarget = user;
      alert(`Now chatting privately with ${user}`);
    };
    userList.appendChild(li);
  });
});

socket.on('private message', (data) => {
  const li = document.createElement('li');
  li.classList.add('message', 'them');
  li.innerHTML = `
    <span class="username">${data.from} (private)</span>
    <div class="bubble">${data.msg}</div>
  `;
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  if (currentTarget) {
    socket.emit('private message', { to: currentTarget, msg: message });
    const li = document.createElement('li');
    li.classList.add('message', 'me');
    li.innerHTML = `
      <span class="username">You → ${currentTarget} (private)</span>
      <div class="bubble">${message}</div>
    `;
    messages.appendChild(li);
  } else {
    socket.emit('chat message', message);
  }

  input.value = '';
});


io.on('connection', (socket) => {
  const username = socket.handshake.session.username;
  if (!username) return;

  onlineUsers.set(username, socket.id);

  io.emit('online users', Array.from(onlineUsers.keys()));

  socket.on('private message', ({ to, msg }) => {
    const targetSocketId = onlineUsers.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('private message', {
        from: username,
        msg
      });
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(username);
    io.emit('online users', Array.from(onlineUsers.keys()));
  });

});

http.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
