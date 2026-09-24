import forge from "https://esm.sh/node-forge@1.3.1";

export type ParsedPfx = {
  certPem: string; // leaf certificate only
  chainPem: string; // leaf + remaining certificates
  keyPem: string;
  privateKey: any;
};

type Bag = { attributes?: any; cert?: any; key?: any };

/**
 * Parses a PKCS#12 file and returns the certificate that belongs to the private key.
 * Match order: localKeyId of the key bag -> certificate whose public key modulus matches the key.
 */
export function parsePfx(pfxBytes: Uint8Array, password: string): ParsedPfx {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < pfxBytes.length; i += chunkSize) {
    binary += String.fromCharCode(...pfxBytes.subarray(i, i + chunkSize));
  }
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(binary), password);

  const shrouded = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []) as Bag[];
  const plain = (p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []) as Bag[];
  const keyBag = [...shrouded, ...plain].find((b) => b?.key);
  if (!keyBag?.key) throw new Error("Chave privada não encontrada no certificado");
  const privateKey = keyBag.key;
  const keyPem = forge.pki.privateKeyToPem(privateKey);
  const keyId = normalizeLocalKeyId(keyBag.attributes?.localKeyId?.[0]);

  const certs = ((p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []) as Bag[])
    .filter((b) => b?.cert);
  if (certs.length === 0) throw new Error("Certificado não encontrado no PFX");

  const keyModulus = privateKey?.n?.toString(16);
  const leaf = certs.find((c) => keyId && normalizeLocalKeyId(c.attributes?.localKeyId?.[0]) === keyId)
    || certs.find((c) => keyModulus && c.cert.publicKey?.n?.toString(16) === keyModulus);
  if (!leaf) throw new Error("Nenhum certificado do PFX corresponde à chave privada");

  const certPem = forge.pki.certificateToPem(leaf.cert).trim();
  const chainPem = [certPem, ...certs.filter((c) => c !== leaf).map((c) => forge.pki.certificateToPem(c.cert).trim())].join("\n");
  return { certPem, chainPem, keyPem, privateKey };
}

function normalizeLocalKeyId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return forge.util.bytesToHex(value);
  if (value instanceof Uint8Array) return Array.from(value).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (Array.isArray(value)) return value.map((b) => Number(b).toString(16).padStart(2, "0")).join("");
  return null;
}
