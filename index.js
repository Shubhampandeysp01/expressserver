const express = require('express');

const app = express();

const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();


app.use(cors({
    origin: 'https://peperunner.xyz',
    credentials: true
}));
app.use(bodyParser.json());

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = '1h';


const connectionString = process.env.POSTGRES_PRISMA_URL 
const pool = new Pool({
    connectionString: connectionString,
});

const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
};

app.post('/issue-token', (req, res) => {
    const { username } = req.body; 
    const payload = { username };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
    res.cookie('token', token, { httpOnly: true, secure: true });
    res.json({ token });
});


app.get('/leaderboard', authenticateToken, async (req, res) => {
    try {
        
        const query = `
            SELECT wallet_address, score FROM solana_wallets 
            ORDER BY score DESC
            LIMIT 25;
        `;
        
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/update-leaderboard',authenticateToken, async (req, res) => {
    try {
        console.log("sjss");
        console.log('Received request to update leaderboard:', req.body);
        const { wallet_address, score } = req.body;

        const query = `
            SELECT score FROM solana_wallets 
            ORDER BY score DESC
            LIMIT 25 OFFSET 24;
        `;

        const result = await pool.query(query);

        // Check if there are already 25 scores
        if (result.rows.length === 25) {
            const lowestScore = result.rows[0].score;

            // Check if the new score is higher than the lowest score
            if (score > lowestScore) {
                // Insert new score
                await pool.query(`
                    INSERT INTO solana_wallets (wallet_address, score) 
                    VALUES ($1, $2)
                    ON CONFLICT (wallet_address) DO UPDATE 
                    SET score = EXCLUDED.score
                    WHERE EXCLUDED.score > solana_wallets.score;
                `, [wallet_address, score]);

                // Remove lowest score
                await pool.query(`
                    DELETE FROM solana_wallets 
                    WHERE score = $1;
                `, [lowestScore]);

                res.status(200).json({ success: true });
            } else {
                res.status(200).json({ success: false, message: "Score is not higher than the lowest score in top 25. Score not updated." });
            }
        } else {
            // Insert new score if there are less than 25 scores
            await pool.query(`
                INSERT INTO solana_wallets (wallet_address, score) 
                VALUES ($1, $2)
                ON CONFLICT (wallet_address) DO UPDATE 
                SET score = EXCLUDED.score
                WHERE EXCLUDED.score > solana_wallets.score;
            `, [wallet_address, score]);

            res.status(200).json({ success: true });}
    } catch (error) {
        console.error("Error updating leaderboard:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`Server running on ${port}, http://localhost:${port}`));