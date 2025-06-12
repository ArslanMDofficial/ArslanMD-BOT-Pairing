const express = require('express');
const fs = require('fs-extra');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

const SESSIONS_DIR = path.join(__dirname, 'sessions', 'arslan-md');
fs.ensureDirSync(SESSIONS_DIR);

// Static folder setup (yahan apna frontend folder set karo, for example 'public')
app.use(express.static(path.join(__dirname, 'public')));

let sock; // WhatsApp socket

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSIONS_DIR);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      global.qrImage = await QRCode.toDataURL(qr);
      console.log('📱 QR Code generated.');
    }

    if (connection === 'open') {
  console.log('✅ WhatsApp connected.');

  const number = sock.user.id.split(':')[0];
  const credsPath = path.join(SESSIONS_DIR, 'creds.json');

  // Delay to ensure creds.json is fully saved
  setTimeout(async () => {
    if (fs.existsSync(credsPath)) {
      const buffer = fs.readFileSync(credsPath);

      await sock.sendMessage(number + '@s.whatsapp.net', {
        document: buffer,
        mimetype: 'application/json',
        fileName: 'creds.json',
        caption: '*🤖 Arslan-MD Bot Connected Successfully!*\n\nHere is your `creds.json` file. Paste it in your bot to get started.',
      });

      console.log(`📤 creds.json sent to ${number}`);
    } else {
      console.error('❌ creds.json not found to send!');
    }
  }, 3000); // 3 seconds wait to ensure full file write
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error && new Boom(lastDisconnect.error).output?.statusCode !== DisconnectReason.loggedOut);
      console.log('❌ Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        startWhatsApp();
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

// Start WhatsApp
startWhatsApp().catch(console.error);

// QR code route to serve QR as PNG image
app.get('/generate-qr', async (req, res) => {
  try {
    if (!global.qrImage) {
      return res.status(404).send('QR not ready yet, please refresh after few seconds.');
    }
    const img = Buffer.from(global.qrImage.split(',')[1], 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': img.length,
    });
    res.end(img);
  } catch (err) {
    console.error('[ERROR] /generate-qr route error:', err);
    res.status(500).send('Failed to generate QR');
  }
});

// Root route serve index.html explicitly (optional, express.static might handle it)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
});
