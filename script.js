document.addEventListener('DOMContentLoaded', function () {
  function getRootDomain(url) {
    try {
      let hostname = new URL(url).hostname;
      const parts = hostname.split('.');

      // Handle standard subdomains and domains
      if (parts.length > 2) {
        return parts.slice(-2).join('.');
      }

      return hostname; // Returns domain.com if no subdomains
    } catch (e) {
      return null;
    }
  }
  const rootDomain = getRootDomain(window.location.href);
  const email = 'support@' + rootDomain;
  const siteName = rootDomain.charAt(0).toUpperCase() + rootDomain.slice(1);
  document.querySelectorAll('.domain-name').forEach(el => el.textContent = rootDomain);
  document.querySelectorAll('.domain-email').forEach(el => {
    el.textContent = email;
    if (el.tagName === 'A') el.href = 'mailto:' + email;
  });
  document.querySelectorAll('.site-name').forEach(el => el.textContent = siteName);
});

// === QUIZ SCRIPT ===
const gadsids = {

};



const quizData = [
  { question: "What does a budget help you manage?", options: ["Income and expenses", "Weather forecasts", "Travel distance", "Internet speed"], correct: "Income and expenses" },
  { question: "What is interest earned on both the principal and previously earned interest called?", options: ["Simple interest", "Compound interest", "Service charge", "Sales tax"], correct: "Compound interest" },

];

let score = 0, selectedAnswer = null, correctAnswers = 0;

const questionCounter = document.getElementById('questionCounter');
const progressFill = document.getElementById('progressFill');
const scoreDisplay = document.getElementById('scoreDisplay');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');
//const nextBtn = document.getElementById('nextBtn');
const quizCard = document.getElementById('quizCard');
const resultCard = document.getElementById('resultCard');
const resultTitle = document.getElementById('resultTitle');
const resultMessage = document.getElementById('resultMessage');
const finalScore = document.getElementById('finalScore');
const correctAnswersDisplay = document.getElementById('correctAnswers');
const accuracy = document.getElementById('accuracy');
const restartBtn = document.getElementById('restartBtn');

// Initialize quiz
function initQuiz() {
  if (quizCard) {
    // currentQuestion = 0;
    score = 0;
    selectedAnswer = null;
    correctAnswers = 0;
    quizCard.style.display = 'block';
    resultCard.style.display = 'none';
    loadQuestion();
  }

}
let is_wrong_ans;
// Load question
function loadQuestion() {

  const q = quizData[currentQuestion];

  questionCounter.textContent = `Question ${currentQuestion + 1} of ${quizData.length}`;
  progressFill.style.width = `${((currentQuestion + 1) / quizData.length) * 100}%`;
  questionText.textContent = q.question;

  optionsContainer.innerHTML = '';
  selectedAnswer = null;

  q.options.forEach(option => {
    const el = document.createElement('a');
    if (currentQuestion == 1) {
      el.href = `result.html`;
    } else {
      el.href = `index.html?question=${currentQuestion + 1}`;
      //  el.href = `result.html`;
    }

    el.className = 'option';
    el.textContent = option;

    let answered = false;

    el.addEventListener('pointerup', function (e) {
      if (answered) return;
      answered = true;
      e.preventDefault();

      selectAnswer(option, el);
    });

    optionsContainer.appendChild(el);
  });

  updateScore();
}



//selected Answer
function selectAnswer(answer, element) {
  if (selectedAnswer) return;
  selectedAnswer = answer;

  element.classList.add('selected');
  const q = quizData[currentQuestion];

  optionsContainer.querySelectorAll('.option').forEach(opt => {
    if (opt.textContent === q.correct) {
      opt.classList.add('correct');
    } else if (opt.textContent === answer && answer !== q.correct) {
      opt.classList.add('wrong');
    }
  });

  if (answer === q.correct) {
    score += 100;
    correctAnswers++;
    is_wrong_ans = 0;
  } else {
    is_wrong_ans = 1;
  }

  updateScore();

  // 🔥 Delay before redirect (important for vignette)
  setTimeout(() => {
    goNextQuestion();
  }, 400);
}
function goNextQuestion() {
  const nextIndex = currentQuestion + 1;
  if (currentQuestion == 1) {
    //  window.location.href = 'result.html';
  }
  // If next question exists → same page with param (inter ads)
  if (nextIndex < quizData.length) {
    const nextUrl = `index.html?question=${nextIndex}`;
    // window.location.href = nextUrl;
    setTimeout(() => {
      //  window.location.href = nextUrl;
    }, 500); // ideal delay for google_vignette

  } else {
    // ✅ Quiz finished → natural redirect to result page

  }
}





