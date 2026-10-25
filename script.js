const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const AIR_API = "https://air-quality-api.open-meteo.com/v1/air-quality";
const KEYS = { recent: "skycast_pro_recent", favorites: "skycast_pro_favorites", unit: "skycast_pro_unit", theme: "skycast_pro_theme" };

const $ = selector => document.querySelector(selector);
const form = $("#search-form"), input = $("#city-input"), searchButton = $("#search-button");
const loadingState = $("#loading-state"), errorState = $("#error-state"), suggestions = $("#suggestions");
let currentPlace = null, currentData = null, currentUnit = localStorage.getItem(KEYS.unit) || "C";
let suggestionTimer = null, suggestionRequest = 0;

const codes = {
  0:["Clear sky","☀️"],1:["Mainly clear","🌤️"],2:["Partly cloudy","⛅"],3:["Overcast","☁️"],
  45:["Fog","🌫️"],48:["Rime fog","🌫️"],51:["Light drizzle","🌦️"],53:["Drizzle","🌦️"],55:["Heavy drizzle","🌧️"],
  56:["Freezing drizzle","🌧️"],57:["Heavy freezing drizzle","🌧️"],61:["Light rain","🌦️"],63:["Rain","🌧️"],65:["Heavy rain","🌧️"],
  66:["Freezing rain","🌧️"],67:["Heavy freezing rain","🌧️"],71:["Light snow","🌨️"],73:["Snow","🌨️"],75:["Heavy snow","❄️"],
  77:["Snow grains","🌨️"],80:["Rain showers","🌦️"],81:["Moderate showers","🌧️"],82:["Heavy showers","⛈️"],85:["Snow showers","🌨️"],
  86:["Heavy snow showers","❄️"],95:["Thunderstorm","⛈️"],96:["Thunderstorm with hail","⛈️"],99:["Thunderstorm with heavy hail","⛈️"]
};
const describe = code => codes[code] || ["Variable conditions","🌡️"];
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const readStorage = key => { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } };

