# Tourpool

Monorepo met npm workspaces:

| Map | Workspace | Inhoud |
| --- | --- | --- |
| `apps/api` | `@tourpool/api` | REST-API (Node.js, Express, TypeScript, MariaDB), migraties en tests |
| `apps/admin` | `@tourpool/admin` | Beheermodule (Vue 3, Vite, Tailwind) |
| `apps/user` | `@tourpool/user` | Deelnemersapp met registratie, eigen tourploegen en PDF |
| `packages/client` | `@tourpool/client` | Gedeelde sessieclient en accountformulieren |

Beide Vue-apps gebruiken Tailwind CSS 4 via de Vite-plugin. De deelnemersapp
en de gedeelde inlog-/profielcomponenten gebruiken utilities in hun templates,
zonder eigen CSS-regels. De deelnemersapp laadt ook Tailwinds Preflight-reset.
De gedeelde clientcomponenten zijn in beide apps expliciet opgenomen in de
Tailwind-bronscan.

## Accounts en autorisatie

In de adminmodule opent **Tours** voor de geselecteerde tour een modal voor
**Deelnemende tourploegen** (deelname en volgorde) en een voor **Touretappes**
(etappes en rustdagen toevoegen/bewerken). Het menu **Uitslagen** blijft op
`/stages` en is bedoeld voor daguitslagen en klassementstruien; etappebeheer
staat uitsluitend bij Tours.
Etappelijsten worden vanaf 1024 pixels beschikbare breedte over twee kolommen
verdeeld, eerst van boven naar beneden links en daarna rechts. Bij minder ruimte
blijft de lijst in een kolom.
In de actiekolom van Touretappes kun je een etappe of rustdag verwijderen na
bevestiging. De API blokkeert het verwijderen van etappes met uitslagen of
deelnemerspunten; bestaande resultaten blijven behouden.
De etappe-API geeft datums terug als `YYYY-MM-DD`, zonder tijdzone, zodat het
openen en opslaan van een etappe of rustdag de kalenderdatum niet verschuift.

### Zichtbaarheid van pools

Voer op bestaande databases ook
`apps/api/migrations/20261008_add_pool_visibility.sql` uit voordat je de nieuwe
API gebruikt. Bestaande en nieuwe pools zijn standaard zichtbaar.
In **Pools beheren** kun je de zichtbaarheid direct omschakelen of instellen
bij het aanmaken/bewerken van een pool.
Een onzichtbare pool verdwijnt volledig uit de deelnemersapp: ook bestaande
inschrijvingen, renners en PDF's zijn via de user-API niet toegankelijk.
Admins houden toegang en alle gegevens blijven bewaard. Zodra je de pool
weer zichtbaar maakt, zijn de bestaande inschrijvingen opnieuw toegankelijk;
de normale inschrijfperiode blijft bepalen of wijzigingen zijn toegestaan.

### Accountregistratie

Voer op bestaande databases achtereenvolgens de migraties
`20261007_add_accounts.sql`, `20261008_add_account_usernames.sql` en
`20261009_add_email_verification.sql` uit. Deze voegen accounts, sessies,
gebruikersnamen en e-mailverificatie toe; bestaande accounts blijven bevestigd.
Nieuwe databases bevatten deze structuur via `tourpool.sql`.

Gebruikers registreren zichzelf met een unieke gebruikersnaam (3-32 letters,
cijfers, punten, koppeltekens of underscores), naam, e-mailadres en een
wachtwoord van minimaal 12 tekens. Inloggen kan met de gebruikersnaam of het
e-mailadres. Woonplaats en telefoon zijn optioneel. Nieuwe accounts moeten
eerst hun e-mailadres bevestigen via een link die 24 uur geldig is. De registratie
stuurt daarnaast een melding naar `CONTACT_RECEIVER`; bestaande accounts blijven
bevestigd na de migratie. Registratie is met een honeypotveld en rate limits
tegen geautomatiseerde aanmeldingen beschermd. Onbevestigde accounts kunnen
niet inloggen en verschijnen niet in de admin-accountkeuze. Registratie maakt
altijd een **user** aan, met een nieuw adres. Bestaande adressen/inschrijvingen
worden niet automatisch op e-mailadres gekoppeld: dat zou eigendom toekennen
zonder controle. Bestaande inschrijvingen blijven door de admin beheerd.

