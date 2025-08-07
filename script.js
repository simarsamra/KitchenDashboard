// --- Config ---
const REPO = 'simarsamra/kitchen-recipes-display';
const RAW_URL = `https://raw.githubusercontent.com/${REPO}/main/recipes.json`;
const LS_KEY = 'recipeData';
const FALLBACK_RECIPES = {
  "Breakfast": [
    { "name": "Toast", "ingredients": ["Bread", "Butter"], "steps": ["Toast bread.", "Spread butter."] },
    { "name": "Eggs", "ingredients": ["Eggs", "Salt"], "steps": ["Boil or scramble eggs.", "Season."] }
  ],
  "Lunch": [
    { "name": "Sandwich", "ingredients": ["Bread", "Ham", "Cheese"], "steps": ["Layer ingredients.", "Serve."] },
    { "name": "Salad", "ingredients": ["Lettuce", "Tomato"], "steps": ["Chop and mix."] }
  ],
  "Dinner": [
    { "name": "Pasta", "ingredients": ["Pasta", "Sauce"], "steps": ["Cook pasta.", "Add sauce."] },
    { "name": "Rice Bowl", "ingredients": ["Rice", "Veggies"], "steps": ["Cook rice.", "Top with veggies."] }
  ],
  "Spare": [
    { "name": "Fruit", "ingredients": ["Apple", "Banana"], "steps": ["Slice and serve."] },
    { "name": "Crackers", "ingredients": ["Crackers"], "steps": ["Open package."] }
  ]
};

const categories = ["Breakfast", "Lunch", "Dinner", "Spare"];

document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.addEventListener('click', () => loadRecipes(true));
  loadRecipes();
});

async function loadRecipes(forceRefresh=false) {
  setStatus('Loading...');
  let recipes;
  
  // Try GitHub raw fetch
  try {
    if (forceRefresh || !localStorage.getItem(LS_KEY)) {
      const resp = await fetch(RAW_URL, {cache: "no-store"});
      if (resp.ok) {
        recipes = await resp.json();
        localStorage.setItem(LS_KEY, JSON.stringify(recipes));
        setStatus('Loaded from GitHub');
      } else throw new Error('GitHub fetch failed');
    }
  } catch (e) {
    setStatus('GitHub fetch failed, trying localStorage...');
  }

  // Try localStorage
  if (!recipes) {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        recipes = JSON.parse(stored);
        setStatus('Loaded from localStorage');
      }
    } catch (e) {
      setStatus('localStorage load failed, using fallback...');
    }
  }

  // Fallback recipes.json (bundled)
  if (!recipes) {
    try {
      const resp = await fetch('recipes.json');
      if (resp.ok) {
        recipes = await resp.json();
        setStatus('Loaded from bundled file');
      } else throw new Error();
    } catch (e) {
      recipes = FALLBACK_RECIPES;
      setStatus('Using built-in fallback');
    }
  }

  showRecipes(recipes);
}

function showRecipes(recipes) {
  const container = document.getElementById('categories');
  container.innerHTML = '';

  const dayIndex = (new Date()).getDate() % 4; // 0..3

  categories.forEach(category => {
    const catDiv = document.createElement('div');
    catDiv.className = 'category';
    const h2 = document.createElement('h2');
    h2.textContent = category;
    catDiv.appendChild(h2);

    const recipeList = document.createElement('div');
    recipeList.className = 'recipe-list';

    // Show 2 rotated recipes per category
    const catRecipes = recipes[category] || [];
    for (let i = 0; i < 2; i++) {
      // Pick recipes in rotation
      const idx = (dayIndex * 2 + i) % catRecipes.length;
      if (!catRecipes[idx]) continue;
      const r = catRecipes[idx];

      const recDiv = document.createElement('div');
      recDiv.className = 'recipe';
      const h3 = document.createElement('h3');
      h3.textContent = r.name;
      recDiv.appendChild(h3);

      // Ingredients
      const ing = document.createElement('ul');
      r.ingredients.forEach(ingredient => {
        const li = document.createElement('li');
        li.textContent = ingredient;
        ing.appendChild(li);
      });
      recDiv.appendChild(ing);

      // Steps
      const steps = document.createElement('ol');
      r.steps.forEach(step => {
        const li = document.createElement('li');
        li.textContent = step;
        steps.appendChild(li);
      });
      recDiv.appendChild(steps);

      recipeList.appendChild(recDiv);
    }
    catDiv.appendChild(recipeList);
    container.appendChild(catDiv);
  });
}

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}
