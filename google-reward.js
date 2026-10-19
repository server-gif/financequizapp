(function () {
    var rewardEnabled = true;
    var isRootOrIndexWithoutQuestionParam = () => {
        const { pathname, search } = window.location;
        const isCorrectPath =
            pathname === '/' || pathname === '/index.html';
        const hasNoQuestionParam = !new URLSearchParams(search).has('question');
        return isCorrectPath && hasNoQuestionParam;
    };
    function createRewardPopup(onWatchAdClick) {
        if (document.getElementById('custom-reward-popup')) return;

        var overlay = document.createElement('div');
        overlay.id = 'custom-reward-popup';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '999999';

        var modal = document.createElement('div');
        modal.style.backgroundColor = '#1c1e26';
        modal.style.borderRadius = '16px';
        modal.style.padding = '24px';
        modal.style.width = '90%';
        modal.style.maxWidth = '340px';
        modal.style.textAlign = 'center';
        modal.style.color = '#ffffff';
        modal.style.fontFamily = 'Arial, sans-serif';
        modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        modal.style.position = 'relative';

        var closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '12px';
        closeBtn.style.right = '16px';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.color = '#ffffff';
        closeBtn.style.fontSize = '24px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.outline = 'none';
        closeBtn.style.opacity = '0.6';
        closeBtn.onmouseover = function () { closeBtn.style.opacity = '1'; };
        closeBtn.onmouseout = function () { closeBtn.style.opacity = '0.6'; };
        closeBtn.addEventListener('click', function () {
            document.body.removeChild(overlay);
        });

        var tag = document.createElement('div');
        tag.style.display = 'inline-flex';
        tag.style.alignItems = 'center';
        tag.style.backgroundColor = '#29b6f6';
        tag.style.color = '#ffffff';
        tag.style.padding = '6px 12px';
        tag.style.borderRadius = '20px';
        tag.style.fontSize = '12px';
        tag.style.fontWeight = 'bold';
        tag.style.marginBottom = '16px';
        tag.innerHTML = '<span style="margin-right: 6px;">🎁</span> REWARD';

        var title = document.createElement('h2');
        title.innerText = 'Unlock the recommendation';
        title.style.fontSize = '18px';
        title.style.margin = '0 0 12px 0';
        title.style.fontWeight = 'bold';

        var subtitle = document.createElement('p');
        subtitle.innerText = 'We found something made for you. Watch a short ad to continue.';
        subtitle.style.fontSize = '14px';
        subtitle.style.color = '#a0a0a0';
        subtitle.style.margin = '0 0 24px 0';
        subtitle.style.lineHeight = '1.4';

        var btn = document.createElement('button');
        btn.innerHTML = '<span style="margin-right: 8px;">▶</span> Watch ad and continue';
        btn.style.width = '100%';
        btn.style.padding = '14px';
        btn.style.border = '2px solid #5ed0ff';
        btn.style.borderRadius = '12px';
        btn.style.background = 'linear-gradient(90deg, #8a2be2, #00bfff)';
        btn.style.color = '#fff';
        btn.style.fontSize = '16px';
        btn.style.fontWeight = 'bold';
        btn.style.cursor = 'pointer';
        btn.style.marginBottom = '16px';
        btn.style.outline = 'none';

        var bottomText = document.createElement('p');
        bottomText.innerText = 'You will see an ad in exchange for the content.';
        bottomText.style.fontSize = '12px';
        bottomText.style.color = '#707070';
        bottomText.style.margin = '0';

        modal.appendChild(closeBtn);
        modal.appendChild(tag);
        modal.appendChild(title);
        modal.appendChild(subtitle);
        modal.appendChild(btn);
        modal.appendChild(bottomText);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        btn.addEventListener('click', function () {
            document.body.removeChild(overlay);
            onWatchAdClick();
        });
    }

    if (rewardEnabled) {
        const sessionChecker = setInterval(() => {
            var isActive = window.__sessionActive === true;
            var isInActive = window.__sessionInActive === true;

            if ((isActive || isInActive) && isRootOrIndexWithoutQuestionParam()) {
                clearInterval(sessionChecker);

                // Requirement: on every landing on the first page, show ONE ad —
                // rewarded ad directly; if it fails to load, the interstitial takes
                // its place. No popups, no visit gating.
                console.log('Session state determined. Active:', isActive);

                window.googletag = window.googletag || { cmd: [] };

                var iSlot = null;
                var renderInfo = {}; // slotId -> isEmpty (from slotRenderEnded)

                function ensureInterstitialSlot() {
                    if (iSlot) return iSlot;
                    if (typeof interstitialSlot !== 'undefined' && interstitialSlot) {
                        return interstitialSlot;
                    }
                    iSlot = googletag.defineOutOfPageSlot(
                        window.adsKeys.interstitial_001,
                        googletag.enums.OutOfPageFormat.INTERSTITIAL
                    );
                    if (iSlot) iSlot.addService(googletag.pubads());
                    return iSlot;
                }

                // A fresh interstitial request: GPT ignores refresh()/display() on an
                // already-requested out-of-page slot, so destroy + redefine + display.
                // onEmpty() is called when no creative came back (escalate to next tier).
                function requestFreshInterstitial(onEmpty) {
                    var cur = ensureInterstitialSlot();
                    if (cur) {
                        try { googletag.destroySlots([cur]); } catch (e) { }
                    }
                    iSlot = googletag.defineOutOfPageSlot(
                        window.adsKeys.interstitial_001,
                        googletag.enums.OutOfPageFormat.INTERSTITIAL
                    );
                    if (!iSlot) return null;
                    iSlot.addService(googletag.pubads());
                    var id = iSlot.getSlotElementId();
                    googletag.display(iSlot);
                    setTimeout(function () {
                        // renderInfo[id] === false → a real creative came back
                        if (renderInfo[id] === false) return;
                        if (typeof onEmpty === 'function') onEmpty();
                    }, 4000);
                    return iSlot;
                }

                googletag.cmd.push(function () {
                    // Track which slots actually received a creative (isEmpty flag).
                    googletag.pubads().addEventListener('slotRenderEnded', function (e) {
                        renderInfo[e.slotId] = e.isEmpty;
                    });

                    // Make sure the interstitial slot exists from the very start,
                    // so the fallback can always request it.
                    ensureInterstitialSlot();

                    const rewardedSlot = googletag.defineOutOfPageSlot(
                        window.adsKeys.rewoarded_001, // GAM rewarded ad unit
                        googletag.enums.OutOfPageFormat.REWARDED
                    );

                    var rewardHandled = false; // reward ad ne show kari (late events block kare)
                    var rewardReadyFired = false;
                    var fallbackRan = false;   // interstitial/display fallback ek j vaar chale
                    var rewardDone = false;
                    var rewardVisible = false;
                    var stuckWatchdog = null;
                    var lastAdShown = false;   // display overlay ek vaar j banay

                    // Last-resort full-screen display ad (fillable inventory), so at
                    // least one ad always appears even when reward + interstitial fail.
                    function showDisplayAdOverlay() {
                        if (lastAdShown) return;
                        lastAdShown = true;
                        console.log('Interstitial did not render → showing display ad overlay.');
                        if (document.getElementById('ad-fallback-overlay')) return;
                        var box = document.createElement('div');
                        box.id = 'ad-fallback-overlay';
                        box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:999998;display:flex;align-items:center;justify-content:center;';
                        var inner = document.createElement('div');
                        inner.id = 'global-ads-online-fallback-wrap';
                        inner.style.cssText = 'background:#fff;min-width:300px;min-height:50px;border-radius:8px;';
                        var closeBtn = document.createElement('button');
                        closeBtn.textContent = '✖';
                        closeBtn.style.cssText = 'position:absolute;top:10px;right:12px;background:#2563eb;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:16px;cursor:pointer;';
                        closeBtn.onclick = function () {
                            if (box.parentNode) box.parentNode.removeChild(box);
                        };
                        box.appendChild(closeBtn);
                        box.appendChild(inner);
                        document.body.appendChild(box);
                        try {
                            var fSlot = googletag.defineSlot(window.adsKeys.display_002, [[336, 280], 'fluid', [300, 250]], 'global-ads-online-fallback-wrap');
                            if (!fSlot) return;
                            fSlot.addService(googletag.pubads());
                            googletag.display('global-ads-online-fallback-wrap');
                            var fId = fSlot.getSlotElementId();
                            // If GAM returns no fill for the overlay slot too, remove the
                            // empty box (checked via renderInfo AND a real iframe probe).
                            setTimeout(function () {
                                var filled = renderInfo[fId] === false ||
                                    (inner.querySelector && inner.querySelector('iframe'));
                                if (!filled && box.parentNode) box.parentNode.removeChild(box);
                            }, 3500);
                        } catch (e) {
                            console.warn('Display ad overlay fallback failed:', e);
                        }
                    }

                    function showInterstitialFallback() {
                        if (rewardHandled || fallbackRan) return;
                        fallbackRan = true;
                        console.log('Rewarded ad not loaded → showing interstitial.');
                        try {
                            if (!requestFreshInterstitial(showDisplayAdOverlay)) {
                                showDisplayAdOverlay();
                            }
                        } catch (e) {
                            console.warn('Interstitial fallback error:', e);
                            showDisplayAdOverlay();
                        }
                    }

                    if (!rewardedSlot) {
                        console.log('Rewarded ads not supported on this device → interstitial.');
                        showInterstitialFallback();
                        return;
                    }

                    rewardedSlot.addService(googletag.pubads());

                    googletag.pubads().addEventListener(
                        'rewardedSlotReady',
                        function (event) {
                            if (event.slot.getSlotElementId() !== rewardedSlot.getSlotElementId()) return;
                            // Fallback already ran (late ready event) → do NOT show a second ad.
                            if (rewardHandled) return;
                            console.log('Rewarded ad ready — loading directly (no popup).');
                            rewardHandled = true;
                            rewardReadyFired = true;
                            rewardVisible = true;
                            event.makeRewardedVisible();

                            // Watchdog: if the creative is blank/stuck (black screen — neither
                            // rewardedSlotGranted nor rewardedSlotClosed ever fires),
                            // destroy the slot quickly and show the interstitial instead.
                            stuckWatchdog = setTimeout(function () {
                                if (rewardDone || !rewardVisible) return;
                                console.log('Rewarded ad stuck (not completing) → destroying slot, showing interstitial.');
                                rewardDone = true;
                                // best-effort: hide the stuck rewarded overlay immediately
                                try {
                                    var oop = document.getElementById(rewardedSlot.getSlotElementId());
                                    if (oop) oop.style.setProperty('display', 'none', 'important');
                                } catch (e) { }
                                try { googletag.destroySlots([rewardedSlot]); } catch (e) { }
                                rewardHandled = false;    // reward no show fail mani late
                                rewardReadyFired = false; // events ignore thai jashe
                                fallbackRan = false;
                                showInterstitialFallback();
                            }, 6000);
                        }
                    );

                    googletag.pubads().addEventListener(
                        'rewardedSlotGranted',
                        function (event) {
                            if (!rewardedSlot || event.slot.getSlotElementId() !== rewardedSlot.getSlotElementId()) return;
                            console.log('Reward granted.');
                            rewardDone = true;
                            if (stuckWatchdog) clearTimeout(stuckWatchdog);
                        }
                    );

                    googletag.pubads().addEventListener(
                        'rewardedSlotClosed',
                        function (event) {
                            if (!rewardedSlot || event.slot.getSlotElementId() !== rewardedSlot.getSlotElementId()) return;
                            console.log('Rewarded ad closed.');
                            rewardDone = true;
                            if (stuckWatchdog) clearTimeout(stuckWatchdog);
                        }
                    );

                    // No rewarded ad inventory / load fail → no ready event fires,
                    // so show the interstitial after a timeout instead.
                    setTimeout(showInterstitialFallback, 6000);

                    googletag.enableServices();
                    googletag.display(rewardedSlot);
                });
            }
        }, 1000);
    }
})();