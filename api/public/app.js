document.addEventListener('DOMContentLoaded', () => {
    
    let token = localStorage.getItem('token');
    let currentVideoId = null;

    const mainPlayer = document.getElementById('mainPlayer');
    const videoSource = document.getElementById('videoSource');
    const videoTitle = document.getElementById('videoTitle');
    const videoGrid = document.getElementById('videoGrid');

    updateAuthUI();

    // Attach Event Listeners
    document.getElementById('loginBtn').addEventListener('click', () => handleAuth('/api/login'));
    document.getElementById('registerBtn').addEventListener('click', () => handleAuth('/api/register'));
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        token = null;
        updateAuthUI();
    });

    async function handleAuth(endpoint) {
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: usernameInput.value, 
                password: passwordInput.value 
            })
        });

        const data = await res.json();
        if (data.token) {
            token = data.token;
            localStorage.setItem('token', token);
            localStorage.setItem('username', data.username);
            usernameInput.value = '';
            passwordInput.value = '';
            updateAuthUI();
        } else {
            alert(data.error || data.message);
        }
    }

    function updateAuthUI() {
        const user = localStorage.getItem('username');
        if (token && user) {
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('userSection').style.display = 'block';
            document.getElementById('userInfo').innerText = `Welcome, ${user}`;
        } else {
            document.getElementById('authSection').style.display = 'block';
            document.getElementById('userSection').style.display = 'none';
        }
    }

    async function fetchCatalog() {
        try {
            const res = await fetch('/api/videos');
            const videos = await res.json();
            videoGrid.innerHTML = '';
            
            videos.forEach(video => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerText = video.title;
                card.addEventListener('click', () => playVideo(video));
                videoGrid.appendChild(card);
            });
        } catch (err) {
            console.error('Failed to load catalog:', err);
        }
    }

    async function playVideo(video) {
        currentVideoId = video.id;
        videoTitle.innerText = video.title;
        videoSource.src = `/api/stream/${video.id}`;
        mainPlayer.load();

        if (token) {
            try {
                const res = await fetch(`/api/progress/${video.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.timestamp) {
                    mainPlayer.currentTime = data.timestamp;
                }
            } catch (err) {
                console.error('Failed to fetch playback position:', err);
            }
        }
        mainPlayer.play();
    }

    // Save playback position periodically (throttled every 5 seconds)
    let lastSave = 0;
    mainPlayer.addEventListener('timeupdate', () => {
        const now = Date.now();
        if (token && currentVideoId && (now - lastSave > 5000)) {
            lastSave = now;
            fetch('/api/progress', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    videoId: currentVideoId,
                    timestamp: mainPlayer.currentTime
                })
            });
        }
    });

    // Mock Data for UI Rendering
    const watchlistData = [
        { id: 'news1.mp4', title: "Queen's Gambit", rating: '9.1', genre: 'Social drama', poster: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?q=80&w=300' },
        { id: 'news1.mp4', title: 'Ozark', rating: '8.2', genre: 'Police drama', poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=300' },
        { id: 'news1.mp4', title: 'Breaking bad', rating: '9.1', genre: 'Police drama', poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=300' }
    ];

    const acclaimedData = [
        { id: 'news1.mp4', title: 'The Crown', genre: 'Historical', rating: '8.2', poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=150' },
        { id: 'news1.mp4', title: 'Vikings', genre: 'Warlike', rating: '9.1', poster: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?q=80&w=150' },
        { id: 'news1.mp4', title: 'You', genre: 'Thrillers', rating: '7.5', poster: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=150' }
    ];

    // DOM Elements
    const watchlistGrid = document.getElementById('watchlistGrid');
    const acclaimedList = document.getElementById('acclaimedList');
    const videoModal = document.getElementById('videoModal');
    const modalPlayer = document.getElementById('modalPlayer');
    const modalVideoSource = document.getElementById('modalVideoSource');
    const closeModal = document.getElementById('closeModal');
    const featuredPlayBtn = document.getElementById('featuredPlayBtn');

    // Render Watchlist Grid
    function renderGrid(container, data) {
        container.innerHTML = '';
        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'movie-card';
            card.innerHTML = `
                <div class="card-poster" style="background-image: url('${item.poster}')">
                    <button class="add-btn-corner">+</button>
                </div>
                <div class="card-info">
                    <div class="card-title">${item.title}</div>
                    <div class="card-meta">
                        <span class="rating">★ ${item.rating}</span>
                        <span>${item.genre}</span>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => openStream(item.id));
            container.appendChild(card);
        });
    }

    // Render Right Panel Lists
    function renderList(container, data) {
        container.innerHTML = '';
        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'small-card';
            card.innerHTML = `
                <div class="small-poster" style="background-image: url('${item.poster}')"></div>
                <div class="small-info">
                    <div class="title">${item.title}</div>
                    <div class="genre">${item.genre}</div>
                    <div class="rating">★ ${item.rating}</div>
                </div>
            `;
            card.addEventListener('click', () => openStream(item.id));
            container.appendChild(card);
        });
    }

    // Modal Video Stream Handler
    function openStream(filename) {
        modalVideoSource.src = `/api/stream/${filename}`;
        videoModal.style.display = 'flex';
        modalPlayer.load();
        modalPlayer.play();
    }

    closeModal.addEventListener('click', () => {
        videoModal.style.display = 'none';
        modalPlayer.pause();
    });

    featuredPlayBtn.addEventListener('click', () => {
        openStream('news1.mp4');
    });

    // Initialize UI
    renderGrid(watchlistGrid, watchlistData);
    renderList(acclaimedList, acclaimedData);

    fetchCatalog();
});