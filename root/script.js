// --- Config ---
const REPO = 'simarsamra/kitchen-recipes-display';
const RAW_URL = `https://raw.githubusercontent.com/${REPO}/main/recipes.json`;
const LS_KEY = 'recipeData';

const MEAL_TIMES = [
  { name: "Breakfast", start: 5, end: 10 },   // 5AM - 10AM
  { name: "Lunch", start: 11, end: 14 },      // 11AM - 2PM
  { name: "Dinner", start: 17, end: 21 },     // 5PM - 9PM
  { name: "Spare", start: 22, end: 4 }        // 10PM - 4AM (wraps around midnight)
];

function getCurrentMeal() {
  const hour = new Date().getHours();
  for (const meal of MEAL_TIMES) {
    if (meal.start <= meal.end) {
      if (hour >= meal.start && hour <= meal.end) return meal.name;
    } else {
      // Wrap around midnight
      if (hour >= meal.start || hour <= meal.end) return meal.name;
    }
  }
  return "Breakfast";
}

// Day index for rotation (0-3 for 4 days)
function getDayIndex() {
  // Use UTC date for consistency; change to local if you prefer
  const startDate = new Date('2024-01-01'); // Set your rotation start date here
  const today = new Date();
  const diffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
  return diffDays % 4;
}
let dayIndex = getDayIndex();

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refreshBtn').addEventListener('click', () => loadRecipes(true));
  document.getElementById('optionBtn').addEventListener('click', () => {
    // Manual override: advance to next day in rotation
    dayIndex = (dayIndex + 1) % 4;
    loadRecipes(false, true);
  });
  // Always set dayIndex to current day on load
  dayIndex = getDayIndex();
  loadRecipes();

  setInterval(() => {
    dayIndex = getDayIndex();
    loadRecipes();
  }, 1200000); // 20 min auto-refresh
});

async function loadRecipes(forceRefresh=false, keepDay=false) {
  setStatus('Loading...');
  let recipes;

  // Always fetch from GitHub (no localStorage)
  try {
    const resp = await fetch(RAW_URL, {cache: "no-store"});
    if (resp.ok) {
      recipes = await resp.json();
      setStatus('Loaded from GitHub');
    } else throw new Error('GitHub fetch failed');
  } catch (e) {
    setStatus('GitHub fetch failed, trying bundled file...');
    try {
      const resp = await fetch('recipes.json');
      if (resp.ok) {
        recipes = await resp.json();
        setStatus('Loaded from bundled file');
      } else throw new Error();
    } catch (e) {
      setStatus('No recipes available');
      return;
    }
  }

  if (!keepDay) dayIndex = 0;

  showCurrentRecipe(recipes);
}

function showCurrentRecipe(recipes) {
  const container = document.getElementById('categories');
  container.innerHTML = '';

  const meal = getCurrentMeal();
  const mealArr = recipes[meal] || [];
  if (!Array.isArray(mealArr) || mealArr.length === 0) {
    container.textContent = `No recipes found for ${meal}.`;
    return;
  }

  // Get recipes for current day (each is an array of two: [International, North Indian])
  const todayRecipes = mealArr[dayIndex % mealArr.length];
  if (!Array.isArray(todayRecipes) || todayRecipes.length === 0) {
    container.textContent = `No recipes found for ${meal} (day ${dayIndex+1}).`;
    return;
  }

  const catDiv = document.createElement('div');
  catDiv.className = 'category';
  const h2 = document.createElement('h2');
  h2.textContent = `${meal} (Day ${dayIndex+1})`;
  catDiv.appendChild(h2);

  const recipeRow = document.createElement('div');
  recipeRow.className = 'recipe-list';

  todayRecipes.forEach(r => {
    const recDiv = document.createElement('div');
    recDiv.className = 'recipe';

    const h3 = document.createElement('h3');
    h3.textContent = `${r.type}: ${r.name || ''}`;
    recDiv.appendChild(h3);

    // Ingredients
    if (r.ingredients) {
      const ing = document.createElement('ul');
      r.ingredients.forEach(ingredient => {
        const li = document.createElement('li');
        li.textContent = ingredient;
        ing.appendChild(li);
      });
      recDiv.appendChild(ing);
    }

    // Steps
    if (r.steps) {
      const steps = document.createElement('ol');
      r.steps.forEach(step => {
        const li = document.createElement('li');
        li.textContent = step;
        steps.appendChild(li);
      });
      recDiv.appendChild(steps);
    }

    recipeRow.appendChild(recDiv);
  });

  catDiv.appendChild(recipeRow);
  container.appendChild(catDiv);
}

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}
