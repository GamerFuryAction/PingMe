const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const sharedsession = require('express-socket.io-session');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const users = [];
const onlineUsers = new Map();

const sessionMiddleware = session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: true
});

app.use(sessionMiddleware);
io.use(sharedsession(sessionMiddleware, { autoSave: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  if (req.session.username) return res.redirect('/chat');
  res.render('index');
});

app.post('/register', async (req, res) => {
  const { username, password, confirmPassword } = req.body;
  if (password !== confirmPassword) {
    return res.send('Passwords do not match. <a href="/">Try again</a>');
  }

  const exists = users.find(u => u.username === username);
  if (exists) {
    return res.send('Username already taken. <a href="/">Try again</a>');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  users.push({ username, passwordHash });
  req.session.username = username;
  res.redirect('/chat');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.send('User not found. <a href="/">Try again</a>');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.send('Incorrect password. <a href="/">Try again</a>');

  req.session.username = username;
  res.redirect('/chat');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/chat', (req, res) => {
  if (!req.session.username) return res.redirect('/');
  res.render('chat', { username: req.session.username });
});

io.on('connection', (socket) => {
  const username = socket.handshake.session.username;
  if (!username) return;

  onlineUsers.set(username, socket.id);
  io.emit('online users', Array.from(onlineUsers.keys()));

  socket.on('disconnect', () => {
    onlineUsers.delete(username);
    io.emit('online users', Array.from(onlineUsers.keys()));
  });

  socket.on('chat message', (msg) => {
    io.emit('chat message', { username, msg });
  });

  socket.on('private message', ({ to, msg }) => {
    const toSocket = onlineUsers.get(to);
    if (toSocket) {
      io.to(toSocket).emit('private message', { from: username, msg });
    }
  });

  socket.on('typing', (target) => {
    if (target) {
      const toSocket = onlineUsers.get(target);
      if (toSocket) {
        io.to(toSocket).emit('typing', { from: username });
      }
    } else {
      socket.broadcast.emit('typing', { from: username });
    }
  });

  socket.on('stop typing', (target) => {
    if (target) {
      const toSocket = onlineUsers.get(target);
      if (toSocket) {
        io.to(toSocket).emit('stop typing', { from: username });
      }
    } else {
      socket.broadcast.emit('stop typing', { from: username });
    }
  });
});

server.listen(3000, () => {
  console.log('PingMe is running on http://localhost:3000');
});
