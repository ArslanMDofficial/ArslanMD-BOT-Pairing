const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { Boom } = require('@hapi/boom');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 10000;
app.use(express.static('public'));

const SESSION_ID = 'arslan-md';
const SESSION_PATH = path.join(__dirname, 'sessions', SESSION_ID);

// ✅ Agar file hai jahan folder chahiye to delete kar ke folder banao
if (fs.existsSync(SESSION_PATH) && fs.lstatSync(SESSION_PATH).isFile()) {
    fs.unlinkSync(SESSION_PATH);
}
fs.ensureDirSync(SESSION_PATH);

let qrCodeData = ''; // QR base64 string store hoga

async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['Arslan-MD', 'Safari', '1.0']
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;

        if (qr) {
            qrCodeData = await qrcode.toDataURL(qr);
            console.log('📱 QR Code generated.');
        }

        if (connection === 'open') {
            console.log('✅ WhatsApp Connected!');
        } else if (connection === 'close') {
            const shouldReconnect = (update.lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('📴 Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) {
                startWhatsApp();
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startWhatsApp();

// ✅ Show QR image on site
app.get('/qr', (req, res) => {
    if (!qrCodeData) {
        return res.status(503).send('QR Code not ready yet. Please refresh after a few seconds.');
    }

    res.send(`
        <html>
            <head>
                <title>Arslan-MD QR</title>
                <style>
                    body {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        background: #121212;
                        color: white;
                        font-family: sans-serif;
                    }
                    img {
                        border: 8px solid #00ff99;
                        border-radius: 10px;
                    }
                    h2 {
                        margin-top: 20px;
                        color: #00ff99;
                    }
                </style>
            </head>
            <body>
                <h2>📲 Scan This QR Code</h2>
                <img src="${qrCodeData}" alt="QR Code" />
                <p>Use WhatsApp on your phone > Link a Device</p>
            </body>
        </html>
    `);
});

// ✅ Start Express server
app.listen(PORT, () => {
    console.log(`🌐 Server running at http://localhost:${PORT}`);
});
