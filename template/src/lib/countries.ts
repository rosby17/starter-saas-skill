// Drapeau d'un pays saisi librement (« Cameroun », « CM », « Côte d’Ivoire »…) : emoji drapeau, ou rien si inconnu.
const NAMES: Record<string, string> = {
  cameroun: 'CM', cameroon: 'CM', gabon: 'GA', congo: 'CG', 'congo brazzaville': 'CG', 'rd congo': 'CD', rdc: 'CD', 'republique democratique du congo': 'CD',
  tchad: 'TD', centrafrique: 'CF', 'republique centrafricaine': 'CF', 'guinee equatoriale': 'GQ', senegal: 'SN', 'cote d ivoire': 'CI', 'cote divoire': 'CI',
  mali: 'ML', 'burkina faso': 'BF', burkina: 'BF', niger: 'NE', togo: 'TG', benin: 'BJ', guinee: 'GN', 'guinee bissau': 'GW', mauritanie: 'MR',
  madagascar: 'MG', comores: 'KM', burundi: 'BI', rwanda: 'RW', djibouti: 'DJ', maroc: 'MA', algerie: 'DZ', tunisie: 'TN', egypte: 'EG',
  nigeria: 'NG', ghana: 'GH', kenya: 'KE', 'afrique du sud': 'ZA', ethiopie: 'ET', tanzanie: 'TZ', ouganda: 'UG', angola: 'AO', 'cap vert': 'CV',
  france: 'FR', belgique: 'BE', suisse: 'CH', luxembourg: 'LU', allemagne: 'DE', espagne: 'ES', italie: 'IT', portugal: 'PT', 'royaume uni': 'GB',
  angleterre: 'GB', 'pays bas': 'NL', canada: 'CA', 'etats unis': 'US', usa: 'US', haiti: 'HT', bresil: 'BR', mexique: 'MX', chine: 'CN', inde: 'IN',
  'emirats arabes unis': 'AE', dubai: 'AE', turquie: 'TR', russie: 'RU', japon: 'JP',
}

export function countryCode(country: string | null | undefined): string | null {
  if (!country) return null
  const raw = country.trim()
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase()
  const key = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim()
  return NAMES[key] ?? null
}

export function flagOf(country: string | null | undefined): string {
  const cc = countryCode(country)
  return cc ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : ''
}
