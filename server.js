require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // 🔥 FIX IPN

// ==========================
// 🔍 VERIFICATION CONFIG
// ==========================
if (!process.env.PAYTECH_API_KEY || !process.env.PAYTECH_API_SECRET) {
    console.error("❌ API KEY ou SECRET manquant");
    process.exit(1);
}

if (!process.env.PAYTECH_URL) {
    console.error("❌ PAYTECH_URL manquant");
    process.exit(1);
}

if (!process.env.MYBACKENDURL) {
    console.error("❌ MYBACKENDURL manquant");
    process.exit(1);
}

// ==========================
// 🔥 ROUTE ZAPIER → PAYTECH
// ==========================
app.post('/create-payment-link', async (req, res) => {
    try {
        console.log("📩 DONNÉES REÇUES :", req.body);

        let {
            item_name,
            item_price,
            ref_command,
            command_name
        } = req.body;

        let rawPrice = item_price;

        console.log("💰 PRIX BRUT :", rawPrice);

        rawPrice = rawPrice.toString()
            .replace(/\s/g, '')
            .replace(',', '.');

        let amount = Math.round(Number(rawPrice));

        console.log("💰 PRIX FINAL :", amount);

        if (!amount || isNaN(amount) || amount <= 0) {
            console.log("❌ MONTANT INVALIDE :", rawPrice);
            return res.status(400).json({
                error: "Montant invalide"
            });
        }

        const payload = {
            item_name: item_name || "Produit ZeiStore",
            item_price: amount.toString(),
            currency: "XOF",
            ref_command: ref_command || ("CMD_" + Date.now()),
            command_name: command_name || "Paiement ZeiStore",
            env: "prod",
            ipn_url: process.env.MYBACKENDURL + "/ipn",
            success_url: "https://zeistoreofficiel.com/pages/merci",
            cancel_url: "https://zeistoreofficiel.com/cart"
        };

        console.log("📦 PAYLOAD PAYTECH :", payload);

        const response = await axios.post(
            process.env.PAYTECH_URL,
            payload,
            {
                headers: {
                    API_KEY: process.env.PAYTECH_API_KEY,
                    API_SECRET: process.env.PAYTECH_API_SECRET,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("✅ RÉPONSE PAYTECH :", response.data);

        res.json({
            success: true,
            redirect_url: response.data.redirect_url
        });

    } catch (error) {
        console.error("❌ ERREUR COMPLETE:");

        if (error.response) {
            console.error("👉 STATUS:", error.response.status);
            console.error("👉 DATA:", error.response.data);
        } else {
            console.error("👉 MESSAGE:", error.message);
        }

        res.status(500).json({
            error: "Erreur serveur"
        });
    }
});

// ==========================
// 🔐 IPN PAYTECH
// ==========================
app.post('/ipn', async (req, res) => {
    console.log("📩 IPN REÇU :", req.body);

    try {
        await axios.post("https://hooks.zapier.com/hooks/catch/27141384/u7gi84e/", {
            order_name: req.body.ref_command,
            status: req.body.type_event,
            amount: req.body.item_price
        });

        console.log("✅ Envoyé à Zapier");
    } catch (error) {
        console.log("❌ Erreur Zapier :", error.message);
    }

    res.status(200).send('OK');
});

// ==========================
// ROUTE TEST
// ==========================
app.get('/', (req, res) => {
    res.send('🚀 Backend PayTech actif');
});

// ==========================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