Configureer voor e-mail `CONTACT_RECEIVER`, `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, optioneel `SMTP_FROM`, en
`PUBLIC_API_URL` in `apps/api/.env` (zie `.env.example`). De publieke API-URL
moet eindigen op `/api`; verificatielinks gebruiken dit adres. SMTP-poort 465
gebruikt `SMTP_SECURE=true`, poort 587 doorgaans `false`. Bewaar SMTP-gegevens
alleen in de serveromgeving en commit ze nooit naar Git.

Op piweb staan de gedeelde SMTP-instellingen, `DB_HOST` en `DB_PORT` in
`/home/jeroen/config/shared.env`. Jota Tours, Golf, Tourpool en Laurierboom laden
dit bestand bij het starten via de Node-preloader `/home/jeroen/config/load-shared.cjs`;
deze leidt ook het oudere `SMTP_PASS` af van `SMTP_PASSWORD`.
De Dynamic DNS-melder gebruikt een symlink naar hetzelfde bestand.
Het oude `smtp.env` is een compatibiliteitslink; `load-smtp.cjs` verwijst naar de nieuwe loader.
Bewaar de gedeelde instellingen daar, niet meer in de afzonderlijke server-`.env`-bestanden.
Deze bestanden bevatten een comment met de locatie en de laadwijze.
`CONTACT_RECEIVER`, `PUBLIC_API_URL`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` en
accountinstellingen blijven per app.
Al ingestelde procesvariabelen hebben voorrang op het centrale bestand.
De configuratiemap heeft rechten `700`, het gedeelde bestand `600`.
Na een wijziging: `pm2 restart jota-api gts-api tourpool-api laurierboom-api`.
De Dynamic DNS-melder leest de instellingen bij elke uitvoering opnieuw.
Het deployscript behoudt de preloader bij het starten/herstarten van Tourpool.
Dit vereist Node.js 20.12 of nieuwer. Lokale ontwikkeling blijft `apps/api/.env` gebruiken.

De admin kan een bestaande inschrijving handmatig koppelen via
**Pools > Deelnemers > Bewerken > Koppelen aan gebruikersaccount**.
Kies het reeds geregistreerde account en bevestig **Account koppelen**.
Alleen die inschrijving krijgt het adres-ID van het gekozen account; andere
inschrijvingen en het oude adres blijven behouden. Renners, ploegnaam, punten
en betaalstatus veranderen niet. Persoonsgegevens op de inschrijving/PDF
komen voortaan uit het gekozen account. Het oude account verliest toegang
als een inschrijving opnieuw wordt gekoppeld. Een dubbele ploegnaam binnen
dezelfde pool/account wordt geweigerd: pas dan eerst de ploegnaam aan.
Koppelen staat los van **Opslaan** van ploegnaam/betaling; sla die wijzigingen
zo nodig eerst op. Er worden nooit wachtwoorden in het accountoverzicht getoond.
De adminroutes hiervoor zijn `GET /api/accounts` en
`PUT /api/participants/:deelnID/account` met `accountID` en `expectedAdrID`;
die laatste voorkomt koppelen op basis van een verouderd overzicht.

Maak de eerste admin vanuit `apps/api` aan (na de migratie):

```sh
read -rp "Admin e-mail: " ADMIN_EMAIL
read -rsp "Admin wachtwoord (minimaal 12 tekens): " ADMIN_PASSWORD; echo
export ADMIN_EMAIL ADMIN_PASSWORD
npm run create-admin
unset ADMIN_EMAIL ADMIN_PASSWORD
```

Voor beheerders wordt het e-mailadres ook als gebruikersnaam ingesteld.
In productie kan dit zonder ontwikkeldependencies met
`node dist/scripts/createAdmin.js`. Het script overschrijft geen bestaande accounts.
Er is geen standaardwachtwoord of publieke route om admin te worden.
Wachtwoorden worden met scrypt en een willekeurige salt opgeslagen. Sessies
duren 12 uur en gebruiken een HttpOnly-cookie (Secure in productie), met een
CSRF-token voor mutaties. Log opnieuw in als de sessie is verlopen.

