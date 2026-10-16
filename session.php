<?php
/**
 * session.php  —  token ISSUE only (sirf landing pe ek baar chalta hai)
 * -------------------------------------------------------------------
 * Private key se token sign hota hai. Verify browser khud karta hai
 * (public key se), isliye baaki pages pe PHP bilkul nahi chalta.
 *
 *   GET session.php?action=issue&utm_campign=allcountry  -> { ok, token }
 */

header('Content-Type: application/json');

// ===== SETTINGS ====================================================
$DURATION = 3600; // 1 hour (seconds)

// PRODUCTION se pehle apna naya keypair banao (ye chat mein dikh chuka hai):
//   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out priv.pem
//   openssl rsa -in priv.pem -pubout -out pub.pem
$PRIVATE_KEY = <<<'KEY'
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCcQqMpmxcK7GBF
KgNg/vGMT4pm43vrPL9l5J1W/toSuhE2eARF07fN54NqrM2WJcSGq2mwcBPd2G5V
2JDewBDFgb1PWDjfwD9FRNjx/ix66wrWOUsqn4QNmvA2NQRWNi3jnDAk9M1yhBsP
g4ZDcdo1K2jG54xfWxyPuiA4mJg47oawa5VKVJOcctADJINHhXNVRjCg8vHF86Z/
Rr9/dOclGcLmQaf+SHlxLVcbTbqcdmXfVG6U/4P39VebP4rHRUWie+5wp6RdaMcP
2FkjXw0g2Wq5w8CxDx5nZS348yNwvFiw+Gv0d7KvUbWvWk3+/WpdB7WAWf886UJ2
43fWzlGHAgMBAAECggEAP40iiuNWpcypArgpk6NcXfJjmaDfXzbfqPMnwp/31THz
mjGJm1SWJpoH6rTJEE3f9d11KJsMmWdSyHtBwDZhG9K+SazZxLaNhQCRMypqsLsz
NxkqJvWlYVsoYwOA9gcm9rEpK36cp/xufQrC6l89ne4/uNWnU4jcvt+2Bw6Yql5F
XF3wGJFXgnzg2zWVKzkepITBiRDcbwIiCIlc5RJ8P9NU32ZD5gNdaagdinDrpqAR
y4brHWTxzEZdsSCyX0lEN5a47mTeUhiM/g6lZaX6uj/Q88iNPR1/8BKetco9FQLO
Gt8xz/QxHBc6EE6rzaYfiT4P5b/yojslhrwZJ1Ky4QKBgQDTdUVTK26RwrbQtEHI
wEC0Nx3X5MrUNRb3+cdrB04MhEi+rcce6arvCWY+M5P8CW/pf28mnIF97F6Xt54M
WZfukOpP3QayskrZR8g+IXoZaKmZX2TYrGw6VmaCmF9lnWhyZFzGVRjUAV0BL8Lo
yPkp0AkkWIZYhTBWhkaQzvRVOQKBgQC9LN1WBDjuqYjyHFKx6jsug9ZXpEuPpm2u
cC5ZiU+80AlZovaOawGCrGqc8X+izWKlrZb1mVRnuy2KoIyAypNuiLHd1z8pp1zd
3tkxHUEOYSoLI02M+FXaKJjzGaXd1cmfIe6axw59GC3ZyayGOnlNGbSBQJHRYSE1
1qo8EzScvwKBgFEqvoWCMlr45ruNtYKdaTjDv0zToZd7GWnuEsHed/MOA+5NPhV7
lAVVEk3l9nPUG4UBSWUExh/Tzytla+FJsqv8LDSjnqKRFXH5v785kmiWaCNbHpac
+J4b9BVE77lNhn4CUCpBF9qo+04tSx+XpSyLkjbFVCw+U6OivwtupRLhAoGBAKfz
VO4xAXqh+Xs5uhFKqxA46+sTaiI219murve++JPg/uwdylfWmJizClQb8/1N6u68
lvGlF1Kg02Xn89XEA/B2W7Ngjisk80Xnu1vnZQKnMPSCey9UqqPstx3c/21biI1H
StcPMsXM2agpbIofD+Jrl93IvazuVtW9p5V+V49xAoGASsBgseef3VzPOBS9h7XA
0sbPk4nseko2LGXRjYsVBSZ7JDcQPImadICieXOysywxB6Elykj/UfqpbBJFkFo4
sH4c1rhZet/kt4ICtMg3kLkEYf5m733RfVvOjlvPLahKJ6+Sq6YIGYrTZ6Kg8lq7
OlYG/nE9F2PCt6rWWZXHZGs=
-----END PRIVATE KEY-----
KEY;

// OPTIONAL: sirf apni site se issue allow karo (casual abuse rokta hai)
$ALLOWED_ORIGINS = [
  // 'https://yoursite.com',
  // 'https://www.yoursite.com',
];
// ===================================================================

function origin_ok($allowed) {
  if (empty($allowed)) return true;
  $o = $_SERVER['HTTP_ORIGIN'] ?? '';
  if ($o === '' && isset($_SERVER['HTTP_REFERER'])) {
    $p = parse_url($_SERVER['HTTP_REFERER']);
    if ($p && isset($p['scheme'], $p['host'])) $o = $p['scheme'].'://'.$p['host'];
  }
  return in_array($o, $allowed, true);
}

if (($_GET['action'] ?? '') === 'issue') {
  if (!origin_ok($ALLOWED_ORIGINS)) { echo json_encode(['ok'=>false]); exit; }

  $campign = $_GET['utm_campign'] ?? '';
  if ($campign !== 'allcountry') {              // <-- tumhari condition
    echo json_encode(['ok'=>false]); exit;
  }

  $expires = time() + $DURATION;
  $payload = (string)$expires;

  $key = openssl_pkey_get_private($PRIVATE_KEY);
  $sig = '';
  openssl_sign($payload, $sig, $key, OPENSSL_ALGO_SHA256);

  $token = $payload . '.' . base64_encode($sig);
  echo json_encode(['ok'=>true, 'token'=>$token]);
  exit;
}

echo json_encode(['ok'=>false]);