function temp(value) {
  const converted = currentUnit === "F" ? (value * 9 / 5) + 32 : value;
  return `${Math.round(converted)}°`;
}
function unitText() { return currentUnit === "F" ? "°F" : "°C"; }
function formatTime(dateString) {
  if (!dateString) return "--:--";
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? "--:--" : new Intl.DateTimeFormat("en", {hour:"numeric",minute:"2-digit"}).format(date);
}
function dayLabel(dateString, index) {
  if (index === 0) return "Today";
  return new Intl.DateTimeFormat("en", {weekday:"short"}).format(new Date(`${dateString}T12:00:00`));
}
function setLoading(active) {
  loadingState.classList.toggle("hidden", !active);
  searchButton.disabled = active;
  searchButton.innerHTML = active ? '<span>Loading</span><span class="loader" style="width:13px;height:13px;border-width:2px"></span>' : '<span>Explore</span><span>↗</span>';
  if (active) errorState.classList.add("hidden");
}
function showError(title, message) {
  $("#error-title").textContent = title;
  $("#error-message").textContent = message;
  errorState.classList.remove("hidden");
  $("#weather-section").classList.add("hidden");
}
async function fetchJSON(url, errorText) {
  let response;
  try { response = await fetch(url); }
  catch { throw new Error("Network error. Check your internet connection and try again."); }
  if (!response.ok) throw new Error(errorText || "The weather service is temporarily unavailable. Please try again.");
  return response.json();
}
async function findCity(query) {
  const data = await fetchJSON(`${GEO_API}?name=${encodeURIComponent(query)}&count=8&language=en&format=json`, "The location service is unavailable.");
  if (!data.results?.length) throw new Error(`We couldn't find “${query}”. Check the spelling or try a nearby city.`);
  return data.results.find(p => p.name.toLowerCase() === query.trim().toLowerCase()) || data.results[0];
}
async function getWeather(place) {
  const params = new URLSearchParams({
    latitude:place.latitude, longitude:place.longitude, timezone:"auto", forecast_days:"7",
    current:"temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m",
    hourly:"temperature_2m,precipitation_probability,weather_code",
    daily:"weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max"
  });
  const data = await fetchJSON(`${WEATHER_API}?${params}`, "Could not load the weather forecast. Please try again.");
  if (!data.current || !data.daily || !data.hourly) throw new Error("The weather service returned incomplete data.");
  return data;
}
async function getAirQuality(place) {
  try {
    const params = new URLSearchParams({latitude:place.latitude,longitude:place.longitude,current:"us_aqi,european_aqi"});
    const data = await fetchJSON(`${AIR_API}?${params}`);
    return data.current || null;
  } catch { return null; }
}
function aqiLabel(value) {
  if (value == null) return "Unavailable";
  if (value <= 50) return "Good";
  if (value <= 100) return "Moderate";
  if (value <= 150) return "Sensitive";
  if (value <= 200) return "Unhealthy";
  if (value <= 300) return "Very unhealthy";
  return "Hazardous";
}
function renderCurrent(place, data, air) {
  const c = data.current, [description, emoji] = describe(c.weather_code);
  $("#location-name").textContent = place.name;
  $("#location-details").textContent = [place.admin1, place.country].filter(Boolean).join(", ") || "Location found";
  $("#weather-visual").textContent = emoji;
  $("#temperature").textContent = temp(c.temperature_2m);
  $("#degree-label").textContent = unitText();
  $("#condition").textContent = description;
  $("#feels-like").textContent = `Feels like ${temp(c.apparent_temperature)}`;
  $("#humidity").textContent = `${c.relative_humidity_2m}%`;
  $("#wind-speed").textContent = `${Math.round(c.wind_speed_10m)} km/h`;
  $("#cloud-cover").textContent = `${c.cloud_cover}%`;
  $("#precipitation").textContent = `${Number(c.precipitation).toFixed(1)} mm`;
  $("#uv-index").textContent = data.daily.uv_index_max?.[0] ?? "N/A";
  $("#air-quality").textContent = air ? `${aqiLabel(air.us_aqi)} (${Math.round(air.us_aqi)})` : "Unavailable";
  $("#sunrise").textContent = formatTime(data.daily.sunrise?.[0]);
  $("#sunset").textContent = formatTime(data.daily.sunset?.[0]);
  $("#sunrise-small").textContent = formatTime(data.daily.sunrise?.[0]);
  $("#sunset-small").textContent = formatTime(data.daily.sunset?.[0]);
  $("#updated-label").textContent = `Updated ${formatTime(new Date().toISOString())}`;
  $("#today-summary").textContent = summaryText(c, data.daily, air);
  $("#favorite-button").classList.toggle("active", isFavorite(place));
  $("#favorite-button").textContent = isFavorite(place) ? "♥" : "♡";
  renderHourly(data.hourly);
  renderForecast(data.daily);
  $("#weather-section").classList.remove("hidden");
  $("#weather-section").animate([{opacity:0,transform:"translateY(10px)"},{opacity:1,transform:"translateY(0)"}],{duration:400,easing:"ease-out"});
}
function summaryText(current, daily, air) {
  const hi = temp(daily.temperature_2m_max[0]), lo = temp(daily.temperature_2m_min[0]);
  const airText = air ? ` Air quality is ${aqiLabel(air.us_aqi).toLowerCase()}.` : "";
  return `Today's range is ${lo} to ${hi}. ${current.wind_speed_10m < 15 ? "A gentle breeze" : "Breezy conditions"} with ${current.relative_humidity_2m}% humidity.${airText}`;
}
function renderHourly(hourly) {
  const now = new Date();
  let start = hourly.time.findIndex(t => new Date(t) >= new Date(now.getTime() - 60 * 60 * 1000));
  if (start < 0) start = 0;
  const indexes = Array.from({length:24},(_,i)=>start+i).filter(i=>i<hourly.time.length).slice(0,8);
  $("#hourly-grid").innerHTML = indexes.map((i,order) => {
    const [desc,icon] = describe(hourly.weather_code[i]);
    const date = new Date(hourly.time[i]);
    const time = order===0 ? "Now" : new Intl.DateTimeFormat("en",{hour:"numeric"}).format(date);
    return `<article class="hour-card" style="animation-delay:${order*35}ms"><div class="hour-time">${time}</div><div class="hour-icon" title="${escapeHTML(desc)}">${icon}</div><div class="hour-temp">${temp(hourly.temperature_2m[i])}</div><div class="hour-rain">☂ ${hourly.precipitation_probability?.[i] ?? 0}%</div></article>`;
  }).join("");
}
function renderForecast(daily) {
  $("#forecast-grid").innerHTML = daily.time.map((date,i) => {
    const [desc,icon] = describe(daily.weather_code[i]);
    return `<article class="forecast-card" style="animation-delay:${i*35}ms"><div class="forecast-day">${dayLabel(date,i)}</div><div class="forecast-icon" title="${escapeHTML(desc)}">${icon}</div><div class="forecast-temps"><span>${temp(daily.temperature_2m_max[i])}</span><span class="low">${temp(daily.temperature_2m_min[i])}</span></div><p class="forecast-desc">${escapeHTML(desc)}</p></article>`;
  }).join("");
}
function placeKey(p) { return `${p.name}|${p.latitude}|${p.longitude}`; }
function isFavorite(place) { return readStorage(KEYS.favorites).some(p=>placeKey(p)===placeKey(place)); }
function addToRecent(place) {
  const saved = {name:place.name,latitude:place.latitude,longitude:place.longitude,admin1:place.admin1||"",country:place.country||""};
  const list = [saved,...readStorage(KEYS.recent).filter(p=>placeKey(p)!==placeKey(saved))].slice(0,3);
  localStorage.setItem(KEYS.recent,JSON.stringify(list)); renderSavedPlaces();
}
function toggleFavorite() {
  if (!currentPlace) return;
  let list = readStorage(KEYS.favorites);
  if (isFavorite(currentPlace)) list = list.filter(p=>placeKey(p)!==placeKey(currentPlace));
  else list = [{name:currentPlace.name,latitude:currentPlace.latitude,longitude:currentPlace.longitude,admin1:currentPlace.admin1||"",country:currentPlace.country||""},...list].slice(0,8);
  localStorage.setItem(KEYS.favorites,JSON.stringify(list));
  $("#favorite-button").classList.toggle("active",isFavorite(currentPlace));
  $("#favorite-button").textContent = isFavorite(currentPlace) ? "♥" : "♡";
  renderSavedPlaces();
}
function placeButton(place, kind) {
  return `<button class="place-chip" type="button" data-kind="${kind}" data-key="${escapeHTML(placeKey(place))}"><span><strong>${escapeHTML(place.name)}</strong><small>${escapeHTML([place.admin1,place.country].filter(Boolean).join(", "))}</small></span><span>↗</span></button>`;
}
function renderSavedPlaces() {
  const favorites = readStorage(KEYS.favorites), recent = readStorage(KEYS.recent);
  $("#favorites-list").innerHTML = favorites.length ? favorites.map(p=>placeButton(p,"favorite")).join("") : '<p class="empty-note">Save a city with the ♡ button to keep it close.</p>';
  $("#recent-list").innerHTML = recent.length ? recent.map(p=>placeButton(p,"recent")).join("") : '<p class="empty-note">Your last three searches will appear here.</p>';
  $("#clear-history").classList.toggle("hidden",!recent.length);
  document.querySelectorAll(".place-chip").forEach(button=>button.addEventListener("click",()=>{
    const list = button.dataset.kind==="favorite" ? readStorage(KEYS.favorites) : readStorage(KEYS.recent);
    const place = list.find(p=>placeKey(p)===button.dataset.key);
    if(place) loadWeather(place);
  }));
}
async function loadWeather(queryOrPlace) {
  const query = typeof queryOrPlace==="string" ? queryOrPlace.trim() : queryOrPlace.name;
  if(!query){showError("Enter a city name","Type a city into the search box, then try again.");return;}
  suggestions.classList.add("hidden"); setLoading(true); $("#weather-section").classList.add("hidden");
  try {
    const place = typeof queryOrPlace==="string" ? await findCity(query) : queryOrPlace;
    const data = await getWeather(place);
    const air = await getAirQuality(place);
    currentPlace=place; currentData=data;
    renderCurrent(place,data,air); addToRecent(place); input.value=place.name;
  } catch(error) { showError("Couldn't load weather",error.message||"Something went wrong. Please try again."); }
  finally { setLoading(false); }
}
async function showSuggestions(query) {
  const requestId = ++suggestionRequest;
  if(query.trim().length<2){suggestions.classList.add("hidden");return;}
  try {
    const data = await fetchJSON(`${GEO_API}?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
    if(requestId!==suggestionRequest) return;
    if(!data.results?.length){suggestions.classList.add("hidden");return;}
    suggestions.innerHTML=data.results.map((p,i)=>`<button class="suggestion" type="button" role="option" data-index="${i}">${escapeHTML(p.name)}<small>${escapeHTML([p.admin1,p.country].filter(Boolean).join(", "))}</small></button>`).join("");
    suggestions.classList.remove("hidden");
    suggestions.querySelectorAll(".suggestion").forEach((button,i)=>button.addEventListener("click",()=>loadWeather(data.results[i])));
  } catch { suggestions.classList.add("hidden"); }
}
form.addEventListener("submit",event=>{event.preventDefault();loadWeather(input.value);});
input.addEventListener("input",()=>{clearTimeout(suggestionTimer);suggestionTimer=setTimeout(()=>showSuggestions(input.value),280);});
document.addEventListener("click",event=>{if(!form.contains(event.target))suggestions.classList.add("hidden");});
document.querySelectorAll("[data-city]").forEach(button=>button.addEventListener("click",()=>loadWeather(button.dataset.city)));
$("#favorite-button").addEventListener("click",toggleFavorite);
$("#clear-history").addEventListener("click",()=>{localStorage.removeItem(KEYS.recent);renderSavedPlaces();});
$("#unit-toggle").addEventListener("click",()=>{
  currentUnit=currentUnit==="C"?"F":"C";localStorage.setItem(KEYS.unit,currentUnit);
  $("#unit-toggle").innerHTML=currentUnit==="C"?'°C <span>/</span> °F':'°F <span>/</span> °C';
  if(currentPlace&&currentData) renderCurrent(currentPlace,currentData, null);
});
$("#theme-toggle").addEventListener("click",()=>{
  const light=!document.body.classList.contains("light");
  document.body.classList.toggle("light",light);localStorage.setItem(KEYS.theme,light?"light":"dark");
  $("#theme-toggle").textContent=light?"☾":"☼";
});
$("#location-button").addEventListener("click",()=>{
  if(!navigator.geolocation){showError("Location isn't supported","Try searching for your city instead.");return;}
  setLoading(true);
  navigator.geolocation.getCurrentPosition(async position=>{
    const place={name:"Your location",latitude:position.coords.latitude,longitude:position.coords.longitude,admin1:"GPS coordinates",country:""};
    try{
      const data=await getWeather(place),air=await getAirQuality(place);
      currentPlace=place;currentData=data;renderCurrent(place,data,air);addToRecent(place);input.value="";
    }catch(error){showError("Couldn't load your location",error.message);}
    finally{setLoading(false);}
  },()=>{
    setLoading(false);showError("Location access denied","Allow location access in your browser, or search for a city manually.");
  },{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
});
const savedTheme=localStorage.getItem(KEYS.theme);
if(savedTheme==="light"){document.body.classList.add("light");$("#theme-toggle").textContent="☾";}
$("#unit-toggle").innerHTML=currentUnit==="C"?'°C <span>/</span> °F':'°F <span>/</span> °C';
renderSavedPlaces();
const recent=readStorage(KEYS.recent);
loadWeather(recent.length?recent[0]:"Lahore");
