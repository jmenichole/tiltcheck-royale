/**
 * Discord OAuth token exchange for Embedded App / Activity auth.
 */

function createAuthRoutes(app, { clientId, clientSecret }) {
    app.post('/api/auth/discord', async (req, res) => {
        const { code } = req.body || {};
        if (!code) {
            return res.status(400).json({ error: 'Missing code' });
        }
        if (!clientSecret) {
            return res.status(503).json({ error: 'DISCORD_CLIENT_SECRET not configured on server' });
        }

        try {
            const params = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code,
            });

            const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params,
            });

            const tokenData = await tokenRes.json();
            if (!tokenRes.ok) {
                return res.status(tokenRes.status).json({ error: tokenData.error || 'Token exchange failed' });
            }

            const userRes = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            const user = await userRes.json();
            if (!userRes.ok) {
                return res.status(userRes.status).json({ error: 'Failed to fetch user' });
            }

            return res.json({ user });
        } catch (err) {
            console.error('OAuth error:', err);
            return res.status(500).json({ error: 'Internal auth error' });
        }
    });

    app.get('/api/health', (_req, res) => {
        res.json({ ok: true, service: 'tiltcheck-royale-bot' });
    });
}

module.exports = { createAuthRoutes };
