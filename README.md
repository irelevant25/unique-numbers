# unique-numbers

Kompaktný hárok na zaznamenávanie série čísel (0 – 36), ich transformovanej
hodnoty a toho, či táto hodnota bola medzi poslednými šiestimi unikátnymi.

Aplikácia je navrhnutá predovšetkým pre mobil a pre človeka, ktorý nie je
technický typ: všetko sa ukladá samo, každé tlačidlo má popis a nič sa nezmaže
bez opýtania.

## Spustenie

Stránku obsluhuje PHP (8.1+), takže ju otvárajte cez webový server, nie priamo
zo súborového systému:

```sh
php -S localhost:8000
```

Potom navštívte <http://localhost:8000/>. Funguje aj ľubovoľný Apache/nginx
hosting s PHP – stačí nasmerovať document root na tento priečinok. Rozšírenie
mbstring ani nastavené časové pásmo nie sú potrebné (bez nastavenia sa použije
Europe/Bratislava).

Aplikácia nemá prihlasovanie – kto pozná adresu, vidí aj maže všetky série. Na
verejnom hostingu ju preto dajte za heslo (napr. HTTP basic auth).

## Zadávanie čísel

- Číslo napíšte do prázdneho riadku a stlačte **Enter**. Na Androide je to
  kláves **Ďalej**, na iPhone šípka nadol nad klávesnicou (číselná klávesnica
  iPhonu Enter nemá) – číslo sa zapíše aj vtedy, keď z políčka odídete.
- Chybné číslo opravíte tak, že naň ťuknete a napíšete správne – pôvodné sa
  prepíše.
- Číslo mimo 0 – 36 (napr. 37) zostane v políčku na červeno, kým ho neopravíte,
  a do výpočtov sa nezapočíta.
- Prázdny riadok sa do výpočtov nezapočítava (nie je to nula).

## Ukladanie a načítanie

Série sa ukladajú ako jeden JSON súbor na sériu do priečinka `data/`, ktorý sa
vytvorí pri prvom uložení a je vylúčený z gitu. Netreba žiadnu databázu, stačí
aby mal webový server právo zapisovať do toho priečinka.

- **Všetko sa ukladá automaticky** – sekundu po každom čísle alebo zmene názvu.
  Tlačidlo vedľa názvu ukazuje stav (*Ukladám…*, *✓ Uložené*) a po ťuknutí
  uloží hneď (rovnako `Ctrl`/`Cmd`+`S`).
- Keď sa uložiť nedá (napr. bez internetu), tlačidlo ukáže *⚠ Neuložené*, čísla
  zostanú v prehliadači a aplikácia to skúša znova každých 10 sekúnd.
- Po otvorení aplikácie sa zobrazí séria, na ktorej sa pracovalo naposledy.
- **Nová séria** začne čistý hárok, doterajšia zostane uložená. Prázdna nová
  séria sa neukladá, kým do nej nenapíšete prvé číslo.
- **Otvoriť** zobrazí uložené série od najnovšej a umožní ich načítať alebo
  vymazať (s potvrdením).
- Názov série sa automaticky predvyplní aktuálnym dátumom a časom v slovenskom
  formáte (napr. `6. 9. 2026 19:01`). Kedykoľvek ho môžete prepísať.
- Načítaná séria má svoje ID v adrese (`index.php?s=…`), takže sa dá uložiť do
  záložiek alebo otvoriť priamo.

`api.php` poskytuje tie isté operácie ako JSON: `?action=list`,
`?action=load&id=…` a `POST ?action=save` / `?action=delete` (telo
`Content-Type: application/json`).

## Zvuk

Farebné dvojice sa reťazia – každá zdieľa posledné dve bunky s nasledujúcou.
Keď má ďalšia zafarbená skupina v stĺpci **rovnakú farbu** ako tá predchádzajúca,
aplikácia **pípne** a hore na obrazovke ukáže *Pozor: druhá dvojica rovnakej
farby za sebou.* Rátajú sa aj skupiny, medzi ktorými sú nezafarbené riadky – pri
náhodných číslach to vychádza zhruba raz za 11 čísel.

Pípne len pri novej dvojici, ktorá vznikla práve zadaným číslom. Načítanie
uloženej série ani pridanie náhodných čísel nepípajú, aj keď séria také dvojice
obsahuje.

V **Nastaveniach** sa dá zvuk vypnúť a nastaviť:

- **Dĺžka pípnutia** v milisekundách (100 – 5000, predvolene 800 ms),
- **Hlasitosť** (10 – 100 %, predvolene 100 %),
- **Tón**: *Jemný* alebo *Výrazný* (ostrejší, pri rovnakej hlasitosti znie
  hlasnejšie),
- **Vyskúšať zvuk**. Každá zmena sa hneď prehrá na ukážku.

Celkovú hlasitosť určuje telefón. Na novších iPhonoch pípne aj v tichom režime.
Nastavenia sa pamätajú pre daný prehliadač.

## Nastavenia

Okrem zvuku:

- **Väčšie písmo** – väčšie čísla aj políčka; hárok sa stále zmestí na šírku
  telefónu.
- **Pridať 25 náhodných čísel (na skúšku)** – pridá ich na koniec série, po
  potvrdení.
- **Vymazať všetky čísla** – vyprázdni aktuálnu sériu, po potvrdení.
- **Ako na to** – krátky návod.

## Tlač

**Tlačiť** (alebo `Ctrl`/`Cmd`+`P`) vykreslí veľmi hustý hárok A4: čísla tečú v
siedmich úzkych stĺpcoch ako v novinách, každý stĺpec má vlastnú hlavičku a na
jednu stranu sa zmestí **576 čísel** aj s výsledkami (predtým 41). Séria s 2000
číslami sa zmestí na 4 strany.

Hore je názov série, počet čísel, aktuálne *staré* a *nové* čísla a dátum, dole
číslo strany. Farby `+`/`−`, farby dvojíc aj rámčeky zostávajú zachované. Písmo
má 7 bodov – drobné, ale čitateľné.

## Testy

```sh
node --test                       # pravidlá výpočtu (logic.js)
php tests/storage-test.php        # ukladanie; skúste aj: php -n tests/storage-test.php
```

## Súbory

| Súbor | Účel |
| --- | --- |
| `index.php` | Stránka. Vykreslí panel, mriežku a dialógy, pri `?s=` predpripraví sériu. |
| `api.php` | JSON endpointy na výpis, načítanie, uloženie a mazanie sérií. |
| `lib/Storage.php` | Ukladanie sérií do súborov a validácia názvov a čísel. |
| `logic.js` | Pravidlá výpočtu (T, +/−, dvojice, farby, pípnutie) – bez závislosti na stránke. |
| `index.js` | Stránka: riadky, automatické ukladanie, nastavenia, zvuk, tlač. |
| `style.css` | Štýly pre obrazovku (mobile first) a pre tlač. |
| `tests/` | Testy pravidiel a ukladania. |
| `data/` | Uložené série (mimo gitu). |
