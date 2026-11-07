const state = { games: [], cityGames: [], steamId: null, editingSlot: null, visibleGameCount: 9, achievementRequests: new Set(), mode: 'achievements', sortAsc: false, rotation: 0, connected: false, player: null };
const $ = (selector) => document.querySelector(selector);
const percent = (game) => game.total ? Math.round(game.unlocked / game.total * 100) : 0;
const buildingColors = ['#8ce0bd','#75a8ff','#e9ac70','#bd9bea','#e78071','#d1c48a','#79c6d3','#91bd73','#e38eaa'];

function updateSteamName(name='') {
  const displayName=String(name || '').trim();
  $('#cityOwner').textContent=displayName ? `${displayName}'s city` : 'Your city';
  $('#profileName').textContent=displayName || 'Not connected';
  $('#profileAvatar').textContent=displayName.charAt(0).toUpperCase() || 'S';
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-button').forEach(button => button.classList.toggle('selected', button.dataset.mode === mode));
  $('#modeLegend').textContent = mode === 'achievements' ? 'Completion' : 'Playtime';
  renderCity();
}

function renderCity() {
  window.SteamCityBuilding.renderCity(state, $, percent, escapeHTML);
}

function renderGames() {
  const query = $('#gameSearch').value.trim().toLowerCase();
  const games = [...state.games].sort((a,b) => state.sortAsc ? a.hours-b.hours : b.hours-a.hours)
    .filter(game => game.name.toLowerCase().includes(query));
  const visibleGames = games.slice(0, state.visibleGameCount);
  $('#gameList').innerHTML = visibleGames.map(game => `<article class="game-row">
    <div class="game-info"><div class="game-art">${game.image ? `<img src="${escapeHTML(game.image)}" alt="" loading="lazy">` : `<span>${escapeHTML(game.name.slice(0,2).toUpperCase())}</span>`}</div><div><div class="game-title">${escapeHTML(game.name)}</div><div class="game-meta">Steam game</div></div></div>
    <div class="game-stat">${game.hours.toLocaleString()}<small>hrs played</small></div>
    <div class="game-stat">${game.total === null ? game.achievementChecked ? '—' : '…' : game.unlocked}<small>${game.total === null ? game.achievementLoadError ? ' could not load achievements' : game.achievementChecked ? ' achievements unavailable' : ' loading achievements' : ` / ${game.total} achievements`}</small></div>
    <div class="game-progress">${game.total === null ? '' : `<div class="progress-track"><span style="width:${percent(game)}%;background:${escapeHTML(game.tone)}"></span></div><em>${percent(game)}%</em>`}</div>
  </article>`).join('') || `<div class="empty-games">${state.games.length ? 'No games match your search.' : state.connected ? 'Steam did not return any games. Set Game Details to Public in Steam privacy settings, then sync again.' : 'Connect Steam to load your games.'}</div>`;
  const loadMore = $('#loadMoreGames');
  const showLess = $('#showLessGames');
  const remaining = games.length - visibleGames.length;
  loadMore.hidden = remaining <= 0;
  loadMore.disabled = false;
  loadMore.textContent = 'Show more';
  showLess.hidden = state.visibleGameCount <= 9;
  $('#librarySummary').textContent = query
    ? `Showing ${visibleGames.length} of ${games.length} matching games`
    : `Showing ${visibleGames.length} of ${state.games.length} games`;
  const totalHours = state.games.reduce((sum, game) => sum + game.hours, 0);
  const gamesWithAchievements = state.games.filter(game => game.total !== null);
  const totalUnlocked = gamesWithAchievements.reduce((sum, game) => sum + game.unlocked, 0);
  const totalAchievements = gamesWithAchievements.reduce((sum, game) => sum + game.total, 0);
  $('#totalHours').textContent = totalHours.toLocaleString();
  $('#unlockedCount').textContent = totalUnlocked.toLocaleString();
  $('#achievementCount').textContent = totalAchievements.toLocaleString();
  const rate = totalAchievements ? Math.round(totalUnlocked/totalAchievements*100) : 0;
  $('#achievementRate').textContent = rate;
  $('#achievementProgress').style.width = `${rate}%`;
  $('#gameTotal').textContent = state.cityGames.filter(Boolean).length;
  $('#statGames').textContent = state.games.length;
  renderCity();
  const statsToLoad = new Map();
  state.games.forEach(game => {
    if (!game.achievementChecked) statsToLoad.set(game.id, game);
  });
  ensureAchievementStats([...statsToLoad.values()]);
}

