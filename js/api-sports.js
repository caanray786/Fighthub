/* ============================================
   FightHub — API Sports & Combat Feeds Module
   Connects to the API-Sports MMA endpoint. Without a key (or if the
   request fails) it returns nothing rather than placeholder cards, so
   the site never shows fights that aren't real.
   ============================================ */

class FightAPIService {
  constructor(apiKey = '') {
    this.apiKey = apiKey || localStorage.getItem('fighthub_api_sports_key') || '';
    this.baseUrl = 'https://v1.mma.api-sports.io/'; // API-Sports MMA endpoint
  }

  setApiKey(key) {
    this.apiKey = key;
    if (key) {
      localStorage.setItem('fighthub_api_sports_key', key);
    }
  }

  // Fetch upcoming fights for the current season, grouped into events.
  async fetchLiveSchedules() {
    if (!this.apiKey) return [];
    try {
      const season = new Date().getFullYear();
      const response = await fetch(`${this.baseUrl}fights?season=${season}`, {
        headers: {
          'x-apisports-key': this.apiKey,
          'x-rapidapi-host': 'v1.mma.api-sports.io'
        }
      });
      if (!response.ok) {
        console.warn('API-Sports request failed with status', response.status);
        return [];
      }
      const json = await response.json();
      return this.transformApiSportsSchedules(json.response || []);
    } catch (err) {
      console.warn('API-Sports live fetch failed:', err);
      return [];
    }
  }

  async fetchFightCardDetails(eventId) {
    const schedules = await this.fetchLiveSchedules();
    const event = schedules.find(e => e.id === eventId);
    return event ? event.bouts : [];
  }

  // API-Sports returns one row per fight; group them by event (slug + date).
  // Fields the API doesn't provide are left blank instead of being guessed.
  transformApiSportsSchedules(apiData) {
    const events = new Map();

    apiData.forEach(item => {
      const red = item.fighters?.first;
      const blue = item.fighters?.second;
      if (!red?.name || !blue?.name) return;

      const date = item.date ? item.date.split('T')[0] : '';
      const name = item.slug || 'MMA Event';
      const key = `${name}|${date}`;

      if (!events.has(key)) {
        const promotion = /^UFC/i.test(name) ? 'UFC' : /^PFL/i.test(name) ? 'PFL' : /^ONE/i.test(name) ? 'ONE' : 'MMA';
        events.set(key, {
          id: 'api-e-' + (name + '-' + date).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name,
          promotion,
          discipline: 'MMA',
          date,
          time: item.time || 'TBA',
          venue: 'TBA',
          city: 'TBA',
          country: 'TBA',
          description: '',
          status: ['FT', 'FIN'].includes(item.status?.short) ? 'completed' : 'upcoming',
          ticketUrl: '',
          source: 'API-Sports',
          fights: [],
          bouts: []
        });
      }

      const event = events.get(key);
      event.fights.push(`${red.name} vs. ${blue.name}`);
      event.bouts.push({
        id: `bout-${item.id}`,
        weightClass: item.category || '',
        isMainEvent: !!item.is_main,
        redCorner: { name: red.name, image: red.logo || '', winner: !!red.winner },
        blueCorner: { name: blue.name, image: blue.logo || '', winner: !!blue.winner }
      });
    });

    return [...events.values()];
  }
}

window.fightAPIService = new FightAPIService();
