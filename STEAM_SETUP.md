# SteamCity Steam connection

SteamCity uses Steam OpenID for sign-in and the Steam Web API to load the signed-in user's profile, owned games, playtime, and achievements. It does not need a database.

## One-time setup

1. Copy `.env.example` to `.env` if needed.
2. Create a Steam Web API key at <https://steamcommunity.com/dev/apikey> and set `STEAM_API_KEY` in `.env`.
3. Set `SESSION_SECRET` to a long random value. Keep `.env` private; it is ignored by Git.
4. Set `APP_URL=http://localhost:3000` for local use. Open SteamCity at that exact address so Steam's OpenID callback matches. A deployed site needs its public HTTPS URL.
5. In Steam privacy settings, make **Game details** public so Steam can return owned games and playtime.
6. Run `npm install` once if dependencies are missing, then run `npm run dev` and open <http://localhost:3000>.

## How it works

1. **Connect Steam** redirects to Steam's sign-in page. Steam handles the password; SteamCity never receives it.
2. Steam returns a claimed Steam ID. The server verifies the OpenID response before creating a signed, HTTP-only login cookie.
3. The server requests the profile, full owned-game library, and playtime. It uses the Steam API key only on the server.
4. SteamCity lists every game Steam returns, showing nine games at first. **Load more games** reveals nine more at a time, and achievement totals load for games as they appear where Steam exposes them. The city uses the nine most-played or assigned games.
5. Reloading the page syncs the signed-in account again. **Switch** clears the current sign-in and lets another Steam account connect.

## Limits

- Game details must be public for owned games and playtime to be available.
- Steam only exposes achievement details for some games. Unsupported games can show no achievement data; the dashboard totals update as game stats load.
- The city holds up to nine assigned games; the library includes every game Steam returns. The current snapshot stays in browser memory and is fetched again from Steam on reload.
- OpenID login state is kept in server memory, so a server restart during sign-in requires starting again.
