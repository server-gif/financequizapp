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

                var shouldShow = false;

                if (isInActive) {
                    var inactiveShown = localStorage.getItem('inactiveRewardShown') === 'true' || localStorage.getItem('rewardShown') === 'true';
                    if (!inactiveShown) {
                        shouldShow = true;
                    }
                } else if (isActive) {
                    var activeVisitCount = parseInt(localStorage.getItem('activeVisitCount') || '0', 10);
                    activeVisitCount++;
                    localStorage.setItem('activeVisitCount', activeVisitCount);

                    if (activeVisitCount % 3 === 1) {
                        shouldShow = true;
                    }
                }

                if (!shouldShow) {
                    return;
                }

                console.log('Session state determined. Active:', isActive);

                window.googletag = window.googletag || { cmd: [] };

                googletag.cmd.push(function () {
                    const rewardedSlot = googletag.defineOutOfPageSlot(
                        window.adsKeys.rewoarded_001, // Replace with your GAM ad unit
                        googletag.enums.OutOfPageFormat.REWARDED
                    );

                    if (!rewardedSlot) {
                        console.log('Rewarded ads not supported on this device.');
                        return;
                    }

                    rewardedSlot.addService(googletag.pubads());

                    googletag.pubads().addEventListener(
                        'rewardedSlotReady',
                        function (event) {
                            console.log('Rewarded ad ready.');
                            if (isInActive) {
                                createRewardPopup(function () {
                                    event.makeRewardedVisible();
                                    localStorage.setItem('inactiveRewardShown', 'true');
                                });
                            } else {
                                event.makeRewardedVisible();
                            }
                        }
                    );

                    googletag.pubads().addEventListener(
                        'rewardedSlotGranted',
                        function () {
                            console.log('Reward granted.');
                        }
                    );

                    googletag.pubads().addEventListener(
                        'rewardedSlotClosed',
                        function () {
                            console.log('Rewarded ad closed.');
                        }
                    );

                    googletag.enableServices();
                    googletag.display(rewardedSlot);
                });
            }
        }, 1000);
    }
})();