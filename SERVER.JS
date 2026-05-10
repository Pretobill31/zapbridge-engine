const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const app = express();

app.use(cors());
app.use(express.json());

let qrGlobal = null;
let sock = null;

// INICIAR WHATSAPP
async function startWhatsApp() {

  const { state, saveCreds } =
    await useMultiFileAuthState("auth");

  sock = makeWASocket({
    auth: state
  });

  // QR CODE
  sock.ev.on("connection.update", async (update) => {

    const { connection, qr } = update;

    // GERAR QR
    if (qr) {

      qrGlobal = await QRCode.toDataURL(qr);

      console.log("QR CODE GERADO");

    }

    // CONECTADO
    if (connection === "open") {

      console.log("WHATSAPP CONECTADO");

    }

    // DESCONECTOU
    if (connection === "close") {

      console.log("DESCONECTADO");

      startWhatsApp();

    }

  });

  // SALVAR SESSÃO
  sock.ev.on("creds.update", saveCreds);

  // RECEBER MENSAGENS
  sock.ev.on("messages.upsert", async ({ messages }) => {

    const msg = messages[0];

    if (!msg.message) return;

    const texto =
      msg.message.conversation || "";

    const numero =
      msg.key.remoteJid;

    console.log(numero);
    console.log(texto);

  });

}

startWhatsApp();

// QR ROUTE
app.get("/qr", async (req, res) => {

  res.json({
    qr: qrGlobal
  });

});

// STATUS
app.get("/", (req, res) => {

  res.send("ZapBridge Engine Online");

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(`Servidor rodando ${PORT}`);

}); 
