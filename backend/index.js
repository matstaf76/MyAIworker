/**
 * MyAIworker — Business Lookup Cloud Function
 * Vapi calls this mid-conversation when Max identifies a business name.
 * Returns a plain-English summary Max can speak naturally.
 *
 * Deploy: gcloud functions deploy business-lookup \
 *   --gen2 --runtime=nodejs20 --region=us-central1 \
 *   --trigger-http --allow-unauthenticated \
 *   --set-env-vars PLACES_API_KEY=YOUR_KEY_HERE \
 *   --entry-point=businessLookup
 */

const PLACES_API_KEY = process.env.PLACES_API_KEY;

exports.businessLookup = async (req, res) => {
  // CORS — Vapi needs this
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).send('');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    // ── Parse Vapi's tool-call envelope ────────────────────────
    const body = req.body || {};
    let businessName = '';
    let city = '';
    let toolCallId = null;

    if (body.message && body.message.toolCallList) {
      // Vapi server-tool format
      const call = body.message.toolCallList[0];
      toolCallId = call.id;
      const args = JSON.parse(call.function.arguments || '{}');
      businessName = args.businessName || args.business_name || '';
      city = args.city || args.location || '';
    } else {
      // Direct test call: { businessName, city }
      businessName = body.businessName || body.business_name || '';
      city = body.city || body.location || '';
    }

    if (!businessName) {
      const msg = 'No business name provided.';
      return res.json(vapiResult(toolCallId, msg));
    }

    // ── Call Places API (New) Text Search ───────────────────────
    // A prospect is listening while this runs, so cap it hard: better a
    // graceful "let's keep talking" than 8 seconds of dead air on the call.
    const query = city ? `${businessName} ${city}` : businessName;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    let data;
    try {
      const placesRes = await fetch(
        'https://places.googleapis.com/v1/places:searchText',
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': PLACES_API_KEY,
            'X-Goog-FieldMask': [
              'places.displayName',
              'places.formattedAddress',
              'places.nationalPhoneNumber',
              'places.websiteUri',
              'places.rating',
              'places.userRatingCount',
              'places.regularOpeningHours',
              'places.primaryTypeDisplayName',
              'places.businessStatus',
            ].join(','),
          },
          // Pull a few candidates so we can reject an out-of-area match
          // instead of confidently reciting the wrong business's hours.
          body: JSON.stringify({ textQuery: query, maxResultCount: 5, regionCode: 'US' }),
        }
      );
      data = await placesRes.json();
    } finally {
      clearTimeout(timer);
    }

    if (!data.places || data.places.length === 0) {
      const msg = `I couldn't find a listing for "${businessName}" online. That's actually useful info — if Google can't find you easily, neither can your customers.`;
      return res.json(vapiResult(toolCallId, msg));
    }

    const { place, confident } = pickBestMatch(data.places, businessName, city);
    let summary = buildSummary(place, businessName);
    if (!confident) {
      summary =
        `LOW CONFIDENCE MATCH — this may be a different business with a similar name. ` +
        `Confirm it with them ("I'm seeing a listing on Oak Street — is that you?") before stating any of these details as fact. ` +
        summary;
    }
    return res.json(vapiResult(toolCallId, summary));

  } catch (err) {
    console.error('businessLookup error:', err);
    const msg = "I wasn't able to pull up their business profile right now, but let's keep talking.";
    return res.json(vapiResult(null, msg));
  }
};

