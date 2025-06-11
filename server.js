const express = require('express');
const fs = require('fs');
const path = require('path');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static('public'));

// Ensure sessions/arslan-md exists and is a directory
const sessionPath = path.join(__dirname, 'sessions', 'arslan-md');

if (fs.existsSync(sessionPath)) {
  if (!fs.statSync(sessionPath).isDirectory()) {
    fs.unlinkSync(sessionPath); // remove file if it's not a directory
    fs.mkdirSync(sessionPath, { recursive: true });
  }
} else {
  fs.mkdirSync(sessionPath, { recursive: true });
}

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API route to generate QR
app.get('/generate-qr', async (req, res) => {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr } = update;

      if (qr) {
        const qrImage = await qrcode.toDataURL(qr);
        res.json({ qr: qrImage });
      }

      if (connection === 'open') {
        console.log('✅ WhatsApp connected');
        await sock.sendMessage(sock.user.id, { text: '🤖 Bot linked successfully!' });
      }

      if (connection === 'close') {
        console.log('❌ Connection closed');
      }
    });

    sock.ev.on('creds.update', saveCreds);

  } catch (err) {
    console.error('QR Error:', err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
});
