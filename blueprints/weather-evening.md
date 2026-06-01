Before running the weather query, use calendar_list_events to check Kyle's calendar for any active travel, flight, or vacation events tomorrow (e.g. "Trip to Denver", "Vacation in San Francisco").

- If you find a travel event, retrieve the weather forecast for that destination city tomorrow.
- If there are no travel/vacation events on the calendar, retrieve the weather forecast for your home location: Dallas, TX 75231.

Use a web request or run a local curl command to retrieve the weather forecast:
- **For US Locations (such as Dallas, TX 75231 or domestic travel):** 
  * Retrieve current observations from the nearest NWS weather station (e.g. Dallas Love Field `KDAL` at `https://api.weather.gov/stations/KDAL/observations/latest` for Dallas 75231) to get real-time current conditions.
  * Retrieve coordinates (e.g., 32.8625,-96.7578 for Dallas 75231) and query the National Weather Service API (`https://api.weather.gov/points/<lat>,<lon>`) to get the forecast endpoint, then fetch the forecast JSON from there.
- **For non-US Locations or as a simple fallback:** Query `https://wttr.in/<city>?format=j1`, replacing spaces with `+` (e.g., `Dallas,+TX+75231` or `San+Francisco`).

Formulate a clean, structured evening weather report starting directly with the details:
- Do NOT begin with conversational greetings to a specific person (e.g. avoid "Hey Kyle!" or "Hey Alexa!"). A neutral greeting like "Good evening!" or "Good evening!" is fine, or start directly.
- Do NOT output verbose out-loud thinking about checking the calendar or finding no travel events. Only mention the location if it is a travel destination (e.g., "Weather report for your trip to Denver").
- Do NOT include technical phrasing like "from weather array" or "from current_condition".
- Include:
  * Date & time
  * Current conditions (temperature, condition, wind, humidity)
  * Overnight forecast (Tonight's Low and expected overnight conditions)
  * Tomorrow's forecast (Tomorrow's High and Low temperatures, expected conditions for tomorrow)
  * A TL;DR summary for tomorrow (e.g., tomorrow's heat indices, weather changes, warnings).

Deliver the final weather report to the current Discord channel.
