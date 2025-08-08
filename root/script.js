// --- Config ---
const REPO = 'simarsamra/kitchen-recipes-display';
const RAW_URL = `https://raw.githubusercontent.com/${REPO}/main/recipes.json`;

const MEAL_TIMES = [
  { name: "Breakfast", start: 5, end: 10 },
  { name: "Lunch", start: 11, end: 14 },
  { name: "Dinner", start: 17, end: 21 },
  { name: "Spare", start: 22, end: 4 }
];

function getCurrentMeal() {
  const hour = new Date().getHours();
  for (const meal of MEAL_TIMES) {
    if (meal.start <= meal.end) {
      if (hour >= meal.start && hour <= meal.end) return meal.name;
    } else {
      if (hour >= meal.start || hour <= meal.end) return meal.name;
    }
  }
  return "Breakfast";
}

function getNextMeal() {
  const hour = new Date().getHours();
  for (let i = 0; i < MEAL_TIMES.length; i++) {
    const meal = MEAL_TIMES[i];
    if (meal.start <= meal.end) {
      if (hour < meal.start) return meal.name;
    } else {
      if (hour < meal.start && hour > meal.end) return meal.name;
    }
  }
  const idx = MEAL_TIMES.findIndex(m => m.name === getCurrentMeal());
  return MEAL_TIMES[(idx + 1) % MEAL_TIMES.length].name;
}

function getDayIndex() {
  const startDate = new Date('2024-01-01');
  const today = new Date();
  const diffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
  return diffDays % 4;
}

document.addEventListener('DOMContentLoaded', () => {
  loadRecipes();
  setInterval(loadRecipes, 1200000); // 20 min auto-refresh
});

async function loadRecipes() {
  setStatus('Loading...');
  let recipes;
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

  showCurrentRecipe(recipes);
  showPrepSuggestion(recipes);
  showGroceryList(recipes);
}

function showCurrentRecipe(recipes) {
  const container = document.getElementById('current-meal');
  container.innerHTML = '';

  const meal = getCurrentMeal();
  const mealArr = recipes[meal] || [];
  const dayIndex = getDayIndex();
  if (!Array.isArray(mealArr) || mealArr.length === 0) {
    container.textContent = `No recipes found for ${meal}.`;
    return;
  }
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

    if (r.ingredients) {
      const ing = document.createElement('ul');
      r.ingredients.forEach(ingredient => {
        const li = document.createElement('li');
        li.textContent = ingredient;
        ing.appendChild(li);
      });
      recDiv.appendChild(ing);
    }
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

function showPrepSuggestion(recipes) {
  const container = document.getElementById('prep-suggestion');
  container.innerHTML = '';

  const nextMeal = getNextMeal();
  const mealArr = recipes[nextMeal] || [];
  const dayIndex = getDayIndex();
  if (!Array.isArray(mealArr) || mealArr.length === 0) {
    container.textContent = `No recipes found for ${nextMeal}.`;
    return;
  }
  const nextRecipes = mealArr[dayIndex % mealArr.length];
  if (!Array.isArray(nextRecipes) || nextRecipes.length === 0) {
    container.textContent = `No recipes found for ${nextMeal} (day ${dayIndex+1}).`;
    return;
  }
  const catDiv = document.createElement('div');
  catDiv.className = 'category';
  const h2 = document.createElement('h2');
  h2.textContent = `Preparation for Next Meal: ${nextMeal}`;
  catDiv.appendChild(h2);

  const recipeRow = document.createElement('div');
  recipeRow.className = 'recipe-list';

  nextRecipes.forEach(r => {
    const recDiv = document.createElement('div');
    recDiv.className = 'recipe';
    const h3 = document.createElement('h3');
    h3.textContent = `${r.type}: ${r.name || ''}`;
    recDiv.appendChild(h3);

    if (r.ingredients) {
      const ing = document.createElement('ul');
      r.ingredients.forEach(ingredient => {
        const li = document.createElement('li');
        li.textContent = ingredient;
        ing.appendChild(li);
      });
      recDiv.appendChild(ing);
    }
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

function showGroceryList(recipes) {
  const container = document.getElementById('grocery-list');
  container.innerHTML = '';

  const dayIndex = getDayIndex();
  const meals = ["Breakfast", "Lunch", "Dinner"];
  let allIngredients = [];

  meals.forEach(meal => {
    const mealArr = recipes[meal] || [];
    const todayRecipes = mealArr[dayIndex % mealArr.length];
    if (Array.isArray(todayRecipes)) {
      todayRecipes.forEach(r => {
        if (Array.isArray(r.ingredients)) {
          allIngredients = allIngredients.concat(r.ingredients);
        }
      });
    }
  });

  // Remove duplicates
  const uniqueIngredients = [...new Set(allIngredients)];

  const catDiv = document.createElement('div');
  catDiv.className = 'category';
  const h2 = document.createElement('h2');
  h2.textContent = 'Grocery List for Today';
  catDiv.appendChild(h2);

  const ul = document.createElement('ul');
  uniqueIngredients.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    ul.appendChild(li);
  });
  catDiv.appendChild(ul);
  container.appendChild(catDiv);
}

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}