De bestaande beheer-API is uitsluitend voor admins: ook reads van adressen,
deelnemers en renners. De deelnemersapp gebruikt `/api/me/*`; elke opstelling
en PDF is server-side beperkt tot het adres van de ingelogde gebruiker.
Users kunnen meerdere ploegen per pool en in meerdere pools opslaan.
Elke ploeg heeft binnen die gebruiker/pool een eigen ploegnaam.
De inschrijving opent op `StartInschr` om 00:00 (of direct wanneer deze ontbreekt)
en loopt **tot en met `EindInschr`**: sluiten gebeurt om 00:00 op de volgende dag.
De tourstart om **00:00 uur Europe/Amsterdam** blijft de uiterste grens, ook
wanneer de einddatum later ligt. Zonder tourstartdatum zijn wijzigingen niet toegestaan.
Admins behouden hun bestaande beheermogelijkheden, ook na de sluitingsdatum.
De admin stelt de inschrijfperiode in bij het toevoegen/bewerken van een pool;
deze velden bevatten alleen een datum, zonder tijd of browser-tijdzoneconversie.
De periode staat ook in het admin- en deelnemersoverzicht. De API accepteert
`YYYY-MM-DD`, slaat dat op als middernacht in de bestaande DATETIME-kolommen
en geeft alleen de datum terug. Oude tijdwaarden worden als kalenderdatum behandeld;
er is geen databasemigratie nodig. Een einddatum voor de begindatum wordt geweigerd.

Een ploeg mag als concept worden opgeslagen. Voor een PDF is het ingestelde
aantal renners inclusief reserves vereist. De volgorde bepaalt basisrenners
en reserves. De PDF bevat de opgeslagen ploeg, inschrijvingsnummer, naam,
ploegnaam, e-mailadres, eventuele woonplaats/telefoon en inleg/betaalstatus.
De PDF blijft na sluiting beschikbaar. De gebruiker levert deze in en betaalt
bij de organisatie; de admin gebruikt het bestaande betaalveld bij
**Pools > Deelnemers** om `Betaald` op true te zetten. Users kunnen dit veld
niet wijzigen, ook niet via een handmatig API-verzoek.
In het ploegformulier slaat **Opslaan en PDF downloaden** eerst de ploeg op
en downloadt daarna het afdrukbare formulier. Bij een downloadfout blijft het
formulier open en is de ploeg wel opgeslagen; opnieuw opslaan werkt diezelfde
inschrijving bij. Opslagfouten staan bij de knoppen. Na succesvol opslaan
kan de gebruiker vanuit het pooloverzicht nog een ploeg invullen, in dezelfde
of een andere pool. Een deelnemer maakt daarmee een inschrijving aan, geen
nieuwe poolcompetitie; dat laatste blijft een adminfunctie.
Bij **Mijn tourploegen** kiest de gebruiker een opgeslagen ploeg in een dropdown
met ploegnaam, poolnaam en inschrijvingsnummer. **Bekijken / wijzigen** opent
die ploeg; **PDF downloaden** gebruikt dezelfde selectie. Na opslaan blijft
de zojuist opgeslagen ploeg geselecteerd. Gesloten pools blijven alleen-lezen.

Authenticatie-endpoints: `POST /api/auth/register`, `POST /api/auth/login`,
`GET /api/auth/session`, `POST /api/auth/logout`.
Deelnemers-endpoints: `GET/PUT /api/me/profile`, `GET /api/me/pools`,
`GET /api/me/pools/:poolID/riders`, `GET/POST /api/me/entries`,
`GET/PUT /api/me/entries/:deelnID`, `GET /api/me/entries/:deelnID/pdf`.
Mutaties na het inloggen vereisen `X-CSRF-Token` uit de sessieresponse.
Inloggen/registreren is begrensd op 20 pogingen per IP per 15 minuten
(per API-proces). E-mailverificatie en wachtwoordherstel zijn nog niet aanwezig.

De autorisatietests draaien standaard zonder databasewijzigingen. De optionele
MariaDB-integratietest maakt een willekeurig benoemd, leeg testschema aan,
kopieert alleen tabeldefinities (geen bestaande gegevens) en verwijdert dat
schema na afloop. De databasegebruiker moet schema's mogen aanmaken/verwijderen:

```sh
TOURPOOL_DB_TEST=1 node --import tsx --test apps/api/tests/authDatabase.test.mjs
```

## Ontwikkelen

