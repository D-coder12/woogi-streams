const express = require('express');
// A built-in Node.js module used to read, write, update, and delete files on the server's disk.
const fs = require('fs');
// A built-in Node.js module used to handle file and directory paths. 
// It prevents path errors across operating systems (such as using / on Linux/Mac versus \ on Windows).
const path = require('path');
// A security library used to hash passwords. Instead of saving plain-text 
// passwords (like "password123") into users.json, bcryptjs 
// transforms them into irreversible strings (like $2a$10$e8Z...). When a user logs in, it compares 
// their input against the stored hash.
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const SECRET_KEY = 'super_secret_jwt_key';

app.use(express.json());
app.use(express.static('/api/public'));

// Helper functions for user storage (JSON file persistence)
// join the root dir and the users.json file
const USERS_FILE = path.join(__dirname, 'users.json');
// fs.existsSync(USERS_FILE): Checks whether users.json exists on server disk.
// JSON.stringify([]): Converts an empty JavaScript array ([]) into valid JSON text format ("[]").
// fs.writeFileSync(...): Synchronously creates users.json and writes "[]" 
// into it on the server's first boot, preventing file-not-found crashes when the server attempts to read users later.
if (
    !fs.existsSync(USERS_FILE)) 
    fs.writeFileSync(USERS_FILE, 
        JSON.stringify([])
    );

const getUsers = () => JSON.parse(fs.readFileSync(USERS_FILE));
const saveUsers = (data) => fs.writeFileSync(
    USERS_FILE, JSON.stringify(data, null, 2)
);

// Auth Middleware
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.split(' ')[1];
    try {
        req.user = jwt.verify(token, SECRET_KEY);
        next();
    } catch {
        res.status(403).json({ error: 'Invalid token' });
    }
};

// 0. Unguidded endpoint
app.get('/', (req, res) => {
    // Return sample featured content or public news streams
    res.sendFile(path.join(__dirname, 'api/public/index.html'));
});

// 1. Auth Endpoints
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    const users = getUsers();
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'User exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ username, password: hashedPassword, history: {} });
    saveUsers(users);
    res.json({ message: 'User created' });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const users = getUsers();
    const user = users.find(u => u.username === username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1d' });
    res.json({ token, username });
});

// 2. Stream and Catalog Endpoints
app.get('/api/videos', (req, res) => {
    res.json([{ id: 'news1.mp4', title: 'Daily Evening News' }]);
});

app.get('/api/stream/:filename', (req, res) => {
    const videoPath = path.join(__dirname, 'videos', req.params.filename);
    if (!fs.existsSync(videoPath)) return res.status(404).send('Not Found');

    const videoSize = fs.statSync(videoPath).size;
    const range = req.headers.range;

    if (!range) {
        res.writeHead(200, { 'Content-Length': videoSize, 'Content-Type': 'video/mp4' });
        return fs.createReadStream(videoPath).pipe(res);
    }

    const CHUNK_SIZE = 10 ** 6;
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

    res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": (end - start + 1),
        "Content-Type": "video/mp4",
    });

    fs.createReadStream(videoPath, { start, end }).pipe(res);
});

// 3. User Watch History Endpoints
app.post('/api/progress', authenticate, (req, res) => {
    const { videoId, timestamp } = req.body;
    const users = getUsers();
    const user = users.find(u => u.username === req.user.username);
    if (user) {
        user.history[videoId] = timestamp;
        saveUsers(users);
    }
    res.sendStatus(200);
});

app.get('/api/progress/:videoId', authenticate, (req, res) => {
    const users = getUsers();
    const user = users.find(u => u.username === req.user.username);
    const savedTime = user?.history?.[req.params.videoId] || 0;
    res.json({ timestamp: savedTime });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));