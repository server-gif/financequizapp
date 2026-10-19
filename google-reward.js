(function () {
    var rewardEnabled = true;

    // REWARD MODE — which ad gets shown first.
    //   'never'  → NEVER display a rewarded ad; the interstitial is loaded instead.
    //   'auto'   → rewarded first for real browsers, skipped in environments that
    //              cannot play Google's video player (embedded Electron previews).
    //   'always' → always attempt the rewarded ad first.
    //
    // WHY 'never' IS THE DEFAULT: the GAM rewarded unit
    // /23338698373/financequizapp_rewarded_001 "fills" but its creative delivers no
    // media file at all — measured in a real (non-Electron) Chrome: IMA telemetry
    // vsrc=none / vs=1x1 / "The element has no supported sources.", the video source
    // request dies with net::ERR_BLOCKED_BY_ORB, and not a single .mp4/.webm/
    // googlevideo segment is ever fetched. GPT still fires rewardedSlotReady, so the
    // only thing a visitor sees is a full-screen BLACK player. No page-side check can
    // detect that (the creative lives in a cross-origin Safeframe, mediaSession and
    // canPlayType are both useless), so the only way to guarantee "no blank page" is
    // to not display it. Flip this back to 'auto' as soon as a working VAST video
    // creative is attached to that ad unit in GAM.
    var rewardMode = 'never';
    var rewardOffReason = 'rewarded unit serves no playable video (would be a blank screen)';

    function isBrokenVideoEnvironment() {
        var ua = navigator.userAgent || '';
        return /electron|headlesschrome/i.test(ua) && !/crios|edg\//i.test(ua);
    }

    function rewardShouldBeTried() {
        if (rewardMode === 'never') return false;
        if (rewardMode === 'always') return true;
        return !isBrokenVideoEnvironment();
    }

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

                // RULE: never show a blank ad. Both rewarded and interstitial are
                // requested up-front, but whichever tier we display must be one that
                // ACTUALLY filled. Priority: rewarded > interstitial > display ad.
                // If nothing fills, we show nothing (no black/white page).
                console.log('Session state determined. Active:', isActive);

                window.googletag = window.googletag || { cmd: [] };

                googletag.cmd.push(function () {
                    var pubads = googletag.pubads();

                    // slotId -> isEmpty, filled from real slotRenderEnded events.
                    // NOTE: this GPT build has no e.slotId — read it from the slot.
                    var renderInfo = {};
                    pubads.addEventListener('slotRenderEnded', function (e) {
                        var id = e.slot ? e.slot.getSlotElementId() : e.slotId;
                        if (id) renderInfo[id] = e.isEmpty;
                    });

                    function isFilled(slotId) {
                        if (!slotId) return false;
                        if (renderInfo[slotId] === false) return true;
                        var el = document.getElementById(slotId);
                        return !!(el && el.querySelector && el.querySelector('iframe'));
                    }

                    /* ---------- TIER 3: display ad prepared OFF-SCREEN ---------- */
                    var displayWrap = null;
                    var displaySlotId = null;

                    function prepareDisplayAd() {
                        displayWrap = document.createElement('div');
                        displayWrap.id = 'ad-fallback-wrap';
                        // hidden off-screen while GAM decides whether it fills
                        displayWrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:336px;min-height:280px;';
                        var inner = document.createElement('div');
                        inner.id = 'global-ads-online-fallback-wrap';
                        displayWrap.appendChild(inner);
                        document.body.appendChild(displayWrap);
                        try {
                            var s = googletag.defineSlot(
                                window.adsKeys.display_002,
                                [[336, 280], 'fluid', [300, 250]],
                                'global-ads-online-fallback-wrap'
                            );
                            if (!s) { discardDisplayAd(); return; }
                            s.addService(pubads);
                            displaySlotId = s.getSlotElementId();
                            googletag.display('global-ads-online-fallback-wrap');
                        } catch (e) {
                            discardDisplayAd();
                        }
                    }

                    function discardDisplayAd() {
                        if (displayWrap && displayWrap.parentNode) {
                            displayWrap.parentNode.removeChild(displayWrap);
                        }
                        displayWrap = null;
                    }

                    // Reveal ONLY when a creative really rendered — otherwise stay hidden.
                    function revealDisplayAdIfFilled() {
                        if (!displayWrap) return;
                        if (isFilled(displaySlotId)) {
                            adShown = true;
                            escalated = true;
                            console.log('Display ad filled → showing it.');
                            displayWrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:999998;display:flex;align-items:center;justify-content:center;';
                        } else {
                            console.log('Display ad has no fill → showing nothing (no blank page).');
                            discardDisplayAd();
                        }
                    }

                    /* ---------- TIER 2: interstitial (reuse the existing slot) ---------- */
                    // GPT allows only ONE out-of-page interstitial per page: a second one is
                    // silently dropped with "Format already created on the page" and is then
                    // never requested — which is exactly why the interstitial did not appear.
                    // The slot is looked up in GPT's own slot list rather than trusting the
                    // ads-keys.js variable, because async script order is not guaranteed.
                    function findInterstitialSlot() {
                        var slots = pubads.getSlots() || [], found = null;
                        for (var i = 0; i < slots.length; i++) {
                            if (slots[i].getAdUnitPath() === window.adsKeys.interstitial_001) found = slots[i];
                        }
                        return found;
                    }

                    var interSlot = findInterstitialSlot();
                    var interSlotIsNew = false;
                    if (!interSlot) {
                        interSlot = googletag.defineOutOfPageSlot(
                            window.adsKeys.interstitial_001,
                            googletag.enums.OutOfPageFormat.INTERSTITIAL
                        );
                        interSlotIsNew = !!interSlot;
                    }
                    var interSlotId = null;
                    if (interSlot) {
                        if (interSlotIsNew) {
                            interSlot.addService(pubads);
                            interSlotId = interSlot.getSlotElementId();
                            googletag.display(interSlot);
                        } else {
                            // already requested by ads-keys.js — GPT shows it itself when
                            // it fills; re-displaying would log "Format already created".
                            interSlotId = interSlot.getSlotElementId();
                        }
                    }

                    /* ---------- ESCALATE: fresh interstitial, then display ad ---------- */
                    // GPT ignores display()/refresh() on an already-requested out-of-page
                    // slot, so a real re-request needs destroy + redefine + display.
                    var escalated = false;

                    function escalateNow(reason) {
                        if (escalated) return;
                        escalated = true;
                        console.log('Escalating (' + reason + ') → interstitial.');
                        // Free the interstitial format FIRST — destroying only our own handle
                        // leaves a duplicate registration behind, and GPT then refuses the
                        // fresh slot ("Format already created") so no ad is requested at all.
                        var stale = [];
                        try {
                            stale = (pubads.getSlots() || []).filter(function (s) {
                                return s.getAdUnitPath() === window.adsKeys.interstitial_001;
                            });
                        } catch (e) { }
                        if (stale.length) { try { googletag.destroySlots(stale); } catch (e) { } }
                        interSlot = null;
                        var fresh = googletag.defineOutOfPageSlot(
                            window.adsKeys.interstitial_001,
                            googletag.enums.OutOfPageFormat.INTERSTITIAL
                        );
                        if (!fresh) { revealDisplayAdIfFilled(); return; }
                        interSlot = fresh;
                        fresh.addService(pubads);
                        var fid = fresh.getSlotElementId();
                        googletag.display(fresh);
                        setTimeout(function () {
                            if (!isFilled(fid)) revealDisplayAdIfFilled();
                        }, 4000);
                    }

                    /* ---------- TIER 1: rewarded ---------- */
                    // A GAM rewarded slot reports "filled" even when its video creative
                    // cannot deliver a media file (black screen, frozen progress bar), so
                    // repeated breakage is remembered and reward is skipped for a while.
                    var STRIKE_KEY = 'fqRewardBrokenStrikes';
                    function saveStrikes(n) { try { localStorage.setItem(STRIKE_KEY, String(n)); } catch (e) { } }
                    var brokenStrikes = 0;
                    try { brokenStrikes = parseInt(localStorage.getItem(STRIKE_KEY) || '0', 10) || 0; } catch (e) { }
                    var skipReward = brokenStrikes >= 2 || !rewardShouldBeTried();
                    var skipReason = rewardShouldBeTried()
                        ? 'rewarded marked broken on recent visits'
                        : (rewardMode === 'never' ? rewardOffReason : 'this environment cannot play rewarded video');

                    // When skipping we don't even define/request the rewarded slot, so no
                    // dead rewarded ad unit sits on the page.
                    var rewardedSlot = skipReward ? null : googletag.defineOutOfPageSlot(
                        window.adsKeys.rewoarded_001, // GAM rewarded ad unit
                        googletag.enums.OutOfPageFormat.REWARDED
                    );

                    prepareDisplayAd(); // fetched in parallel, shown only if it fills

                    var rewardFilled = false;  // rewardedSlotReady fired (= creative loaded)
                    var rewardVisible = false;
                    var rewardDone = false;
                    var rewardGranted = false;
                    var rewardShownAt = 0;
                    var gestureHappened = false;
                    var adShown = false;       // one ad only

                    function hideReward() {
                        if (!rewardedSlot) return;
                        try {
                            var oop = document.getElementById(rewardedSlot.getSlotElementId());
                            if (oop) oop.style.setProperty('display', 'none', 'important');
                        } catch (e) { }
                        try { googletag.destroySlots([rewardedSlot]); } catch (e) { }
                        rewardedSlot = null;
                    }

                    // Video creatives render BLACK unless revealed with a user gesture.
                    var revealReward = (function () {
                        var runOnce = false;
                        return function () {
                            if (runOnce || !rewardFilled || rewardVisible || adShown) return;
                            runOnce = true;
                            rewardVisible = true;
                            adShown = true;
                            rewardShownAt = Date.now();
                            console.log('Rewarded ad filled → showing it.');
                            revealEvent.makeRewardedVisible();

                            // Safety net: a creative that never plays out (black screen the
                            // visitor just ignores) must not stay on screen forever.
                            setTimeout(function () {
                                if (rewardDone) return;
                                console.log('Rewarded ad never played out → hiding it (no blank screen).');
                                saveStrikes(brokenStrikes + 1);
                                hideReward();
                                escalateNow('rewarded creative did not play');
                            }, 20000);
                        };
                    })();

                    function onFirstGesture() {
                        if (gestureHappened) return;
                        gestureHappened = true;
                        ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
                            document.removeEventListener(ev, onFirstGesture, true);
                        });
                        revealReward();
                    }

                    ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
                        document.addEventListener(ev, onFirstGesture, { capture: true, passive: true });
                    });

                    var revealEvent = null;

                    if (skipReward) {
                        // Reward can't play here → never show a blank screen, interstitial instead
                        console.log('Rewarded skipped (' + skipReason + ') → loading interstitial.');
                        googletag.enableServices();
                        escalateNow(skipReason);
                    } else if (!rewardedSlot) {
                        console.log('Rewarded format not supported on this device.');
                        googletag.enableServices();
                        escalateNow('rewarded unsupported');
                    } else {
                        rewardedSlot.addService(pubads);

                        pubads.addEventListener('rewardedSlotReady', function (event) {
                            if (!rewardedSlot || event.slot.getSlotElementId() !== rewardedSlot.getSlotElementId()) return;
                            if (adShown) return; // a lower tier already took over
                            console.log('Rewarded ad filled — waiting for first tap to play (avoids black screen).');
                            revealEvent = event;
                            rewardFilled = true;
                            // Don't wait forever: if the visitor taps quickly we reveal on
                            // the gesture; otherwise reveal after a short grace period.
                            setTimeout(revealReward, 3000);
                        });

                        pubads.addEventListener('rewardedSlotGranted', function (event) {
                            if (!rewardedSlot || event.slot.getSlotElementId() !== rewardedSlot.getSlotElementId()) return;
                            console.log('Reward granted.');
                            rewardDone = true;
                            rewardGranted = true;
                            saveStrikes(0); // it plays fine again → reward gets priority back
                        });

                        pubads.addEventListener('rewardedSlotClosed', function (event) {
                            if (!rewardedSlot || event.slot.getSlotElementId() !== rewardedSlot.getSlotElementId()) return;
                            console.log('Rewarded ad closed.');
                            rewardDone = true;
                            // Closed almost straight away with no reward = the visitor saw a
                            // broken (black) creative → escalate now, don't leave them stuck.
                            if (!rewardGranted && rewardShownAt && Date.now() - rewardShownAt < 12000) {
                                console.log('Rewarded closed without playing → treated as broken.');
                                saveStrikes(brokenStrikes + 1);
                                hideReward();
                                escalateNow('rewarded closed unplayed');
                            }
                        });

                        googletag.enableServices();
                        googletag.display(rewardedSlot);
                    }

                    /* ---------- DECISION: pick the tier that really filled ---------- */
                    setTimeout(function () {
                        if (adShown || rewardFilled || escalated) return; // reward won / already escalated

                        if (isFilled(interSlotId)) {
                            console.log('Rewarded unavailable → interstitial filled, GPT will show it.');
                            adShown = true;
                            discardDisplayAd();
                            hideReward(); // no longer needed; keeps getSlots() clean
                            return;
                        }

                        hideReward(); // rewarded no-filled → drop the dead slot
                        escalateNow('no rewarded fill');
                    }, 8000);
                });
            }
        }, 1000);
    }
})();