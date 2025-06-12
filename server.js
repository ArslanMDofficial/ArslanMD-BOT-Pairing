const express = require('express');
const fs = require('fs-extra');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// 📁 Session folder
const SESSIONS_DIR = path.join(__dirname, 'sessions', 'arslan-md');
fs.ensureDirSync(SESSIONS_DIR);

// 🌐 Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

let sock;

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

      const userNumber = sock.user.id.split(':')[0];
      const credsPath = path.join(SESSIONS_DIR, 'creds.json');

      // 🕒 Wait 3 seconds then send creds + links image
      setTimeout(async () => {
        if (fs.existsSync(credsPath)) {
          const buffer = fs.readFileSync(credsPath);

          // 🖼️ Send promotional image with caption
          await sock.sendMessage(userNumber + '@s.whatsapp.net', {
            image: fs.readFileSync(path.join(__dirname, 'arslan-md-promo.jpg')),
            caption:
`*🤖 Arslan-MD Bot Connected Successfully!*

🔗 Paste this *creds.json* file in your bot to activate.

📢 Join & Support:
🧿 YouTube: https://youtube.com/@arslanmdofficial
📡 WhatsApp Channel: https://whatsapp.com/channel/0029VarfjW04tRrmwfb8x306
👥 WhatsApp Group: https://chat.whatsapp.com/KRyARlvcUjoIv1CPSSyQA5
💬 Message Me: https://wa.me/message/VRZ5QLDAHXKSF1
🚀 Telegram: https://t.me/@ArslanMDofficial`,
          });

          // 📄 Send creds.json file
          await sock.sendMessage(userNumber + '@s.whatsapp.net', {
            document: buffer,
            mimetype: 'application/json',
            fileName: 'creds.json',
          });

          console.log(`📤 creds.json sent to ${userNumber}`);

          // ✅ Notify Admin (YOU) of new connection
          await sock.sendMessage('923237045919@s.whatsapp.net', {
            text: `✅ *New User Connected to Arslan-MD*\n\n*User Number:* ${userNumber}`,
          });
        } else {
          console.log('⚠️ creds.json not found!');
        }
      }, 3000);
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

startWhatsApp().catch(console.error);

// 🎯 Serve QR code image
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
    console.error('[ERROR] /generate-qr:', err);
    res.status(500).send('Failed to generate QR');
  }
});

// 🏠 Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
});
