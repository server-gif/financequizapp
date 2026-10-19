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

                function ensureInterstitialSlot() {
                    if (typeof interstitialSlot !== 'undefined' && interstitialSlot) {
                        return interstitialSlot;
                    }
                    if (!iSlot) {
                        iSlot = googletag.defineOutOfPageSlot(
                            window.adsKeys.interstitial_001,
                            googletag.enums.OutOfPageFormat.INTERSTITIAL
                        );
                        if (iSlot) iSlot.addService(googletag.pubads());
                    }
                    return iSlot;
                }

                googletag.cmd.push(function () {
                    // Make sure the interstitial slot exists from the very start,
                    // so the fallback can always request it.
                    ensureInterstitialSlot();

                    const rewardedSlot = googletag.defineOutOfPageSlot(
                        window.adsKeys.rewoarded_001, // GAM rewarded ad unit
                        googletag.enums.OutOfPageFormat.REWARDED
                    );

                    var rewardHandled = false;
                    var rewardReadyFired = false;
                    var rewardDone = false;
                    var rewardVisible = false;
                    var stuckWatchdog = null;

                    function showInterstitialFallback() {
                        if (rewardHandled || rewardReadyFired) return;
                        rewardHandled = true;
                        console.log('Rewarded ad not loaded → showing interstitial.');
                        try {
                            var slot = ensureInterstitialSlot();
                            if (slot) googletag.display(slot);
                        } catch (e) {
                            console.warn('Interstitial fallback error:', e);
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
                                rewardHandled = false;    // allow the fallback to run
                                rewardReadyFired = false; // (guard checks both flags)
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