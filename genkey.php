<?php
/**
 * genkey.php  —  EK BAAR chalao, phir DELETE kar do.
 * Tumhare server pe hi naya RSA keypair banata hai (chat mein kabhi nahi gaya).
 * Browser mein kholo:  https://yoursite.com/genkey.php
 */
header('Content-Type: text/plain; charset=utf-8');

if (!function_exists('openssl_pkey_new')) {
  echo "ERROR: PHP openssl extension OFF hai. Hosting support se on karwao.";
  exit;
}

$res = openssl_pkey_new([
  'private_key_bits' => 2048,
  'private_key_type' => OPENSSL_KEYTYPE_RSA,
]);
openssl_pkey_export($res, $privPem);
$details = openssl_pkey_get_details($res);
$pubB64 = str_replace(
  ["-----BEGIN PUBLIC KEY-----","-----END PUBLIC KEY-----","\r","\n"],
  "", $details['key']
);

echo "================ STEP A ================\n";
echo "Neeche wali poori PRIVATE KEY copy karke session.php ke andar\n";
echo "\$PRIVATE_KEY = <<<'KEY'  ...  KEY;  ke beech paste karo:\n\n";
echo $privPem . "\n";
echo "================ STEP B ================\n";
echo "Ye ek line PUBLIC key index.html ke PUB_SPKI_B64 = \"...\" mein paste karo:\n\n";
echo $pubB64 . "\n\n";
echo "================ STEP C ================\n";
echo "Ho gaya? Ab is genkey.php file ko server se DELETE kar do.\n";
