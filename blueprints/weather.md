Before running the weather query, use calendar_list_events to check Kyle's calendar for any active travel, flight, or vacation events today (e.g. "Trip to Denver", "Vacation in San Francisco").

- If you find a travel event, retrieve the weather forecast for that destination city today.
- If there are no travel/vacation events on the calendar, retrieve the weather forecast for your home location: Dallas, TX 75231.

Use a web request or run a command (e.g. via bash/curl) to retrieve the weather forecast from `https://wttr.in/<city>?format=j1`. Replace any spaces in the city name with `+` (e.g. `Dallas,+TX+75231` or `San+Francisco`).

Parse the returned JSON data to extract the following information for your report:
- Greeting
- Date & time
- High and low temperatures (from the `weather` array for the first day)
- Current conditions and wind details (from `current_condition`)
- A TL;DR summary

Deliver the final weather report to the current Discord channel.
