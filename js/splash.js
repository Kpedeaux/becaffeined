/* ==========================================================================
 * splash.js — Between-level brand splash + title + game-over overlays
 *
 * Splash content comes from levels.js. Render is straight DOM construction
 * so we don't need a templating library.
 * ========================================================================== */

const overlayEl = () => document.getElementById('overlay');

function clear() {
  const el = overlayEl();
  el.innerHTML = '';
  el.hidden = false;
}

function hide() {
  const el = overlayEl();
  el.hidden = true;
  el.innerHTML = '';
}

function makeButton(label, onClick, { variant = 'primary' } = {}) {
  const b = document.createElement('button');
  b.className = variant === 'ghost' ? 'btn btn--ghost' : 'btn';
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick, { once: true });
  return b;
}

/** Title screen. Resolves when the player presses Play. */
export function showTitle({ highScore }) {
  return new Promise(resolve => {
    clear();
    const root = overlayEl();

    const inner = document.createElement('div');
    inner.className = 'overlay__inner';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'overlay__eyebrow';
    eyebrow.textContent = 'New Orleans · Est. 2015';
    inner.appendChild(eyebrow);

    const title = document.createElement('h1');
    title.className = 'overlay__title';
    title.textContent = 'Becaffeined';
    inner.appendChild(title);

    const sub = document.createElement('p');
    sub.className = 'overlay__subtitle';
    sub.textContent = 'A match-three game from CR Coffee Shop.';
    inner.appendChild(sub);

    const photo = document.createElement('img');
    photo.className = 'overlay__photo';
    photo.src = 'assets/splash/magazine-umbrella.jpg';
    photo.alt = 'CR Coffee Shop, Magazine Street';
    photo.loading = 'eager';
    inner.appendChild(photo);

    const body = document.createElement('p');
    body.className = 'overlay__body';
    body.textContent = 'Match three drinks to clear them. Match four or more ' +
      'to create a red powerup that clears a row, column, or area when matched ' +
      'again. Eight levels. Learn a little about CR Coffee Shop between each.';
    inner.appendChild(body);

    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';
    btnRow.appendChild(makeButton('Play', () => { hide(); resolve(); }));
    inner.appendChild(btnRow);

    if (highScore > 0) {
      const best = document.createElement('p');
      best.className = 'title-best';
      best.innerHTML = `Personal Best <strong>${highScore.toLocaleString()}</strong>`;
      inner.appendChild(best);
    }

    root.appendChild(inner);
  });
}

/** Between-level splash. Resolves when player presses Continue. */
export function showSplash(splash, levelNumber, totalLevels) {
  return new Promise(resolve => {
    clear();
    const root = overlayEl();

    const inner = document.createElement('div');
    inner.className = 'overlay__inner';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'overlay__eyebrow';
    eyebrow.textContent = splash.eyebrow;
    inner.appendChild(eyebrow);

    const title = document.createElement('h2');
    title.className = 'overlay__title';
    title.textContent = splash.title;
    inner.appendChild(title);

    if (splash.subtitle) {
      const sub = document.createElement('p');
      sub.className = 'overlay__subtitle';
      sub.textContent = splash.subtitle;
      inner.appendChild(sub);
    }

    if (splash.photo) {
      const photo = document.createElement('img');
      photo.className = 'overlay__photo';
      photo.src = splash.photo;
      photo.alt = '';
      photo.loading = 'eager';
      // Optional crop control — defaults to center. Set photoPosition: 'top'
      // (or any valid object-position value) when the subject lives in the
      // upper portion of the source photo and center-crop is hiding it.
      if (splash.photoPosition) {
        photo.style.objectPosition = splash.photoPosition;
      }
      inner.appendChild(photo);
    }

    const body = document.createElement('p');
    body.className = 'overlay__body';
    body.textContent = splash.body;
    inner.appendChild(body);

    if (splash.pull) {
      const pull = document.createElement('p');
      pull.className = 'overlay__pull';
      pull.textContent = `"${splash.pull}"`;
      inner.appendChild(pull);
    }

    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';
    const isLast = levelNumber >= totalLevels;
    btnRow.appendChild(makeButton(
      isLast ? 'See Final Score' : `Level ${levelNumber + 1} →`,
      () => { hide(); resolve(); }
    ));
    inner.appendChild(btnRow);

    const meta = document.createElement('p');
    meta.className = 'title-best';
    meta.innerHTML = `Level <strong>${levelNumber} / ${totalLevels}</strong>`;
    inner.appendChild(meta);

    root.appendChild(inner);
  });
}

