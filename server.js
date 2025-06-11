const express = require('express');
const qrcode = require('qrcode');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = 10000;

app.use(express.static(path.join(__dirname, 'public')));

// Ensure sessions directory exists
const SESSIONS_DIR = path.join(__dirname, 'sessions');
fs.ensureDirSync(SESSIONS_DIR);

let sock;
let qrCodeDataUrl = '';

async function startWhatsApp() {
  // Use Multi File Auth State (session stored in sessions/arslan-md)
  const { state, saveCreds } = await useMultiFileAuthState(path.join(SESSIONS_DIR, 'arslan-md'));

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr } = update;
    if (qr) {
      // Generate base64 QR image
      qrCodeDataUrl = await qrcode.toDataURL(qr);
      console.log('QR Code updated');
    }
    if (connection === 'close') {
      console.log('Connection closed, reconnecting...');
      startWhatsApp();
    } else if (connection === 'open') {
      console.log('WhatsApp connected!');
      qrCodeDataUrl = ''; // Clear QR code after connect
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

// API route to get QR code image as base64
app.get('/generate-qr', (req, res) => {
  if (!qrCodeDataUrl) {
    return res.json({ status: false, message: 'QR code not generated yet' });
  }
  res.json({ status: true, qr: qrCodeDataUrl });
});

app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
  startWhatsApp();
});
