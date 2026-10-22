START TRANSACTION;

DELETE FROM tblEtappes
WHERE tour = '2';

INSERT INTO tblEtappes (tour, etappeNr, datum, Start, Finish, kms, type) VALUES
('2', 1, '2027-07-02', 'Edinburgh', 'Carlisle', 185, 'vlak'),
('2', 2, '2027-07-03', 'Keswick', 'Liverpool', 223, 'heuvels'),
('2', 3, '2027-07-04', 'Welshpool', 'Cardiff', 223, 'heuvels'),
('2', NULL, '2027-07-05', 'Cherbourg-en-Cotentin', NULL, NULL, 'rustdag'),
('2', 4, '2027-07-06', 'Cherbourg-en-Cotentin', 'Cherbourg-en-Cotentin', 171, 'heuvels'),
('2', 5, '2027-07-07', 'Pontorson', 'Plumelec', 178, 'heuvels'),
('2', 6, '2027-07-08', 'Vannes', 'Angers', 193, 'heuvels'),
('2', 7, '2027-07-09', 'Blois', 'Chambord', 38, 'ITT'),
('2', 8, '2027-07-10', 'Bourges', 'Le Creusot', 224, 'heuvels'),
('2', 9, '2027-07-11', 'Villars-les-Dombes Parc des Oiseaux', 'Grand Colombier', 162, 'bergen'),
('2', NULL, '2027-07-12', 'Haute-Savoie', NULL, NULL, 'rustdag'),
('2', 10, '2027-07-13', 'Annecy', 'Sallanches', 171, 'bergen'),
('2', 11, '2027-07-14', 'Cluses', 'Les Saisies', 150, 'bergen'),
('2', 12, '2027-07-15', 'Chambéry', 'Valence', 162, 'vlak'),
('2', 13, '2027-07-16', 'Aubenas', 'Montpellier', 164, 'vlak'),
('2', 14, '2027-07-17', 'Montpellier', 'Mende', 199, 'bergen'),
('2', 15, '2027-07-18', 'Rodez', 'Albi', 169, 'heuvels'),
('2', NULL, '2027-07-19', 'Toulouse', NULL, NULL, 'rustdag'),
('2', 16, '2027-07-20', 'Toulouse', 'Toulouse', 33, 'ITT'),
('2', 17, '2027-07-21', 'Muret', 'Pau', 186, 'vlak'),
('2', 18, '2027-07-22', 'Pau', 'Saint-Lary-Soulan Col du Portet', 174, 'bergen'),
('2', 19, '2027-07-23', 'Hasparren', 'Laruns', 160, 'bergen'),
('2', 20, '2027-07-24', 'Maubourguet', 'Libourne', 198, 'vlak'),
('2', 21, '2027-07-25', 'Saint-Quentin-en-Yvelines', 'Paris Champs-Élysées', 116, 'vlak');

COMMIT;

ALTER TABLE tblEtappes
  DROP COLUMN IF EXISTS voorlopig;