/** Game over overlay. Resolves with 'replay' when player chooses to play again. */
export function showGameOver({ score, highScore, isNewBest, levelReached, totalLevels, won, bonusEarned }) {
  return new Promise(resolve => {
    clear();
    const root = overlayEl();

    const inner = document.createElement('div');
    inner.className = 'overlay__inner';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'overlay__eyebrow';
    eyebrow.textContent = won ? 'You Made It' : 'Time\'s Up';
    inner.appendChild(eyebrow);

    const title = document.createElement('h2');
    title.className = 'overlay__title';
    title.textContent = won ? 'Becaffeined.' : 'Decaf?';
    inner.appendChild(title);

    const sub = document.createElement('p');
    sub.className = 'overlay__subtitle';
    sub.textContent = won
      ? 'You cleared all eight levels. Time for a real cup at any of our four locations.'
      : `You reached level ${levelReached} of ${totalLevels}. Try again?`;
    inner.appendChild(sub);

    const stat = document.createElement('div');
    stat.className = 'overlay__stat';
    stat.innerHTML = `
      <div class="overlay__stat-cell">
        <strong>${score.toLocaleString()}</strong>
        <span>Final Score</span>
      </div>
      <div class="overlay__stat-cell">
        <strong>${highScore.toLocaleString()}</strong>
        <span>Personal Best${isNewBest ? ' ★' : ''}</span>
      </div>
    `;
    inner.appendChild(stat);

    if (typeof bonusEarned === 'number' && bonusEarned > 0) {
      const bonusLine = document.createElement('p');
      bonusLine.className = 'title-best';
      const isCorrect = bonusEarned >= 5000;
      bonusLine.innerHTML = isCorrect
        ? `Bonus answer correct <strong>+${bonusEarned.toLocaleString()}</strong>`
        : `Bonus attempt <strong>+${bonusEarned.toLocaleString()}</strong>`;
      inner.appendChild(bonusLine);
    }

    if (isNewBest) {
      const pull = document.createElement('p');
      pull.className = 'overlay__pull';
      pull.textContent = '"New personal best."';
      inner.appendChild(pull);
    }

    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';
    btnRow.appendChild(makeButton('Play Again', () => { hide(); resolve('replay'); }));
    btnRow.appendChild(makeButton(
      'Visit CR Coffee',
      () => { window.open('https://crcoffeenola.com/', '_blank', 'noopener'); },
      { variant: 'ghost' }
    ));
    inner.appendChild(btnRow);

    root.appendChild(inner);
  });
}

/** Pause overlay. Resolves when player resumes. */
export function showPause() {
  return new Promise(resolve => {
    clear();
    const root = overlayEl();
    const inner = document.createElement('div');
    inner.className = 'overlay__inner';
    inner.innerHTML = `
      <p class="overlay__eyebrow">Paused</p>
      <h2 class="overlay__title">Take a Sip.</h2>
      <p class="overlay__subtitle">The board is waiting.</p>
    `;
    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';
    btnRow.appendChild(makeButton('Resume', () => { hide(); resolve(); }));
    inner.appendChild(btnRow);
    root.appendChild(inner);
  });
}

/* ==========================================================================
 * Bonus trivia round — fires after the player wins all 8 levels. Pulls a
 * random multiple-choice question from the splash facts they saw between
 * levels. Correct answer awards 5000 bonus points; wrong answer awards 500
 * for trying. Returns the bonus number to the caller.
 * ========================================================================== */

const TRIVIA = [
  {
    q: 'How many CR Coffee locations are there in New Orleans?',
    options: ['Two', 'Three', 'Four', 'Five'],
    correct: 2,
  },
  {
    q: 'What model of antique roaster does CR use?',
    options: [
      '1910s Royal No. 6',
      '1920s Probat',
      '1900s Burns',
      'Modern Diedrich',
    ],
    correct: 0,
  },
  {
    q: 'Where do CR\'s green coffee beans come through?',
    options: [
      'Port of Houston',
      'Port of New Orleans',
      'Port of Mobile',
      'Port of Tampa',
    ],
    correct: 1,
  },
  {
    q: 'What is the name of CR\'s private event space?',
    options: [
      'The Riverside Room',
      'The Magazine Room',
      'The Crescent Room',
      'The St. Roch Room',
    ],
    correct: 2,
  },
  {
    q: 'What year was Coast Roast Coffee founded?',
    options: ['1995', '2005', '2009', '2015'],
    correct: 2,
  },
  {
    q: 'Which CR blend honors the New Orleans coffee-and-chicory tradition?',
    options: [
      'Streetcar Blend',
      'Magazine Blend',
      'Roch Blend',
      'French Roast',
    ],
    correct: 2,
  },
];

export function showBonusQuestion() {
  return new Promise(resolve => {
    clear();
    const root = overlayEl();
    const inner = document.createElement('div');
    inner.className = 'overlay__inner';

    const trivia = TRIVIA[Math.floor(Math.random() * TRIVIA.length)];

    const eyebrow = document.createElement('p');
    eyebrow.className = 'overlay__eyebrow';
    eyebrow.textContent = 'Bonus Round';
    inner.appendChild(eyebrow);

    const title = document.createElement('h2');
    title.className = 'overlay__title';
    title.textContent = 'One Question.';
    inner.appendChild(title);

    const sub = document.createElement('p');
    sub.className = 'overlay__subtitle';
    sub.textContent = 'Answer correctly for 5,000 bonus points.';
    inner.appendChild(sub);

    const question = document.createElement('p');
    question.className = 'overlay__body';
    question.textContent = trivia.q;
    inner.appendChild(question);

    const choices = document.createElement('div');
    choices.className = 'trivia-choices';
    let answered = false;
    trivia.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn btn--ghost trivia-choice';
      btn.type = 'button';
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const correct = i === trivia.correct;
        btn.classList.add(correct ? 'is-correct' : 'is-wrong');
        // Reveal the right answer if they got it wrong
        if (!correct) {
          const right = choices.children[trivia.correct];
          if (right) right.classList.add('is-correct');
        }
        // Disable all buttons
        for (const b of choices.children) b.disabled = true;
        setTimeout(() => {
          hide();
          resolve(correct ? 5000 : 500);
        }, 1600);
      }, { once: true });
      choices.appendChild(btn);
    });
    inner.appendChild(choices);

    root.appendChild(inner);
  });
}