Installeer alle afhankelijkheden eenmalig vanuit de hoofdmap:

```sh
npm install
```

Start daarna in aparte terminals:

```sh
npm run dev:api     # API op http://localhost:3000
npm run dev:admin   # admin op http://localhost:5173 (proxy /api -> :3000)
npm run dev:user    # deelnemers op http://localhost:5174 (proxy /api -> :3000)
```

Overige scripts vanuit de hoofdmap:

```sh
npm run build        # bouwt alle apps (apps/*/dist)
npm run build:api
npm run build:admin
npm run build:user
npm run check        # typecheck API, admin en deelnemers
npm test             # API-tests
```

## Deployen naar piweb

`./deploy_tourpool.sh` deployt naar `https://jota.nl/tourpool/` (admin in `/var/www/tourpool`, API via pm2 als `tourpool-api` op poort 3002 in `~/apps/tourpool-api`).

1. Eenmalig **optie 1**: maakt mappen, database `tourpool` + gebruiker, de prod-`.env` (met gegenereerd wachtwoord) en `/etc/nginx/snippets/tourpool.conf` (optioneel met basic auth). Voeg daarna eenmalig `include /etc/nginx/snippets/tourpool.conf;` toe aan het 443-serverblok in `jota.conf` en herlaad nginx.
2. **Optie 2** zet de dev-database over (eerst backup naar `~/apps/backups`). De dump wordt aangepast voor MariaDB 10.11 (collatie, DEFINER).
3. **Optie 3/4/5/7** bouwt en deployt API, admin en/of deelnemersapp.

Bij een bestaande productie-installatie: voer de accountmigratie uit, maak
een admin aan en voeg `AUTH_ORIGINS=https://jota.nl` en `TRUST_PROXY=1`
toe aan de API-`.env` voordat je de nieuwe API activeert.
Optie 1 schrijft de aangepaste nginx-snippet; deze geeft
`/tourpool/deelnemen/` een eigen SPA-fallback en laat de API zonder nginx
basic auth werken. Bestaande snippets moeten dus ook worden bijgewerkt.
Eventuele basic auth kan als extra laag voor alleen de admin blijven staan.
Gebruik voor een update **niet** optie 2/6: die overschrijft productiegegevens.
Een volledige import van `tourpool.sql` verwijdert ook oude accounts/sessies;
maak daarna opnieuw een admin aan. Gebruik de losse migratie voor bestaande data.

Het basispad van de admin staat in `apps/admin/.env.production` (`VITE_BASE_PATH`, `VITE_API_URL`).
De deelnemersapp gebruikt `apps/user/.env.production` en staat in
`/var/www/tourpool/deelnemen`.

## Wat is aangepast voor MariaDB

- De database-driver gebruikt nu `mariadb` in plaats van `mysql2`.
- De standaard `DB_HOST` staat op `mariadb`, zodat de API direct met de Docker-service kan praten.
- Er is een `docker-compose.yml` toegevoegd voor een lokale MariaDB-container plus de API.

## Database-updates

Voer SQL-updates uit `apps/api/migrations/` eenmalig uit op bestaande databases.
`20261004_add_stage_prize_precision.sql` maakt bedragen voor etappeprijzen nauwkeurig
tot op eurocenten; `20261004_store_stage_prizes_as_double.sql` wijzigt de opslag
naar `DOUBLE`, zodat gedeelde bedragen hun volledige fractie behouden. Nieuwe
databases gebruiken deze opslag via `tourpool.sql`.

## Starten met Docker

1. Start alles met `docker compose up --build`.
2. De database draait op `mariadb:3306` binnen het compose-netwerk.
3. De API draait op `http://localhost:3000`.

## Lokale configuratie

Gebruik `apps/api/.env.example` als basis voor je eigen `apps/api/.env` als je de API buiten Docker wilt draaien.

## Endpoints

