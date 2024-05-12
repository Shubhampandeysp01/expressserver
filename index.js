const express = require('express');

const app = express();

const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');


app.use(cors());
app.use(bodyParser.json());

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    // Check if the token matches the stored secret
    if (token !== ACCESS_TOKEN_SECRET) {
        console.error('Token mismatch');
        return res.status(403).json({ error: 'Forbidden' });
    }

    // If token is valid, proceed to the next middleware
    next();
};







const connectionString = process.env.POSTGRES_PRISMA_URL 
// Create a pool
const pool = new Pool({
    connectionString: connectionString,
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