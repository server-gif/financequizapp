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

// Enable single request ONCE (new API; old enableSingleRequest is deprecated
// and calling it per-slot caused "Format already created on the page" errors).
if (typeof googletag.setConfig === "function") {
  googletag.setConfig({ singleRequest: true });
} else {
  googletag.pubads().enableSingleRequest();
}

googletag.cmd.push(function () {
  interstitialSlot = googletag.defineOutOfPageSlot(
    adsKeys.interstitial_001,
    googletag.enums.OutOfPageFormat.INTERSTITIAL,
  );

  if (interstitialSlot) {
    interstitialSlot.addService(googletag.pubads());

    googletag.enableServices();
  }
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
