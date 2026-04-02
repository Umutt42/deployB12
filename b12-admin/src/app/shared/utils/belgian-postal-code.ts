/**
 * Retourne la province belge correspondant à un code postal (4 chiffres).
 * Retourne null si le code postal est invalide ou hors Belgique.
 */
export function getProvinceFromPostalCode(cp: string): string | null {
  const code = parseInt((cp ?? '').trim(), 10);
  if (isNaN(code) || code < 1000 || code > 9999) return null;

  if (code >= 1000 && code <= 1299) return 'Bruxelles-Capitale';
  if (code >= 1300 && code <= 1499) return 'Brabant wallon';
  if (code >= 1500 && code <= 1999) return 'Brabant flamand';
  if (code >= 2000 && code <= 2999) return 'Anvers';
  if (code >= 3000 && code <= 3499) return 'Brabant flamand';
  if (code >= 3500 && code <= 3999) return 'Limbourg';
  if (code >= 4000 && code <= 4999) return 'Liège';
  if (code >= 5000 && code <= 5999) return 'Namur';
  if (code >= 6000 && code <= 6599) return 'Hainaut';
  if (code >= 6600 && code <= 6999) return 'Luxembourg';
  if (code >= 7000 && code <= 7999) return 'Hainaut';
  if (code >= 8000 && code <= 8999) return 'Flandre-Occidentale';
  if (code >= 9000 && code <= 9999) return 'Flandre-Orientale';

  return null;
}