async function ensureAchievementStats(games) {
  const pending = [...new Map(games.filter(game => !game.achievementChecked && !state.achievementRequests.has(game.id)).map(game => [game.id, game])).values()];
  if (!pending.length) return;
  pending.forEach(game => state.achievementRequests.add(game.id));
  try {
    for (let offset = 0; offset < pending.length; offset += 9) {
      const batch = pending.slice(offset, offset + 9);
      let stats = new Map();
      let requestFailed = false;
      try {
        const result = await apiJson('/api/steam/achievements', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ appids: batch.map(game => game.id) })
        });
        stats = new Map((result.games || []).map(game => [game.id, game]));
      } catch { requestFailed = true; }
      for (const game of batch) {
        const stat = requestFailed
          ? { unlocked: null, total: null, achievementChecked: true, achievementLoadError: true }
          : stats.get(game.id) || { unlocked: null, total: null, achievementChecked: true };
        Object.assign(game, stat);
        if (!requestFailed) delete game.achievementLoadError;
        const libraryGame = state.games.find(item => item.id === game.id);
        if (libraryGame) {
          Object.assign(libraryGame, stat);
          if (!requestFailed) delete libraryGame.achievementLoadError;
        }
        state.cityGames = state.cityGames.map(cityGame => {
          if (cityGame?.id !== game.id) return cityGame;
          const updated = { ...cityGame, ...stat };
          if (!requestFailed) delete updated.achievementLoadError;
          return updated;
        });
      }
    }
  } finally {
    pending.forEach(game => state.achievementRequests.delete(game.id));
    renderGames();
  }
}

function cityLayoutKey() {
  return state.steamId ? `steamcity-layout-${state.steamId}` : null;
}

function saveCityLayout() {
  const key = cityLayoutKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(state.cityGames.map(game => game ? { id: game.id, tone: game.tone, skin: game.skin || 'classic' } : null)));
  } catch { /* Keep the edited layout for this page load if storage is unavailable. */ }
}

function setCityGames(games, steamId) {
  if (steamId) state.steamId = steamId;
  let savedLayout = [];
  const key = cityLayoutKey();
  try { savedLayout = key ? JSON.parse(localStorage.getItem(key) || '[]') : []; } catch { savedLayout = []; }
  if (!Array.isArray(savedLayout)) savedLayout = [];
  const used = new Set();
  state.cityGames = [];
  for (let slot = 0; slot < 9; slot++) {
    const saved = savedLayout[slot];
    if (slot < savedLayout.length && saved === null) {
      state.cityGames.push(null);
      continue;
    }
    const savedGame = saved && games.find(game => game.id === saved.id && !used.has(game.id));
    const game = savedGame || games.find(candidate => !used.has(candidate.id));
    if (!game) {
      state.cityGames.push(null);
      continue;
    }
    used.add(game.id);
    const savedColor = typeof saved?.tone === 'string' && /^#[\da-f]{6}$/i.test(saved.tone) ? saved.tone : game.tone;
    const savedSkin = ['classic', 'burj-khalifa', 'mahanakhon', 'pisa'].includes(saved?.skin) ? saved.skin : 'classic';
    state.cityGames.push({ ...game, tone: savedGame ? savedColor : game.tone, skin: savedGame ? savedSkin : 'classic' });
  }
  saveCityLayout();
}

function updateColorSwatches(color) {
  document.querySelectorAll('.color-swatch').forEach(button => {
    button.classList.toggle('selected', button.dataset.color.toLowerCase() === color.toLowerCase());
  });
}

function openBuildingEditor(slot) {
  const building = state.cityGames[slot] || null;
  if (slot < 0 || slot >= 9 || !state.games.length) return;
  state.editingSlot = slot;
  $('#buildingDialogTitle').textContent = building ? 'Edit building' : 'Add building';
  $('#buildingGameId').value = building?.id || '';
  $('#buildingGameSearch').value = building?.name || '';
  $('#buildingGameSearch').dataset.currentName = building?.name || '';
  $('#buildingGameSearch').setCustomValidity('');
  $('#buildingGameChoices').hidden = true;
  $('#buildingGameSearch').setAttribute('aria-expanded', 'false');
  $('#buildingGameSearch').removeAttribute('aria-activedescendant');
  $('#buildingColor').value = building?.tone || buildingColors[0];
  $('#buildingSkin').value = ['classic', 'burj-khalifa', 'mahanakhon', 'pisa'].includes(building?.skin) ? building.skin : 'classic';
  $('#colorSwatches').innerHTML = buildingColors.map(color => `<button class="color-swatch" type="button" data-color="${color}" style="background:${color}" aria-label="Set building color ${color}" title="${color}"></button>`).join('');
  updateColorSwatches(building?.tone || buildingColors[0]);
  $('#removeBuilding').hidden = !building;
  $('#saveBuilding').textContent = building ? 'Save changes' : 'Add building';
  document.documentElement.classList.add('building-dialog-open');
  $('#buildingDialog').showModal();
  $('#closeBuildingDialog').focus();
}

