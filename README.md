# Tourpool API

Basis-API voor de Tourpool-database, gebouwd met Node.js, Express, TypeScript en MariaDB.

## Wat is aangepast voor MariaDB

- De database-driver gebruikt nu `mariadb` in plaats van `mysql2`.
- De standaard `DB_HOST` staat op `mariadb`, zodat de API direct met de Docker-service kan praten.
- Er is een `docker-compose.yml` toegevoegd voor een lokale MariaDB-container plus de API.

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