- `GET /health`
- `GET /api`
- `GET /api/tours`, `POST`, `PUT /api/tours/:tourID`, `DELETE /api/tours/:tourID`
- `GET /api/pools`, `POST`, `PUT /api/pools/:poolID`, `DELETE /api/pools/:poolID`
- `GET /api/addresses`, `POST`, `PUT /api/addresses/:adrID`, `DELETE /api/addresses/:adrID`
- `GET /api/riders` (filters: `?landID=&search=`), `POST`, `PUT /api/riders/:rennerID`, `DELETE /api/riders/:rennerID`
- `GET /api/countries` (filters: `?iso2=&continent=&search=`), `POST`, `PUT /api/countries/:id`, `DELETE /api/countries/:id`
- `GET /api/teams` (filters: `?landID=&search=`), `POST`, `PUT /api/teams/:ploegID`, `DELETE /api/teams/:ploegID`
- `GET /api/team-riders` (filters: `?tourID=&ploegID=&rennerID=`), `GET /api/team-riders/view`, `POST`, `PUT /api/team-riders/:tourID/:ploegID/:rennerID`, `DELETE`
- `GET /api/stages` (filter: `?tour=`), `POST`, `PUT /api/stages/:tour/:etappeNr`, `DELETE`
- `GET /api/stage-results` (filters: `?tourID=&etappeNr=&uitslagType=&rennerID=`), `POST`, `PUT /api/stage-results/:tourID/:etappeNr/:uitslagType/:plaats`, `DELETE`
- `GET /api/participants` (filters: `?poolID=&adrID=`), `POST`, `PUT /api/participants/:deelnID`, `DELETE /api/participants/:deelnID`
- `GET /api/participant-riders` (filters: `?deelnID=&rennerID=`), `POST`, `PUT /api/participant-riders/:deelnID/:rennerID`, `DELETE`
- `GET /api/participant-points` (filters: `?deelnemID=&etappeNr=`), `POST`, `PUT /api/participant-points/:deelnemID/:etappeNr`, `DELETE`
- `GET /api/options`, `POST`, `PUT /api/options/:poolID`, `DELETE /api/options/:poolID`
- `GET /api/standard-points`, `POST`, `PUT /api/standard-points/:prestatieID`, `DELETE /api/standard-points/:prestatieID`
- `GET /api/point-allocations` (filters: `?poolID=&prestatieID=`), `POST`, `PUT /api/point-allocations/:prestatieID/:poolID`, `DELETE`
- `PUT /api/point-allocations/load/:poolID` vervangt alle poolprestaties door de standaardpunten binnen een transactie.

Bij het aanmaken van een pool worden de standaardprestaties en hun punten,
uitslagtype, plaats en volgorde gekopieerd naar de pool. De poolinstellingen zijn daarna
aanpasbaar via **Puntentoekenning** op de poolkaart bij Pools; het scherm
**Standaard Punten** blijft de basisinstellingen beheren.
Het formulier voor het aanmaken/bewerken van een pool bevat geen prestaties.
Bij aanmaken kopieert de API automatisch alle standaardprestaties naar
`tblPuntenToekenning` (een record per prestatie), samen met de pool en opties
in dezelfde transactie. Bewerken van poolgegevens wijzigt geen poolpunten;
puntenbeheer gebeurt uitsluitend via **Puntentoekenning**.
Op elk poolprestatiekaartje worden de punten direct in een invoerveld aangepast.
Bij verlaten van het veld of Enter worden alleen de punten opgeslagen; via het
vuilnisbakje wordt de prestatie direct uit de pool verwijderd, zonder bevestiging.
Bij navigeren naar een andere pagina worden gewijzigde velden eerst opgeslagen
en wordt op lopende opslagverzoeken gewacht. Bij ongeldige invoer of een
opslagfout blijft de pagina open met een foutmelding.
**Verversen** (ronde pijl) haalt alleen de opgeslagen poolpunten op en behoudt
de wijzigingen. Deze knop staat los van **Standaardpunten laden**.
**Standaardpunten laden** vervangt na bevestiging alle prestaties van de actieve
pool door de huidige standaardprestaties, inclusief punten en volgorde.
Bij een kopieerfout blijven de bestaande poolprestaties behouden. Openen van de
pagina, wisselen van pool en verversen na toevoegen/verwijderen halen alleen
gegevens op en overschrijven geen poolpunten.
Bij wijzigen, toevoegen, verwijderen of laden van poolpunten worden alle
bestaande etappes voor die pool opnieuw doorgerekend, inclusief categoriepunten,
totalen, plaatsen en etappeprijzen. Andere pools blijven ongewijzigd.
Alleen toegewezen poolprestaties leveren punten op; verwijderde prestaties
vallen niet terug op standaardpunten. De puntentoekenning en herberekening
worden samen opgeslagen in een transactie: bij een fout worden beide teruggedraaid.

