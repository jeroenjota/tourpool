# Tourpool API

Basis-API voor de Tourpool-database, gebouwd met Node.js, Express, TypeScript en MariaDB.

## Wat is aangepast voor MariaDB

- De database-driver gebruikt nu `mariadb` in plaats van `mysql2`.
- De standaard `DB_HOST` staat op `mariadb`, zodat de API direct met de Docker-service kan praten.
- Er is een `docker-compose.yml` toegevoegd voor een lokale MariaDB-container plus de API.

## Database-updates

Voer SQL-updates uit `migrations/` eenmalig uit op bestaande databases.
`20261004_add_stage_prize_precision.sql` maakt bedragen voor etappeprijzen nauwkeurig
tot op eurocenten; `20261004_store_stage_prizes_as_double.sql` wijzigt de opslag
naar `DOUBLE`, zodat gedeelde bedragen hun volledige fractie behouden. Nieuwe
databases gebruiken deze opslag via `tourpool.sql`.

## Starten met Docker

1. Start alles met `docker compose up --build`.
2. De database draait op `mariadb:3306` binnen het compose-netwerk.
3. De API draait op `http://localhost:3000`.

## Lokale configuratie

Gebruik `.env.example` als basis voor je eigen `.env` als je de API buiten Docker wilt draaien.

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
node --import tsx --test tests/options.test.mjs
```