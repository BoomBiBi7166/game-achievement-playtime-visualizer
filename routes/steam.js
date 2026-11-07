const crypto = require('crypto');
const express = require('express');

const router = express.Router();
const pendingLogins = new Map();
const COOKIE_NAME = 'steamcity_session';
const OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const STEAM_ID_RE = /^\d{17}$/;

function baseUrl(req) {
  return (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

function sign(value) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('base64url');
}

function setSession(res, steamId) {
  const value = `${steamId}.${sign(steamId)}`;
  const secure = (process.env.APP_URL || '').startsWith('https://');
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure ? '; Secure' : ''}`);
}

function sessionSteamId(req) {
  if (!process.env.SESSION_SECRET) return null;
  const cookie = (req.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE_NAME}=`));
  const [steamId, signature, extra] = cookie ? cookie.slice(COOKIE_NAME.length + 1).split('.') : [];
  if (extra || !STEAM_ID_RE.test(steamId || '') || !signature) return null;
  const expected = Buffer.from(sign(steamId));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual) ? steamId : null;
}

async function steamApi(method, params) {
  if (!process.env.STEAM_API_KEY) throw new Error('Steam API key is not configured.');
  const url = new URL(`https://api.steampowered.com/${method}/`);
  url.search = new URLSearchParams({ key: process.env.STEAM_API_KEY, format: 'json', ...params });
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Steam API returned ${response.status}.`);
  return response.json();
}

router.get('/login', (req, res) => {
  if (!process.env.SESSION_SECRET) return res.status(503).send('Set SESSION_SECRET in .env before connecting Steam.');
  const root = baseUrl(req);
  const state = crypto.randomBytes(24).toString('hex');
  pendingLogins.set(state, { returnTo: `${root}/api/steam/callback`, createdAt: Date.now() });
  for (const [key, entry] of pendingLogins) if (Date.now() - entry.createdAt > 10 * 60 * 1000) pendingLogins.delete(key);
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': `${root}/api/steam/callback?state=${state}`,
    'openid.realm': `${root}/`,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
  });
  res.redirect(`${OPENID_ENDPOINT}?${params}`);
});

router.get('/callback', async (req, res) => {
  const state = req.query.state;
  const pending = pendingLogins.get(state);
  pendingLogins.delete(state);
  if (!pending || Date.now() - pending.createdAt > 10 * 60 * 1000 || req.query['openid.return_to'] !== `${pending.returnTo}?state=${state}` || req.query['openid.mode'] !== 'id_res') {
    return res.status(401).send('Steam sign-in could not be verified. Please try again.');
  }
  const claimedId = req.query['openid.claimed_id'];
  const match = typeof claimedId === 'string' && claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);
  if (!match || req.query['openid.identity'] !== claimedId) return res.status(401).send('Steam returned an invalid account ID.');

  try {
    const check = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) if (key.startsWith('openid.') && typeof value === 'string') check.set(key, value);
    check.set('openid.mode', 'check_authentication');
    const verification = await fetch(OPENID_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: check, signal: AbortSignal.timeout(15000) });
    const result = await verification.text();
    if (!verification.ok || !/is_valid:true/.test(result)) return res.status(401).send('Steam sign-in verification failed.');
    setSession(res, match[1]);
    res.redirect('/?steam=connected');
  } catch (error) {
    console.error('Steam OpenID verification failed:', error.message);
    res.status(502).send('Could not verify with Steam. Please try again.');
  }
});

router.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  const steamId = sessionSteamId(req);
  if (!steamId) return res.json({ connected: false });
  try {
    const summary = await steamApi('ISteamUser/GetPlayerSummaries/v2', { steamids: steamId });
    const player = summary.response?.players?.[0];
    res.json({ connected: true, steamId, user: player ? { username: player.personaname, avatar_url: player.avatarfull } : null });
  } catch (error) {
    console.error('Steam account lookup failed:', error.message);
    const status = /not configured/.test(error.message) ? 503 : 502;
    res.status(status).json({ error: error.message });
  }
});

router.post('/sync', async (req, res) => {
  const steamId = sessionSteamId(req);
  if (!steamId) return res.status(401).json({ error: 'Connect Steam first.' });
  try {
    const [owned, summary] = await Promise.all([
      steamApi('IPlayerService/GetOwnedGames/v1', { steamid: steamId, include_appinfo: '1', include_played_free_games: '1', include_free_sub: '1', skip_unvetted_apps: '0' }),
      steamApi('ISteamUser/GetPlayerSummaries/v2', { steamids: steamId })
    ]);
    const player = summary.response?.players?.[0];
    if (!player) throw new Error('Steam profile was not available. Check your profile visibility.');
    const games = (owned.response?.games || []).sort((a, b) => b.playtime_forever - a.playtime_forever);
    if (!games.length) throw new Error('No games were returned. Set Game details to Public in Steam privacy settings.');

    const featuredGames = new Set(games.slice(0, 9).map(game => String(game.appid)));
    const syncedGames = games.map(game => {
      let unlocked = null, total = null;
      if (featuredGames.has(String(game.appid))) {
        unlocked = 0;
        total = 0;
      }
      return { game, unlocked, total, featured: featuredGames.has(String(game.appid)) };
    });
    for (const entry of syncedGames) {
      const { game } = entry;
      if (entry.total !== null) {
        try {
          const achievements = await steamApi('ISteamUserStats/GetPlayerAchievements/v1', { steamid: steamId, appid: String(game.appid) });
          const list = achievements.playerstats?.achievements || [];
          if (list.length) {
            entry.total = list.length;
            entry.unlocked = list.filter(item => item.achieved === 1).length;
          } else {
            entry.total = null;
            entry.unlocked = null;
          }
        } catch {
          entry.total = null;
          entry.unlocked = null;
        }
      }
    }
    const tones = ['#8ce0bd', '#75a8ff', '#e9ac70', '#bd9bea', '#e78071', '#d1c48a', '#79c6d3', '#91bd73', '#e38eaa'];
    const gamesWithStats = syncedGames.map(({ game, unlocked, total, featured }) => {
      const title = game.name || `App ${game.appid}`;
      const image = game.img_icon_url ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg` : null;
      return { id: String(game.appid), name: title, image, hours: Math.round((game.playtime_forever || 0) / 60), unlocked, total, achievementChecked: featured, genre: 'Steam game', tone: tones[Number(game.appid) % tones.length] };
    });
    res.json({ connected: true, steamId, player: { name: player.personaname, avatar: player.avatarfull }, games: gamesWithStats });
  } catch (error) {
    console.error('Steam sync failed:', error.message);
    const status = /not configured/.test(error.message) ? 503 : 502;
    res.status(status).json({ error: error.message });
  }
});

