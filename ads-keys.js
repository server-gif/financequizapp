window.adsKeys = {
  display_001: "/23338698373/financequizapp_display_001",
  display_002: "/23338698373/financequizapp_display_002",
  display_003: "/23338698373/financequizapp_display_003",
  interstitial_001: "/23338698373/financequizapp_interstitial_001",
  anchor_001: "/23338698373/financequizapp_anchor_001",
  rewoarded_001: "/23338698373/financequizapp_rewarded_001",
};

let rewardedAd = null;
let isRewardReady = false;
let pendingUrl = null;
let showRewardedFn = null;

/*-------------- OPean -------------------*/

window.googletag = window.googletag || { cmd: [] };

let interstitialSlot;

// Enable single request ONCE — must run INSIDE googletag.cmd (before gpt.js
// loads, the stub has no setConfig/pubads, causing a TypeError at top level).
googletag.cmd.push(function () {
  if (typeof googletag.setConfig === "function") {
    googletag.setConfig({ singleRequest: true });
  } else {
    googletag.pubads().enableSingleRequest();
  }
});

// WHO OWNS THE PAGE'S ONE INTERSTITIAL FORMAT?
// GPT allows exactly one out-of-page INTERSTITIAL per page. Measured on the live
// site: /23338698373/financequizapp_interstitial_001 answers EVERY request with
// isEmpty:true and lineItemId:null (at 1x1 out-of-page AND at 320x480/300x250/
// 336x280), i.e. the ad unit has no eligible ad at all. At the same time Google's
// own page-level ads script logs
//   "[GPT] Interstitial /23338698373/Latest3 not requested: Format already created
//    on the page."
// — it wants to run a real interstitial and our empty unit is what blocks it.
//   'pagelevel' → register nothing here, so Google's page-level interstitial can
//                 serve (it draws on the same demand that fills display_001).
//   'own'       → the old behaviour: our GAM ad unit takes the format.
// Override for one load with ?inter=own or ?inter=pagelevel.
window.interstitialSource = (function () {
  try {
    var q = new URLSearchParams(window.location.search).get("inter");
    if (q === "own" || q === "pagelevel") return q;
  } catch (e) {}
  return "pagelevel";
})();

googletag.cmd.push(function () {
  // The REWARDED slot is deliberately NOT defined here. GPT requires the
  // rewardedSlotReady listener to exist before a Rewarded-format slot is requested,
  // and defining it here (before google-reward.js has registered anything) logs
  //   "[GPT] Missing required event listener 'rewardedSlotReady' for Rewarded format
  //    slot" (error level, measured) and can stop the ad being served. It also made
  //   ?admode=never still define a rewarded slot. google-reward.js registers its
  // listeners first and then defines + displays the rewarded slot itself.
  if (window.interstitialSource === "own") {
    interstitialSlot = googletag.defineOutOfPageSlot(
      adsKeys.interstitial_001,
      googletag.enums.OutOfPageFormat.INTERSTITIAL,
    );

    if (interstitialSlot) interstitialSlot.addService(googletag.pubads());
  }

  // enableServices() has to run either way — it used to sit inside the slot check,
  // so skipping the interstitial would have stopped every other ad request too.
  googletag.enableServices();
  // google-reward.js checks this instead of calling enableServices() a second time,
  // which GPT reports as an error.
  window.__gptServicesEnabled = true;
});

/*-------------- End ----------------------*/

var isRootOrIndexWithoutQuestionParam = () => {
  const { pathname, search } = window.location;
  const isCorrectPath = pathname === "/" || pathname === "/index.html";
  const hasNoQuestionParam = !new URLSearchParams(search).has("question");
  return isCorrectPath && hasNoQuestionParam;
};

/* ---------- PRELOAD REWARDED AD ---------- */
function preloadReward() {
  if (isRootOrIndexWithoutQuestionParam()) return;
  window.googletag = window.googletag || { cmd: [] };

  googletag.cmd.push(function () {
    try {
      // Avoid duplicate slot creation
      if (rewardedAd) return;

      rewardedAd = googletag.defineOutOfPageSlot(
        adsKeys.rewoarded_001,
        googletag.enums.OutOfPageFormat.REWARDED,
      );

      if (!rewardedAd) {
        console.warn("Rewarded slot failed to create.");
        return;
      }

      rewardedAd.addService(googletag.pubads());

      /* READY EVENT – The ONLY correct place to store makeRewardedVisible */
      googletag.pubads().addEventListener("rewardedSlotReady", function (evt) {
        if (evt.slot !== rewardedAd) return;

        console.log("Reward Preloaded ✔");
        isRewardReady = true;

        // IMPORTANT: store original GPT callback
        showRewardedFn = evt.makeRewardedVisible;
      });

      /* CLOSE EVENT */
      googletag.pubads().addEventListener("rewardedSlotClosed", function (evt) {
        if (evt.slot !== rewardedAd) return;

        console.log("Reward closed → navigating…");

        if (pendingUrl) {
          window.location.href = pendingUrl;
          pendingUrl = null;
        }

        cleanupReward();
        preloadReward(); // preload next reward
      });

      googletag.enableServices();
      googletag.display(rewardedAd);
    } catch (err) {
      console.error("Reward preload error:", err);
    }
  });
}

/* ---------- INSTANT SHOW WHEN USER CLICKS ---------- */
function showRewardAndGo(url) {
  pendingUrl = url;

  // reward is already preloaded & we have correct GPT show func
  if (isRewardReady && typeof showRewardedFn === "function") {
    console.log("Showing Reward Instantly ✔");
    try {
      showRewardedFn();
    } catch (err) {
      console.warn("Instant show error:", err);
      window.location.href = url; // fallback
    }
    return;
  }

  console.log("Reward NOT ready → redirecting instantly");
  // window.location.href = url;
}

/* ---------- CLEANUP AFTER CLOSE ---------- */
function cleanupReward() {
  try {
    googletag.destroySlots([rewardedAd]);
  } catch (err) {}

  rewardedAd = null;
  isRewardReady = false;
  showRewardedFn = null;
}

/* ---------- START PRELOADING AUTOMATICALLY ---------- */
document.addEventListener("DOMContentLoaded", preloadReward);
