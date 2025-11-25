const puppeteer = require('puppeteer');
const chrome = require('chrome-aws-lambda');
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// CORS pour permettre les requêtes depuis InfinityFree
app.use(cors());
app.use(express.json());

// URL de base de votre site InfinityFree (À MODIFIER)
const BASE_URL = process.env.BASE_URL || 'https://votre-domaine.infinityfreeapp.com';

// Route de test
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Serveur Puppeteer actif',
        endpoints: {
            generate: '/generate?guest_id=X&format=png|jpeg|pdf',
            health: '/health'
        }
    });
});

// Health check pour Render
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Route pour générer le screenshot
app.get('/generate', async (req, res) => {
    const { guest_id, format } = req.query;
    
    if (!guest_id || !format) {
        return res.status(400).json({ 
            error: 'Paramètres manquants',
            required: ['guest_id', 'format']
        });
    }
    
    let browser;
    try {
        // URL du billet depuis InfinityFree
        const ticketUrl = `${BASE_URL}/qrcodes/view_ticket.php?guest_id=${guest_id}`;
        
        console.log(`🎫 Génération ${format.toUpperCase()} pour invité #${guest_id}`);
        console.log(`📍 URL: ${ticketUrl}`);
        
        // Lancer Puppeteer avec config pour Vercel/Serverless
        browser = await puppeteer.launch({
            args: chrome.args,
            executablePath: await chrome.executablePath,
            headless: chrome.headless
        });
        
        const page = await browser.newPage();
        
        // Définir la taille (A5 paysage = 2100x1480 pixels)
        await page.setViewport({
            width: 2100,
            height: 1480,
            deviceScaleFactor: 2
        });
        
        // Charger la page
        await page.goto(ticketUrl, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        // Attendre que tout soit chargé
        await page.waitForTimeout(1000);
        
        let result;
        
        if (format === 'pdf') {
            // Générer PDF
            result = await page.pdf({
                format: 'A5',
                landscape: true,
                printBackground: true,
                margin: { top: 0, right: 0, bottom: 0, left: 0 }
            });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="billet_invite_${guest_id}.pdf"`);
        } else {
            // Générer PNG ou JPEG
            result = await page.screenshot({
                type: format,
                fullPage: false,
                quality: format === 'jpeg' ? 95 : undefined
            });
            res.setHeader('Content-Type', `image/${format}`);
            res.setHeader('Content-Disposition', `attachment; filename="billet_invite_${guest_id}.${format}"`);
        }
        
        await browser.close();
        
        console.log(`✅ ${format.toUpperCase()} généré avec succès`);
        res.send(result);
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        
        if (browser) {
            await browser.close();
        }
        
        res.status(500).json({
            error: 'Erreur lors de la génération',
            message: error.message,
            guest_id,
            format
        });
    }
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur Puppeteer démarré sur le port ${PORT}`);
    console.log(`📸 URL de base: ${BASE_URL}`);
    console.log(`🔗 Endpoints:`);
    console.log(`   - GET / (info)`);
    console.log(`   - GET /health (health check)`);
    console.log(`   - GET /generate?guest_id=X&format=png|jpeg|pdf`);
});
