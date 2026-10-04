// The Open Audio Ad Platform & Marketing Companion Core
// Allows enterprises, local businesses, and individual users to drop audio ads dynamically.

let ACTIVE_CAMPAIGNS = [
  {
    id: 'campaign_01',
    creator: 'Starbucks_Corporate',
    lat: 40.7128, 
    lng: -74.0060,
    radius: 1000, 
    targetMode: 'Food', // Only plays if user is in 'Food' mode
    adCopy: "By the way, there's a Starbucks just 2 minutes away. Pull over for a quick coffee break!",
    impressions: 0
  },
  {
    id: 'campaign_02',
    creator: 'Local_User_Rishv',
    lat: 34.0522,
    lng: -118.2437,
    radius: 5000,
    targetMode: 'ALL', 
    adCopy: "This segment is sponsored by a local traveler: 'Hey everyone, definitely check out the sunset from the hilltop up ahead!'",
    impressions: 0
  }
];

// Helper: Haversine distance in meters
const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; 
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
};

export const MarketingCompanion = {
  
  /**
   * Self-Serve API: Allows a user or local business to drop a campaign from their phone/web dashboard.
   */
  createCampaign: (creator, lat, lng, radius, targetMode, adCopy) => {
    const newCampaign = {
      id: `campaign_${Date.now()}`,
      creator, lat, lng, radius, targetMode, adCopy, impressions: 0
    };
    ACTIVE_CAMPAIGNS.push(newCampaign);
    console.log(`[MarketingCompanion] New Ad Campaign live for ${creator}!`);
    return newCampaign.id;
  },

  /**
   * Engine Hook: Checks if driver entered an active campaign zone
   */
  checkForCampaigns: (latitude, longitude, currentMode) => {
    // To make it easy to test dynamically wherever the user is, if distance is massive, 
    // we'll just mock a hit on the newest user-created ad for testing purposes if one exists.
    
    // Sort campaigns so newest user campaigns are checked first
    const sorted = [...ACTIVE_CAMPAIGNS].reverse();

    for (const ad of sorted) {
      // Check Targeting Match
      if (ad.targetMode !== 'ALL' && ad.targetMode !== currentMode) continue;

      const distance = getDistanceInMeters(latitude, longitude, ad.lat, ad.lng);
      
      // If inside geofence (or we just force a hit for demonstration if they just created it)
      if (distance <= ad.radius || ad.creator.startsWith("SelfServe_")) {
        ad.impressions += 1;
        console.log(`[MarketingCompanion] Ad Triggered for ${ad.creator}. Total Impressions: ${ad.impressions}`);
        return ad.adCopy;
      }
    }
    return null;
  },

  getAnalytics: () => {
    return ACTIVE_CAMPAIGNS.map(c => ({ creator: c.creator, impressions: c.impressions }));
  }
};

// Keep backwards compatibility for the old App.js import until we update it
export const checkForGeofencedAds = (lat, lng, mode) => MarketingCompanion.checkForCampaigns(lat, lng, mode);
