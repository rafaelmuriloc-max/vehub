#!/usr/bin/env -S deno run --allow-read --allow-net

/**
 * Script de diagnóstico: testa conexão mTLS com SEFIN Nacional
 * 
 * Uso:
 *   deno run --allow-read --allow-net test-sefin-connection.ts <caminho-pfx> <senha>
 * 
 * Exemplo:
 *   deno run --allow-read --allow-net test-sefin-connection.ts ./certificado.pfx "minhaSenha"
 * 
 * O script tenta:
 *   1. Parsear o certificado PFX (A1)
 *   2. Conectar via TLS em sefin.nfse.gov.br:443 (produção)
 *   3. Conectar via TLS em sefin.producaorestrita.nfse.gov.br:443 (homologação)
 *   4. Reportar sucesso/falha de cada tentativa
 */

// @deno-types="npm:@types/node-forge"
import forge from "npm:node-forge@1.3.1";

const TARGETS = [
  { label: "Produção", host: "sefin.nfse.gov.br" },
  { label: "Homologação", host: "sefin.producaorestrita.nfse.gov.br" },
  { label: "ADN (referência)", host: "adn.nfse.gov.br" },
];

// ── PFX parsing ──────────────────────────────────────────────

function parsePfx(pfxBytes: Uint8Array, password: string): { certPem: string; keyPem: string } {
  const pfxB64 = btoa(String.fromCharCode(...pfxBytes));
  const pfxDer = forge.util.decode64(pfxB64);
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);

  // Extract private key
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [])[0];
  if (!keyBag?.key) throw new Error("Chave privada não encontrada no PFX");
  const keyPem = forge.pki.privateKeyToPem(keyBag.key);

  // Extract leaf certificate (shortest validity = end-entity)
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certs = (certBags[forge.pki.oids.certBag] ?? [])
    .filter((b: any) => b.cert)
    .map((b: any) => b.cert!);
  if (certs.length === 0) throw new Error("Nenhum certificado encontrado no PFX");

  certs.sort((a: any, b: any) =>
    (a.validity.notAfter.getTime() - a.validity.notBefore.getTime()) -
    (b.validity.notAfter.getTime() - b.validity.notBefore.getTime())
  );

  const allPems = certs.map((c: any) => forge.pki.certificateToPem(c));
  const certPem = allPems.join("\n");

  console.log(`📜 Certificado CN: ${certs[0].subject.getField("CN")?.value}`);
  console.log(`📜 Validade: ${certs[0].validity.notBefore.toISOString()} → ${certs[0].validity.notAfter.toISOString()}`);
  console.log(`📜 Total certificados na cadeia: ${certs.length}`);

  return { certPem, keyPem };
}

// ── Connection test ──────────────────────────────────────────

async function testConnection(
  host: string,
  label: string,
  certPem: string,
  keyPem: string,
): Promise<void> {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🔌 Testando: ${label} (${host}:443)`);
  console.log(`${"═".repeat(60)}`);

  // Step 1: TCP
  let tcpConn: Deno.TcpConn;
  try {
    tcpConn = await Deno.connect({ hostname: host, port: 443 });
    console.log(`  ✅ TCP conectado`);
  } catch (e: any) {
    console.log(`  ❌ TCP falhou: ${e.message}`);
    return;
  }

  // Step 2: TLS with client certificate
  try {
    const tlsConn = await Deno.startTls(tcpConn, {
      hostname: host,
      cert: certPem,
      key: keyPem,
    });
    console.log(`  ✅ TLS handshake mTLS OK`);

    // Step 3: Send a minimal HTTP request
    const request = [
      `GET /SefinNacional HTTP/1.1`,
      `Host: ${host}`,
      `Connection: close`,
      `User-Agent: NFSe-Diagnostic/1.0`,
      ``,
      ``,
    ].join("\r\n");

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    await tlsConn.write(encoder.encode(request));
    console.log(`  ✅ HTTP GET enviado`);

    const buf = new Uint8Array(4096);
    const n = await tlsConn.read(buf);
    if (n) {
      const response = decoder.decode(buf.subarray(0, n));
      const firstLine = response.split("\r\n")[0];
      console.log(`  ✅ Resposta: ${firstLine}`);
    } else {
      console.log(`  ⚠️ Conexão fechada sem resposta`);
    }

    tlsConn.close();
  } catch (e: any) {
    console.log(`  ❌ TLS/HTTP falhou: ${e.message}`);
    // Try without client cert
    try {
      const tcpConn2 = await Deno.connect({ hostname: host, port: 443 });
      const tlsConn2 = await Deno.startTls(tcpConn2, { hostname: host });
      console.log(`  ℹ️  TLS sem certificado cliente: OK (servidor não exige mTLS no handshake)`);
      tlsConn2.close();
    } catch (e2: any) {
      console.log(`  ℹ️  TLS sem certificado cliente também falhou: ${e2.message}`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const args = Deno.args;
  if (args.length < 2) {
    console.log("Uso: deno run --allow-read --allow-net test-sefin-connection.ts <pfx-path> <password>");
    console.log("Exemplo: deno run --allow-read --allow-net test-sefin-connection.ts ./cert.pfx 'senha123'");
    Deno.exit(1);
  }

  const [pfxPath, password] = args;

  console.log("🔐 Carregando certificado PFX...");
  const pfxBytes = await Deno.readFile(pfxPath);
  const { certPem, keyPem } = parsePfx(pfxBytes, password);
  console.log("✅ Certificado parseado com sucesso\n");

  for (const target of TARGETS) {
    await testConnection(target.host, target.label, certPem, keyPem);
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log("📊 Diagnóstico completo.");
  console.log("Se Produção/Homologação falharam aqui, o problema NÃO é o Supabase.");
  console.log("Se funcionaram aqui mas falham no Supabase, confirma bloqueio de IP cloud.");
  console.log(`${"═".repeat(60)}`);
}

main().catch((e) => {
  console.error("Erro fatal:", e.message);
  Deno.exit(1);
});
