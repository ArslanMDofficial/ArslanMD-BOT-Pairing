const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 10000;

// Static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// Session folder path
const SESSION_ID = 'arslan-md';
const SESSION_PATH = path.join(__dirname, 'sessions', SESSION_ID);

// Make sure session folder exists
fs.ensureDirSync(SESSION_PATH);

let qrData = '';
let connected = false;

// Start WhatsApp connection
async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: undefined,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrData = await qrcode.toDataURL(qr);
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected!');
      connected = true;
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log('⚠️ Disconnected. Reconnecting...');
        startWhatsApp();
      } else {
        console.log('❌ Disconnected. Not reconnecting.');
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

// API to serve QR code
app.get('/get-qr', (req, res) => {
  if (connected) {
    res.json({ success: false, message: 'Bot already connected ✅' });
  } else if (qrData) {
    res.json({ success: true, qr: qrData });
  } else {
    res.json({ success: false, message: 'QR not ready yet ⏳' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
  startWhatsApp();
});