function renderGameChoices(query = '') {
  const results = $('#buildingGameChoices');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingGames = state.games.filter(game => game.name.toLocaleLowerCase().includes(normalizedQuery));
  const visibleGames = matchingGames;
  const choices = visibleGames.map(game => {
    const usedElsewhere = state.cityGames.some((cityGame, index) => index !== state.editingSlot && cityGame?.id === game.id);
    const selected = $('#buildingGameId').value === game.id;
    return `<button class="game-search-option${selected ? ' selected' : ''}" id="game-option-${escapeHTML(game.id)}" type="button" role="option" aria-selected="${selected}" data-game-id="${escapeHTML(game.id)}" ${usedElsewhere ? 'disabled' : ''}>${escapeHTML(game.name)}${usedElsewhere ? '<small>Already in your city</small>' : ''}</button>`;
  }).join('');
  results.innerHTML = choices || '<div class="game-search-empty" role="status">No matching games in your Steam library.</div>';
  results.hidden = false;
  $('#buildingGameSearch').setAttribute('aria-expanded', 'true');
  $('#buildingGameSearch').removeAttribute('aria-activedescendant');
}

function chooseGame(gameId) {
  const game = state.games.find(candidate => candidate.id === gameId);
  if (!game) return;
  $('#buildingGameId').value = game.id;
  $('#buildingGameSearch').value = game.name;
  $('#buildingGameSearch').dataset.currentName = game.name;
  $('#buildingGameSearch').setCustomValidity('');
  $('#buildingGameChoices').hidden = true;
  $('#buildingGameSearch').setAttribute('aria-expanded', 'false');
  $('#buildingGameSearch').removeAttribute('aria-activedescendant');
  updateSelectedGameChoice();
}

function updateSelectedGameChoice() {
  document.querySelectorAll('.game-search-option').forEach(option => {
    const selected = option.dataset.gameId === $('#buildingGameId').value;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-selected', String(selected));
  });
}

