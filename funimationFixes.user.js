// ==UserScript==
// @name          Funimation Fixes
// @namespace     http://yo1.dog
// @version       1.0.0
// @description   Fixes issues with funimation.com
// @author        Mike "yo1dog" Moore
// @homepageURL   https://github.com/yo1dog/funimationFixes#readme
// @icon          https://github.com/yo1dog/funimationFixes/raw/master/icon.ico
// @match         *://www.funimation.com/*
// @run-at        document-end
// ==/UserScript==

let __execIdSeq = 0;


console.log('funimationFixes - loaded');

try {
  funimationFixes();
}
catch (err) {
  console.error(err);
}

function funimationFixes() {
  console.log('funimationFixes - start');
  
  // get the player iframe
  const playerIFrame = document.getElementById('player');
  if (!playerIFrame) {
    return;
  }
  playerIFrame.addEventListener('load', () => {
    console.log('funimationFixes - player iframe loaded');
    
    execOnPage(playerIFrame.contentWindow, playerFixes)
    .catch(err => {
      console.error(err);
    });
  });
}


function playerFixes() {
  (async function run() {
    console.log('funimationFixes - playerFixes - start');
    const nextButton = await waitForNextButton();
    console.log('funimationFixes - playerFixes - found');
    const prevButton = findPrevButton();
    
    const show = window.show;
    if (!show) {
      throw new Error(`Unable to get show from window.`);
    }

    const pathname = window.location.pathname;
    const match = /\/player\/(\d+)/.exec(window.location.pathname);
    if (!match) {
      throw new Error(`Unable to get experience ID from pathname: ${pathname}`);
    }
    const experienceId = parseInt(match[1], 10);

    const result = findCurrentEpisode(show, experienceId);
    if (!result) {
      throw new Error(`Unable to find current episode for experience ID: ${experienceId}`);
    }

    const nextEpisode = getNextEpisode(show, result.seasonIndex, result.episodeIndex);
    const prevEpisode = getPrevEpisode(show, result.seasonIndex, result.episodeIndex);

    setButtonAction(nextButton, show, nextEpisode);
    setButtonAction(prevButton, show, prevEpisode);
    console.log('funimationFixes - playerFixes - done');
  })();

  function findNextButton() {
    return document.getElementById('funimation-control-next');
  }
  function findPrevButton() {
    return document.getElementById('funimation-control-prev');
  }
  
  async function waitForNextButton() {
    return new Promise(resolve => {
      const observer = new MutationObserver(mutations => {
        console.log('funimationFixes - playerFixes - mutation');
        const nextButton = findNextButton();
        if (nextButton) {
          observer.disconnect();
          resolve(nextButton);
        }
      });
      observer.observe(document.documentElement, {childList: true, subtree: true});
    });
  }

  function findCurrentEpisode(show, experienceId) {
    for (let seasonIndex = 0; seasonIndex < show.seasons.length; ++seasonIndex) {
      const season = show.seasons[seasonIndex];

      for (let episodeIndex = 0; episodeIndex < season.episodes.length; ++episodeIndex) {
        const episode = season.episodes[episodeIndex];

        for (const key1 in episode.languages) {
          for (const key2 in episode.languages[key1]) {
            for (const key3 in episode.languages[key1][key2]) {
              if (episode.languages[key1][key2][key3].experienceId === experienceId) {
                return {
                  seasonIndex,
                  episodeIndex
                };
              }
            }
          }
        }
      }
    }
    return null;
  }

  function getNextEpisode(show, currentSeasonIndex, currentEpisodeIndex) {
    let nextSeasonIndex  = currentSeasonIndex;
    let nextEpisodeIndex = currentEpisodeIndex + 1;

    if (nextEpisodeIndex >= show.seasons[nextSeasonIndex].episodes.length) {
      ++nextSeasonIndex;
      if (nextSeasonIndex >= show.seasons.length) {
        return null;
      }

      nextEpisodeIndex = 0;
    }

    return show.seasons[nextSeasonIndex].episodes[nextEpisodeIndex];
  }

  function getPrevEpisode(show, currentSeasonIndex, currentEpisodeIndex) {
    let prevSeasonIndex  = currentSeasonIndex;
    let prevEpisodeIndex = currentEpisodeIndex - 1;

    if (prevEpisodeIndex < 0) {
      --prevSeasonIndex;
      if (prevSeasonIndex < 0) {
        return null;
      }

      prevEpisodeIndex = show.seasons[prevSeasonIndex].episodes.length - 1;
    }

    return show.seasons[prevSeasonIndex].episodes[prevEpisodeIndex];
  }

  function setButtonAction(button, show, episode) {
    button.removeAttribute('onclick');
    button.target = '_top';
    button.href = `/shows/${encodeURIComponent(show.showSlug)}/${encodeURIComponent(episode.slug)}/`;
  }
}



/**
 * @param {Function} fn 
 * @param {*} jsonParam
 */
async function execOnPage(window, fn, jsonParam) {
  const execId = __execIdSeq++;
  const script = window.document.createElement('script');
  script.setAttribute('async', '');
  script.textContent = `
    (
      async () => await (${fn})(${JSON.stringify(jsonParam)})
    )()
    .then (result => document.dispatchEvent(new CustomEvent('exec-on-page-complete', {detail: {id: ${JSON.stringify(execId)}, result}})))
    .catch(error  => document.dispatchEvent(new CustomEvent('exec-on-page-complete', {detail: {id: ${JSON.stringify(execId)}, error }})));
  `;
  
  const result = await new Promise((resolve, reject) => {
    window.document.addEventListener('exec-on-page-complete', event => {
      if (!event.detail || event.detail.id !== execId) {
        return;
      }
      if (event.detail.error) {
        reject(event.detail.error);
        return;
      }
      resolve(event.detail.result);
    }, {once: true});
    window.document.body.appendChild(script);
  });
  
  window.document.body.removeChild(script);
  return result;
}