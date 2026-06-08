Before running the weather query, use calendar_list_events to check Kyle's calendar for any active travel, flight, or vacation events today (e.g. "Trip to Denver", "Vacation in San Francisco").

- If you find a travel event, retrieve the weather forecast for that destination city today.
- If there are no travel/vacation events on the calendar, retrieve the weather forecast for your home location: Dallas, TX 75231.

Use a web request or run a local curl command to retrieve the weather forecast:
- **For US Locations (such as Dallas, TX 75231 or domestic travel):** 
  * Retrieve current observations from the nearest NWS weather station (e.g. Dallas Love Field `KDAL` at `https://api.weather.gov/stations/KDAL/observations/latest` for Dallas 75231) to get real-time current conditions.
  * Retrieve coordinates (e.g., 32.8625,-96.7578 for Dallas 75231) and query the National Weather Service API (`https://api.weather.gov/points/<lat>,<lon>`) to get the forecast endpoint, then fetch the forecast JSON from there.
- **For non-US Locations or as a simple fallback:** Query `https://wttr.in/<city>?format=j1`, replacing spaces with `+` (e.g., `Dallas,+TX+75231` or `San+Francisco`).

Formulate a clean, structured morning weather report:
- Start with a neutral greeting like: "Good morning! Here is your morning weather report:"
- Do NOT begin with conversational greetings to a specific person (e.g. avoid "Hey Kyle!" or "Hey Alexa!").
- Do NOT output verbose out-loud thinking about checking the calendar or finding no travel events.
- Do NOT include technical phrasing (like "from weather array" or API terminology).
- Use Fahrenheit only (do NOT include Celsius/metric conversions).
- Use standard wind direction abbreviations (e.g. "S", "SSE" instead of spelling them out).
- Structure the report exactly like this:

[emoji: 🌴 if traveling, 🏡 if home] **Weather Report for <Location>**
📅 **Date & Time:** <Day of week, Month Date, Year at Current Time>
📍 **Current Conditions:**
* **Temperature:** <Temp>°F (include "feels like" if different)
* **Condition:** <Condition>
* **Wind:** <Direction> at <Speed> mph
* **Humidity:** <Percentage>%

☀️ **Today's Forecast:**
* **High:** <High>°F | **Low:** <Low>°F
* **Conditions:** <Forecast description>
* **Wind:** <Forecast wind>
* **Precipitation Chance:** <Percentage>%

📋 **TL;DR Summary:**
<A short one-sentence summary for the day ahead.>

Deliver the final weather report to the current Discord channel.
