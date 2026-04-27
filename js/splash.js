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
    body.textContent = 'Match three drinks to clear them. Bigger matches make ' +
      'special pieces. Make it through eight levels — we\'ll teach you something ' +
      'about CR between each one.';
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
export function showGameOver({ score, highScore, isNewBest, levelReached, totalLevels, won }) {
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
      ? 'You cleared all eight levels. Your next cup is on us — kind of.'
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
