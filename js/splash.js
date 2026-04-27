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
export function showTitle({ highScore, topScores = [] }) {
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
    body.textContent = 'Move any drink up, down, left, or right to swap with its ' +
      'neighbor. Line up three matching drinks in a row or column and they ' +
      'burst. Match four or more to create a red powerup that explodes when ' +
      'matched again. Ten levels. Learn a little about CR Coffee Shop ' +
      'between each.';
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

    // Always render the leaderboard so the player sees what they're chasing,
    // even on a fresh device or first play of the day.
    inner.appendChild(makeTopScoresList(topScores || []));

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
      // Cache-bust splash photos for the same reason as drink SVGs
      photo.src = splash.photo + (splash.photo.includes('?') ? '&' : '?') + 'v=15';
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
export function showGameOver({
  score, highScore, isNewBest, levelReached, totalLevels, won,
  bonusLevelsReached = 0, topScores = [],
  madeLeaderboard = false, leaderboardLimit = 10,
}) {
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
    let wonMsg = 'You cleared all eight levels. Time for a real cup at any of our four locations.';
    if (bonusLevelsReached === 1) {
      wonMsg = 'You cleared all eight levels and the first bonus round. Come visit us in person.';
    } else if (bonusLevelsReached >= 2) {
      wonMsg = 'Fully Becaffeined. Ten levels, two trivia gates, all double points. Time for a real cup.';
    }
    sub.textContent = won
      ? wonMsg
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

    if (bonusLevelsReached > 0) {
      const bonusLine = document.createElement('p');
      bonusLine.className = 'title-best';
      bonusLine.innerHTML = `Bonus Levels Cleared <strong>${bonusLevelsReached}</strong>`;
      inner.appendChild(bonusLine);
    }

    if (isNewBest) {
      const pull = document.createElement('p');
      pull.className = 'overlay__pull';
      pull.textContent = '"New personal best."';
      inner.appendChild(pull);
    }

    // Always render the leaderboard section so non-qualifying players see
    // what they're chasing. Heading + (list OR empty-state) + encouragement.
    inner.appendChild(makeTopScoresList(topScores || []));

    const cta = document.createElement('p');
    cta.className = 'leaderboard-cta';
    const list = topScores || [];
    if (madeLeaderboard) {
      cta.textContent = won
        ? 'You earned a spot on the leaderboard. Play again to climb higher.'
        : 'You made the leaderboard. Play again to climb higher.';
    } else if (list.length === 0) {
      cta.textContent = 'No scores on the board yet. Play again to be the first.';
    } else if (list.length < leaderboardLimit) {
      cta.textContent = `${list.length} of ${leaderboardLimit} spots taken. Play again to grab one.`;
    } else {
      const min = list[list.length - 1].score;
      cta.textContent = `Beat ${min.toLocaleString()} to land on the leaderboard. Try again.`;
    }
    inner.appendChild(cta);

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

export function showBonusQuestion({
  eyebrow = 'Bonus Round',
  title = 'One Question.',
  subtitle = 'Answer correctly to unlock the next round.',
  score = null,
  excludeIndices = [],
} = {}) {
  return new Promise(resolve => {
    clear();
    const root = overlayEl();
    const inner = document.createElement('div');
    inner.className = 'overlay__inner';

    // Pick a random question that hasn't been used yet
    const available = TRIVIA
      .map((_, i) => i)
      .filter(i => !excludeIndices.includes(i));
    const questionIndex = available[Math.floor(Math.random() * available.length)];
    const trivia = TRIVIA[questionIndex];

    const eyebrowEl = document.createElement('p');
    eyebrowEl.className = 'overlay__eyebrow';
    eyebrowEl.textContent = eyebrow;
    inner.appendChild(eyebrowEl);

    const titleEl = document.createElement('h2');
    titleEl.className = 'overlay__title';
    titleEl.textContent = title;
    inner.appendChild(titleEl);

    const subEl = document.createElement('p');
    subEl.className = 'overlay__subtitle';
    subEl.textContent = subtitle;
    inner.appendChild(subEl);

    // Show running score if provided — doubles as the score-reveal screen
    if (typeof score === 'number') {
      const stat = document.createElement('div');
      stat.className = 'overlay__stat';
      stat.innerHTML = `
        <div class="overlay__stat-cell">
          <strong>${score.toLocaleString()}</strong>
          <span>Score So Far</span>
        </div>
      `;
      inner.appendChild(stat);
    }

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
        if (!correct) {
          const right = choices.children[trivia.correct];
          if (right) right.classList.add('is-correct');
        }
        for (const b of choices.children) b.disabled = true;
        setTimeout(() => {
          hide();
          resolve({ correct, questionIndex });
        }, 1700);
      }, { once: true });
      choices.appendChild(btn);
    });
    inner.appendChild(choices);

    root.appendChild(inner);
  });
}

