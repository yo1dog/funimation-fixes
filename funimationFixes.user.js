// @typescript:strictNullChecks
// ==UserScript==
// @name          Funimation Fixes
// @namespace     http://yo1.dog
// @version       1.0.0
// @description   Fixes issues with funimation.com
// @author        Mike "yo1dog" Moore
// @homepageURL   https://github.com/yo1dog/funimation-fixes#readme
// @icon          https://github.com/yo1dog/funimation-fixes/raw/master/icon.ico
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
  const playerIFrame = /** @type {HTMLIFrameElement | undefined} */(
    document.getElementById('player')
  );
  if (!playerIFrame) {
    return;
  }
  
  playerIFrame.addEventListener('load', () => {
    console.log('funimationFixes - player iframe loaded');
    
    const playerWindow = playerIFrame.contentWindow;
    if (!playerWindow) {
      console.error(new Error(`Unable to get window from player iframe.`));
      return;
    }
    
    execOnPage(playerWindow, playerFixes)
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
    
    const show = /** @type {any} */(window).show;
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
  
  /** @returns {HTMLAnchorElement} */
  function findNextButton() {
    return /** @type {HTMLAnchorElement} */(
      document.getElementById('funimation-control-next')
    );
  }
  /** @returns {HTMLAnchorElement} */
  function findPrevButton() {
    return /** @type {HTMLAnchorElement} */(
      document.getElementById('funimation-control-prev')
    );
  }
  
  /** @returns {Promise<HTMLAnchorElement>} */
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
  
  /**
   * @param {any} show 
   * @param {number} experienceId 
   */
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
  
  /**
   * @param {any} show 
   * @param {number} currentSeasonIndex 
   * @param {number} currentEpisodeIndex 
   */
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
  
  /**
   * @param {any} show 
   * @param {number} currentSeasonIndex 
   * @param {number} currentEpisodeIndex 
   */
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
  
  /**
   * @param {HTMLAnchorElement} button 
   * @param {any} show 
   * @param {any} episode 
   */
  function setButtonAction(button, show, episode) {
    button.removeAttribute('onclick');
    button.target = '_top';
    button.href = `/shows/${encodeURIComponent(show.showSlug)}/${encodeURIComponent(episode.slug)}/`;
  }
}



/**
 * @param {Window} window 
 * @param {(param?: any) => void} fn 
 * @param {any} [jsonParam] 
 */
async function execOnPage(window, fn, jsonParam) {
  const execId = __execIdSeq++;
  const eventName = 'exec-on-page-complete';
  
  const script = window.document.createElement('script');
  script.setAttribute('async', '');
  script.textContent = `
    const currentScript = document.currentScript;
    (async () =>
      await (${fn})(${JSON.stringify(jsonParam)})
    )()
    .then (result => document.dispatchEvent(new CustomEvent(${JSON.stringify(eventName)}, {detail: {id: ${JSON.stringify(execId)}, result}})))
    .catch(error  => document.dispatchEvent(new CustomEvent(${JSON.stringify(eventName)}, {detail: {id: ${JSON.stringify(execId)}, error }})))
    .finally(() => {currentScript.remove();})
  `;
  
  const result = await new Promise((resolve, reject) => {
    /** @type {EventListener} */
    const eventListener = event => {
      if (
        !(event instanceof CustomEvent) ||
        !event.detail ||
        event.detail.id !== execId
      ) {
        return;
      }
      
      window.document.removeEventListener(eventName, eventListener);
      
      if (event.detail.error) {
        reject(event.detail.error);
        return;
      }
      resolve(event.detail.result);
    };
    
    window.document.addEventListener(eventName, eventListener);
    window.document.body.appendChild(script);
  });
  
  window.document.body.removeChild(script);
  return result;
}