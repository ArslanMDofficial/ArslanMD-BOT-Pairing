// server.js
const express = require('express');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const { default: makeWASocket, Browsers, useMultiFileAuthState, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 10000;

// Session folder and session id
const SESSION_ID = 'arslan-md';
const SESSION_DIR = path.join(__dirname, 'sessions', SESSION_ID);

// Ensure session folder exists
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

let sock; // WhatsApp socket

// Start WhatsApp connection and generate QR code
async function startWhatsApp() {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: Browsers.macOS('Safari'),
  });

  // On QR event — generate QR image and save it
  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      // Convert QR string to Data URL (base64 image)
      const qrImageUrl = await qrcode.toDataURL(qr);

      // Save QR image as base64 for serving
      fs.writeFileSync(path.join(__dirname, 'public', 'qr.txt'), qrImageUrl);

      console.log('✅ QR Code Generated. Open http://localhost:' + PORT + ' to scan.');
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp is connected!');
      // Save credentials on update
      sock.ev.on('creds.update', saveCreds);

      // Read creds.json and send a message
      const credsFile = path.join(SESSION_DIR, 'creds.json');
      if (fs.existsSync(credsFile)) {
        const credsData = fs.readFileSync(credsFile);
        await sock.sendMessage(sock.user.id, {
          document: credsData,
          mimetype: 'application/json',
          fileName: 'creds.json',
          caption: 'Your WhatsApp session credentials (keep it safe).',
        });

        await sock.sendMessage(sock.user.id, {
          text: `🤖 Welcome to Arslan-MD Bot!\n\n🔗 Join our channels:\nYouTube: https://youtube.com/@arslanmdofficial\nTelegram: https://t.me/ArslanMDofficial\nInstagram: https://instagram.com/ArslanMD\n\n⚠️ Do not share your creds.json file with anyone!`,
        });
      }
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
      console.log('⚠️ Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        startWhatsApp();
      } else {
        console.log('❌ Unauthorized. Please delete sessions folder and try again.');
      }
    }
  });
}

startWhatsApp();

// Express static folder to serve qr image
app.use(express.static('public'));

// Route to serve QR code image
app.get('/qr', (req, res) => {
  const qrPath = path.join(__dirname, 'public', 'qr.txt');
  if (fs.existsSync(qrPath)) {
    const qrDataUrl = fs.readFileSync(qrPath, 'utf-8');
    res.send(`<html>
      <head><title>Scan QR to Connect WhatsApp</title></head>
      <body style="display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;background:#121212;color:#fff;font-family:sans-serif;">
        <h2>Scan this QR code with your WhatsApp</h2>
        <img src="${qrDataUrl}" alt="WhatsApp QR Code" style="max-width:300px;"/>
        <p>Once scanned, your bot will connect automatically.</p>
      </body>
    </html>`);
  } else {
    res.send('QR code not generated yet. Please wait...');
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
});
