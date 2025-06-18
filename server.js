const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const path = require('path');
const session = require('express-session');
const sharedsession = require('express-socket.io-session');
const bcrypt = require('bcryptjs');

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

// Routes
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
  const { username, password } = req.body;
  const existingUser = users.find(u => u.username === username);
  if (existingUser) {
    return res.send('User already exists. <a href="/">Try again</a>');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  users.push({ username, passwordHash });
  req.session.username = username;
  res.redirect('/chat');
});

app.post('/login', async (req, res) => {
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

io.on('connection', (socket) => {
  const username = socket.handshake.session.username;

  if (!username) {
    console.log('User connected without username');
    return;
  }

  console.log(`User connected: ${username}`);

  socket.emit('message history', messageHistory);

  socket.on('chat message', (msg) => {
    const message = { username, msg };
    messageHistory.push(message);
    io.emit('chat message', message);
  });

  socket.on('disconnect', () => {
    console.log(`${username} disconnected`);
  });
});

http.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
