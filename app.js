let data = [];
let favorites = new Set();
let selectedCats = new Set();

const FAV_KEY = "tvf_favorites_v1";

const els = {
  search: document.getElementById("search"),
  age: document.getElementById("age"),
  borough: document.getElementById("borough"),
  sort: document.getElementById("sort"),
  virtualOnly: document.getElementById("virtualOnly"),
  favoritesOnly: document.getElementById("favoritesOnly"),
  clearCats: document.getElementById("clearCats"),
  chips: document.getElementById("categoryChips"),
  results: document.getElementById("results"),
  count: document.getElementById("count"),
  error: document.getElementById("error"),
};

function slug(s){
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function loadFavorites(){
  try{
    const raw = localStorage.getItem(FAV_KEY);
    favorites = new Set(raw ? JSON.parse(raw) : []);
  } catch {
    favorites = new Set();
  }
}

function saveFavorites(){
  localStorage.setItem(FAV_KEY, JSON.stringify([...favorites]));
}

function normalizeItem(item){
  const name = item.name || item.title || "Untitled";
  const id = item.id || slug(name) || slug(item.url || Math.random());

  const virtual = !!item.virtual;

  let borough = item.borough || item.location || "NYC";
  if (virtual) borough = "Virtual";
  if (borough === "Anywhere") borough = "Virtual";
  if (borough === "NYC-wide") borough = "NYC";
  if (borough === "Manhattan/Bronx/Staten Island") borough = "NYC";

  return {
    id,
    name,
    url: item.url || "#",
    virtual,
    minAge: Number.isFinite(item.minAge) ? item.minAge : 13,
    maxAge: Number.isFinite(item.maxAge) ? item.maxAge : 19,
    borough,
    location: item.location || (virtual ? "Anywhere" : "NYC"),
    categories: Array.isArray(item.categories) ? item.categories : [],
    description: item.description || item.notes || "",
    image: item.image || ""
  };
}

function uniqCategories(items){
  const set = new Set();
  items.forEach(it => (it.categories || []).forEach(c => set.add(c)));
  return [...set].sort((a,b)=>a.localeCompare(b));
}

function buildCategoryChips(){
  const cats = uniqCategories(data);
  els.chips.innerHTML = "";
  cats.forEach(cat=>{
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = cat;
    b.setAttribute("aria-pressed", selectedCats.has(cat) ? "true" : "false");
    b.onclick = ()=>{
      if(selectedCats.has(cat)) selectedCats.delete(cat);
      else selectedCats.add(cat);
      buildCategoryChips();
      render();
    };
    els.chips.appendChild(b);
  });
}

function setToggle(btn, on){
  btn.setAttribute("aria-pressed", on ? "true" : "false");
}

function getToggle(btn){
  return btn.getAttribute("aria-pressed") === "true";
}

function matchesFilters(it){
  const q = els.search.value.trim().toLowerCase();
  const age = parseInt(els.age.value || "0", 10);
  const borough = els.borough.value;

  if(age && it.minAge > age) return false;

  if(getToggle(els.virtualOnly) && !it.virtual) return false;

  if(borough !== "Any"){
    if(borough === "Virtual"){
      if(!it.virtual) return false;
    } else {
      if(it.virtual) return false;
      if(it.borough !== borough && !(borough === "NYC" && it.borough === "NYC")) return false;
    }
  }

  if(getToggle(els.favoritesOnly) && !favorites.has(it.id)) return false;

  if(selectedCats.size){
    const set = new Set(it.categories || []);
    let ok = false;
    for(const c of selectedCats){
      if(set.has(c)){ ok = true; break; }
    }
    if(!ok) return false;
  }

  if(q){
    const hay = `${it.name} ${it.description} ${(it.categories||[]).join(" ")} ${it.borough} ${it.location}`.toLowerCase();
    if(!hay.includes(q)) return false;
  }

  return true;
}

function score(it, q){
  if(!q) return 0;
  const hay = `${it.name} ${it.description} ${(it.categories||[]).join(" ")} ${it.borough}`.toLowerCase();
  let s = 0;
  q.split(/\s+/).filter(Boolean).forEach(p=>{
    if(hay.includes(p)) s += 5;
    if(it.name.toLowerCase().includes(p)) s += 6;
  });
  return s;
}

function sortItems(items){
  const mode = els.sort.value;
  const q = els.search.value.trim().toLowerCase();
  const copy = [...items];

  if(mode === "az"){
    copy.sort((a,b)=>a.name.localeCompare(b.name));
  } else if(mode === "minAge"){
    copy.sort((a,b)=>(a.minAge-b.minAge) || a.name.localeCompare(b.name));
  } else if(mode === "favorites"){
    copy.sort((a,b)=> (favorites.has(b.id)-favorites.has(a.id)) || a.name.localeCompare(b.name));
  } else {
    copy.sort((a,b)=> (score(b,q)-score(a,q)) || a.name.localeCompare(b.name));
  }
  return copy;
}

function openDetails(id){
  window.location.href = `details.html?id=${encodeURIComponent(id)}`;
}

function render(){
  els.error.textContent = "";
  const filtered = data.filter(matchesFilters);
  const sorted = sortItems(filtered);

  els.count.textContent = String(sorted.length);
  els.results.innerHTML = "";

  sorted.forEach(it=>{
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = ()=> openDetails(it.id);

    const isFav = favorites.has(it.id);

    card.innerHTML = `
      <div class="card-top">
        <div>
          <p class="title">${it.name}</p>
          <p class="org">${it.virtual ? "Virtual" : it.borough} • Min age ${it.minAge}</p>
        </div>
        <button class="heart" aria-pressed="${isFav ? "true" : "false"}" title="Favorite">
          ${isFav ? "♥" : "♡"}
        </button>
      </div>

      <div class="badges">
        ${(it.categories||[]).slice(0,4).map(c=>`<span class="badge">${c}</span>`).join("")}
        ${it.virtual ? `<span class="badge">Anywhere</span>` : ``}
      </div>

      <p class="desc">${it.description || "Click for details."}</p>

      <div class="card-footer">
        <div class="meta">${it.url}</div>
      </div>
    `;

    const heart = card.querySelector(".heart");
    heart.onclick = (e)=>{
      e.stopPropagation();
      if(favorites.has(it.id)) favorites.delete(it.id);
      else favorites.add(it.id);
      saveFavorites();
      render();
    };

    els.results.appendChild(card);
  });
}

async function loadData(){
  loadFavorites();
  try{
    const res = await fetch("http://localhost:3001/opportunities", { cache: "no-store" });

    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    data = raw.map(normalizeItem);
    buildCategoryChips();
    render();
  }catch(e){
    els.error.textContent = `Load failed: ${e.message}. Make sure you opened http://localhost:8000 (not double-clicking the html file).`;
  }
}

els.search.addEventListener("input", render);
els.age.addEventListener("input", render);
els.borough.addEventListener("change", render);
els.sort.addEventListener("change", render);

els.virtualOnly.onclick = ()=>{
  setToggle(els.virtualOnly, !getToggle(els.virtualOnly));
  render();
};
els.favoritesOnly.onclick = ()=>{
  setToggle(els.favoritesOnly, !getToggle(els.favoritesOnly));
  render();
};
els.clearCats.onclick = ()=>{
  selectedCats = new Set();
  buildCategoryChips();
  render();
};
// ----- Hamburger menu logic -----
function setupMenu(){
  const btn = document.getElementById("menuBtn");
  const dropdown = document.getElementById("menuDropdown");
  if(!btn || !dropdown) return;

  function open(){
    dropdown.classList.add("open");
    dropdown.setAttribute("aria-hidden","false");
    btn.setAttribute("aria-expanded","true");
  }

  function close(){
    dropdown.classList.remove("open");
    dropdown.setAttribute("aria-hidden","true");
    btn.setAttribute("aria-expanded","false");
  }

  btn.addEventListener("click", (e)=>{
    e.stopPropagation();
    if(dropdown.classList.contains("open")) close();
    else open();
  });

  document.addEventListener("click", ()=> close());
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape") close();
  });
}

window.onload = ()=>{
  setupMenu();
  loadData();
};
