# unique-numbers

Kompaktný hárok na zaznamenávanie série čísel (0 – 36), ich transformovanej
hodnoty a toho, či táto hodnota bola medzi poslednými šiestimi unikátnymi.

Aplikácia je navrhnutá predovšetkým pre mobil.

## Spustenie

Stránku obsluhuje PHP (8.1+), takže ju otvárajte cez webový server, nie priamo
zo súborového systému:

```sh
php -S localhost:8000
```

Potom navštívte <http://localhost:8000/>. Funguje aj ľubovoľný Apache/nginx
hosting s PHP – stačí nasmerovať document root na tento priečinok.

## Ukladanie a načítanie

Série sa ukladajú ako jeden JSON súbor na sériu do priečinka `data/`, ktorý sa
vytvorí pri prvom uložení a je vylúčený z gitu. Netreba žiadnu databázu, stačí
aby mal webový server právo zapisovať do toho priečinka.

- Názov série sa automaticky predvyplní aktuálnym dátumom a časom v slovenskom
  formáte (napr. `6. 9. 2026 19:01`). Kedykoľvek ho môžete prepísať; ak ho
  necháte prázdny, server doplní ten istý tvar.
- **Uložiť** (alebo `Ctrl`/`Cmd`+`S`) uloží aktuálne čísla pod názvom z panela.
  Ďalšie uloženie prepíše tú istú sériu, nevytvorí kópiu.
- **Otvoriť** zobrazí uložené série od najnovšej a umožní ich načítať alebo
  vymazať. Nájdete tam aj tlačidlo **Nová séria**.
- **Generovať** pridá ďalších 25 náhodných čísel *pod* existujúce – nič nemaže.
- **Vyčistiť** vymaže všetky čísla (s potvrdením) a ponechá názov série.
- Načítaná séria má svoje ID v adrese (`index.php?s=…`), takže sa dá uložiť do
  záložiek alebo otvoriť priamo.
- Neuložená práca sa priebežne odkladá do local storage prehliadača, takže sa
  po obnovení stránky nestratí.

`api.php` poskytuje tie isté operácie ako JSON: `?action=list`,
`?action=load&id=…` a `POST ?action=save` / `?action=delete`.

## Tlač

**Tlačiť** (alebo `Ctrl`/`Cmd`+`P`) vykreslí čistý hárok A4: panel s tlačidlami
sa skryje, z políčok sa stane obyčajný text, hore je názov série a dátum, a
farby `+`/`−` aj rámčeky dvojíc zostávajú zachované. Dlhšie zoznamy pokračujú na
ďalších stranách so zopakovanou hlavičkou. Na jednu stranu A4 sa zmestí
približne 40 riadkov.

## Zvuk

Farebné dvojice sa reťazia – každá zdieľa posledné dve bunky s nasledujúcou.
Keď sa hneď za dvojicou objaví ďalšia **rovnakej farby**, vznikne dlhší
súvislý pás a aplikácia **pípne**.

Pípne len pri novej dvojici, ktorá vznikla práve zadaným číslom. Načítanie
uloženej série ani tlačidlo Generovať nepípajú, aj keď séria také dvojice
obsahuje. Tlačidlo `♪` zvuk vypína a zapína; voľba sa pamätá pre daný
prehliadač.

## Rozloženie

Tlačidlo `↕` prepína medzi predvolenými kompaktnými riadkami a redšími; voľba sa
pamätá pre daný prehliadač.

## Súbory

| Súbor | Účel |
| --- | --- |
| `index.php` | Stránka. Vykreslí panel a mriežku, pri `?s=` predpripraví sériu. |
| `api.php` | JSON endpointy na výpis, načítanie, uloženie a mazanie sérií. |
| `lib/Storage.php` | Ukladanie sérií do súborov a validácia názvov a čísel. |
| `index.js` | Logika čísel a klient na ukladanie, načítanie a tlač. |
| `style.css` | Štýly pre obrazovku (mobile first) a pre tlač. |
| `data/` | Uložené série (mimo gitu). |
