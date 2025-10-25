// Socket.IO connection
const socket = io();

// Elements
const obsStatus = document.getElementById('obs-status');
const twitchStatus = document.getElementById('twitch-status');
const vtubeStatus = document.getElementById('vtube-status');
const audioStatus = document.getElementById('audio-status');
const transcriptionBox = document.getElementById('transcription-box');
const chatContainer = document.getElementById('chat-container');
const startAudioBtn = document.getElementById('start-audio-btn');
const stopAudioBtn = document.getElementById('stop-audio-btn');
const sendMessageBtn = document.getElementById('send-message-btn');
const testMessage = document.getElementById('test-message');
const statMessages = document.getElementById('stat-messages');
const statResponses = document.getElementById('stat-responses');
const statUptime = document.getElementById('stat-uptime');

// State
let chatMessages = [];
let messageCount = 0;
let responseCount = 0;
let startTime = Date.now();

// Socket.IO event handlers
socket.on('connect', () => {
    console.log('Connected to server');
    showNotification('Connected to CoHost', 'success');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    showNotification('Disconnected from CoHost', 'error');
});

socket.on('status', (status) => {
    updateServiceStatus(status);
});

socket.on('chatMessage', (data) => {
    addChatMessage(data);
    messageCount++;
    updateStats();
});

socket.on('twitchEvent', (event) => {
    const eventMessage = formatTwitchEvent(event);
    addChatMessage({
        username: 'System',
        message: eventMessage,
        timestamp: new Date(),
    });
});

socket.on('speechStart', () => {
    transcriptionBox.textContent = '🎤 Listening...';
    transcriptionBox.classList.add('listening');
    animateAudioBars();
});

socket.on('speechEnd', (data) => {
    transcriptionBox.textContent = `✅ Speech captured (${(data.duration / 1000).toFixed(1)}s)`;
    transcriptionBox.classList.remove('listening');
    stopAudioBars();
});

socket.on('audioStarted', () => {
    startAudioBtn.style.display = 'none';
    stopAudioBtn.style.display = 'inline-block';
    transcriptionBox.textContent = 'Listening for speech...';
    showNotification('Audio capture started', 'success');
});

socket.on('audioStopped', () => {
    startAudioBtn.style.display = 'inline-block';
    stopAudioBtn.style.display = 'none';
    transcriptionBox.textContent = 'Audio capture stopped';
    transcriptionBox.classList.remove('listening');
    showNotification('Audio capture stopped', 'info');
});

socket.on('error', (data) => {
    showNotification(data.message, 'error');
});

// Button handlers
startAudioBtn.addEventListener('click', () => {
    socket.emit('startAudio');
});

stopAudioBtn.addEventListener('click', () => {
    socket.emit('stopAudio');
});

sendMessageBtn.addEventListener('click', () => {
    const message = testMessage.value.trim();
    if (message) {
        socket.emit('sendMessage', { message });
        testMessage.value = '';
        showNotification('Message sent', 'success');
    }
});

testMessage.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessageBtn.click();
    }
});

// Functions
function updateServiceStatus(status) {
    updateStatusIndicator(obsStatus, status.obs);
    updateStatusIndicator(twitchStatus, status.twitch);
    updateStatusIndicator(vtubeStatus, status.vtubeStudio);
    updateStatusIndicator(audioStatus, status.audioCapture);

    if (status.speaking) {
        audioStatus.classList.add('status-speaking');
        audioStatus.classList.remove('status-online', 'status-offline');
    } else if (status.audioCapture) {
        audioStatus.classList.add('status-online');
        audioStatus.classList.remove('status-speaking', 'status-offline');
    } else {
        audioStatus.classList.add('status-offline');
        audioStatus.classList.remove('status-online', 'status-speaking');
    }
}

function updateStatusIndicator(element, isOnline) {
    if (element === audioStatus) return; // Handled separately

    if (isOnline) {
        element.classList.add('status-online');
        element.classList.remove('status-offline');
    } else {
        element.classList.add('status-offline');
        element.classList.remove('status-online');
    }
}

function addChatMessage(data) {
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message';

    const time = new Date(data.timestamp).toLocaleTimeString();
    messageEl.innerHTML = `
        <span class="chat-username">${data.username}</span>: ${escapeHtml(data.message)}
        <span style="opacity: 0.6; font-size: 0.8em; float: right;">${time}</span>
    `;

    chatContainer.appendChild(messageEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Keep only last 100 messages
    while (chatContainer.children.length > 100) {
        chatContainer.removeChild(chatContainer.firstChild);
    }
}

function formatTwitchEvent(event) {
    switch (event.type) {
        case 'subscription':
            return `🎉 ${event.data.username} just subscribed!`;
        case 'cheer':
            return `💎 ${event.data.username} cheered ${event.data.bits} bits!`;
        case 'raid':
            return `🚀 ${event.data.username} raided with ${event.data.viewers} viewers!`;
        default:
            return `Event: ${event.type}`;
    }
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;

    if (type === 'error') {
        notification.style.background = 'rgba(244, 67, 54, 0.95)';
    } else if (type === 'info') {
        notification.style.background = 'rgba(33, 150, 243, 0.95)';
    }

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function updateStats() {
    statMessages.textContent = messageCount;
    statResponses.textContent = responseCount;

    const uptime = Date.now() - startTime;
    const minutes = Math.floor(uptime / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);
    statUptime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function animateAudioBars() {
    const bars = document.querySelectorAll('.audio-bar');
    audioBarInterval = setInterval(() => {
        bars.forEach(bar => {
            const height = Math.random() * 60 + 20;
            bar.style.height = height + 'px';
        });
    }, 100);
}

function stopAudioBars() {
    if (audioBarInterval) {
        clearInterval(audioBarInterval);
        const bars = document.querySelectorAll('.audio-bar');
        bars.forEach((bar, i) => {
            bar.style.height = (20 + i * 5) + 'px';
        });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update uptime every second
setInterval(updateStats, 1000);

// Initial stats update
updateStats();

let audioBarInterval = null;