De poolpunten-API gebruikt `prestatieID`, `poolID`, `Omschrijving`, `Punten`,
`uitslagtype`, `plaats` en `volgorde`; een kolom `uitleg` is niet vereist.
Bij losse toevoegingen wordt ook de standaardvolgorde opgeslagen. Voor bestaande
poolprestaties vult `migrations/20261004_copy_point_allocation_order.sql` alleen
ontbrekende volgordewaarden aan en voegt zo nodig de kolom toe. Bestaande
poolvolgordewaarden blijven behouden. De poolkaartjes staan in categoriekolommen:
twee voor etappeplaatsen (`rit`), een voor etappetruien (`klasGeel`, `klasGroen`,
`klasBol`, `klasWit`), een voor het eindklassement (`eindKlas`) en een voor overige
klassementen. Binnen elke categorie volgen ze de opgeslagen `volgorde` van boven
naar beneden. De eerste etappekolom wordt gevuld tot het hoogste aantal
prestaties in de drie overige categoriekolommen; de rest staat in de tweede
etappekolom. Zijn die overige kolommen leeg, dan staan alle etappeplaatsen in
de eerste kolom.
Niet-toegekende standaardprestaties staan zonder categoriegroepering in een
kaartjesraster, in standaardvolgorde van links naar rechts en daarna naar beneden.
De regressietest voor het laden en aanpassen van poolpunten draait zonder
databasewijzigingen:

```sh
cd apps/api
node --import tsx --test tests/pointAllocations.test.mjs
```

## Etappeuitslagen opslaan

`PUT /api/stage-results/batch` vervangt de uitslagen voor een tour en etappe en
berekent de deelnemerpunten binnen dezelfde transactie. Bij een fout worden
beide wijzigingen teruggedraaid. Punten worden gekoppeld op `uitslagtype` en
`plaats` uit `tblStandaardPunten`, met eventuele poolspecifieke punten uit
`tblPuntenToekenning`.
De uitslagcategorieen `geel`, `groen`, `bol` en `wit` worden daarbij gekoppeld
aan respectievelijk `klasGeel`, `klasGroen`, `klasBol` en `klasWit` in de
puntentabel; `rit` blijft `rit`.

De regressietests voor gewone etappes, TTT-klassementen en rollback gebruiken een
gesimuleerde databaseverbinding en wijzigen geen databasegegevens:

```sh
cd apps/api
node --import tsx --test tests/stageResults.test.mjs
```

## Etappeprijzen instellen

De poolschermen Deelnemers, Poolstand, Puntentoekenning en Opties open je
per pool via de knoppen op de poolkaart bij Pools (`/pools/:poolID/...`).
Ze tonen de naam en organisator van de pool in een gezamenlijke header, met
tabbladen om tussen de poolschermen te wisselen. Standaard Punten blijven
algemene instellingen in het linkermenu.

Het optiescherm ondersteunt de geldvelden `geldEtappeHoog`, `geldEtappeTotaal`
en `geldEtappeLaagTTL`. Bedragen worden in euro's opgeslagen, met maximaal
twee decimalen en een bereik van 0 tot en met 99,99 (`DECIMAL(4,2)`).
De opties-API ondersteunt deze velden bij toevoegen en wijzigen. Nieuwe pools
nemen de bedragen over van de meest recente poolopties.
Bij het opslaan van een etappe-uitslag bestaat `etapGeld` uit de prijzen voor
de hoogste dagscore, de hoogste totaalstand en de laagste totaalstand. Elke
prijs wordt bij een gedeelde plaats gelijk verdeeld over de deelnemers met die
score. Gedeelde prijzen en totaalgeld worden met hun volledige fractie opgeslagen
en in de poolstand met twee decimalen naar beneden afgerond. Bestaande databases
hebben hiervoor de migraties
`migrations/20261004_add_stage_prize_precision.sql` en
`migrations/20261004_store_stage_prizes_as_double.sql` nodig.

Test de opslag, validatie en het kopieren naar nieuwe pools zonder
databasegegevens te wijzigen:

```sh
cd apps/api
node --import tsx --test tests/options.test.mjs
```