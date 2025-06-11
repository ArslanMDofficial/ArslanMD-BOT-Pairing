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

// Make sure session folder exists
if (!fs.existsSync(sessionPath)) {
  fs.mkdirSync(sessionPath, { recursive: true });
  console.log('[INFO] Created sessions folder:', sessionPath);
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
      const { qr, connection } = update;
      console.log('[DEBUG] Connection update:', update);

      if (qr && !qrSent) {
        try {
          const qrImage = await qrcode.toDataURL(qr);
          qrSent = true;
          console.log('[INFO] QR code generated, sending to client.');
          return res.json({ qr: qrImage });
        } catch (qrErr) {
          console.error('[ERROR] Failed to generate QR image:', qrErr);
          if (!res.headersSent) {
            return res.status(500).json({ error: 'Failed to generate QR image' });
          }
        }
      }

      if (connection === 'open') {
        console.log('[INFO] WhatsApp connection opened');
      }

      if (connection === 'close') {
        console.log('[INFO] WhatsApp connection closed');
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Timeout: if QR not generated in 15 seconds
    setTimeout(() => {
      if (!qrSent) {
        console.warn('[WARN] QR code not generated within 15 seconds.');
        if (!res.headersSent) {
          res.status(408).json({ error: 'QR code generation timeout' });
        }
      }
    }, 15000);

  } catch (err) {
    console.error('[ERROR] /generate-qr route error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
});
