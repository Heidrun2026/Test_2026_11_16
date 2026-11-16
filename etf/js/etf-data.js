// Vorauswahl: 10 breit gestreute, sparplanfähige UCITS-ETFs (nur ETFs – andere Anlagen sind ausgeschlossen).
// Stammdaten (Name, ISIN, Index) nach Wissensstand – vor einer Anlage im Basisinformationsblatt prüfen.
// Bewusst KEINE Kurs- oder Renditewerte: Diese ändern sich täglich und werden aus kostenlosen Quellen eingetragen.

export const ETFS = [
  { isin: 'IE00BK5BQT80', name: 'Vanguard FTSE All-World UCITS ETF (Acc)', index: 'FTSE All-World', klasse: 'Aktien', region: 'Welt inkl. Schwellenländer', anbieter: 'Vanguard' },
  { isin: 'IE00B4L5Y983', name: 'iShares Core MSCI World UCITS ETF (Acc)', index: 'MSCI World', klasse: 'Aktien', region: 'Welt (Industrieländer)', anbieter: 'iShares' },
  { isin: 'IE00BJ0KDQ92', name: 'Xtrackers MSCI World UCITS ETF 1C', index: 'MSCI World', klasse: 'Aktien', region: 'Welt (Industrieländer)', anbieter: 'Xtrackers' },
  { isin: 'IE00B3YLTY66', name: 'SPDR MSCI ACWI IMI UCITS ETF', index: 'MSCI ACWI IMI', klasse: 'Aktien', region: 'Welt inkl. Nebenwerte', anbieter: 'SPDR' },
  { isin: 'IE00BKM4GZ66', name: 'iShares Core MSCI EM IMI UCITS ETF (Acc)', index: 'MSCI Emerging Markets IMI', klasse: 'Aktien', region: 'Schwellenländer', anbieter: 'iShares' },
  { isin: 'IE00B5BMR087', name: 'iShares Core S&P 500 UCITS ETF (Acc)', index: 'S&P 500', klasse: 'Aktien', region: 'USA', anbieter: 'iShares' },
  { isin: 'IE00B4K48X80', name: 'iShares Core MSCI Europe UCITS ETF (Acc)', index: 'MSCI Europe', klasse: 'Aktien', region: 'Europa', anbieter: 'iShares' },
  { isin: 'IE00BMVB5R75', name: 'Vanguard LifeStrategy 60% Equity UCITS ETF (Acc)', index: 'Mischung 60 % Aktien / 40 % Anleihen', klasse: 'Gemischt', region: 'Welt', anbieter: 'Vanguard' },
  { isin: 'IE00BDBRDM35', name: 'iShares Core Global Aggregate Bond UCITS ETF EUR Hedged (Acc)', index: 'Bloomberg Global Aggregate (EUR-gesichert)', klasse: 'Anleihen', region: 'Welt', anbieter: 'iShares' },
  { isin: 'LU0290355717', name: 'Xtrackers II Eurozone Government Bond UCITS ETF 1C', index: 'iBoxx EUR Sovereigns Eurozone', klasse: 'Anleihen', region: 'Eurozone (Staatsanleihen)', anbieter: 'Xtrackers' },
];

/** Kostenlose Quellen je ETF (öffnen im neuen Tab, es werden keine Daten aus der App übertragen). */
export function quellen(isin) {
  const i = encodeURIComponent(isin);
  return [
    { titel: 'justETF', url: `https://www.justetf.com/de/etf-profile.html?isin=${i}` },
    { titel: 'extraETF', url: `https://extraetf.com/de/etf-profile/${i}` },
  ];
}
