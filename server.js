const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 10000;

const sessionFolder = path.join(__dirname, 'sessions');
const sessionPath = path.join(sessionFolder, 'arslan-md');

try {
  // Agar sessionPath pe file hai, to delete karo
  if (fs.existsSync(sessionPath) && !fs.lstatSync(sessionPath).isDirectory()) {
    fs.unlinkSync(sessionPath);
  }
  // Agar directory nahi hai to banao
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }
} catch (err) {
  console.error('[ERROR] Failed to prepare session directory:', err);
}

let sock, state, saveState;

async function startWhatsApp() {
  ({ state, saveState } = await useMultiFileAuthState(sessionPath));

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log('📱 QR Code generated.');
      // Emit QR to frontend or handle here
      // If you want to serve it via endpoint, save or broadcast the qr string
    }

    if (connection === 'open') {
      console.log('✅ Connected to WhatsApp!');
    }

    if (connection === 'close') {
      const status = lastDisconnect?.error?.output?.statusCode;
      if (status === DisconnectReason.loggedOut) {
        console.log('⚠️ Logged out, deleting session...');
        // Delete session folder/files to force re-authentication next time
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
      console.log('🔄 Reconnecting...');
      startWhatsApp();
    }
  });

  sock.ev.on('creds.update', saveState);
}

startWhatsApp().catch(console.error);

// API route to get QR code as base64
app.get('/generate-qr', async (req, res) => {
  if (!sock) return res.status(503).send({ error: 'Socket not ready' });

  sock.ev.once('connection.update', async (update) => {
    if (update.qr) {
      try {
        const qrDataUrl = await qrcode.toDataURL(update.qr);
        res.send({ qr: qrDataUrl });
      } catch (err) {
        console.error('QR Generation error:', err);
        res.status(500).send({ error: 'Failed to generate QR code' });
      }
    }
  });

  // Trigger QR by reconnecting (if not connected)
  if (sock.authState?.creds?.me) {
    res.send({ message: 'Already connected, no QR needed' });
  } else {
    // Disconnect to trigger new QR
    sock.logout().catch(() => {});
    startWhatsApp();
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
});
