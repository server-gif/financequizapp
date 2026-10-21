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

    // Testing without editing the file: append ?admode=always (or auto / never) to the
    // page URL to override the setting above for that load.
    try {
        var modeParam = new URLSearchParams(window.location.search).get('admode');
        if (modeParam === 'always' || modeParam === 'auto' || modeParam === 'never') rewardMode = modeParam;
    } catch (e) { }

    // FULL-SCREEN FORMATS ONLY. The ad shown over the first page is either a REWARDED
    // video or an INTERSTITIAL — never a display/banner creative stretched into an
    // overlay. A promoted banner is exactly what looked like "a banner appeared in the
    // content and then turned into an interstitial". While this is false, a display
    // unit is never requested into the overlay and never promoted, so an unfilled
    // interstitial simply shows nothing instead of falling back to a banner.
    // Override for one load with ?adfallback=on (or force off with ?adfallback=off).
    // Related switch: window.interstitialSource in ads-keys.js (?inter=own|pagelevel)
    // picks whether our GAM interstitial unit or Google's page-level ad gets the one
    // interstitial format the page is allowed to register.
    var allowDisplayFallback = false;
    try {
        var fbParam = new URLSearchParams(window.location.search).get('adfallback');
        if (fbParam === 'on' || fbParam === 'off') allowDisplayFallback = fbParam === 'on';
    } catch (e) { }

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
                    var displayFilledHook = null;
                    pubads.addEventListener('slotRenderEnded', function (e) {
                        var id = e.slot ? e.slot.getSlotElementId() : e.slotId;
                        if (id) renderInfo[id] = e.isEmpty;
                        // Reveal the fallback the instant it renders: while the wrapper is
                        // transparent Google already counts the impression, so the invisible
                        // window has to be as short as possible — not a fixed 4 s poll.
                        if (id && id === displaySlotId && e.isEmpty === false && displayFilledHook) {
                            try { displayFilledHook(); } catch (err) { }
                        }
                    });

                    function isFilled(slotId) {
                        if (!slotId) return false;
                        if (renderInfo[slotId] === false) return true;
                        var el = document.getElementById(slotId);
                        return !!(el && el.querySelector && el.querySelector('iframe'));
                    }

                    /* ---------- TIER 3: display fallback — DISABLED by default ---------- */
                    // Kept behind allowDisplayFallback (see the config at the top) so the
                    // first-page ad is a rewarded video or an interstitial and never a
                    // banner. Two measured facts about this tier, if it is ever enabled:
                    //  1. Google refuses to fill a slot whose container is off-screen — the
                    //     same display_002 slot went isEmpty:true at adxs=-9999 and
                    //     isEmpty:false (real creative) once it had on-screen coordinates.
                    //  2. A container that is visible while it waits makes the ad pop up as
                    //     a banner and then "convert" into an interstitial, which looks
                    //     broken. So the wrapper IS the full-screen ad from the start, just
                    //     transparent and click-through until a creative really renders.
                    // financequizapp_display_003 is not used (no inventory at all) and
                    // display_001 is not used here either, because it is already the in-page
                    // banner and Google answers the same creative twice.
                    var DISPLAY_UNITS = [
                        window.adsKeys.display_002
                    ];
                    var displayWrap = null;
                    var displaySlotId = null;
                    var displayIdx = -1;
                    var displayRun = false;
                    var displayWaitLeft = 6; // × 1.5 s grace while an interstitial is in flight
                    var displayRevealed = false;

                    function ensureDisplayWrap() {
                        if (displayWrap) return displayWrap;
                        displayWrap = document.createElement('div');
                        displayWrap.id = 'ad-fallback-wrap';
                        // Real on-screen geometry (so GAM will fill it) but invisible and
                        // click-through until a creative has actually rendered.
                        displayWrap.style.cssText = 'position:fixed;inset:0;z-index:999998;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;';
                        document.body.appendChild(displayWrap);
                        return displayWrap;
                    }

                    function prepareDisplayAd() {
                        if (displayRun) return;
                        displayRun = true;
                        tryNextDisplayUnit();
                    }

                    function tryNextDisplayUnit() {
                        displayIdx++;
                        if (displayIdx >= DISPLAY_UNITS.length) {
                            console.log('No display ad unit filled → showing nothing (no blank page).');
                            discardDisplayAd();
                            refreshInPageBanners();
                            fillReport('display ladder exhausted');
                            return;
                        }
                        var unit = DISPLAY_UNITS[displayIdx];
                        if (!unit) { tryNextDisplayUnit(); return; }
                        displayWaitLeft = 6; // fresh grace period per ad unit

                        var inner = document.createElement('div');
                        inner.id = 'global-ads-online-fallback-' + displayIdx;
                        // the slot itself keeps a real size and sits centred in the wrapper
                        inner.style.cssText = 'width:336px;min-height:280px;';
                        ensureDisplayWrap().appendChild(inner);

                        var slot = null;
                        try {
                            slot = googletag.defineSlot(
                                unit,
                                [[336, 280], 'fluid', [300, 250]],
                                inner.id
                            );
                            if (!slot) { tryNextDisplayUnit(); return; }
                            slot.addService(pubads);
                            displaySlotId = slot.getSlotElementId();
                            googletag.display(inner.id);
                            console.log('Display tier: requesting ' + unit);
                        } catch (e) { tryNextDisplayUnit(); return; }

                        setTimeout(checkCurrentDisplaySlot, 4000);
                        displayFilledHook = checkCurrentDisplaySlot;

                        // A fill is only revealed once no interstitial request is still open,
                        // otherwise a filled interstitial and this overlay could BOTH appear.
                        function checkCurrentDisplaySlot() {
                            if (displayRevealed) return;                // already on screen
                            if (adShown) { displayFilledHook = null; discardDisplayAd(); return; } // a higher tier won
                            if (interInFlight && displayWaitLeft-- > 0) {
                                setTimeout(checkCurrentDisplaySlot, 1500);
                                return;
                            }
                            if (isFilled(displaySlotId)) {
                                revealDisplayAdIfFilled();
                                return;
                            }
                            console.log('  → ' + unit + ' had no fill, trying the next display unit.');
                            displayFilledHook = null;
                            try { googletag.destroySlots([slot]); } catch (e) { }
                            if (inner.parentNode) inner.parentNode.removeChild(inner);
                            tryNextDisplayUnit();
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
                        if (!displayWrap || displayRevealed) return;
                        if (isFilled(displaySlotId)) {
                            displayRevealed = true;
                            displayFilledHook = null;
                            adShown = true;
                            escalated = true;
                            console.log('Display ad filled → showing it as a full-screen ad.');
                            displayWrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:999998;display:flex;align-items:center;justify-content:center;pointer-events:auto;opacity:1;';
                            addAdCloseButton(displayWrap);
                        } else {
                            console.log('Display ad has no fill → dropping the overlay (no blank page).');
                            discardDisplayAd();
                            refreshInPageBanners();
                            fillReport('display no-fill');
                        }
                    }

                    // A promoted display ad must be dismissable, otherwise the visitor is stuck.
                    function addAdCloseButton(wrap) {
                        if (wrap.querySelector('.ad-fallback-close')) return;
                        var btn = document.createElement('div');
                        btn.className = 'ad-fallback-close';
                        btn.textContent = '\u2715';
                        btn.title = 'Close ad';
                        btn.style.cssText = 'position:absolute;top:14px;right:16px;width:34px;height:34px;line-height:32px;text-align:center;border:1px solid #fff;border-radius:50%;color:#fff;font-size:17px;cursor:pointer;background:rgba(0,0,0,.65);pointer-events:auto;font-family:Arial,sans-serif;';
                        btn.addEventListener('click', function () {
                            adShown = false;
                            discardDisplayAd();
                        });
                        wrap.appendChild(btn);
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

                    var interSlot = null;
                    var interSlotId = null;
                    // WHO GETS THE PAGE'S ONE INTERSTITIAL FORMAT? decided in ads-keys.js
                    // (window.interstitialSource, overridable with ?inter=own|pagelevel).
                    // 'pagelevel' is the default because the live measurements are blunt:
                    // financequizapp_interstitial_001 answers EVERY request isEmpty:true with
                    // lineItemId:null — at the out-of-page 1x1 AND at 320x480 / 300x250 /
                    // 336x280 — so the ad unit simply has no eligible ad, while Google's
                    // page-level ads logs "Interstitial /23338698373/Latest3 not requested:
                    // Format already created on the page". Our empty unit is the thing
                    // blocking Google's own interstitial, which draws on the demand that
                    // demonstrably does serve on this network (display_001 fills).
                    var useOwnInterstitial = window.interstitialSource !== 'pagelevel';

                    if (useOwnInterstitial) {
                        interSlot = findInterstitialSlot();
                        var interSlotIsNew = false;
                        if (!interSlot) {
                            interSlot = googletag.defineOutOfPageSlot(
                                window.adsKeys.interstitial_001,
                                googletag.enums.OutOfPageFormat.INTERSTITIAL
                            );
                            interSlotIsNew = !!interSlot;
                        }
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
                    } else {
                        // Registering nothing is the fix: it leaves the interstitial format
                        // free so the Google page-level ad can take it.
                        console.log('Interstitial: ' + window.adsKeys.interstitial_001 + ' is NOT registered (no eligible ad on that unit) — the format is left free for the Google page-level interstitial.');
                    }

                    // Diagnostic only: report what Google's page-level interstitial decides.
                    pubads.addEventListener('slotRenderEnded', function (e) {
                        var path = e.slot ? e.slot.getAdUnitPath() : '';
                        if (!path || path.indexOf('/Latest') === -1) return;
                        console.log('Page-level interstitial ' + path + ': '
                            + (e.isEmpty ? 'NO FILL (Google answered empty)' : 'FILLED → Google shows its full-screen ad'));
                    });

                    /* ---------- ESCALATE: interstitial (up to 2 tries), then display ---------- */
                    // GPT ignores display()/refresh() on an already-requested out-of-page
                    // slot, so a real re-request needs destroy + redefine + display. A single
                    // no-fill is often transient, so the interstitial gets a second attempt
                    // and the in-page banners get a refresh — the goal is that at least one
                    // ad unit really renders.
                    var escalated = false;
                    var interAttempts = 0;
                    var interInFlight = false;
                    var MAX_INTER_ATTEMPTS = 2;

                    function escalateNow(reason) {
                        if (escalated) return;
                        escalated = true;
                        if (!useOwnInterstitial) {
                            // Nothing to escalate to: no banner is allowed and our own
                            // interstitial unit is deliberately not registered.
                            console.log('Rewarded unavailable (' + reason + ') → no full-screen ad requested by us; the Google page-level interstitial has the format.');
                            fillReport('page-level interstitial mode');
                            return;
                        }
                        tryInterstitial(reason);
                    }

                    function tryInterstitial(reason) {
                        if (interAttempts >= MAX_INTER_ATTEMPTS) { interInFlight = false; tryDisplayOrBail(); return; }
                        interAttempts++;
                        interInFlight = true;
                        console.log('Interstitial attempt ' + interAttempts + ' (' + reason + ').');
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
                        // GPT allows exactly ONE out-of-page interstitial per page. If the
                        // format is still held (ads-keys.js defined it at load, or Google's
                        // own page-level ads did) this returns null and NO request goes out.
                        // That is not a no-fill, so it must not be logged as one.
                        if (!fresh) {
                            var held = findInterstitialSlot();
                            console.log('Interstitial attempt ' + interAttempts + ': NOT REQUESTED — the interstitial format is already held on this page'
                                + (held ? " by '" + held.getSlotElementId() + "'" : '') + '.');
                            if (!held) { interInFlight = false; tryDisplayOrBail(); return; }
                            interSlotId = held.getSlotElementId();
                            setTimeout(function () {
                                interInFlight = false;
                                if (isFilled(interSlotId)) {
                                    adShown = true;
                                    console.log('Interstitial filled → GPT is showing it.');
                                    fillReport('interstitial filled');
                                } else {
                                    console.log('Interstitial (' + interSlotId + '): ' + describeAnswer(interSlotId) + '.');
                                    tryDisplayOrBail();
                                }
                            }, 4000);
                            return;
                        }
                        interSlot = fresh;
                        fresh.addService(pubads);
                        var fid = fresh.getSlotElementId();
                        interSlotId = fid;
                        googletag.display(fresh);
                        setTimeout(function () {
                            interInFlight = false;
                            if (isFilled(fid)) {
                                adShown = true;
                                console.log('Interstitial filled → GPT is showing it.');
                                fillReport('interstitial filled');
                                return;
                            }
                            console.log('Interstitial attempt ' + interAttempts + ': ' + describeAnswer(fid) + '.');
                            if (interAttempts < MAX_INTER_ATTEMPTS) tryInterstitial('previous attempt had no fill');
                            else tryDisplayOrBail();
                        }, 4000);
                    }

                    // Interstitial gave up → the display ladder, but ONLY when the banner
                    // fallback is explicitly allowed. Otherwise nothing more is shown: the
                    // visitor keeps the page instead of getting a banner dressed as an ad.
                    function tryDisplayOrBail() {
                        if (!allowDisplayFallback) {
                            console.log('No full-screen ad served and the banner fallback is off → showing nothing (no blank page).');
                            refreshInPageBanners();
                            fillReport('no full-screen ad');
                            return;
                        }
                        prepareDisplayAd();
                    }

                    // 'NO FILL' must only ever be logged for a slot Google actually
                    // answered. A slot that was never sent (GPT refused the format) is a
                    // completely different problem, and treating it as a no-fill made the
                    // retry loop report an ad unit that was never requested.
                    function describeAnswer(id) {
                        if (!id) return 'NOT REQUESTED (no slot)';
                        if (renderInfo[id] === false) return 'FILLED';
                        if (renderInfo[id] === true) return 'NO FILL — Google answered empty';
                        return 'NOT ANSWERED (no slotRenderEnded for it)';
                    }

                    /* ---------- DIAGNOSTICS: which ad unit filled and which did not ---------- */
                    function fillReport(tag) {
                        try {
                            var rows = (pubads.getSlots() || []).map(function (s) {
                                var id = s.getSlotElementId();
                                var info = renderInfo[id];
                                var state;
                                if (info === false) state = 'FILLED';
                                else if (info === true) state = 'NO FILL (empty)';
                                else state = isFilled(id) ? 'FILLED (no render event)' : 'not rendered';
                                return { adUnit: s.getAdUnitPath(), slot: id, fill: state };
                            });
                            console.log('=== AD FILL REPORT (' + tag + ') ===');
                            rows.forEach(function (r) { console.log('  ' + r.fill.padEnd(22) + r.adUnit); });
                            return rows;
                        } catch (e) { return []; }
                    }

                    // Nothing overlay-able filled: at least make sure the normal in-page
                    // banners get one more request, so the visitor sees a real ad.
                    function refreshInPageBanners() {
                        var paths = [window.adsKeys.display_001, window.adsKeys.display_003];
                        var targets = [];
                        try {
                            targets = (pubads.getSlots() || []).filter(function (s) {
                                return paths.indexOf(s.getAdUnitPath()) !== -1 && !isFilled(s.getSlotElementId());
                            });
                        } catch (e) { }
                        if (!targets.length) { fillReport('nothing to refresh'); return; }
                        console.log('Refreshing ' + targets.length + ' in-page banner slot(s) so at least one ad renders.');
                        try { pubads.refresh(targets); } catch (e) { }
                        setTimeout(function () { fillReport('after banner refresh'); }, 4000);
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

                    if (allowDisplayFallback) prepareDisplayAd(); // else no banner is ever requested

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