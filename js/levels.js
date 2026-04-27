/* ==========================================================================
 * levels.js — Level definitions + brand splash content
 *
 * Each level has:
 *   id, target (score required), seconds (time limit),
 *   splash (the brand fact shown after clearing this level)
 *
 * Splash content is sourced from the CR Coffee Design System README and the
 * crcoffeenola.com site copy. Conversational, factual, never promotional.
 * ========================================================================== */

export const LEVELS = [
  {
    id: 1,
    target: 800,
    seconds: 90,
    splash: {
      eyebrow: 'New Orleans · Est. 2015',
      title: 'Four Locations.',
      subtitle: 'One Standard.',
      photo: 'assets/splash/magazine-dusk.jpg',
      body:
        'CR Coffee Shop runs four locations across the city: Magazine Street ' +
        'in Uptown, St. Roch Market on St. Claude, Old Metairie on Metairie ' +
        'Road, and inside Louis Armstrong International Airport.',
      pull: null,
    },
  },
  {
    id: 2,
    target: 1200,
    seconds: 90,
    splash: {
      eyebrow: 'Our Coffee',
      title: 'Antique Roasted.',
      subtitle: 'Since 1910.',
      photo: 'assets/splash/coffee-roaster.jpg',
      body:
        'Every batch of Coast Roast Coffee is roasted on 1910s Royal No. 6 ' +
        'drum roasters. These machines run slow and steady, the way coffee ' +
        'was made before commercial speed roasting. The result is a ' +
        'naturally sweeter, smoother cup.',
      pull: null,
    },
  },
  {
    id: 3,
    target: 1600,
    seconds: 80,
    splash: {
      eyebrow: 'The St. Roch Blend',
      title: 'Coffee and Chicory.',
      subtitle: 'The New Orleans tradition.',
      photo: 'assets/splash/cold-brew.jpg',
      body:
        'Our St. Roch Blend pays tribute to a century-old New Orleans ' +
        'coffee tradition: coffee blended with chicory root for a smoother, ' +
        'richer cup. Taste it at any of our four locations or order beans ' +
        'to ship home.',
      pull: null,
    },
  },
  {
    id: 4,
    target: 2000,
    seconds: 80,
    splash: {
      eyebrow: 'Sourcing',
      title: 'Port of New Orleans.',
      subtitle: 'Second-largest coffee port in the US.',
      photo: 'assets/splash/beans-macro.jpg',
      body:
        'All green beans come through the Port of New Orleans, the ' +
        'second-largest coffee port in the United States. Kevin works ' +
        'with local importers and keeps direct relationships with farms ' +
        'in Central and South America.',
      pull: null,
    },
  },
  {
    id: 5,
    target: 2400,
    seconds: 75,
    splash: {
      eyebrow: 'The Crescent Room',
      title: 'A Quiet Room',
      subtitle: 'with a presentation TV and a fireplace.',
      photo: 'assets/splash/crescent-room.jpg',
      body:
        'Magazine Street has a private event space called The Crescent ' +
        'Room. It seats eight at a conference table, comes with high-speed ' +
        'WiFi, and the coffee service is on the house. Book it for a ' +
        'meeting that doesn\'t need to feel like a meeting.',
      pull: null,
    },
  },
  {
    id: 6,
    target: 2800,
    seconds: 75,
    splash: {
      eyebrow: 'The Blends',
      title: 'Three Signature Roasts.',
      subtitle: null,
      photo: 'assets/splash/fresh-pour.jpg',
      body:
        'Streetcar (medium). French Roast (dark). St. Roch Blend, our ' +
        'coffee and chicory blend for the New Orleans tradition. Plus ' +
        'Cold Brew Blend and CR Espresso. All ship nationwide.',
      pull: null,
    },
  },
  {
    id: 7,
    target: 3200,
    seconds: 70,
    splash: {
      eyebrow: 'Behind the Counter',
      title: 'A Family Shop.',
      subtitle: null,
      photo: 'assets/splash/espresso-machine.jpg',
      body:
        'CR Coffee Shop is locally owned by Kevin Pedeaux, a New Orleans ' +
        'native. Coast Roast Coffee was founded in 2009 with Shawn ' +
        'Montella on the Mississippi Gulf Coast. The same roaster has ' +
        'pulled every batch since.',
      pull: null,
    },
  },
  {
    id: 8,
    target: 4000,
    seconds: 70,
    splash: {
      eyebrow: 'Final Round',
      title: 'Your Next Cup',
      subtitle: 'is waiting.',
      photo: 'assets/splash/cold-brew.jpg',
      body:
        'You made it. Eight levels, eight reasons we do what we do. Visit ' +
        'us on Magazine Street, at St. Roch Market, on Metairie Road, ' +
        'or at the airport on your way out of town.',
      pull: 'Serving Antique Roasted Coffee.',
    },
  },
];

export const TIME_BONUS_PER_PIECE = 0.4;       // seconds added per cleared piece
export const TIME_WARN_THRESHOLD = 10;          // pulse red under N seconds
export const HINT_DELAY_MS = 8000;              // idle before hint pulse
