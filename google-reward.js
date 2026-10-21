(function () {
    var rewardEnabled = true;

    /* ================= AD FLOW CONFIGURATION ================= */
    // Rewarded is ALWAYS tried first, every page view. The previous version of this
    // file defaulted to rewardMode = 'never' and remembered "broken" visits in
    // localStorage (fqRewardBrokenStrikes), permanently skipping the rewarded tier
    // after two bad loads. Both of those are gone: nothing persisted can switch the
    // rewarded request off, so the flow really does start from a rewarded request
    // and only falls back when THIS view's request fails or times out.
    var AD_CONFIG = {
        // Wait this long for rewardedSlotReady before calling rewarded failed.
        rewardReadyTimeoutMs: 12000,
        // rewardedSlotReady fired: reveal after this grace period if the visitor
        // has not touched the page yet (Google's player autoplays inside a gesture).
        rewardRevealGraceMs: 2500,
        // Visible but the creative never plays out (a fill with no media file shows
        // as a full-screen black player) → tear it down after this long.
        rewardPlayGuardMs: 20000,
        // Wait this long for the interstitial's own render verdict.
        interstitialTimeoutMs: 8000,
        // Platform/consent eligibility only — never a memory of past failures.
        // Google's rewarded player cannot run in embedded Electron/HEADLESS previews.
        allowRewarded: true,
        // ?admode=always — try the rewarded tier even in a preview environment that
        // is normally excluded, so the rewarded path can be tested from an embedded
        // Electron browser without editing this file.
        forceRewarded: false
    };

    // Tune or disable per load without editing this file:
    //   ?rttl=8000      rewarded ready-timeout (ms)
    //   ?ittl=6000      interstitial verdict-timeout (ms)
    //   ?admode=never   skip the rewarded tier (platform check only, no ad is
    //                   "remembered" as broken)
    //   ?admode=always  force the rewarded tier even in an excluded environment
    try {
        var cfgQs = new URLSearchParams(window.location.search);
        var cfgNum = function (key, target) {
            var v = parseInt(cfgQs.get(key), 10);
            if (v > 0) AD_CONFIG[target] = v;
        };
        cfgNum('rttl', 'rewardReadyTimeoutMs');
        cfgNum('ittl', 'interstitialTimeoutMs');
        var modeParam = cfgQs.get('admode');
        if (modeParam === 'never') AD_CONFIG.allowRewarded = false;
        if (modeParam === 'always') AD_CONFIG.forceRewarded = true;
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

    // Only real platform limits can stop the rewarded tier.
    function rewardShouldBeTried() {
        return AD_CONFIG.allowRewarded &&
            (AD_CONFIG.forceRewarded || !isBrokenVideoEnvironment());
    }

    // Why the rewarded tier is not requestable, for honest logging.
    function rewardBlockReason() {
        if (!AD_CONFIG.allowRewarded) return 'rewarded tier disabled for this load (?admode=never)';
        if (isBrokenVideoEnvironment()) return 'this environment cannot play Google\'s rewarded video player (override with ?admode=always)';
        return '';
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

                    /* ================= AD STATE MACHINE ================= */
                    // One variable decides everything, so a late Google callback can never
                    // put a second ad on screen. Legal paths:
                    //   idle
                    //    → reward_loading → reward_ready → reward_showing → finished
                    //                ↓ (no fill / timeout / unsupported / never played out)
                    //          reward_failed → interstitial_loading → interstitial_showing → finished
                    //                                          ↓ no fill
                    //                                        finished (nothing shown)
                    var S = {
                        IDLE: 'idle',
                        REWARD_LOADING: 'reward_loading',
                        REWARD_READY: 'reward_ready',
                        REWARD_SHOWING: 'reward_showing',
                        REWARD_FAILED: 'reward_failed',
                        INTER_LOADING: 'interstitial_loading',
                        INTER_SHOWING: 'interstitial_showing',
                        FINISHED: 'finished'
                    };
                    var state = S.IDLE;
                    // Set by whichever tier actually got on screen (the banner overlay uses
                    // it too), so "an ad is already up" has exactly one meaning.
                    var fullScreenShown = false;

                    function go(next, why) {
                        state = next;
                        // Read-only diagnostic for testing: type window.__adLastState in the
                        // console to see where the flow ended.
                        try { window.__adLastState = next; } catch (e) { }
                        console.log('AD STATE → ' + next + (why ? '  [' + why + ']' : ''));
                    }

                    // True as soon as a full-screen ad is up or the flow is over: no tier may
                    // start, nothing may be revealed by a late event.
                    function adTaken() {
                        return fullScreenShown ||
                            state === S.REWARD_SHOWING ||
                            state === S.INTER_SHOWING ||
                            state === S.FINISHED;
                    }

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

                    // 'NO FILL' may only ever be reported for a slot Google actually
                    // answered. A request that was never sent is a different problem, and
                    // labelling it a no-fill made dead ad units look like Google refusals.
                    function answerOf(id) {
                        if (!id) return 'NOT REQUESTED (no slot)';
                        if (renderInfo[id] === false) return 'FILLED';
                        if (renderInfo[id] === true) return 'NO FILL — Google answered empty';
                        return 'NOT ANSWERED (no slotRenderEnded for it)';
                    }

                    // Every async verdict is read through this one helper, so no tier can
                    // wait forever and no verdict is read before Google had a chance to
                    // answer. test() returns null while pending, a value once known.
                    function pollUntil(test, timeoutMs, onResult) {
                        var waited = 0, step = 500, settled = false;
                        function finish(val) {
                            if (settled) return;
                            settled = true;
                            onResult(val);
                        }
                        (function tick() {
                            if (settled) return;
                            var v = null;
                            try { v = test(); } catch (e) { v = null; }
                            if (v !== null && v !== undefined) { finish(v); return; }
                            waited += step;
                            if (waited >= timeoutMs) { finish(null); return; }
                            setTimeout(tick, step);
                        })();
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
                            if (adTaken()) {
                                // Do not vanish silently: this tier was requested and Google
                                // answered, so its verdict has to reach the console.
                                displayFilledHook = null;
                                if (!displayRevealed) console.log('Display tier (' + unit + '): ' + answerOf(displaySlotId) + ' — another ad already took the screen, overlay discarded.');
                                discardDisplayAd();
                                return;
                            }
                            if (interPending && displayWaitLeft-- > 0) {
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
                            fullScreenShown = true;
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
                            fullScreenShown = false;
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

                    /* ---------- WEB INTERSTITIAL TRIGGERS ---------- */
                    // Google's own docs: web interstitials are "full-page ads that appear in
                    // response to user actions" — they are NEVER shown just because the ad
                    // filled. Only "clicked an <a> element" is enabled by default, and this
                    // page has four footer links, so a FILLED interstitial sat on the page
                    // unseen. These are the documented optional triggers:
                    //   inactivity   → 30 s without interaction, then a click/scroll/key press
                    //   endOfArticle → scrolled to the end of the <article> + 5 s (mobile)
                    //   unhideWindow → the tab/window is hidden and comes back
                    //   navBar       → the browser navigation bar is used (desktop)
                    // Google still applies its own revenue optimisation and the frequency cap
                    // (default: 1 impression per 10 minutes per subdomain), so a trigger is an
                    // eligibility, not a guarantee.
                    var INTERSTITIAL_TRIGGERS = {
                        inactivity: true,
                        endOfArticle: true,
                        unhideWindow: true,
                        navBar: true
                    };
                    // Test a different set without editing the file: ?intertrig=inactivity
                    // (or ?intertrig=none to arm nothing).
                    try {
                        var trigParam = new URLSearchParams(window.location.search).get('intertrig');
                        if (trigParam !== null) {
                            INTERSTITIAL_TRIGGERS = {};
                            trigParam.split(',').forEach(function (k) {
                                k = (k || '').trim();
                                if (k && k !== 'none') INTERSTITIAL_TRIGGERS[k] = true;
                            });
                        }
                    } catch (e) { }

                    var triggersArmed = false;

                    function armInterstitialTriggers(slot) {
                        if (triggersArmed || !slot) return;
                        if (typeof slot.setConfig !== 'function') {
                            console.log('This GPT build has no slot.setConfig() — optional interstitial triggers cannot be enabled from code.');
                            triggersArmed = true;
                            return;
                        }
                        try {
                            slot.setConfig({ interstitial: { triggers: INTERSTITIAL_TRIGGERS } });
                            triggersArmed = true;
                            var names = Object.keys(INTERSTITIAL_TRIGGERS);
                            console.log('Interstitial triggers armed on ' + slot.getAdUnitPath() + ': '
                                + (names.length ? names.join(', ') : 'none')
                                + ' — plus the always-enabled <a> link click. The ad shows on the next such action.');
                        } catch (e) {
                            console.log('Arming interstitial triggers failed: ' + e.message);
                        }
                    }

                    // Google creates its page-level slot itself, so it may not exist yet.
                    function findPageLevelInterstitialSlot() {
                        var slots = [], found = null;
                        try { slots = pubads.getSlots() || []; } catch (e) { return null; }
                        for (var i = 0; i < slots.length; i++) {
                            if (/\/Latest\d*$/.test(slots[i].getAdUnitPath() || '')) found = slots[i];
                        }
                        return found;
                    }

                    // Nothing is registered or requested here. The interstitial tier only
                    // starts once the rewarded tier has really failed (startInterstitial),
                    // so there is exactly one moment when the format is touched.
                    // Diagnostic: report what Google's own page-level interstitial decides.
                    pubads.addEventListener('slotRenderEnded', function (e) {
                        var path = e.slot ? e.slot.getAdUnitPath() : '';
                        if (!path || path.indexOf('/Latest') === -1) return;
                        console.log('Page-level interstitial ' + path + ': ' + (e.isEmpty
                            ? 'NO FILL (Google answered empty)'
                            : 'FILLED → GPT shows it on an eligible user action (link click or an armed trigger).'));
                    });

                    /* ---------- TIER 2: interstitial (the rewarded fallback) ---------- */
                    // GPT allows exactly ONE out-of-page interstitial per page, so this tier
                    // never destroys + redefines slots to "retry": that only frees the format
                    // for Google's page-level ads, and the fresh slot then answers empty. The
                    // slot is looked up in GPT's own list instead of trusting ads-keys.js'
                    // variable, because async script order is not guaranteed.
                    var interPending = false;
                    var interStarted = false;

                    function startInterstitial(reason) {
                        if (state !== S.REWARD_FAILED || interStarted) return;
                        // Something is already on screen (the optional banner overlay): starting
                        // a second full-screen ad would show both.
                        if (fullScreenShown) { go(S.FINISHED, 'an ad is already on screen'); return; }
                        interStarted = true;
                        go(S.INTER_LOADING, reason);
                        if (useOwnInterstitial) requestOwnInterstitial();
                        else watchPageLevelInterstitial();
                    }

                    function endInterstitial(filled, detail) {
                        interPending = false;
                        if (state !== S.INTER_LOADING) return;   // a late answer
                        if (filled) {
                            // GPT owns the display of a web interstitial: a filled one is
                            // shown on the next eligible user action (the triggers above).
                            fullScreenShown = true;
                            go(S.INTER_SHOWING, detail);
                            fillReport('interstitial ' + detail);
                            return;
                        }
                        go(S.FINISHED, detail);
                        // Never a blank overlay: either the explicitly enabled banner tier
                        // or nothing at all, plus one banner refresh so the page shows an ad.
                        if (allowDisplayFallback) prepareDisplayAd();
                        else refreshInPageBanners();
                        fillReport('finished — ' + detail);
                    }

                    // 'own': ads-keys.js defined the slot before enableServices() and GPT has
                    // already requested it — reuse that slot and read its verdict.
                    function requestOwnInterstitial() {
                        interSlot = findInterstitialSlot();
                        if (!interSlot) {
                            interSlot = googletag.defineOutOfPageSlot(
                                window.adsKeys.interstitial_001,
                                googletag.enums.OutOfPageFormat.INTERSTITIAL
                            );
                            if (interSlot) { interSlot.addService(pubads); googletag.display(interSlot); }
                        }
                        if (!interSlot) {
                            // GPT said no. Say honestly WHY — blaming a phantom holder made a
                            // plain "this page cannot open the format" failure look like a
                            // duplicate-slot problem.
                            var holder = findInterstitialSlot();
                            endInterstitial(false, 'NOT REQUESTED — ' + (holder
                                ? "the interstitial format is already held by '" + holder.getSlotElementId() + "'"
                                : 'GPT would not create an interstitial slot on this page'));
                            return;
                        }
                        interSlotId = interSlot.getSlotElementId();
                        armInterstitialTriggers(interSlot);
                        interPending = true;
                        console.log('Interstitial: watching ' + window.adsKeys.interstitial_001 + ' (' + interSlotId + ') for ' + AD_CONFIG.interstitialTimeoutMs + ' ms.');
                        pollUntil(function () {
                            if (renderInfo[interSlotId] === false || isFilled(interSlotId)) return 'FILLED';
                            if (renderInfo[interSlotId] === true) return 'NO FILL';
                            return null;
                        }, AD_CONFIG.interstitialTimeoutMs, function (verdict) {
                            endInterstitial(verdict === 'FILLED',
                                (verdict || answerOf(interSlotId)) + ' on ' + window.adsKeys.interstitial_001);
                        });
                    }

                    // 'pagelevel': our own unit is deliberately NOT registered so Google's
                    // page-level ads script can take the format. We create nothing and must
                    // NOT assume an ad will appear just because no custom interstitial was
                    // registered — measured on the live site Google answers empty on most
                    // loads and sometimes creates no page-level slot at all.
                    function watchPageLevelInterstitial() {
                        console.log('Interstitial: ' + window.adsKeys.interstitial_001 + ' is not registered — reading Google\'s page-level interstitial instead.');
                        interPending = true;
                        pollUntil(function () {
                            var slot = findPageLevelInterstitialSlot();
                            if (!slot) return null;
                            interSlot = slot;
                            interSlotId = slot.getSlotElementId();
                            armInterstitialTriggers(slot);
                            if (renderInfo[interSlotId] === false || isFilled(interSlotId)) return 'FILLED';
                            if (renderInfo[interSlotId] === true) return 'NO FILL';
                            return null;
                        }, AD_CONFIG.interstitialTimeoutMs, function (verdict) {
                            endInterstitial(verdict === 'FILLED',
                                (verdict || answerOf(interSlotId)) +
                                (interSlot ? ' on ' + interSlot.getAdUnitPath() : ' — Google created no page-level interstitial slot on this load'));
                        });
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

                    /* ---------- TIER 1: rewarded (always requested first) ---------- */
                    // Nothing is remembered between page views any more. An earlier version
                    // kept a "broken creative" strike counter in localStorage and stopped
                    // requesting the rewarded tier after two bad visits — so a temporary GAM
                    // problem permanently disabled the ad. A failure now only moves THIS page
                    // forward: reward_loading → reward_failed → interstitial_loading.
                    var rewardedSlot = null;
                    var revealEvent = null;      // rewardedSlotReady event: owns makeRewardedVisible
                    var rewardReadyTimer = null;
                    var rewardRevealTimer = null;
                    var rewardGuardTimer = null;
                    var rewardShownAt = 0;
                    var rewardDone = false;      // granted or closed: nothing left to guard
                    var rewardGranted = false;
                    var gestureHappened = false;
                    var listenersInstalled = false;

                    // GPT allows one REWARDED slot per page, and ads-keys.js creates it before
                    // enableServices() so its request is guaranteed to go out.
                    function findRewardedSlot() {
                        var slots = [];
                        try { slots = pubads.getSlots() || []; } catch (e) { return null; }
                        for (var i = 0; i < slots.length; i++) {
                            if (slots[i].getAdUnitPath() === window.adsKeys.rewoarded_001) return slots[i];
                        }
                        return null;
                    }

                    function isOurReward(e) {
                        return !!(e && e.slot && rewardedSlot &&
                            e.slot.getSlotElementId() === rewardedSlot.getSlotElementId());
                    }

                    // Take a dead rewarded slot off the page (also hides the black player).
                    function hideReward() {
                        if (!rewardedSlot) return;
                        try {
                            var oop = document.getElementById(rewardedSlot.getSlotElementId());
                            if (oop) oop.style.setProperty('display', 'none', 'important');
                        } catch (e) { }
                        try { googletag.destroySlots([rewardedSlot]); } catch (e) { }
                        rewardedSlot = null;
                    }

                    function clearRewardTimers() {
                        clearTimeout(rewardReadyTimer);
                        clearTimeout(rewardRevealTimer);
                        rewardReadyTimer = rewardRevealTimer = null;
                    }

                    // Rewarded never became ready: no fill, timeout, unsupported, no slot.
                    function failReward(why) {
                        if (state !== S.REWARD_LOADING) return;
                        clearRewardTimers();
                        go(S.REWARD_FAILED, why);
                        hideReward();
                        startInterstitial(why);
                    }

                    // Rewarded WAS on screen but its creative never played out. The visitor
                    // must not be stranded on a black screen, so it is torn down and the
                    // interstitial takes over.
                    function abandonReward(why) {
                        if (state !== S.REWARD_SHOWING) return;
                        clearTimeout(rewardGuardTimer);
                        fullScreenShown = false;
                        go(S.REWARD_FAILED, why);
                        hideReward();
                        startInterstitial(why);
                    }

                    // Google's rewarded player needs a gesture context to autoplay video, so
                    // the reveal happens on the first tap if there is one, else on the timer.
                    var revealReward = (function () {
                        var ran = false;
                        return function () {
                            if (ran) return;
                            if (state !== S.REWARD_READY) return;
                            // A rewarded ad that arrives once the flow has moved on must never
                            // put a second ad on screen.
                            if (adTaken()) { ran = true; hideReward(); return; }
                            ran = true;
                            clearTimeout(rewardRevealTimer);
                            rewardShownAt = Date.now();
                            go(S.REWARD_SHOWING, 'makeRewardedVisible()');
                            fullScreenShown = true;
                            try {
                                revealEvent.makeRewardedVisible();
                            } catch (err) {
                                abandonReward('makeRewardedVisible() threw: ' + err.message);
                                return;
                            }
                            rewardGuardTimer = setTimeout(function () {
                                if (rewardDone) return;
                                abandonReward('rewarded creative never played out (would stay a blank screen)');
                            }, AD_CONFIG.rewardPlayGuardMs);
                        };
                    })();

                    function removeGestureListeners() {
                        ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
                            document.removeEventListener(ev, onFirstGesture, true);
                        });
                    }

                    function installGestureListeners() {
                        ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
                            document.addEventListener(ev, onFirstGesture, { capture: true, passive: true });
                        });
                    }

                    function onFirstGesture() {
                        if (gestureHappened) return;
                        gestureHappened = true;
                        removeGestureListeners();
                        revealReward();
                    }

                    // Installed exactly once per page, so no retry can double-handle an event.
                    function installRewardListeners() {
                        if (listenersInstalled) return;
                        listenersInstalled = true;

                        pubads.addEventListener('rewardedSlotReady', function (event) {
                            if (!isOurReward(event)) return;
                            if (state !== S.REWARD_LOADING) return;   // answered after the timeout
                            clearRewardTimers();
                            revealEvent = event;
                            go(S.REWARD_READY, 'rewardedSlotReady fired');
                            if (gestureHappened) revealReward();
                            else rewardRevealTimer = setTimeout(revealReward, AD_CONFIG.rewardRevealGraceMs);
                        });

                        // The creative really answered empty — do not sit and wait for a ready
                        // event that is not coming.
                        pubads.addEventListener('slotRenderEnded', function (e) {
                            if (!isOurReward(e)) return;
                            if (e.isEmpty) failReward('rewarded ad returned an empty response (no fill)');
                        });

                        // A rewarded slot that cannot be opened at all never fires
                        // rewardedSlotReady either, so the ready-timeout below is what turns
                        // it into reward_failed → interstitial. (Listening for a
                        // "rewardSlotNotOpenable" event is not possible: this GPT build
                        // rejects it — "Unknown event type", measured.)

                        pubads.addEventListener('rewardedSlotGranted', function (event) {
                            if (!isOurReward(event)) return;
                            console.log('Reward granted.');
                            rewardDone = true;
                            rewardGranted = true;
                            clearTimeout(rewardGuardTimer);
                            removeGestureListeners();
                            go(S.FINISHED, 'reward watched and granted');
                        });

                        pubads.addEventListener('rewardedSlotClosed', function (event) {
                            if (!isOurReward(event)) return;
                            rewardDone = true;
                            clearTimeout(rewardGuardTimer);
                            removeGestureListeners();
                            if (rewardGranted) { go(S.FINISHED, 'rewarded closed after the reward'); return; }
                            var watched = rewardShownAt ? Date.now() - rewardShownAt : 0;
                            if (state === S.REWARD_SHOWING && watched < 12000) {
                                abandonReward('rewarded closed after ' + watched + ' ms with no reward (blank creative)');
                                return;
                            }
                            go(S.FINISHED, 'rewarded closed');
                            hideReward();
                        });
                    }

                    function startAdFlow() {
                        // Say "requested first" only when a request is really going out.
                        go(S.REWARD_LOADING, rewardShouldBeTried()
                            ? 'rewarded requested first'
                            : 'rewarded not requestable here');
                        installRewardListeners();
                        installGestureListeners();
                        if (!window.__gptServicesEnabled) {
                            try { googletag.enableServices(); } catch (e) { }
                        }

                        // Only a real platform limit can stop the rewarded request.
                        if (!rewardShouldBeTried()) {
                            failReward(rewardBlockReason());
                            return;
                        }

                        rewardedSlot = findRewardedSlot();
                        var rewardedSlotIsNew = false;
                        if (!rewardedSlot) {
                            // Defined here rather than in ads-keys.js on purpose: the
                            // rewardedSlotReady listener has to exist BEFORE the slot is
                            // requested, otherwise GPT logs
                            //   "Missing required event listener 'rewardedSlotReady' for
                            //    Rewarded format slot" (error level, measured)
                            // and can refuse to serve it. Reusing an existing slot also keeps
                            // the one-REWARDED-format-per-page rule intact.
                            rewardedSlot = googletag.defineOutOfPageSlot(
                                window.adsKeys.rewoarded_001, // GAM rewarded ad unit
                                googletag.enums.OutOfPageFormat.REWARDED
                            );
                            rewardedSlotIsNew = !!rewardedSlot;
                            if (rewardedSlot) rewardedSlot.addService(pubads);
                        }
                        if (!rewardedSlot) {
                            failReward('rewarded format unsupported here / slot could not be created');
                            return;
                        }
                        if (rewardedSlotIsNew) {
                            try { googletag.display(rewardedSlot); } catch (e) { }
                        } else {
                            console.log('Rewarded: reusing the rewarded slot already on this page.');
                        }
                        console.log('Rewarded: requested ' + window.adsKeys.rewoarded_001 +
                            ' — waiting up to ' + AD_CONFIG.rewardReadyTimeoutMs + ' ms for rewardedSlotReady.');

                        // Never an indefinite wait: no ready event → rewarded failed → the
                        // interstitial fallback starts.
                        rewardReadyTimer = setTimeout(function () {
                            if (state !== S.REWARD_LOADING) return;
                            failReward('no rewardedSlotReady within ' + AD_CONFIG.rewardReadyTimeoutMs +
                                ' ms (' + answerOf(rewardedSlot ? rewardedSlot.getSlotElementId() : null) + ')');
                        }, AD_CONFIG.rewardReadyTimeoutMs);
                    }

                    // The banner tier is only warmed up when it was explicitly enabled;
                    // otherwise no display ad is ever requested.
                    if (allowDisplayFallback) prepareDisplayAd();

                    startAdFlow();
                });
            }
        }, 1000);
    }
})();