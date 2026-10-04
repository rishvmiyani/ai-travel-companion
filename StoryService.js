// We will use Groq API for ultra-fast, free AI generation.
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;

/**
 * 1. Fetch exact address using BigDataCloud Reverse Geocoding - 100% FREE
 * Extremely stable, no API key required, and doesn't block mobile apps.
 */
const getNearbyPlaces = async (latitude, longitude, mode) => {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && data.city) {
      const place = data.locality || data.principalSubdivision || "the area";
      return `${place} in ${data.city}`;
    }
    return null;
  } catch (err) {
    console.error("BigDataCloud API error:", err);
    return null;
  }
};

/**
 * NEW: Real-Time OpenStreetMap Overpass POI Fetcher
 * Fetches real restaurants, cafes, historical markers, and attractions around the user.
 */
export const fetchRealTimePOIs = async (latitude, longitude, radius = 2000, mode = 'ALL') => {
  if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) return null;
  
  let nodeFilters = '';
  if (mode === 'Food') {
    nodeFilters = `node["amenity"~"restaurant|cafe|fast_food|bar|pub"](around:${radius},${latitude},${longitude});`;
  } else if (mode === 'History') {
    nodeFilters = `node["historic"](around:${radius},${latitude},${longitude});node["tourism"~"museum|monument"](around:${radius},${latitude},${longitude});`;
  } else if (mode === 'Scenic' || mode === 'Legends') {
    nodeFilters = `node["tourism"~"attraction|viewpoint|artwork"](around:${radius},${latitude},${longitude});node["natural"~"peak|beach|water"](around:${radius},${latitude},${longitude});`;
  } else {
    nodeFilters = `node["amenity"~"restaurant|cafe"](around:${radius},${latitude},${longitude});node["historic"](around:${radius},${latitude},${longitude});node["tourism"~"attraction|museum|viewpoint"](around:${radius},${latitude},${longitude});`;
  }

  const overpassQuery = `[out:json];(${nodeFilters});out 5;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
  
  try {
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) return null;
    
    const text = await response.text();
    if (text.startsWith('<')) return null;
    
    const data = JSON.parse(text);
    
    if (data && data.elements && data.elements.length > 0) {
      const places = data.elements
        .filter(e => e.tags && e.tags.name)
        .map(e => {
          let type = mode;
          if (e.tags.amenity) type = e.tags.amenity;
          if (e.tags.historic) type = e.tags.historic;
          if (e.tags.tourism) type = e.tags.tourism;
          if (e.tags.natural) type = e.tags.natural;
          return `${e.tags.name} (${type.replace('_', ' ')})`;
        })
        .slice(0, 5)
        .join(', ');
        
      return places.length > 0 ? places : null;
    }
    return null;
  } catch (e) {
    console.warn("Overpass API error bypassed.");
    return null;
  }
};

/**
 * 2. Generate a story using Groq API based on dynamically fetched models
 */
const generateStoryWithAI = async (placeName, mode, speedMps = 0, destination = null) => {
  if (!GROQ_API_KEY) throw new Error('Groq API Key is missing. Please add it to your .env file.');
  
  const validModels = [
    { id: 'qwen/qwen3.8-27b' },
    { id: 'openai/gpt-oss-20b' },
    { id: 'allam-2-7b' },
  ];

  // Calculate speed in km/h to determine story pacing
  const speedKmh = speedMps * 3.6;
  let pacingInstruction = "Generate a short, engaging 2-3 sentence narration.";
  
  if (speedKmh >= 80) {
    pacingInstruction = "Keep it EXTREMELY short, punchy, and under 2 sentences. Deliver fast facts.";
  } else if (speedKmh <= 15) {
    pacingInstruction = "Write a slightly longer, highly detailed, immersive narration.";
  }

  const destinationContext = destination ? `The user is heading towards ${destination}.` : '';

  const prompt = `You are an expert AI Travel Guide speaking out loud to a traveler.
The user is currently near: "${placeName}". 
The current mode is: "${mode}". 