function updateScore() { scoreDisplay.textContent = score; }

function nextQuestion(is_wrong_ans) {
  console.log(is_wrong_ans);
  //if (!selectedAnswer) return;
  currentQuestion++;
  if (currentQuestion < quizData.length) {
    if (is_wrong_ans == 1) {
      //showAdAndNavigate('',3);
    }

    loadQuestion();
  } else {
    showResults();
  }

}

function showResults() {
  initQuiz();
  addCoins(100);
  // window.location.href = "result.html";
  setTimeout(() => {
    window.location.assign("result.html");
  }, 100);
}

//nextBtn.addEventListener('click', nextQuestion);
if (restartBtn) {
  restartBtn.addEventListener('click', initQuiz);
}


// === ELEMENT SDK ===
const defaultConfig = {
  site_title: "Quick Start!",
  tagline: "Test your knowledge with interactive questions",
  primary_color: "#2E7D5B",
  background_color: "#0B1F1A",
  surface_color: "#102B24",
  text_color: "#e0e6ed",
  accent_color: "#123C32"
};

async function onConfigChange(config) {
  const siteTitle = config.site_title || defaultConfig.site_title;
  const tagline = config.tagline || defaultConfig.tagline;
  const primaryColor = config.primary_color || defaultConfig.primary_color;
  const backgroundColor = config.background_color || defaultConfig.background_color;
  const accentColor = config.accent_color || defaultConfig.accent_color;
  document.getElementById('siteTitle').textContent = siteTitle;
  document.getElementById('tagline').textContent = tagline;
  document.body.style.background = `linear-gradient(135deg, ${backgroundColor} 0%, ${accentColor} 100%)`;
  const logo = document.querySelector('.logo');
  logo.style.background = `linear-gradient(45deg, ${primaryColor}, ${primaryColor}dd)`;
  logo.style.webkitBackgroundClip = 'text';
  logo.style.webkitTextFillColor = 'transparent';
  document.querySelector('.next-btn').style.background = `linear-gradient(45deg, ${primaryColor}, ${primaryColor}dd)`;
  document.querySelector('.progress-fill').style.background = `linear-gradient(90deg, ${primaryColor}, ${primaryColor}dd)`;
  document.querySelector('.score-number').style.color = primaryColor;
}

function mapToCapabilities(config) {
  return {
    recolorables: [],
    borderables: [],
    fontEditable: undefined,
    fontSizeable: undefined
  };
}

function mapToEditPanelValues(config) {
  return new Map([
    ["site_title", config.site_title || defaultConfig.site_title],
    ["tagline", config.tagline || defaultConfig.tagline]
  ]);
}



initQuiz();



// Close popup
function closePopup() {
  const resultContainer = document.querySelector(".result-container");
  resultContainer.classList.remove("hide-index");
  document.getElementById("rewardPopup").style.display = "none";
}

// Claim button logic
function claimReward() {
  const resultContainer = document.querySelector(".result-container");
  resultContainer.classList.remove("hide-index");
  document.getElementById("rewardPopup").style.display = "none";
  document.getElementById("rewardPopup").remove();
  showRewardAndGo('', 7);
  addCoins(100);

  /*  setTimeout(() => {
    closePopup();
  }, 2000);*/
}
/** Add coint ----- */
const coinSet = document.querySelector(".coin_set");
const COIN_COOKIE = "user_coins";
const COIN_REWARD = 100;
function getCoins() {
  const match = document.cookie.match(new RegExp("(^| )" + COIN_COOKIE + "=([^;]+)"));
  return match ? parseInt(match[2]) : 0;
}

function setCoins(value) {
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  document.cookie = `${COIN_COOKIE}=${value}; expires=${expires.toUTCString()}; path=/`;
}
function updateCoinsDisplay(coins) {
  if (coinSet) {
    coinSet.textContent = coins;
  }


}