// ── Choose the candidate that actually matches the prospect ────
// Text Search will happily return a same-named business three states away.
// Max reciting a stranger's phone number and hours to a prospect mid-demo is
// worse than Max admitting he can't find them, so require real confidence.
function pickBestMatch(places, queriedName, city) {
  const normalize = (s) =>
    (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  const wantName = normalize(queriedName);
  const wantCity = normalize(city);
  const nameTokens = wantName.split(' ').filter((t) => t.length > 2);

  let best = null;
  let bestScore = -Infinity;
  let bestNameMatch = 0;

  for (const p of places) {
    const name = normalize(p.displayName && p.displayName.text);
    const addr = normalize(p.formattedAddress);

    // Fraction of the words they said that appear in this listing's name.
    const nameMatch = name && name === wantName
      ? 1
      : (nameTokens.length
          ? nameTokens.filter((t) => name.includes(t)).length / nameTokens.length
          : 0);
    const cityMatch = !!(wantCity && addr.includes(wantCity));

    let score = nameMatch * 4 + (cityMatch ? 3 : 0);
    if (p.businessStatus === 'CLOSED_PERMANENTLY') score -= 5;

    if (score > bestScore) { bestScore = score; best = p; bestNameMatch = nameMatch; }
  }

  // Confidence requires an actual NAME signal. A city match alone only proves
  // Google returned some business in the right town — scoring city at 3 against
  // a threshold of 2 meant a nonsense name matched a random local restaurant and
  // was reported as fact. Caught by a live test against the deployed service.
  const confident = bestNameMatch >= 0.5;

  // Never return nothing when Google gave us something — Max worked fine off a
  // bare business name before and must keep working. Below the bar we still hand
  // back the top hit, just flagged so Max hedges instead of reciting a
  // stranger's phone number as fact.
  return { place: best || places[0], confident };
}

// ── Build a spoken-English summary Max can use ─────────────────
function buildSummary(place, queriedName) {
  const parts = [];

  const name = place.displayName?.text || queriedName;
  const type = place.primaryTypeDisplayName?.text || null;
  const address = place.formattedAddress || null;
  const phone = place.nationalPhoneNumber || null;
  const website = place.websiteUri || null;
  const rating = place.rating || null;
  const reviewCount = place.userRatingCount || 0;
  const hours = place.regularOpeningHours;
  const status = place.businessStatus;

  // Business identity
  parts.push(`Business found: ${name}${type ? ` (${type})` : ''}.`);
  if (address) parts.push(`Located at ${address}.`);

  // Contact / web presence
  if (phone) {
    parts.push(`Phone: ${phone}.`);
  } else {
    parts.push(`No phone number listed on Google — that's a red flag for missed calls.`);
  }

  if (website) {
    parts.push(`Has a website: ${website}.`);
  } else {
    parts.push(`No website listed. That's a missed lead-capture opportunity.`);
  }

  // Social proof
  if (rating && reviewCount > 0) {
    parts.push(`Google rating: ${rating}/5 from ${reviewCount} reviews.`);
  } else {
    parts.push(`No Google reviews yet.`);
  }

  // Hours — look for after-hours gaps
  if (hours && hours.weekdayDescriptions) {
    const hoursText = hours.weekdayDescriptions.join('; ');
    parts.push(`Hours: ${hoursText}.`);
    // Google formats hours like "Monday: 9:00 AM – 5:00 PM" or "Saturday: Closed".
    // Judge weekdays only, and only call it early when EVERY open weekday
    // closes by 6 PM. The old check fired on any single day, so a shop open
    // till 8 PM Mon-Fri that closes at 2 PM Saturday got told it "closes
    // early" — exactly the wrong detail to get wrong in front of a prospect.
    const weekdayCloses = hours.weekdayDescriptions
      .filter(d => /^(monday|tuesday|wednesday|thursday|friday)/i.test(d))
      .map(closingHour24)
      .filter(h => h !== null);

    const closesEarly = weekdayCloses.length >= 3 && weekdayCloses.every(h => h <= 18);
    const closedWeekends = hours.weekdayDescriptions.some(d =>
      /saturday.*closed|sunday.*closed/i.test(d)
    );
    if (closesEarly) {
      parts.push(`Closes by ${formatHour(Math.max(...weekdayCloses))} every weekday — missing every after-hours call.`);
    }
    if (closedWeekends) parts.push(`Closed on weekends — a common time customers try to reach service businesses.`);
  }

  if (status === 'CLOSED_TEMPORARILY') {
    parts.push(`Note: Listed as temporarily closed on Google.`);
  }

  return parts.join(' ');
}

// ── Hours helpers ──────────────────────────────────────────────
// Returns the day's closing hour on a 24-hour clock, or null when the line
// has no times at all ("Closed", "Open 24 hours").
function closingHour24(dayText) {
  const times = dayText.match(/(\d{1,2}):\d{2}\s*(AM|PM)/gi);
  if (!times) return null;
  const m = times[times.length - 1].match(/(\d{1,2}):\d{2}\s*(AM|PM)/i);
  if (!m) return null;

  let hr = parseInt(m[1], 10);
  const pm = m[2].toUpperCase() === 'PM';
  if (hr === 12) hr = pm ? 12 : 0;   // 12 PM = noon, 12 AM = midnight
  else if (pm) hr += 12;
  if (hr === 0) hr = 24;             // closing at midnight is a late close
  return hr;
}

function formatHour(h24) {
  const h = h24 % 24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${ampm}`;
}

// ── Wrap result in Vapi's expected envelope ────────────────────
function vapiResult(toolCallId, result) {
  if (!toolCallId) return { result }; // direct test call
  return {
    results: [{ toolCallId, result }],
  };
}