router.post('/achievements', async (req, res) => {
  const steamId = sessionSteamId(req);
  if (!steamId) return res.status(401).json({ error: 'Connect Steam first.' });
  const requested = req.body?.appids;
  if (!Array.isArray(requested) || requested.length > 9 || requested.some(appid => !/^\d+$/.test(String(appid)))) {
    return res.status(400).json({ error: 'Request up to nine valid Steam game IDs at a time.' });
  }

  const appids = [...new Set(requested.map(String))];
  try {
    const games = await Promise.all(appids.map(async id => {
      try {
        const result = await steamApi('ISteamUserStats/GetPlayerAchievements/v1', { steamid: steamId, appid: id });
        const achievements = result.playerstats?.achievements || [];
        if (!achievements.length) return { id, unlocked: null, total: null, achievementChecked: true };
        return {
          id,
          unlocked: achievements.filter(achievement => achievement.achieved === 1).length,
          total: achievements.length,
          achievementChecked: true
        };
      } catch {
        return { id, unlocked: null, total: null, achievementChecked: true };
      }
    }));
    res.json({ games });
  } catch (error) {
    console.error('Steam achievement lookup failed:', error.message);
    const status = /not configured/.test(error.message) ? 503 : 502;
    res.status(status).json({ error: error.message });
  }
});

module.exports = router;
