/* ============================================
   FightHub — Training Page JS
   Handles dynamic conditioning plans, interval
   round timer (with synthesized AudioContext beeps),
   and fitness calculators.
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await dataStore.ready;

  // 1. Load Conditioning Plans
  await initConditioningPlans();

  // 2. Initialize Round Timer
  initRoundTimer();

  // 3. Initialize BMI Calculator
  initBMICalculator();

  // 4. Initialize Calorie Calculator
  initCalorieCalculator();
});

// ---- Conditioning Plans Loader ---- //
async function initConditioningPlans() {
  const plansGrid = document.getElementById('training-plans-grid');
  if (!plansGrid) return;

  try {
    const plans = await dataStore.getAll('training');
    if (plans.length === 0) {
      plansGrid.innerHTML = `<div class="text-center" style="grid-column:1/-1;"><p>No training plans found. Add them in the Admin panel.</p></div>`;
      return;
    }

    plansGrid.innerHTML = '';
    plans.forEach(plan => {
      const card = document.createElement('div');
      card.className = 'training-card animate-on-scroll';
      card.innerHTML = `
        <div class="training-card-image" style="width: 100%; height: 160px; overflow: hidden; border-radius: var(--radius-sm); margin-bottom: 15px; background: linear-gradient(135deg, #161616 0%, #2a2a2a 100%);">
          ${plan.image ? `<img src="${plan.image}" alt="${plan.title}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease;">` : `<div style="font-size: 3rem; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">🏋️</div>`}
        </div>
        <h3>${plan.title}</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 5px;">${plan.description || ''}</p>
      `;
      card.addEventListener('click', () => openPlanModal(plan));
      plansGrid.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load training plans:', err);
    plansGrid.innerHTML = `<div class="text-center" style="grid-column:1/-1;"><p class="text-accent">Error loading training plans.</p></div>`;
  }
}

// Plan details Modal
function openPlanModal(plan) {
  const modal = document.getElementById('training-modal');
  const backdrop = document.getElementById('training-modal-backdrop');
  const title = document.getElementById('modal-training-title');
  const body = document.getElementById('modal-training-body');

  if (!modal || !backdrop || !title || !body) return;

  title.innerText = plan.title;
  
  let exercisesHtml = '';
  if (plan.exercises && plan.exercises.length > 0) {
    exercisesHtml = `
      <div style="display: flex; flex-direction: column; gap: var(--space-md);">
        ${plan.exercises.map((ex, index) => `
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); padding: var(--space-md); border-radius: var(--radius-md);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-xs); flex-wrap: wrap; gap: 5px;">
              <h4 style="font-family: var(--font-body); font-weight: 700; font-size: 1.1rem; color: var(--text-primary); margin:0;">${index + 1}. ${ex.name}</h4>
              <span class="badge badge-accent">${ex.sets || '3 sets'}</span>
            </div>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0;">${ex.description || 'No description provided.'}</p>
            ${ex.videoUrl ? `
              <div style="margin-top: var(--space-sm);">
                <a href="${ex.videoUrl}" target="_blank" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding: 4px 8px;">🎬 Watch Demonstration</a>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } else {
    exercisesHtml = '<p class="text-muted">No exercises configured for this plan.</p>';
  }

  body.innerHTML = `
    <p style="margin-bottom: var(--space-lg); color: var(--text-muted);">${plan.description || ''}</p>
    <h3 style="font-size: 1.25rem; margin-bottom: var(--space-md);">Exercise Routine</h3>
    ${exercisesHtml}
  `;

  modal.classList.add('active');
  backdrop.classList.add('active');

  const closeBtn = document.getElementById('modal-training-close');
  const closeModal = () => {
    modal.classList.remove('active');
    backdrop.classList.remove('active');
  };

  closeBtn.onclick = closeModal;
  backdrop.onclick = closeModal;
}

// ---- Round Timer ---- //
function initRoundTimer() {
  const startBtn = document.getElementById('timer-start-btn');
  const resetBtn = document.getElementById('timer-reset-btn');
  const timeDisplay = document.getElementById('timer-time-display');
  const statusDisplay = document.getElementById('timer-status');
  
  const inputRounds = document.getElementById('timer-rounds');
  const inputWork = document.getElementById('timer-work');
  const inputRest = document.getElementById('timer-rest');

  if (!startBtn || !resetBtn || !timeDisplay || !statusDisplay) return;

  let timerInterval = null;
  let timerState = 'idle'; // idle, running, paused
  let currentRound = 1;
  let isWorkPhase = true; // true = work, false = rest
  let timeRemaining = 0; // seconds

  // Sound generator using Web Audio API (cross-browser, offline-friendly)
  function playSound(frequency, duration, type = 'sine') {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = type;
      osc.frequency.value = frequency;
      
      gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio Context sound play failed:', e);
    }
  }

  // Ring boxing bell sounds
  function ringBell() {
    playSound(800, 0.4, 'triangle');
    setTimeout(() => playSound(800, 0.4, 'triangle'), 150);
  }

  // Play rest/round alert beeps
  function playBeep() {
    playSound(1000, 0.15, 'sine');
  }

  function updateDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timeDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // Manage class styling for warning phase
    timeDisplay.classList.remove('warning', 'rest');
    if (!isWorkPhase) {
      timeDisplay.classList.add('rest');
    } else if (timeRemaining <= 10 && timeRemaining > 0) {
      timeDisplay.classList.add('warning');
    }
  }

  function tick() {
    if (timeRemaining > 0) {
      timeRemaining--;
      updateDisplay();
      
      // Play 3 Warning Beeps for last 3 seconds of round/rest
      if (timeRemaining <= 3 && timeRemaining > 0) {
        playBeep();
      }
    } else {
      // Transition phase
      if (isWorkPhase) {
        // Finished work phase
        const totalRounds = parseInt(inputRounds.value) || 3;
        if (currentRound < totalRounds) {
          isWorkPhase = false;
          timeRemaining = parseInt(inputRest.value) || 60;
          statusDisplay.textContent = `REST TIME`;
          statusDisplay.style.color = 'var(--success)';
          ringBell();
        } else {
          // Finished entire workout
          resetTimer();
          statusDisplay.textContent = `WORKOUT COMPLETE`;
          statusDisplay.style.color = 'var(--success)';
          ringBell();
          setTimeout(() => ringBell(), 400);
          return;
        }
      } else {
        // Finished rest phase
        currentRound++;
        isWorkPhase = true;
        timeRemaining = (parseInt(inputWork.value) || 3) * 60;
        statusDisplay.textContent = `ROUND ${currentRound}`;
        statusDisplay.style.color = 'var(--accent)';
        ringBell();
      }
      updateDisplay();
    }
  }

  function startTimer() {
    if (timerState === 'idle') {
      const rounds = parseInt(inputRounds.value) || 3;
      const workMin = parseInt(inputWork.value) || 3;
      
      currentRound = 1;
      isWorkPhase = true;
      timeRemaining = workMin * 60;
      statusDisplay.textContent = `ROUND ${currentRound}`;
      statusDisplay.style.color = 'var(--accent)';
      
      // Enable lock on input fields
      inputRounds.disabled = true;
      inputWork.disabled = true;
      inputRest.disabled = true;
      ringBell();
    }
    
    timerState = 'running';
    startBtn.textContent = 'Pause';
    startBtn.className = 'btn btn-secondary';
    
    timerInterval = setInterval(tick, 1000);
  }

  function pauseTimer() {
    timerState = 'paused';
    startBtn.textContent = 'Resume';
    startBtn.className = 'btn btn-primary';
    clearInterval(timerInterval);
  }

  function resetTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerState = 'idle';
    currentRound = 1;
    isWorkPhase = true;
    
    startBtn.textContent = 'Start';
    startBtn.className = 'btn btn-primary';
    statusDisplay.textContent = `ROUND 1`;
    statusDisplay.style.color = 'inherit';
    
    timeRemaining = (parseInt(inputWork.value) || 3) * 60;
    updateDisplay();
    
    // Unlock input fields
    inputRounds.disabled = false;
    inputWork.disabled = false;
    inputRest.disabled = false;
  }

  startBtn.addEventListener('click', () => {
    if (timerState === 'running') {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  resetBtn.addEventListener('click', resetTimer);

  // Auto update display if inputs change while idle
  [inputWork, inputRest].forEach(input => {
    input.addEventListener('change', () => {
      if (timerState === 'idle') {
        resetTimer();
      }
    });
  });

  // Init display
  resetTimer();
}

// ---- BMI Calculator ---- //
function initBMICalculator() {
  const btnToggle = document.getElementById('bmi-unit-toggle');
  const lblWeight = document.getElementById('lbl-weight');
  const lblHeight = document.getElementById('lbl-height');
  const inputWeight = document.getElementById('bmi-weight');
  const inputHeight = document.getElementById('bmi-height');
  const marker = document.getElementById('bmi-gauge-marker');
  const valDisplay = document.getElementById('bmi-val-display');
  const catDisplay = document.getElementById('bmi-cat-display');

  if (!btnToggle || !inputWeight || !inputHeight || !marker || !valDisplay || !catDisplay) return;

  let isMetric = true;

  btnToggle.addEventListener('click', () => {
    isMetric = !isMetric;
    if (isMetric) {
      btnToggle.textContent = 'Switch to Imperial';
      lblWeight.textContent = 'Weight (kg)';
      lblHeight.textContent = 'Height (cm)';
      inputWeight.placeholder = 'e.g. 75';
      // Convert current inputs approx
      const wVal = parseFloat(inputWeight.value);
      const hVal = parseFloat(inputHeight.value);
      if (wVal) inputWeight.value = Math.round(wVal / 2.20462);
      if (hVal) inputHeight.value = Math.round(hVal * 30.48 + 30); // crude check
    } else {
      btnToggle.textContent = 'Switch to Metric';
      lblWeight.textContent = 'Weight (lbs)';
      lblHeight.textContent = 'Height (inches)';
      inputWeight.placeholder = 'e.g. 165';
      const wVal = parseFloat(inputWeight.value);
      const hVal = parseFloat(inputHeight.value);
      if (wVal) inputWeight.value = Math.round(wVal * 2.20462);
      if (hVal) inputHeight.value = Math.round(hVal / 2.54);
    }
    calculateBMI();
  });

  function calculateBMI() {
    let weight = parseFloat(inputWeight.value);
    let height = parseFloat(inputHeight.value);

    if (!weight || !height || height <= 0 || weight <= 0) return;

    let bmi = 0;
    if (isMetric) {
      // height in cm to meters
      const heightInMeters = height / 100;
      bmi = weight / (heightInMeters * heightInMeters);
    } else {
      // imperial formula: (lbs / inches^2) * 703
      bmi = (weight / (height * height)) * 703;
    }

    bmi = Math.round(bmi * 10) / 10;
    valDisplay.textContent = bmi;

    let category = '';
    let markerPercent = 50; // default middle

    if (bmi < 18.5) {
      category = 'Underweight';
      // Map underweight to [0% - 25%]
      markerPercent = Math.max(5, Math.min(23, ((bmi - 12) / 6.5) * 25));
    } else if (bmi >= 18.5 && bmi < 25) {
      category = 'Normal Weight';
      // Map normal weight to [25% - 50%]
      markerPercent = 25 + (((bmi - 18.5) / 6.5) * 25);
    } else if (bmi >= 25 && bmi < 30) {
      category = 'Overweight';
      // Map overweight to [50% - 75%]
      markerPercent = 50 + (((bmi - 25) / 5) * 25);
    } else {
      category = 'Obese';
      // Map obese to [75% - 95%]
      markerPercent = 75 + Math.min(20, (((bmi - 30) / 10) * 20));
    }

    catDisplay.textContent = category;
    marker.style.left = `${markerPercent}%`;
  }

  [inputWeight, inputHeight].forEach(input => {
    input.addEventListener('input', calculateBMI);
  });

  // Calculate default
  calculateBMI();
}

// ---- Calorie Calculator ---- //
function initCalorieCalculator() {
  const ageIn = document.getElementById('cal-age');
  const genderIn = document.getElementById('cal-gender');
  const activityIn = document.getElementById('cal-activity');
  const weightIn = document.getElementById('cal-weight');
  const heightIn = document.getElementById('cal-height');

  const showMaintain = document.getElementById('cal-maintain');
  const showCut = document.getElementById('cal-cut');
  const showBulk = document.getElementById('cal-bulk');

  if (!ageIn || !genderIn || !activityIn || !weightIn || !heightIn || !showMaintain || !showCut || !showBulk) return;

  function calculateCalories() {
    const age = parseInt(ageIn.value);
    const weight = parseFloat(weightIn.value);
    const height = parseFloat(heightIn.value);
    const gender = genderIn.value;
    const activityMult = parseFloat(activityIn.value);

    if (!age || !weight || !height || age <= 0 || weight <= 0 || height <= 0) return;

    // BMR using Mifflin-St Jeor Equation
    let bmr = 0;
    if (gender === 'male') {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }

    const tdee = Math.round(bmr * activityMult);
    const cutting = tdee - 500;
    const bulking = tdee + 500;

    showMaintain.textContent = tdee;
    showCut.textContent = Math.max(1200, cutting); // safe boundary limit
    showBulk.textContent = bulking;
  }

  [ageIn, genderIn, activityIn, weightIn, heightIn].forEach(el => {
    el.addEventListener('input', calculateCalories);
    el.addEventListener('change', calculateCalories);
  });

  // Initial calc
  calculateCalories();
}
