const express = require('express');
const fs = require('fs');
const path = require('path');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static('public'));

const sessionPath = path.join(__dirname, 'sessions', 'arslan-md');

// Ensure session directory exists
if (!fs.existsSync(sessionPath)) {
  fs.mkdirSync(sessionPath, { recursive: true });
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/generate-qr', async (req, res) => {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
    });

    let qrSent = false;

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr } = update;

      if (qr && !qrSent) {
        const qrImage = await qrcode.toDataURL(qr);
        qrSent = true;
        return res.json({ qr: qrImage });
      }

      if (connection === 'open') {
        console.log('✅ WhatsApp connected');
      }

      if (connection === 'close') {
        console.log('❌ Connection closed');
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Timeout if QR not received in 10 seconds
    setTimeout(() => {
      if (!qrSent) {
        res.status(408).json({ error: 'QR generation timed out' });
      }
    }, 10000);

  } catch (err) {
    console.error('QR Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
});