function addCoins(amount) {
  let coins = getCoins() + amount;
  setCoins(coins);
  updateCoinsDisplay(coins);
}
const currentCoins = getCoins();
updateCoinsDisplay(currentCoins);
/* document.querySelectorAll('.play_now_btn').forEach(button => {
 button.addEventListener('click', () => {
   window.location.href ='start.html';
  // showAdAndNavigate('start.html',3);
 });
});*/
let quiz_uql = null;
$(document).on("click", ".play-quiz-start", function (e) {
  e.preventDefault();
  const category = $(this).data("category");
  var currentCoins = getCoins();
  quiz_uql = "play-quiz.html?cate=" + encodeURIComponent(category);
  window.location.href = quiz_uql;
  // document.getElementById("coinAlert").style.display = "flex";

  /*if(currentCoins < 500 || currentCoins == ""){
     quiz_uql = "play-quiz.html?cate=" + encodeURIComponent(category);
    document.getElementById("coinAlert").style.display = "flex";
    return;
  }else{
    window.location.href = "play-quiz.html?cate=" + encodeURIComponent(category);
     return;
  }*/

});
$(document).on("click", "#watchBtn", function () {
  document.getElementById("coinAlert").style.display = "none";

  showAdAndNavigate(quiz_uql, 5);
  addCoins(100);
  /* setTimeout(function() {
 document.getElementById("coinAlert").style.display = "none";
}, 2000); */
});

/**------------------ Reword add Integrated ------------------- */


/* -------- Load rewarded ad + event wiring -------- */

document.querySelectorAll('.coins').forEach(element => {
  element.addEventListener('click', () => {

    showRewardAndGo('', 3);
    setTimeout(() => {
      addCoins(20);
      updateCoinsDisplay(getCoins());
    }, 3000);
  });
});
/**----- End ------ */
/*
window.addEventListener("load", function() {
  const loader = document.getElementById("pageLoader");
   loader.classList.add("hidden");
  setTimeout(() => loader.style.display = "none", 0);
});*/
/** Ads Integration 

/*****************************************************
* REWARDED AD – INSTANT OPEN WITH PROPER PRELOAD
*****************************************************/
let isPopupDisplayed = false;
function showAdAndNavigate(url, timer) {
  if (url) {
    window.location.href = url;
  }
  const cadsPopup = document.getElementById("adsPopup");


  const cadIns = cadsPopup.querySelector('ins.adsbygoogle');
  const cadsstatus = cadIns.getAttribute('data-ad-status');

  if (cadsstatus == 'filled') {
    console.log('ok');
    showAdPopup(url, timer);
  } else {
    if (url) {
      window.location.href = url;
    }

  }

}
/*
function showAdPopupd(url,timerset) {
  let closeButton = document.getElementById('close-button');
    closeButton.style.display = 'none';
      let count_wrap_element = document.getElementById('count-down-wrap');
      count_wrap_element.style.display = 'block'; 
    isPopupDisplayed = true;  // Mark popup as displayed
    const popup = document.getElementById('custom-interstitial-popup');
    popup.style.visibility = 'visible';  // Ensure the popup is visible after ad is loaded
    popup.removeAttribute('tabindex'); 
    // Countdown timer
    let countdown;
    countdown = timerset;
    let countdownElement = document.getElementById('countdown');
    
    let tmpcount = document.getElementById('count-down-wrap');
    let timer = setInterval(function() {
    countdown--;
    countdownElement.textContent = countdown;

    // When countdown hits 0, show the close button
    if (countdown <= 0) {
    clearInterval(timer);  // Stop the countdown
    closeButton.style.display = 'block';  // Show close button
    tmpcount.style.display = 'none';
    }
    }, 1000); // Decrease countdown every second

    // Close button click event
    closeButton.addEventListener('click', function() {
        closeButton.style.display = 'none';  // Hide the close button
        popup.style.visibility = 'hidden';  // Hide the popup again
        if(url){window.location.href = url; } // Redirect to the URL when close is clicked
    });
}*/
function showAdPopup(url, timeLeft) {
  if (url) { window.location.href = url; }
  const adsPopup = document.getElementById("adsPopup");
  const closeAd = document.getElementById("closeAd");
  const adTimer = document.getElementById("adTimer")

  const adIns = adsPopup.querySelector('ins.adsbygoogle');
  const adsstatus = adIns.getAttribute('data-ad-status');

  if (adsstatus != 'filled') {
    if (url) { window.location.href = url; }

  } else {
    adsPopup.classList.add("active");

    adTimer.textContent = `⏳ Please wait ${timeLeft} seconds...`;

    closeAd.classList.remove("active");

    const countdown = setInterval(() => {
      timeLeft--;
      adTimer.textContent = `⏳ Please wait ${timeLeft} seconds...`;
      if (timeLeft <= 0) {

        clearInterval(countdown);
        adTimer.textContent = "✅ You can now close this ad!";
        closeAd.classList.add("active");
      }
    }, 1000);
  }
  closeAd.addEventListener("click", () => {
    adsPopup.classList.remove("active");

    if (url) { window.location.href = url; }
  });
}