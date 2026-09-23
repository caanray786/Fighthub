/* ============================================
   FightHub — API Sports & Combat Feeds Module
   Connects to API-Sports MMA / SportsDataIO endpoints
   with dynamic fallback data for MMA, Boxing & Muay Thai.
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

  // Fetch live upcoming schedules across MMA, Boxing, Muay Thai
  async fetchLiveSchedules() {
    if (this.apiKey) {
      try {
        const response = await fetch(`${this.baseUrl}fights?season=2026`, {
          headers: {
            'x-apisports-key': this.apiKey,
            'x-rapidapi-host': 'v1.mma.api-sports.io'
          }
        });
        if (response.ok) {
          const json = await response.json();
          if (json.response && json.response.length > 0) {
            return this.transformApiSportsSchedules(json.response);
          }
        }
      } catch (err) {
        console.warn('API-Sports live fetch failed, using fallback feed:', err);
      }
    }
    return this.getFallbackSchedules();
  }

  // Fetch detailed fight card matchup (Red Corner vs Blue Corner)
  async fetchFightCardDetails(eventId) {
    const schedules = await this.fetchLiveSchedules();
    const event = schedules.find(e => e.id === eventId) || schedules[0];
    return event ? event.bouts : [];
  }

  // Fetch recent fight results
  async fetchMatchResults() {
    return [
      {
        id: 'res-101',
        event: 'UFC 312: Makhachev vs. Tsarukyan 2',
        promotion: 'UFC',
        date: '2026-06-14',
        discipline: 'MMA',
        winner: 'Islam Makhachev',
        loser: 'Arman Tsarukyan',
        method: 'Submission (Rear-Naked Choke)',
        round: 3,
        time: '3:42',
        weightClass: 'Lightweight',
        summary: 'Makhachev secured a slick takedown in round 3 before transitioning to take Tsarukyan’s back and locking in the fight-ending choke.'
      },
      {
        id: 'res-102',
        event: 'Ring of Fire: Canelo vs. Benavidez',
        promotion: 'Boxing',
        date: '2026-05-04',
        discipline: 'Boxing',
        winner: 'Canelo Alvarez',
        loser: 'David Benavidez',
        method: 'Unanimous Decision (116-112, 115-113, 116-112)',
        round: 12,
        time: '3:00',
        weightClass: 'Super Middleweight',
        summary: 'Canelo showcased brilliant head movement and counter-punching power over 12 high-octane rounds to retain his undisputed crown.'
      },
      {
        id: 'res-103',
        event: 'ONE Friday Fights 98: Superbon vs. Tawanchai 2',
        promotion: 'ONE Championship',
        date: '2026-04-18',
        discipline: 'Muay Thai',
        winner: 'Tawanchai PK.Saenchai',
        loser: 'Superbon Singha Mawynn',
        method: 'KO (Left Head Kick)',
        round: 2,
        time: '1:15',
        weightClass: 'Featherweight Muay Thai',
        summary: 'Tawanchai uncorked a lightning-fast left high kick early in round 2 to scored a stunning knockout in Bangkok.'
      }
    ];
  }

  // Transform raw API-Sports response into FightHub format
  transformApiSportsSchedules(apiData) {
    return apiData.map((item, idx) => ({
      id: `api-e-${item.id || idx}`,
      name: item.competition?.name || item.slug || 'Championship Fight Night',
      promotion: item.category?.name || 'MMA',
      discipline: item.category?.name?.includes('Box') ? 'Boxing' : item.category?.name?.includes('Muay') ? 'Muay Thai' : 'MMA',
      date: item.date ? item.date.split('T')[0] : '2026-10-10',
      time: '10:00 PM ET',
      venue: item.venue?.name || 'T-Mobile Arena',
      city: item.venue?.city || 'Las Vegas',
      country: item.country?.name || 'USA',
      status: item.status?.short === 'FT' ? 'completed' : 'upcoming',
      bouts: [
        {
          id: `bout-${idx}-1`,
          weightClass: item.weight || 'Welterweight',
          isTitleFight: true,
          redCorner: {
            name: item.fighters?.first?.name || 'Main Fighter A',
            record: '24-2-0',
            country: 'USA',
            image: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=400&q=80'
          },
          blueCorner: {
            name: item.fighters?.second?.name || 'Challenger B',
            record: '19-1-0',
            country: 'Brazil',
            image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&q=80'
          },
          odds: { red: '-180', blue: '+150' }
        }
      ]
    }));
  }

  // Fallback schedules with rich MMA, Boxing, and Muay Thai cards
  getFallbackSchedules() {
    return [
      {
        id: 'e-ufc-316',
        name: 'UFC 316: Pereira vs. Ankalaev',
        promotion: 'UFC',
        discipline: 'MMA',
        date: '2026-10-18',
        time: '10:00 PM ET',
        venue: 'T-Mobile Arena',
        city: 'Las Vegas',
        country: 'USA',
        status: 'upcoming',
        ticketUrl: '#',
        description: 'Undisputed Light Heavyweight king Alex Pereira defends his crown against elite Dagestani wrestler Magomed Ankalaev in a classic Striker vs. Grappler collision.',
        bouts: [
          {
            id: 'b-316-1',
            boutType: 'Main Event - Title Fight',
            weightClass: 'Light Heavyweight',
            isTitleFight: true,
            redCorner: {
              name: 'Alex Pereira',
              nickname: 'Poatan',
              record: '12-2-0',
              country: 'Brazil',
              image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&q=80'
            },
            blueCorner: {
              name: 'Magomed Ankalaev',
              nickname: 'The Dagestani Tank',
              record: '19-1-1',
              country: 'Russia',
              image: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=400&q=80'
            },
            odds: { red: '-135', blue: '+115' }
          },
          {
            id: 'b-316-2',
            boutType: 'Co-Main Event',
            weightClass: 'Flyweight',
            isTitleFight: true,
            redCorner: {
              name: 'Alexandre Pantoja',
              nickname: 'The Cannibal',
              record: '28-5-0',
              country: 'Brazil',
              image: 'https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?w=400&q=80'
            },
            blueCorner: {
              name: 'Kai Kara-France',
              nickname: 'Don\'t Blink',
              record: '25-10-0',
              country: 'New Zealand',
              image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&q=80'
            },
            odds: { red: '-200', blue: '+165' }
          }
        ]
      },
      {
        id: 'e-box-superfight',
        name: 'Boxing Mega-Fight: Crawford vs. Ortiz Jr.',
        promotion: 'Boxing',
        discipline: 'Boxing',
        date: '2026-11-08',
        time: '11:00 PM ET',
        venue: 'MGM Grand Garden Arena',
        city: 'Las Vegas',
        country: 'USA',
        status: 'upcoming',
        ticketUrl: '#',
        description: 'P4P king Terence "Bud" Crawford faces knockout artist Vergil Ortiz Jr. for the Junior Middleweight World Championship.',
        bouts: [
          {
            id: 'b-box-1',
            boutType: 'Main Event - World Title',
            weightClass: 'Junior Middleweight',
            isTitleFight: true,
            redCorner: {
              name: 'Terence Crawford',
              nickname: 'Bud',
              record: '41-0-0',
              country: 'USA',
              image: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=400&q=80'
            },
            blueCorner: {
              name: 'Vergil Ortiz Jr.',
              nickname: 'The Texan Phenom',
              record: '22-0-0',
              country: 'USA',
              image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&q=80'
            },
            odds: { red: '-160', blue: '+135' }
          }
        ]
      },
      {
        id: 'e-one-muaythai',
        name: 'ONE 170: Rodtang vs. Haggerty 3',
        promotion: 'ONE Championship',
        discipline: 'Muay Thai',
        date: '2026-11-22',
        time: '9:00 AM ET',
        venue: 'Lumpinee Boxing Stadium',
        city: 'Bangkok',
        country: 'Thailand',
        status: 'upcoming',
        ticketUrl: '#',
        description: 'The trilogy bout! "The Iron Man" Rodtang Jitmuangnon fights Jonathan "The General" Haggerty under 4oz glove Muay Thai rules.',
        bouts: [
          {
            id: 'b-one-1',
            boutType: 'Main Event - Muay Thai World Title',
            weightClass: 'Flyweight Muay Thai',
            isTitleFight: true,
            redCorner: {
              name: 'Rodtang Jitmuangnon',
              nickname: 'The Iron Man',
              record: '272-42-10',
              country: 'Thailand',
              image: 'https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?w=400&q=80'
            },
            blueCorner: {
              name: 'Jonathan Haggerty',
              nickname: 'The General',
              record: '23-4-0',
              country: 'UK',
              image: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=400&q=80'
            },
            odds: { red: '-120', blue: '+100' }
          }
        ]
      }
    ];
  }
}

window.fightAPIService = new FightAPIService();