$('#buildingGameSearch').addEventListener('focus', event => {
  if (event.target.value === event.target.dataset.currentName) {
    event.target.select();
    renderGameChoices('');
  } else {
    renderGameChoices(event.target.value);
  }
});
$('#buildingGameSearch').addEventListener('input', event => {
  $('#buildingGameId').value = '';
  event.target.setCustomValidity('');
  renderGameChoices(event.target.value);
});
$('#buildingGameChoices').addEventListener('mousedown', event => {
  if (event.target.closest('.game-search-option')) event.preventDefault();
});
$('#buildingGameChoices').addEventListener('click', event => {
  const option = event.target.closest('.game-search-option');
  if (option && !option.disabled) chooseGame(option.dataset.gameId);
});
$('#buildingGameSearch').addEventListener('keydown', event => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if ($('#buildingGameChoices').hidden) renderGameChoices(event.target.value);
    const options = [...$('#buildingGameChoices').querySelectorAll('.game-search-option:not(:disabled)')];
    const activeId = event.target.getAttribute('aria-activedescendant');
    const current = options.findIndex(option => option.id === activeId);
    const next = event.key === 'ArrowDown' ? Math.min(current + 1, options.length - 1) : Math.max(current < 0 ? options.length - 1 : current - 1, 0);
    if (options[next]) {
      options.forEach(option => option.classList.remove('active'));
      options[next].classList.add('active');
      event.target.setAttribute('aria-activedescendant', options[next].id);
    }
  } else if (event.key === 'Enter') {
    const options = [...$('#buildingGameChoices').querySelectorAll('.game-search-option:not(:disabled)')];
    const active = options.find(option => option.id === event.target.getAttribute('aria-activedescendant'));
    if (active) {
      event.preventDefault();
      chooseGame(active.dataset.gameId);
    } else {
      event.preventDefault();
    }
  } else if (event.key === 'Escape' && !$('#buildingGameChoices').hidden) {
    $('#buildingGameChoices').hidden = true;
    event.target.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('pointerdown', event => {
  if (!event.target.closest?.('.game-picker')) {
    $('#buildingGameChoices').hidden = true;
    $('#buildingGameSearch').setAttribute('aria-expanded', 'false');
  }
});

$('#colorSwatches').addEventListener('click', event => {
  const swatch = event.target.closest('.color-swatch');
  if (!swatch) return;
  $('#buildingColor').value = swatch.dataset.color;
  updateColorSwatches(swatch.dataset.color);
});
$('#buildingColor').addEventListener('input', event => updateColorSwatches(event.target.value));
$('#closeBuildingDialog').addEventListener('click', () => $('#buildingDialog').close());
$('#buildingDialog').addEventListener('close', () => document.documentElement.classList.remove('building-dialog-open'));
$('#removeBuilding').addEventListener('click', () => {
  if (state.editingSlot === null || !state.cityGames[state.editingSlot]) return;
  state.cityGames[state.editingSlot] = null;
  saveCityLayout();
  renderGames();
  $('#buildingDialog').close();
});
$('#buildingEditorForm').addEventListener('submit', event => {
  if (event.submitter?.value !== 'save') return;
  event.preventDefault();
  const slot = state.editingSlot;
  const selectedGame = state.games.find(game => game.id === $('#buildingGameId').value);
  if (slot === null || !selectedGame) {
    $('#buildingGameSearch').setCustomValidity('Choose a game from your Steam library.');
    $('#buildingGameSearch').reportValidity();
    $('#buildingGameSearch').focus();
    renderGameChoices($('#buildingGameSearch').value);
    return;
  }
  const duplicate = state.cityGames.some((game, index) => index !== slot && game?.id === selectedGame.id);
  if (duplicate) return;
  state.cityGames[slot] = { ...selectedGame, tone: $('#buildingColor').value, skin: $('#buildingSkin').value };
  saveCityLayout();
  renderGames();
  $('#buildingDialog').close();
});

function updateActivePage() {
  const isSettings = location.hash === '#settings';
  $('#city').hidden = isSettings;
  $('#settingsPage').hidden = !isSettings;
  document.querySelectorAll('.side-nav .nav-item').forEach(link => {
    link.classList.toggle('active', (link.hash === '#settings') === isSettings);
  });
}
window.addEventListener('hashchange', updateActivePage);
updateActivePage();

function setTheme(theme, persist = true) {
  const selectedTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = selectedTheme;
  document.querySelectorAll('[data-theme-choice]').forEach(button => {
    const selected = button.dataset.themeChoice === selectedTheme;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  if (persist) {
    try { localStorage.setItem('steamcity-theme', selectedTheme); } catch { /* Theme still works for this page load. */ }
  }
}

document.querySelectorAll('[data-theme-choice]').forEach(button => {
  button.addEventListener('click', () => setTheme(button.dataset.themeChoice));
});
let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('steamcity-theme') || 'dark'; } catch { /* Use the default dark theme. */ }
setTheme(savedTheme, false);

document.querySelectorAll('.mode-button').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
function setRotation(degrees) {
  state.rotation=(degrees%360+360)%360;
  $('#rotationLabel').textContent=`${Math.round(state.rotation)}°`;
  renderCity();
}
$('#rotateLeft').addEventListener('click',()=>setRotation(state.rotation-45));
$('#rotateRight').addEventListener('click',()=>setRotation(state.rotation+45));
$('#resetRotation').addEventListener('click',()=>setRotation(0));
const cityView=$('#cityGrid');
let rotationDrag=null;
cityView.addEventListener('pointerdown',event=>{
  if(event.target.closest?.('.iso-building, .empty-city-slot'))return;
  if(event.pointerType==='mouse'&&event.button!==0)return;
  rotationDrag={id:event.pointerId,startX:event.clientX,startAngle:state.rotation,moved:false};
  cityView.setPointerCapture(event.pointerId);
  cityView.classList.add('dragging');
});
cityView.addEventListener('pointermove',event=>{
  if(!rotationDrag||rotationDrag.id!==event.pointerId)return;
  const delta=event.clientX-rotationDrag.startX;
  if(Math.abs(delta)>3)rotationDrag.moved=true;
  if(rotationDrag.moved)setRotation(rotationDrag.startAngle+delta*.65);
});
const endRotationDrag=event=>{
  if(!rotationDrag||rotationDrag.id!==event.pointerId)return;
  rotationDrag=null;
  cityView.classList.remove('dragging');
};
cityView.addEventListener('pointerup',endRotationDrag);
cityView.addEventListener('pointercancel',endRotationDrag);
cityView.addEventListener('keydown',event=>{
  const building=event.target.closest?.('.iso-building, .empty-city-slot');
  if(building&&(event.key==='Enter'||event.key===' ')){
    event.preventDefault();
    openBuildingEditor(Number(building.dataset.slot));
    return;
  }
  if(event.key==='ArrowLeft'){event.preventDefault();setRotation(state.rotation-15)}
  if(event.key==='ArrowRight'){event.preventDefault();setRotation(state.rotation+15)}
});
cityView.addEventListener('click',event=>{
  const building=event.target.closest?.('.iso-building, .empty-city-slot');
  if(building)openBuildingEditor(Number(building.dataset.slot));
});
$('#gameSearch').addEventListener('input', () => { state.visibleGameCount = 9; renderGames(); });
$('#loadMoreGames').addEventListener('click', () => { state.visibleGameCount += 9; renderGames(); });
$('#showLessGames').addEventListener('click', () => { state.visibleGameCount = 9; renderGames(); });
$('#sortButton').addEventListener('click', () => { state.sortAsc = !state.sortAsc; $('#sortButton span').textContent = state.sortAsc ? 'Least played' : 'Most played'; renderGames(); });
async function apiJson(url, options) {
  const response=await fetch(url,options);
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error || `SteamCity server returned ${response.status}.`);
  return body;
}

function showConnectedPlayer(player) {
  state.connected=true;
  state.player=player;
  updateSteamName(player?.name || '');
  $('#switchAccount').hidden=false;
  $('#connectLabel').textContent='Logout';
  $('#connectButton').classList.add('connected');
  $('#cityDescription').textContent='Your nine games from Steam';
  if(player?.avatar){
    const avatar=$('#profileAvatar');
    avatar.style.backgroundImage=`url("${String(player.avatar).replaceAll('"','%22')}")`;
    avatar.style.backgroundSize='cover';
    avatar.style.backgroundPosition='center';
    avatar.textContent='';
  }
}

$('#switchAccount').addEventListener('click',async()=>{
  $('#switchAccount').disabled=true;
  try {
    await apiJson('/api/steam/logout',{method:'POST'});
    window.location.href='/api/steam/login';
  } catch(error) {
    $('#cityDescription').textContent=`Could not switch Steam account: ${error.message}`;
    $('#switchAccount').disabled=false;
  }
});

async function syncSteam() {
  $('#connectLabel').textContent='Syncing…';
  $('#connectButton').disabled=true;
  try {
    const result=await apiJson('/api/steam/sync',{method:'POST'});
    showConnectedPlayer(result.player);
    state.games=Array.isArray(result.games)?result.games:[];
    state.visibleGameCount=9;
    setCityGames(state.games,result.steamId);
    $('#lastSync').textContent=`Last synced ${new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date())}`;
    renderGames();
  } catch(error) {
    $('#cityDescription').textContent=error.message;
    $('#connectLabel').textContent=state.connected?'Logout':'Retry Steam sync';
    renderGames();
  } finally {
    $('#connectButton').disabled=false;
  }
}

$('#connectButton').addEventListener('click',async()=>{
  $('#connectButton').disabled=true;
  try {
    if(state.connected){
      $('#connectLabel').textContent='Logging out…';
      await apiJson('/api/steam/logout',{method:'POST'});
      window.location.reload();
      return;
    }
    const account=await apiJson('/api/steam/me');
    if(account.connected){
      state.steamId=account.steamId || state.steamId;
      return await syncSteam();
    }
    window.location.href='/api/steam/login';
  } catch(error) {
    const serverUnavailable=error.message.includes('Failed to fetch') || /returned 404/.test(error.message);
    $('#cityDescription').textContent=serverUnavailable?'Start SteamCity with npm run dev to connect':'Steam connection needs attention';
    $('#connectLabel').textContent=serverUnavailable?'Steam server unavailable':'Connect Steam';
  } finally {
    $('#connectButton').disabled=false;
  }
});

async function loadSteamAccount() {
  try {
    const account=await apiJson('/api/steam/me');
    if(!account.connected){
      state.connected=false;
      state.steamId=null;
      updateSteamName();
      renderGames();
      return;
    }
    state.steamId=account.steamId || state.steamId;
    showConnectedPlayer({name:account.user?.username || '',avatar:account.user?.avatar_url || ''});
    if(new URLSearchParams(location.search).get('steam')==='connected')history.replaceState({},'','/');
    await syncSteam();
  } catch(error) {
    const serverUnavailable=error.message.includes('Failed to fetch') || /returned 404/.test(error.message);
    $('#cityDescription').textContent=serverUnavailable?'Start SteamCity with npm run dev to connect':'Steam connection needs attention';
    $('#connectLabel').textContent=serverUnavailable?'Steam server unavailable':'Connect Steam';
    renderGames();
  }
}

updateSteamName();
renderGames();
loadSteamAccount();
