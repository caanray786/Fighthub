/* ============================================
   FightHub — Autonomous Autopilot Agent Script
   Triggered via Admin Settings, utilizes OpenRouter API
   to discover/write news, fighters, events, and gyms.
   ============================================ */

function getSchemaDescription(category) {
  switch (category) {
    case 'articles':
      return `{
        "title": "A catchy news headline",
        "slug": "url-friendly-slug",
        "category": "UFC, Boxing, ONE, PFL, or General",
        "excerpt": "A short summary (1-2 sentences)",
        "content": "A detailed multi-paragraph news article or blog post",
        "author": "Autopilot Writer",
        "image": "An Unsplash photo URL relevant to combat sports",
        "tags": ["tag1", "tag2"],
        "likes": 0,
        "comments": 0,
        "status": "published",
        "date": "2026-07-22"
      }`;
    case 'fighters':
      return `{
        "name": "Fighter Name",
        "nickname": "Fighter Nickname",
        "nationality": "Flag emoji (e.g. 🇧🇷)",
        "country": "Country name",
        "weightClass": "Heavyweight, Middleweight, Lightweight, etc.",
        "wins": 20,
        "losses": 2,
        "draws": 0,
        "ko": 12,
        "sub": 5,
        "dec": 3,
        "style": "Fighting style (e.g. Muay Thai, BJJ)",
        "team": "Gym Team Name",
        "status": "Active or Retired",
        "bio": "Detailed fighter history biography",
        "championships": ["Championship title 1"],
        "highlights": ["Career highlight 1"],
        "image": "Fighter profile Unsplash photo URL",
        "timeline": [
          { "date": "2026-05-10", "opponent": "Opponent Name", "result": "Win", "finishing": "KO (Round 2)", "event": "UFC Bout" }
        ]
      }`;
    case 'events':
      return `{
        "name": "Event Title (e.g. UFC 315)",
        "promotion": "UFC, Boxing, ONE, or PFL",
        "date": "2026-10-15",
        "time": "10:00 PM ET",
        "venue": "MGM Grand Arena",
        "city": "Las Vegas",
        "country": "USA",
        "description": "Short description of event hype",
        "fights": ["Main Event Fight Name", "Co-Main Event Fight Name"],
        "status": "upcoming",
        "ticketUrl": "#"
      }`;
    case 'gyms':
      return `{
        "name": "Gym Academy Name",
        "address": "Street Address",
        "city": "City Name",
        "state": "State/Prov short name",
        "zip": "Postal code",
        "country": "Country Name",
        "phone": "Phone number",
        "email": "Contact email",
        "website": "Website URL link",
        "rating": 4.8,
        "styles": ["MMA", "BJJ", "Muay Thai"],
        "lat": 34.0522,
        "lng": -118.2437,
        "description": "Premium descriptive paragraph of coaches and training mats",
        "image": "Unsplash gym photo URL"
      }`;
  }
  return '';
}

window.runAutopilotAgent = async (orKey) => {
  if (!orKey) throw new Error("OpenRouter API key is missing");

  // Determine a random category to generate
  const categories = ['articles', 'fighters', 'events', 'gyms'];
  const targetCategory = categories[Math.floor(Math.random() * categories.length)];
  
  // Custom prompt instructing the LLM to output database records
  const prompt = `You are the FightHub Autopilot Agent. Generate one new, highly realistic, professional database record for a combat sports website under the collection "${targetCategory}".
  
  The current year is 2026. Use recent real-world fighter data, news, gym listings, or events.
  
  Output ONLY a single raw JSON object that maps EXACTLY to the schema below. Do not add any extra commentary, notes, or markdown fences. Just output the JSON.

  Schema requirements for "${targetCategory}":
  ${getSchemaDescription(targetCategory)}
  
  Make sure the details are highly realistic and detailed (no simple placeholders).`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${orKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'FightHub Autopilot'
    },
    body: JSON.stringify({
      model: localStorage.getItem('fighthub_model_id') || 'z-ai/glm-5.2',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `HTTP error! Status: ${response.status}`);
  }

  const completion = await response.json();
  const text = completion.choices[0].message.content.trim();
  
  // Clean JSON
  let cleanedText = text;
  if (text.includes('```')) {
    cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  let parsedObject;
  try {
    parsedObject = JSON.parse(cleanedText);
  } catch (err) {
    console.error("Failed to parse JSON from AI response:", text);
    throw new Error("AI generated invalid JSON structure. Check console logs.");
  }

  // Set ID and timestamps if not present
  if (!parsedObject.id) {
    const prefix = targetCategory === 'articles' ? 'art' : 
                   targetCategory === 'fighters' ? 'f' : 
                   targetCategory === 'events' ? 'e' : 'g';
    parsedObject.id = prefix + '-' + Date.now().toString(36);
  }
  parsedObject.createdAt = new Date().toISOString();
  parsedObject.updatedAt = new Date().toISOString();

  // Insert into dataStore
  await dataStore.add(targetCategory, parsedObject);

  return `Successfully discovered and created a new ${targetCategory.slice(0, -1)} entry: "${parsedObject.name || parsedObject.title}"!`;
};