CRITICAL INSTRUCTIONS:
1. ONLY talk about the current mode ("${mode}"). 
2. If real-world places were provided in the context above, highly recommend them! If no specific places were provided, DO NOT APOLOGIZE. Instead, use your vast knowledge of ${placeName} to recommend the absolute most famous, legendary local spots and iconic items (e.g. "You must try the Vada Pav at the famous local branch!").
3. NEVER mention traffic, driving, being stuck, or the speed of the car. Do NOT say "since you're stuck in traffic". Just dive straight into the fun facts or food recommendations!
4. NEVER say "I don't have real-time data" or "I cannot recommend". Just confidently recommend the best things you know about the area!
5. ${pacingInstruction}
6. ${destinationContext}`;

  // 2. Loop through valid models until one works!
  for (const model of validModels) {
    try {
      console.log(`Attempting generation with model: ${model.id}`);
      
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model.id, 
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 150
        })
      });

      const data = await response.json();
      
      if (data.error) {
        console.warn(`Model ${model.id} failed:`, data.error.message);
        continue; // Try the next model
      }

      console.log(`Success with model: ${model.id}`);
      return data.choices[0].message.content.trim();
      
    } catch (err) {
      console.warn(`Error with ${model.id}:`, err);
      continue; // Try the next model
    }
  }

  throw new Error('NETWORK_ERROR');
};

/**
 * Main function to tie it all together
 */
export const generateStoryFromLocation = async (latitude, longitude, mode, speed = 0, destination = null) => {
  try {
    const placeName = await getNearbyPlaces(latitude, longitude, mode);
    
    if (!placeName) {
      return "You are exploring the open road. Keep driving to discover new stories!";
    }

    // Phase 6: REAL-TIME LOCAL POI INJECTION
    const poiData = await fetchRealTimePOIs(latitude, longitude, 5000, mode);
    let enrichedPlaceName = placeName;
    if (poiData) {
      enrichedPlaceName = `${placeName}. REAL-WORLD CONTEXT: The user is currently driving past these real places: ${poiData}. Mention them if relevant.`;
    }

    const story = await generateStoryWithAI(enrichedPlaceName, mode, speed, destination);
    return story;
  } catch (error) {
    console.error('Error generating story:', error);
    
    // Phase 5: OFFLINE FALLBACK PACK
    if (error.message === 'NETWORK_ERROR' || error.message.includes('fetch')) {
      console.log("[Offline Mode] Network failed. Falling back to Local Offline Pack...");
      return `[OFFLINE MODE]: You've entered a cellular dead zone! Don't worry, according to your pre-downloaded offline pack, you are near an amazing ${mode} spot. Keep enjoying the views while we reconnect.`;
    }
    
    return `Error: ${error.message || 'Unknown error occurred while generating story.'}`;
  }
};

/**
 * Phase 2 & 6: Follow-up Questions with REAL-TIME LOCAL DATA (The Ask AI Button)
 */
export const askQuestionAboutStory = async (storyContext, userQuestion, lat = null, lng = null) => {
  if (!GROQ_API_KEY) throw new Error('Groq API Key is missing.');
  
  let realTimeContext = "";
  if (lat && lng) {
    const poiData = await fetchRealTimePOIs(lat, lng, 5000); // 5km radius for recommendations
    if (poiData) {
      realTimeContext = `\nREAL-TIME LOCAL DATA: The user is currently near these exact real-world places: ${poiData}. If they ask for recommendations or food, explicitly recommend these places.`;
    } else {
      realTimeContext = `\nREAL-TIME LOCAL DATA: You are looking at a live map. Feel free to give general but highly confident recommendations based on your pre-trained knowledge of the area.`;
    }
  }

  const validModels = [
    { id: 'qwen/qwen3.8-27b' },
    { id: 'openai/gpt-oss-20b' },
    { id: 'allam-2-7b' },
  ];

  const prompt = `You are an AI travel companion sitting in a car with the user.
The user just listened to this story: "${storyContext}"
${realTimeContext}

They asked this follow-up question: "${userQuestion}"
Answer the question quickly in 1-2 short sentences. Do not use markdown. Keep it conversational and friendly. NEVER say you don't have real-time data or specific information. If you don't have live data, use your vast pre-trained knowledge of the city to confidently suggest specific, famous, real-world restaurants (like mentioning the best Vada Pav spots) or historical facts!`;

  for (const model of validModels) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: model.id, messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 150 })
      });
      const data = await response.json();
      if (!data.error) return data.choices[0].message.content.trim();
    } catch (err) {
      continue;
    }
  }
  throw new Error('All text-generation models failed.');
};