/** Renders the global leaderboard as a list. Returns the element to
 *  append. Caller decides where it goes in the layout. Empty list still
 *  renders a heading + placeholder so the section is always visible. */
function makeTopScoresList(topScores) {
  const wrap = document.createElement('div');
  wrap.className = 'top-scores';
  const heading = document.createElement('p');
  heading.className = 'overlay__eyebrow top-scores__heading';
  heading.textContent = 'Leaderboard';
  wrap.appendChild(heading);
  if (!topScores || topScores.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'top-scores__empty';
    empty.textContent = 'No scores yet.';
    wrap.appendChild(empty);
    return wrap;
  }
  const list = document.createElement('ol');
  list.className = 'top-scores__list';
  topScores.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className = 'top-scores__item';
    const rank = document.createElement('span');
    rank.className = 'top-scores__rank';
    rank.textContent = `${i + 1}.`;
    const name = document.createElement('span');
    name.className = 'top-scores__name';
    name.textContent = entry.name;
    const score = document.createElement('span');
    score.className = 'top-scores__score';
    score.textContent = entry.score.toLocaleString();
    li.appendChild(rank);
    li.appendChild(name);
    li.appendChild(score);
    list.appendChild(li);
  });
  wrap.appendChild(list);
  return wrap;
}

/** Name-entry overlay shown when a player makes the top 3.
 *  Resolves with the entered name (max 12 chars, uppercased, defaults
 *  to "Player" if blank). */
export function showNameEntry({ score, rank }) {
  return new Promise(resolve => {
    clear();
    const root = overlayEl();
    const inner = document.createElement('div');
    inner.className = 'overlay__inner';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'overlay__eyebrow';
    eyebrow.textContent = 'New Top Score';
    inner.appendChild(eyebrow);

    const title = document.createElement('h2');
    title.className = 'overlay__title';
    title.textContent = rank === 1 ? 'Number One!' : `Top ${rank}!`;
    inner.appendChild(title);

    const sub = document.createElement('p');
    sub.className = 'overlay__subtitle';
    sub.textContent = `${score.toLocaleString()} points. Enter a name for the leaderboard.`;
    inner.appendChild(sub);

    const form = document.createElement('form');
    form.className = 'name-entry';
    const input = document.createElement('input');
    input.className = 'name-entry__input';
    input.type = 'text';
    input.maxLength = 12;
    input.placeholder = 'YOUR NAME';
    input.autocapitalize = 'characters';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Your name for the leaderboard');
    form.appendChild(input);
    inner.appendChild(form);

    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';
    const submit = document.createElement('button');
    submit.className = 'btn';
    submit.type = 'button';
    submit.textContent = 'Save';
    btnRow.appendChild(submit);
    inner.appendChild(btnRow);

    const finalize = () => {
      const name = input.value.trim() || 'Player';
      hide();
      resolve(name);
    };
    submit.addEventListener('click', finalize, { once: true });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      finalize();
    });

    root.appendChild(inner);
    setTimeout(() => input.focus(), 50);
  });
}
