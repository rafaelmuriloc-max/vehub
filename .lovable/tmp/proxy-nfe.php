<?php
/**
 * Proxy NF-e para SEF-SC
 * 
 * Deploy este arquivo na Hostinger (ou outro hosting PHP).
 * Ele recebe a requisição SOAP + certificado PEM da edge function
 * e encaminha via cURL com mTLS para a SEF-SC.
 * 
 * Secrets necessários (definir no topo ou via env):
 * - PROXY_TOKEN: token de autenticação compartilhado com a edge function
 */

// ===== CONFIGURAÇÃO =====
define('PROXY_TOKEN', getenv('PROXY_TOKEN') ?: 'TROCAR_PELO_SEU_TOKEN_SEGURO');
define('MAX_BODY_SIZE', 5 * 1024 * 1024); // 5MB

// ===== CORS + Preflight =====
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: X-Proxy-Token, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ===== Validar Token =====
$token = $_SERVER['HTTP_X_PROXY_TOKEN'] ?? '';
if ($token !== PROXY_TOKEN) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid proxy token']);
    exit;
}

// ===== Ler Body =====
$rawBody = file_get_contents('php://input');
if (strlen($rawBody) > MAX_BODY_SIZE) {
    http_response_code(413);
    echo json_encode(['error' => 'Payload too large']);
    exit;
}

$data = json_decode($rawBody, true);
if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);
    exit;
}

$soapBody   = $data['soap_body']   ?? null;
$certPem    = $data['cert_pem']    ?? null;
$keyPem     = $data['key_pem']     ?? null;
$targetUrl  = $data['url']         ?? null;
$soapAction = $data['soap_action'] ?? null;
$contentType = $data['content_type'] ?? null;

if (!$soapBody || !$certPem || !$keyPem || !$targetUrl) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: soap_body, cert_pem, key_pem, url']);
    exit;
}

// ===== Escrever PEM em arquivos temporários =====
$certFile = tempnam(sys_get_temp_dir(), 'nfe_cert_');
$keyFile  = tempnam(sys_get_temp_dir(), 'nfe_key_');

try {
    file_put_contents($certFile, $certPem);
    file_put_contents($keyFile, $keyPem);

    // ===== cURL com mTLS =====
    $ch = curl_init();

    $ctHeader = $contentType ?: 'text/xml; charset=utf-8';
    $headers = [
        'Content-Type: ' . $ctHeader,
        'Accept: application/soap+xml, text/xml, application/xml, */*',
        'User-Agent: VeHub-NFe-Proxy/1.0',
    ];
    // SOAP 1.2 carries action in Content-Type; do not duplicate as SOAPAction header.
    $isSoap12 = stripos($ctHeader, 'application/soap+xml') !== false;
    if ($soapAction && !$isSoap12) {
        $headers[] = 'SOAPAction: "' . $soapAction . '"';
    }

    curl_setopt_array($ch, [
        CURLOPT_URL            => $targetUrl,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $soapBody,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_CONNECTTIMEOUT => 30,
        CURLOPT_SSLCERT        => $certFile,
        CURLOPT_SSLKEY         => $keyFile,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HTTP_VERSION   => CURL_HTTP_VERSION_1_1,
        CURLOPT_HEADER         => true,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error    = curl_error($ch);
    $errno    = curl_errno($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    if ($errno) {
        http_response_code(502);
        echo json_encode([
            'error'      => 'cURL error: ' . $error,
            'curl_errno' => $errno,
            'success'    => false,
        ]);
        exit;
    }

    $responseHeaders = substr($response, 0, $headerSize);
    $responseBody    = substr($response, $headerSize);

    echo json_encode([
        'status'  => $httpCode,
        'body'    => $responseBody,
        'headers' => $responseHeaders,
        'success' => true,
    ]);

} finally {
    // ===== Limpar arquivos temporários =====
    @unlink($certFile);
    @unlink($keyFile);
}
