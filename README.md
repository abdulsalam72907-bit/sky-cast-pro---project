# SkyCast Pro — Task 4 Dynamic Web App with Live API Data

A polished, responsive weather dashboard built with HTML, CSS, and vanilla JavaScript. It uses free Open-Meteo public APIs and does not require an API key.

## Features
- City search with live suggestions from the geocoding API.
- Current weather conditions using Fetch API and async/await.
- Loading state, network/API error handling, and no-results messages.
- Current conditions card with temperature, feels-like temperature, humidity, wind, cloud cover, and precipitation.
- Seven-day forecast and next-hours outlook with precipitation probability.
- Sunrise, sunset, daily UV index, and air-quality index (AQI).
- Browser geolocation (permission required).
- Celsius/Fahrenheit toggle.
- Favorite cities and recent search history stored in localStorage.
- Dark/light theme toggle, animations, responsive layout, and weather icons.
- Popular city shortcuts.

## Run locally
1. Extract the ZIP.
2. Open this folder in VS Code.
3. Use the Live Server extension and choose **Open with Live Server** on `index.html`.
4. Keep an internet connection enabled for live API data.

> Geolocation usually requires localhost or HTTPS. If permission is denied, search by city instead.

## Public APIs
- Geocoding: `https://geocoding-api.open-meteo.com/v1/search`
- Forecast: `https://api.open-meteo.com/v1/forecast`
- Air quality: `https://air-quality-api.open-meteo.com/v1/air-quality`
- Provider: https://open-meteo.com/

## Files
- `index.html` — structure and accessible controls
- `style.css` — theme, responsive layout, animations, and card design
- `script.js` — API integration, rendering, search suggestions, favorites, history, and theme/unit preferences

## Important
Weather and air quality require internet access. Air-quality data may be unavailable for some locations. Location access is optional.
