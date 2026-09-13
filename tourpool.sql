/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-11.8.5-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: tourpool
-- ------------------------------------------------------
-- Server version	11.8.5-MariaDB-ubu2404

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Current Database: `tourpool`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `tourpool` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `tourpool`;

--
-- Table structure for table `tblAdressen`
--

DROP TABLE IF EXISTS `tblAdressen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblAdressen` (
  `adrID` int(11) NOT NULL,
  `vNaam` varchar(24) DEFAULT NULL,
  `tNaam` varchar(12) DEFAULT NULL,
  `aNaam` varchar(24) DEFAULT NULL,
  `plaats` varchar(24) DEFAULT NULL,
  `tel` varchar(12) DEFAULT NULL,
  `email` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`adrID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblAdressen`
--

LOCK TABLES `tblAdressen` WRITE;
/*!40000 ALTER TABLE `tblAdressen` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `tblAdressen` VALUES
(8,'Edwin',NULL,'Korsten',NULL,NULL,'edwin@korsten.name'),
(19,'Jeannette',NULL,'Beusker',NULL,NULL,'j.beusker43@gmail.com'),
(41,'Frans',NULL,'Claus','Berkel en Rodenrijs','06-51254651','fclaus@mif.nl'),
(46,'Patrick',NULL,'Klein Breteler',NULL,NULL,NULL),
(50,'Bart',NULL,'Kwant','Amsterdam',NULL,NULL),
(66,'Miranda',NULL,'Tjan','Den Haag',NULL,NULL),
(118,'René',NULL,'Kroezen','Amsterdam',NULL,'renekroezen@kpnmail.nl'),
(128,'Joke',NULL,'Slikker',NULL,NULL,'jokewslikker@gmail.com'),
(131,'Ted',NULL,'Bruijnzeels','Haarlem',NULL,NULL),
(133,'Ron',NULL,'Geurts',NULL,NULL,'ron-janniegeurts@ziggo.nl'),
(141,'Paul ',NULL,'Bierling','Den Haag','06-53695633','p.bierling@ziggo.nl'),
(160,'Ton',NULL,'Verheul',NULL,NULL,NULL),
(169,'Ellie',NULL,'Klijn','Alblasserdam',NULL,'ellieklijn@live.nl'),
(171,'Jan',NULL,'Boekel',NULL,NULL,NULL),
(178,'Timo',NULL,'Jansen','Amsterdam',NULL,NULL),
(184,'Sten',NULL,'Weingartner',NULL,NULL,'stenweingartner@mastersin-it.nl'),
(185,'Jeroen',NULL,'Pijtak',NULL,NULL,'jeroen@cooper-legal.nl'),
(191,'Winny',NULL,'Jansen','Gorinchem',NULL,'w.muller@verbaan.com'),
(192,'Corry',NULL,'Verschuur','Hoogstraten',NULL,'corry.verschuur@hotmail.com'),
(196,'Joop',NULL,'Baars','Almere','0653851544','jbaars1955@kpnmail.nl'),
(209,'Ton ',NULL,'Boon',NULL,'06-13253834','atmboon@upcmail.nl'),
(218,'Wim',NULL,'Boekel',NULL,'06-46021616',NULL),
(2495,'Jeroen',NULL,'Verstegen','Amsterdam','0647116541','jeroenwverstegen@gmail.com');
/*!40000 ALTER TABLE `tblAdressen` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `tblDeelnemRenners`
--

DROP TABLE IF EXISTS `tblDeelnemRenners`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblDeelnemRenners` (
  `deelnID` int(11) NOT NULL,
  `rennerID` int(11) NOT NULL,
  `positie` int(11) DEFAULT NULL,
  PRIMARY KEY (`deelnID`,`rennerID`),
  KEY `tblDeelnemRenners_tblRenners_FK` (`rennerID`),
  CONSTRAINT `tblDeelnemRenners_tblDeelnemers_FK` FOREIGN KEY (`deelnID`) REFERENCES `tblDeelnemers` (`deelnID`) ON DELETE CASCADE,
  CONSTRAINT `tblDeelnemRenners_tblRenners_FK` FOREIGN KEY (`rennerID`) REFERENCES `tblRenners` (`rennerID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblDeelnemRenners`
--

LOCK TABLES `tblDeelnemRenners` WRITE;
/*!40000 ALTER TABLE `tblDeelnemRenners` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `tblDeelnemRenners` VALUES
(5,13,1),
(5,27,15),
(5,30,10),
(5,42,13),
(5,48,14),
(5,66,11),
(5,137,8),
(5,163,2),
(5,165,3),
(5,166,5),
(5,182,12),
(5,184,4),
(5,186,6),
(5,198,7),
(5,213,9),
(6,8,1),
(6,42,2),
(6,66,12),
(6,75,13),
(6,96,3),
(6,154,5),
(6,165,4),
(6,167,11),
(6,178,8),
(6,179,15),
(6,180,10),
(6,185,9),
(6,193,7),
(6,200,14),
(6,205,6),
(7,4,6),
(7,13,7),
(7,39,14),
(7,105,12),
(7,141,9),
(7,160,2),
(7,172,3),
(7,190,15),
(7,199,5),
(7,205,8),
(7,223,13),
(7,228,11),
(7,237,4),
(7,243,1),
(7,249,10),
(8,1,5),
(8,8,6),
(8,25,10),
(8,27,7),
(8,29,2),
(8,35,14),
(8,48,13),
(8,84,3),
(8,95,9),
(8,114,1),
(8,121,11),
(8,138,12),
(8,145,4),
(8,152,15),
(8,154,8),
(9,7,13),
(9,8,3),
(9,44,12),
(9,71,1),
(9,81,11),
(9,115,4),
(9,118,8),
(9,121,10),
(9,122,5),
(9,135,14),
(9,141,7),
(9,143,15),
(9,146,9),
(9,152,6),
(9,166,2),
(10,7,11),
(10,8,9),
(10,55,13),
(10,114,14),
(10,149,1),
(10,168,6),
(10,182,4),
(10,194,7),
(10,198,10),
(10,203,15),
(10,205,2),
(10,211,5),
(10,232,12),
(10,241,8),
(10,244,3),
(11,1,12),
(11,8,9),
(11,13,2),
(11,95,11),
(11,96,13),
(11,128,7),
(11,167,8),
(11,170,10),
(11,171,4),
(11,172,14),
(11,175,3),
(11,204,6),
(11,206,5),
(11,210,15),
(11,255,1),
(12,1,6),
(12,12,5),
(12,42,12),
(12,113,4),
(12,115,14),
(12,126,9),
(12,150,10),
(12,159,13),
(12,220,11),
(12,222,7),
(12,226,15),
(12,231,2),
(12,241,1),
(12,246,3),
(12,249,8),
(13,27,10),
(13,71,8),
(13,81,14),
(13,132,1),
(13,163,3),
(13,165,13),
(13,169,7),
(13,176,5),
(13,180,6),
(13,184,2),
(13,185,4),
(13,190,11),
(13,214,9),
(13,222,12),
(13,250,15),
(14,7,9),
(14,13,1),
(14,14,10),
(14,15,12),
(14,18,2),
(14,22,6),
(14,39,3),
(14,46,11),
(14,49,15),
(14,57,8),
(14,180,14),
(14,183,13),
(14,194,5),
(14,210,7),
(14,215,4),
(15,49,8),
(15,57,9),
(15,85,15),
(15,121,5),
(15,157,14),
(15,171,6),
(15,172,10),
(15,176,13),
(15,179,7),
(15,182,1),
(15,196,3),
(15,197,4),
(15,199,12),
(15,213,2),
(15,242,11),
(16,9,2),
(16,113,6),
(16,134,3),
(16,151,1),
(16,152,14),
(16,169,8),
(16,195,4),
(16,210,12),
(16,212,9),
(16,213,5),
(16,214,11),
(16,218,15),
(16,221,13),
(16,224,10),
(16,236,7),
(17,39,9),
(17,55,12),
(17,66,6),
(17,76,13),
(17,77,4),
(17,86,7),
(17,135,2),
(17,165,1),
(17,166,14),
(17,171,3),
(17,176,10),
(17,183,5),
(17,200,15),
(17,217,8),
(17,219,11),
(18,1,8),
(18,34,11),
(18,77,9),
(18,83,12),
(18,98,5),
(18,146,6),
(18,156,7),
(18,163,10),
(18,167,2),
(18,171,15),
(18,186,13),
(18,193,3),
(18,195,4),
(18,215,14),
(18,244,1),
(19,7,6),
(19,29,11),
(19,54,7),
(19,114,14),
(19,132,12),
(19,133,2),
(19,143,13),
(19,179,9),
(19,191,4),
(19,197,1),
(19,211,5),
(19,216,8),
(19,224,15),
(19,229,10),
(19,256,3),
(20,5,3),
(20,8,9),
(20,13,10),
(20,29,2),
(20,35,5),
(20,48,15),
(20,55,4),
(20,75,13),
(20,99,8),
(20,143,12),
(20,145,14),
(20,155,6),
(20,157,11),
(20,160,1),
(20,161,7),
(21,1,10),
(21,30,1),
(21,38,9),
(21,71,11),
(21,146,6),
(21,150,5),
(21,153,12),
(21,167,8),
(21,172,4),
(21,188,3),
(21,189,15),
(21,196,2),
(21,214,7),
(21,241,13),
(21,253,14),
(22,26,5),
(22,85,12),
(22,105,6),
(22,137,9),
(22,165,10),
(22,171,8),
(22,200,14),
(22,205,13),
(22,213,1),
(22,217,11),
(22,224,2),
(22,232,15),
(22,233,3),
(22,246,4),
(22,251,7),
(23,12,10),
(23,27,11),
(23,34,14),
(23,81,8),
(23,139,2),
(23,166,1),
(23,178,4),
(23,187,3),
(23,190,9),
(23,195,13),
(23,203,6),
(23,212,15),
(23,217,12),
(23,242,5),
(23,252,7),
(24,5,10),
(24,14,11),
(24,36,3),
(24,46,5),
(24,98,8),
(24,105,9),
(24,126,4),
(24,132,6),
(24,133,12),
(24,134,14),
(24,138,15),
(24,150,7),
(24,151,1),
(24,160,13),
(24,162,2),
(25,7,11),
(25,12,9),
(25,28,5),
(25,30,6),
(25,35,7),
(25,63,12),
(25,125,3),
(25,126,13),
(25,135,14),
(25,142,2),
(25,146,4),
(25,148,10),
(25,178,15),
(25,193,8),
(25,223,1),
(26,25,11),
(26,96,7),
(26,113,4),
(26,132,8),
(26,149,13),
(26,150,6),
(26,154,1),
(26,165,12),
(26,166,9),
(26,176,15),
(26,196,2),
(26,202,10),
(26,222,3),
(26,234,5),
(26,245,14),
(27,14,2),
(27,55,8),
(27,95,14),
(27,113,11),
(27,140,3),
(27,167,15),
(27,177,5),
(27,178,7),
(27,187,9),
(27,188,4),
(27,211,6),
(27,212,12),
(27,216,1),
(27,217,13),
(27,228,10);
/*!40000 ALTER TABLE `tblDeelnemRenners` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `tblDeelnemerPunten`
--

DROP TABLE IF EXISTS `tblDeelnemerPunten`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblDeelnemerPunten` (
  `deelnemID` int(11) NOT NULL,
  `etappeNr` int(11) NOT NULL,
  `ritPnt` int(11) DEFAULT 0,
  `geelPnt` int(11) DEFAULT 0,
  `groenPnt` int(11) DEFAULT 0,
  `bolPnt` int(11) DEFAULT 0,
  `witPnt` int(11) DEFAULT 0,
  `etapPnt` int(11) DEFAULT 0 COMMENT 'Totaal aantal piunten na deze etappe',
  `etapPlaats` int(11) DEFAULT 0,
  `etapGeld` decimal(10,0) DEFAULT 0,
  `ttlPnt` int(11) DEFAULT 0,
  `ttlPlaats` int(11) DEFAULT 0,
  `ttlGeld` decimal(10,0) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblDeelnemerPunten`
--

LOCK TABLES `tblDeelnemerPunten` WRITE;
/*!40000 ALTER TABLE `tblDeelnemerPunten` DISABLE KEYS */;
set autocommit=0;
/*!40000 ALTER TABLE `tblDeelnemerPunten` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `tblDeelnemers`
--

DROP TABLE IF EXISTS `tblDeelnemers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblDeelnemers` (
  `deelnID` int(11) NOT NULL AUTO_INCREMENT,
  `poolID` int(11) NOT NULL,
  `adrID` int(11) NOT NULL,
  `roepnaam` varchar(255) DEFAULT NULL,
  `Betaald` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`deelnID`),
  UNIQUE KEY `tblDeelnemers_pool_adr_roep_IDX` (`poolID`,`adrID`,`roepnaam`),
  KEY `tblDeelnemers_tblAdressen_FK` (`adrID`),
  KEY `tblDeelnemers_tblPools_FK` (`poolID`),
  CONSTRAINT `tblDeelnemers_tblAdressen_FK` FOREIGN KEY (`adrID`) REFERENCES `tblAdressen` (`adrID`),
  CONSTRAINT `tblDeelnemers_tblPools_FK` FOREIGN KEY (`poolID`) REFERENCES `tblPools` (`poolID`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblDeelnemers`
--

LOCK TABLES `tblDeelnemers` WRITE;
/*!40000 ALTER TABLE `tblDeelnemers` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `tblDeelnemers` VALUES
(5,1,8,'Edwin Korsten',1),
(6,1,19,'Jeannette Beusker',1),
(7,1,41,'Frans Claus',1),
(8,1,46,'Patrick Klein Breteler',1),
(9,1,50,'Bart Kwant',1),
(10,1,66,'Miranda Tjan',0),
(11,1,118,'René Kroezen',1),
(12,1,128,'Joke Slikker',1),
(13,1,131,'Ted Bruijnzeels',0),
(14,1,133,'Ron Geurts',1),
(15,1,141,'Paul  Bierling',0),
(16,1,160,'Ton Verheul',1),
(17,1,169,'Ellie Klijn',1),
(18,1,171,'Jan Boekel',1),
(19,1,178,'Timo Jansen',1),
(20,1,184,'Sten Weingartner',1),
(21,1,185,'Jeroen Pijtak',1),
(22,1,191,'Winny Jansen',1),
(23,1,192,'Corry Verschuur',1),
(24,1,196,'Joop Baars',0),
(25,1,209,'Ton  Boon',1),
(26,1,218,'Wim Boekel',1),
(27,1,2495,'Jeroen Verstegen',0);
/*!40000 ALTER TABLE `tblDeelnemers` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `tblEtappeUitslag`
--

DROP TABLE IF EXISTS `tblEtappeUitslag`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblEtappeUitslag` (
  `tourID` int(11) NOT NULL,
  `etappeNr` int(11) NOT NULL,
  `uitslagType` varchar(10) NOT NULL,
  `plaats` int(11) NOT NULL,
  `rennerID` int(11) NOT NULL,
  KEY `tblEtappeUitslag_tblTours_FK` (`tourID`),
  KEY `tblEtappeUitslag_tblRenners_FK` (`rennerID`),
  CONSTRAINT `tblEtappeUitslag_tblRenners_FK` FOREIGN KEY (`rennerID`) REFERENCES `tblRenners` (`rennerID`),
  CONSTRAINT `tblEtappeUitslag_tblTours_FK` FOREIGN KEY (`tourID`) REFERENCES `tblTours` (`tourID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblEtappeUitslag`
--

LOCK TABLES `tblEtappeUitslag` WRITE;
/*!40000 ALTER TABLE `tblEtappeUitslag` DISABLE KEYS */;
set autocommit=0;
/*!40000 ALTER TABLE `tblEtappeUitslag` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `tblEtappes`
--

DROP TABLE IF EXISTS `tblEtappes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblEtappes` (
  `tour` varchar(10) NOT NULL,
  `etappeNr` int(11) DEFAULT NULL,
  `datum` date DEFAULT NULL,
  `Start` varchar(100) DEFAULT NULL,
  `Finish` varchar(100) DEFAULT NULL,
  `kms` decimal(5,1) DEFAULT NULL,
  `type` varchar(24) DEFAULT NULL,
  KEY `tblEtappes_tblTours_FK` (`tour`),
  KEY `tblEtappes_datum_IDX` (`datum`) USING BTREE,
  KEY `tblEtappes_etappeNr_IDX` (`etappeNr`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblEtappes`
--

LOCK TABLES `tblEtappes` WRITE;
/*!40000 ALTER TABLE `tblEtappes` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `tblEtappes` VALUES
('1',1,'2026-07-04','Barcelona','Barcelona',19.6,'TTT'),
('1',2,'2026-07-05','Tarragona','Barcelona',168.5,'heuvels'),
('1',3,'2026-07-06','Granollers','Les Angles',195.9,'bergen'),
('1',4,'2026-07-07','Carcassonne','Foix',181.9,'heuvels'),
('1',5,'2026-07-08','Lannemezan','Pau',158.3,'vlak'),
('1',6,'2026-07-09','Pau','Gavarnie-Gèdre',186.2,'bergen'),
('1',7,'2026-07-10','Hagetmau','Bordeaux',175.1,'vlak'),
('1',8,'2026-07-11','Périgueux','Bergerac',180.4,'vlak'),
('1',9,'2026-07-12','Malemort','Ussel',185.5,'heuvels'),
('1',10,'2026-07-14','Aurillac','Le Lioran',166.6,'heuvels'),
('1',11,'2026-07-15','Vichy','Nevers',161.3,'vlak'),
('1',12,'2026-07-16','Magny-Cours','Châlon-sur-Saône',179.1,'vlak'),
('1',13,'2026-07-17','Dole','Belfort',205.8,'heuvels'),
('1',14,'2026-07-18','Mulhouse','Le Markstein',155.3,'bergen'),
('1',15,'2026-07-19','Champagnole','Plateau de Solaison',183.9,'bergen'),
('1',16,'2026-07-21','Evian-les-Bains','Thonon-les-Bains',26.1,'ITT'),
('1',17,'2026-07-22','Chambéry','Voiron',174.7,'vlak'),
('1',18,'2026-07-23','Voiron','Orcières-Merlette',185.2,'bergen'),
('1',19,'2026-07-24','Gap','Alpe d\'Huez',127.9,'bergen'),
('1',20,'2026-07-25','Bourg d\'Oissans','Alpe d\'Huez',170.9,'bergen'),
('1',21,'2026-07-26','Thoiry','Parijs',133.0,'vlak'),
('1',NULL,'2026-07-13',NULL,NULL,NULL,'rustdag'),
('1',NULL,'2026-07-20',NULL,NULL,NULL,'rustdag');
/*!40000 ALTER TABLE `tblEtappes` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `tblLanden`
--

DROP TABLE IF EXISTS `tblLanden`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblLanden` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `country` varchar(100) NOT NULL,
  `land` varchar(100) NOT NULL,
  `iso2` varchar(10) NOT NULL,
  `code` varchar(3) NOT NULL,
  `continent` varchar(50) NOT NULL,
  `vlag` varchar(10) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=198 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblLanden`
--

LOCK TABLES `tblLanden` WRITE;
/*!40000 ALTER TABLE `tblLanden` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `tblLanden` VALUES
(1,'Afghanistan','Afghanistan','AF','AFG','Azië','🇦🇫'),
(2,'Albania','Albanië','AL','ALB','Europa','🇦🇱'),
(3,'Algeria','Algerije','DZ','DZA','Afrika','🇩🇿'),
(4,'Andorra','Andorra','AD','AND','Europa','🇦🇩'),
(5,'Angola','Angola','AO','AGO','Afrika','🇦🇴'),
(6,'Antigua and Barbuda','Antigua en Barbuda','AG','ATG','Noord-Amerika','🇦🇬'),
(7,'Argentina','Argentinië','AR','ARG','Zuid-Amerika','🇦🇷'),
(8,'Armenia','Armenië','AM','ARM','Azië','🇦🇲'),
(9,'Australia','Australië','AU','AUS','Oceanië','🇦🇺'),
(10,'Austria','Oostenrijk','AT','AUT','Europa','🇦🇹'),
(11,'Azerbaijan','Azerbeidzjan','AZ','AZE','Azië','🇦🇿'),
(12,'Bahamas','Bahama\'s','BS','BHS','Noord-Amerika','🇧🇸'),
(13,'Bahrain','Bahrein','BH','BHR','Azië','🇧🇭'),
(14,'Bangladesh','Bangladesh','BD','BGD','Azië','🇧🇩'),
(15,'Barbados','Barbados','BB','BRB','Noord-Amerika','🇧🇧'),
(16,'Belarus','Wit-Rusland','BY','BLR','Europa','🇧🇾'),
(17,'Belgium','België','BE','BEL','Europa','🇧🇪'),
(18,'Belize','Belize','BZ','BLZ','Noord-Amerika','🇧🇿'),
(19,'Benin','Benin','BJ','BEN','Afrika','🇧🇯'),
(20,'Bhutan','Bhutan','BT','BTN','Azië','🇧🇹'),
(21,'Bolivia','Bolivia','BO','BOL','Zuid-Amerika','🇧🇴'),
(22,'Bosnia and Herzegovina','Bosnië en Herzegovina','BA','BIH','Europa','🇧🇦'),
(23,'Botswana','Botswana','BW','BWA','Afrika','🇧🇼'),
(24,'Brazil','Brazilië','BR','BRA','Zuid-Amerika','🇧🇷'),
(25,'Brunei','Brunei','BN','BRN','Azië','🇧🇳'),
(26,'Bulgaria','Bulgarije','BG','BGR','Europa','🇧🇬'),
(27,'Burkina Faso','Burkina Faso','BF','BFA','Afrika','🇧🇫'),
(28,'Burundi','Burundi','BI','BDI','Afrika','🇧🇮'),
(29,'Cabo Verde','Kaapverdië','CV','CPV','Afrika','🇨🇻'),
(30,'Cambodia','Cambodja','KH','KHM','Azië','🇰🇭'),
(31,'Cameroon','Kameroen','CM','CMR','Afrika','🇨🇲'),
(32,'Canada','Canada','CA','CAN','Noord-Amerika','🇨🇦'),
(33,'Central African Republic','Centraal-Afrikaanse Republiek','CF','CAF','Afrika','🇨🇫'),
(34,'Chad','Tsjaad','TD','TCD','Afrika','🇹🇩'),
(35,'Chile','Chili','CL','CHL','Zuid-Amerika','🇨🇱'),
(36,'China','China','CN','CHN','Azië','🇨🇳'),
(37,'Colombia','Colombia','CO','COL','Zuid-Amerika','🇨🇴'),
(38,'Comoros','Comoren','KM','COM','Afrika','🇰🇲'),
(39,'Congo (Congo-Brazzaville)','Congo-Brazzaville','CG','COG','Afrika','🇨🇬'),
(40,'Congo (Democratic Republic)','Congo-Kinshasa','CD','COD','Afrika','🇨🇩'),
(41,'Costa Rica','Costa Rica','CR','CRI','Noord-Amerika','🇨🇷'),
(42,'Croatia','Kroatië','HR','HRV','Europa','🇭🇷'),
(43,'Cuba','Cuba','CU','CUB','Noord-Amerika','🇨🇺'),
(44,'Cyprus','Cyprus','CY','CYP','Europa','🇨🇾'),
(45,'Czechia','Tsjechië','CZ','CZE','Europa','🇨🇿'),
(46,'Denmark','Denemarken','DK','DNK','Europa','🇩🇰'),
(47,'Djibouti','Djibouti','DJ','DJI','Afrika','🇩🇯'),
(48,'Dominica','Dominica','DM','DMA','Noord-Amerika','🇩🇲'),
(49,'Dominican Republic','Dominicaanse Republiek','DO','DOM','Noord-Amerika','🇩🇴'),
(50,'Ecuador','Ecuador','EC','ECU','Zuid-Amerika','🇪🇨'),
(51,'Egypt','Egypte','EG','EGY','Afrika','🇪🇬'),
(52,'El Salvador','El Salvador','SV','SLV','Noord-Amerika','🇸🇻'),
(53,'England','Engeland','GB-ENG','ENG','Europa','🏴󠁧󠁢󠁥󠁮󠁧󠁿'),
(54,'Equatorial Guinea','Equatoriaal-Guinea','GQ','GNQ','Afrika','🇬🇶'),
(55,'Eritrea','Eritrea','ER','ERI','Afrika','🇪🇷'),
(56,'Estonia','Estland','EE','EST','Europa','🇪🇪'),
(57,'Eswatini','Eswatini','SZ','SWZ','Afrika','🇸🇿'),
(58,'Ethiopia','Ethiopië','ET','ETH','Afrika','🇪🇹'),
(59,'Fiji','Fiji','FJ','FJI','Oceanië','🇫🇯'),
(60,'Finland','Finland','FI','FIN','Europa','🇫🇮'),
(61,'France','Frankrijk','FR','FRA','Europa','🇫🇷'),
(62,'Gabon','Gabon','GA','GAB','Afrika','🇬🇦'),
(63,'Gambia','Gambia','GM','GMB','Afrika','🇬🇲'),
(64,'Georgia','Georgië','GE','GEO','Europa','🇬🇪'),
(65,'Germany','Duitsland','DE','DEU','Europa','🇩🇪'),
(66,'Ghana','Ghana','GH','GHA','Afrika','🇬🇭'),
(67,'Greece','Griekenland','GR','GRC','Europa','🇬🇷'),
(68,'Grenada','Grenada','GD','GRD','Noord-Amerika','🇬🇩'),
(69,'Guatemala','Guatemala','GT','GTM','Noord-Amerika','🇬🇹'),
(70,'Guinea','Guinee','GN','GIN','Afrika','🇬🇳'),
(71,'Guinea-Bissau','Guinee-Bissau','GW','GNB','Afrika','🇬🇼'),
(72,'Guyana','Guyana','GY','GUY','Zuid-Amerika','🇬🇾'),
(73,'Haiti','Haïti','HT','HTI','Noord-Amerika','🇭🇹'),
(74,'Honduras','Honduras','HN','HND','Noord-Amerika','🇭🇳'),
(75,'Hungary','Hongarije','HU','HUN','Europa','🇭🇺'),
(76,'Iceland','IJsland','IS','ISL','Europa','🇮🇸'),
(77,'India','India','IN','IND','Azië','🇮🇳'),
(78,'Indonesia','Indonesië','ID','IDN','Azië','🇮🇩'),
(79,'Iran','Iran','IR','IRN','Azië','🇮🇷'),
(80,'Iraq','Irak','IQ','IRQ','Azië','🇮🇶'),
(81,'Ireland','Ierland','IE','IRL','Europa','🇮🇪'),
(82,'Israel','Israël','IL','ISR','Azië','🇮🇱'),
(83,'Italy','Italië','IT','ITA','Europa','🇮🇹'),
(84,'Jamaica','Jamaica','JM','JAM','Noord-Amerika','🇯🇲'),
(85,'Japan','Japan','JP','JPN','Azië','🇯🇵'),
(86,'Jordan','Jordanië','JO','JOR','Azië','🇯🇴'),
(87,'Kazakhstan','Kazachstan','KZ','KAZ','Azië','🇰🇿'),
(88,'Kenya','Kenia','KE','KEN','Afrika','🇰🇪'),
(89,'Kiribati','Kiribati','KI','KIR','Oceanië','🇰🇮'),
(90,'Kuwait','Koeweit','KW','KWT','Azië','🇰🇼'),
(91,'Kyrgyzstan','Kirgizië','KG','KGZ','Azië','🇰🇬'),
(92,'Laos','Laos','LA','LAO','Azië','🇱🇦'),
(93,'Latvia','Letland','LV','LVA','Europa','🇱🇻'),
(94,'Lebanon','Libanon','LB','LBN','Azië','🇱🇧'),
(95,'Lesotho','Lesotho','LS','LSO','Afrika','🇱🇸'),
(96,'Liberia','Liberia','LR','LBR','Afrika','🇱🇷'),
(97,'Libya','Libië','LY','LBY','Afrika','🇱🇾'),
(98,'Liechtenstein','Liechtenstein','LI','LIE','Europa','🇱🇮'),
(99,'Lithuania','Litouwen','LT','LTU','Europa','🇱🇹'),
(100,'Luxembourg','Luxemburg','LU','LUX','Europa','🇱🇺'),
(101,'Madagascar','Madagaskar','MG','MDG','Afrika','🇲🇬'),
(102,'Malawi','Malawi','MW','MWI','Afrika','🇲🇼'),
(103,'Malaysia','Maleisië','MY','MYS','Azië','🇲🇾'),
(104,'Maldives','Malediven','MV','MDV','Azië','🇲🇻'),
(105,'Mali','Mali','ML','MLI','Afrika','🇲🇱'),
(106,'Malta','Malta','MT','MLT','Europa','🇲🇹'),
(107,'Marshall Islands','Marshalleilanden','MH','MHL','Oceanië','🇲🇭'),
(108,'Mauritania','Mauritanië','MR','MRT','Afrika','🇲🇷'),
(109,'Mauritius','Mauritius','MU','MUS','Afrika','🇲🇺'),
(110,'Mexico','Mexico','MX','MEX','Noord-Amerika','🇲🇽'),
(111,'Micronesia','Micronesië','FM','FSM','Oceanië','🇫🇲'),
(112,'Moldova','Moldavië','MD','MDA','Europa','🇲🇩'),
(113,'Monaco','Monaco','MC','MCO','Europa','🇲🇨'),
(114,'Mongolia','Mongolië','MN','MNG','Azië','🇲🇳'),
(115,'Montenegro','Montenegro','ME','MNE','Europa','🇲🇪'),
(116,'Morocco','Marokko','MA','MAR','Afrika','🇲🇦'),
(117,'Mozambique','Mozambique','MZ','MOZ','Afrika','🇲🇿'),
(118,'Myanmar','Myanmar','MM','MMR','Azië','🇲🇲'),
(119,'Namibia','Namibië','NA','NAM','Afrika','🇳🇦'),
(120,'Nauru','Nauru','NR','NRU','Oceanië','🇳🇷'),
(121,'Nepal','Nepal','NP','NPL','Azië','🇳🇵'),
(122,'Netherlands','Nederland','NL','NLD','Europa','🇳🇱'),
(123,'New Zealand','Nieuw-Zeeland','NZ','NZL','Oceanië','🇳🇿'),
(124,'Nicaragua','Nicaragua','NI','NIC','Noord-Amerika','🇳🇮'),
(125,'Niger','Niger','NE','NER','Afrika','🇳🇪'),
(126,'Nigeria','Nigeria','NG','NGA','Afrika','🇳🇬'),
(127,'Northern Ireland','Noord-Ierland','GB-NIR','NIR','Europa','🏴󠁧󠁢󠁮󠁧󠁿'),
(128,'North Korea','Noord-Korea','KP','PRK','Azië','🇰🇵'),
(129,'North Macedonia','Noord-Macedonië','MK','MKD','Europa','🇲🇰'),
(130,'Norway','Noorwegen','NO','NOR','Europa','🇳🇴'),
(131,'Oman','Oman','OM','OMN','Azië','🇴🇲'),
(132,'Pakistan','Pakistan','PK','PAK','Azië','🇵🇰'),
(133,'Palau','Palau','PW','PLW','Oceanië','🇵🇼'),
(134,'Panama','Panama','PA','PAN','Noord-Amerika','🇵🇦'),
(135,'Papua New Guinea','Papua-Nieuw-Guinea','PG','PNG','Oceanië','🇵🇬'),
(136,'Paraguay','Paraguay','PY','PRY','Zuid-Amerika','🇵🇾'),
(137,'Peru','Peru','PE','PER','Zuid-Amerika','🇵🇪'),
(138,'Philippines','Filipijnen','PH','PHL','Azië','🇵🇭'),
(139,'Poland','Polen','PL','POL','Europa','🇵🇱'),
(140,'Portugal','Portugal','PT','PRT','Europa','🇵🇹'),
(141,'Qatar','Qatar','QA','QAT','Azië','🇶🇦'),
(142,'Romania','Roemenië','RO','ROU','Europa','🇷🇴'),
(143,'Russia','Rusland','RU','RUS','Europa/Azië','🇷🇺'),
(144,'Rwanda','Rwanda','RW','RWA','Afrika','🇷🇼'),
(145,'Saint Kitts and Nevis','Saint Kitts en Nevis','KN','KNA','Noord-Amerika','🇰🇳'),
(146,'Saint Lucia','Saint Lucia','LC','LCA','Noord-Amerika','🇱🇨'),
(147,'Saint Vincent and the Grenadines','Saint Vincent en de Grenadines','VC','VCT','Noord-Amerika','🇻🇨'),
(148,'Samoa','Samoa','WS','WSM','Oceanië','🇼🇸'),
(149,'San Marino','San Marino','SM','SMR','Europa','🇸🇲'),
(150,'Sao Tome and Principe','Sao Tomé en Principe','ST','STP','Afrika','🇸🇹'),
(151,'Saudi Arabia','Saoedi-Arabië','SA','SAU','Azië','🇸🇦'),
(152,'Scotland','Schotland','GB-SCT','SCT','Europa','🏴󠁧󠁢󠁳󠁣󠁴󠁿'),
(153,'Senegal','Senegal','SN','SEN','Afrika','🇸🇳'),
(154,'Serbia','Servië','RS','SRB','Europa','🇷🇸'),
(155,'Seychelles','Seychellen','SC','SYC','Afrika','🇸🇨'),
(156,'Sierra Leone','Sierra Leone','SL','SLE','Afrika','🇸🇱'),
(157,'Singapore','Singapore','SG','SGP','Azië','🇸🇬'),
(158,'Slovakia','Slowakije','SK','SVK','Europa','🇸🇰'),
(159,'Slovenia','Slovenië','SI','SVN','Europa','🇸🇮'),
(160,'Solomon Islands','Salomonseilanden','SB','SLB','Oceanië','🇸🇧'),
(161,'Somalia','Somalië','SO','SOM','Afrika','🇸🇴'),
(162,'South Africa','Zuid-Afrika','ZA','ZAF','Afrika','🇿🇦'),
(163,'South Korea','Zuid-Korea','KR','KOR','Azië','🇰🇷'),
(164,'South Sudan','Zuid-Soedan','SS','SSD','Afrika','🇸🇸'),
(165,'Spain','Spanje','ES','ESP','Europa','🇪🇸'),
(166,'Sri Lanka','Sri Lanka','LK','LKA','Azië','🇱🇰'),
(167,'Sudan','Soedan','SD','SDN','Afrika','🇸🇩'),
(168,'Suriname','Suriname','SR','SUR','Zuid-Amerika','🇸🇷'),
(169,'Sweden','Zweden','SE','SWE','Europa','🇸🇪'),
(170,'Switzerland','Zwitserland','CH','CHE','Europa','🇨🇭'),
(171,'Syria','Syrië','SY','SYR','Azië','🇸🇾'),
(172,'Tajikistan','Tadzjikistan','TJ','TJK','Azië','🇹🇯'),
(173,'Tanzania','Tanzania','TZ','TZA','Afrika','🇹🇿'),
(174,'Thailand','Thailand','TH','THA','Azië','🇹🇭'),
(175,'Timor-Leste','Oost-Timor','TL','TLS','Azië','🇹🇱'),
(176,'Togo','Togo','TG','TGO','Afrika','🇹🇬'),
(177,'Tonga','Tonga','TO','TON','Oceanië','🇹🇴'),
(178,'Trinidad and Tobago','Trinidad en Tobago','TT','TTO','Noord-Amerika','🇹🇹'),
(179,'Tunisia','Tunesië','TN','TUN','Afrika','🇹🇳'),
(180,'Turkey','Turkije','TR','TUR','Europa/Azië','🇹🇷'),
(181,'Turkmenistan','Turkmenistan','TM','TKM','Azië','🇹🇲'),
(182,'Tuvalu','Tuvalu','TV','TUV','Oceanië','🇹🇺'),
(183,'Uganda','Oeganda','UG','UGA','Afrika','🇺🇬'),
(184,'Ukraine','Oekraïne','UA','UKR','Europa','🇺🇦'),
(185,'United Arab Emirates','Verenigde Arabische Emiraten','AE','ARE','Azië','🇦🇪'),
(186,'United Kingdom','Verenigd Koninkrijk','GB','GBR','Europa','🇬🇧'),
(187,'United States','Verenigde Staten','US','USA','Noord-Amerika','🇺🇸'),
(188,'Uruguay','Uruguay','UY','URY','Zuid-Amerika','🇺🇾'),
(189,'Uzbekistan','Oezbekistan','UZ','UZB','Azië','🇺🇿'),
(190,'Vanuatu','Vanuatu','VU','VUT','Oceanië','🇻🇺'),
(191,'Vatican City','Vaticaanstad','VA','VAT','Europa','🇻🇦'),
(192,'Venezuela','Venezuela','VE','VEN','Zuid-Amerika','🇻🇪'),
(193,'Vietnam','Vietnam','VN','VNM','Azië','🇻🇳'),
(194,'Wales','Wales','GB-WLS','WLS','Europa','🏴󠁧󠁢󠁷󠁬󠁳󠁿'),
(195,'Yemen','Jemen','YE','YEM','Azië','🇾🇪'),
(196,'Zambia','Zambia','ZM','ZMB','Afrika','🇿🇲'),
(197,'Zimbabwe','Zimbabwe','ZW','ZWE','Afrika','🇿🇼');
/*!40000 ALTER TABLE `tblLanden` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `tblOpties`
--

DROP TABLE IF EXISTS `tblOpties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblOpties` (
  `poolID` int(11) NOT NULL,
  `inleg` decimal(8,2) DEFAULT 10.00,
  `PloegRennerAantal` int(11) DEFAULT 15,
  `PloegReserveAantal` int(11) DEFAULT 5,
  `AantalEtapPlaatsen` int(11) DEFAULT 7,
  `AantalKlasGeel` int(11) DEFAULT 3,
  `AantalKlasGroen` int(11) DEFAULT 3,
  `AantalKlasBol` int(11) DEFAULT 3,
  `AantalKlasWit` int(11) DEFAULT 1,
  `AantalEindKlasGeel` int(11) DEFAULT 3,
  `AantalEindKlasGroen` int(11) DEFAULT 1,
  `AantalEindKlasBol` int(11) DEFAULT 1,
  `AantalEindKlasWit` int(11) DEFAULT 1,
  `PrijsNr1Percentage` decimal(8,2) DEFAULT 0.50,
  `PrijsNr2Percentage` decimal(8,2) DEFAULT 0.35,
  `PrijsNr3Percentage` decimal(8,2) DEFAULT 0.15,
  `PrijsNr4Percentage` decimal(8,2) DEFAULT 0.00,
  `PrijsNrLaatstBedrag` decimal(8,2) DEFAULT 10.00,
  PRIMARY KEY (`poolID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblOpties`
--

LOCK TABLES `tblOpties` WRITE;
/*!40000 ALTER TABLE `tblOpties` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `tblOpties` VALUES
(1,10.00,15,5,7,3,3,3,1,3,1,1,1,0.50,0.35,0.15,0.00,10.00);
/*!40000 ALTER TABLE `tblOpties` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `tblPloegRenners`
--

DROP TABLE IF EXISTS `tblPloegRenners`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblPloegRenners` (
  `tourID` int(11) NOT NULL,
  `ploegID` int(11) NOT NULL,
  `rennerID` int(11) NOT NULL,
  `Rugnummer` int(11) NOT NULL,
  `nietGestartEtappe` int(11) DEFAULT NULL,
  PRIMARY KEY (`ploegID`,`rennerID`,`tourID`),
  KEY `tblPloegRenners_tblRenners_FK` (`rennerID`),
  KEY `tblPloegRenners_tblTours_FK` (`tourID`),
  CONSTRAINT `tblPloegRenners_tblPloegen_FK` FOREIGN KEY (`ploegID`) REFERENCES `tblPloegen` (`ploegID`),
  CONSTRAINT `tblPloegRenners_tblRenners_FK` FOREIGN KEY (`rennerID`) REFERENCES `tblRenners` (`rennerID`),
  CONSTRAINT `tblPloegRenners_tblTours_FK` FOREIGN KEY (`tourID`) REFERENCES `tblTours` (`tourID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblPloegRenners`
--

LOCK TABLES `tblPloegRenners` WRITE;
/*!40000 ALTER TABLE `tblPloegRenners` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `tblPloegRenners` VALUES
(1,1,14,101,NULL),
(1,1,15,105,NULL),
(1,1,18,103,NULL),
(1,1,178,102,14),
(1,1,179,104,NULL),
(1,1,180,106,NULL),
(1,1,181,107,NULL),
(1,1,182,108,NULL),
(1,3,156,61,NULL),
(1,3,157,62,NULL),
(1,3,158,63,NULL),
(1,3,159,64,NULL),
(1,3,160,65,NULL),
(1,3,161,66,NULL),
(1,3,162,67,NULL),
(1,3,163,68,NULL),
(1,4,114,163,NULL),
(1,4,215,161,NULL),
(1,4,216,162,NULL),
(1,4,217,164,NULL),
(1,4,218,165,NULL),
(1,4,219,166,NULL),
(1,4,220,167,NULL),
(1,4,221,168,NULL),
(1,5,8,52,NULL),
(1,5,9,55,NULL),
(1,5,150,51,NULL),
(1,5,151,53,NULL),
(1,5,152,54,NULL),
(1,5,153,56,NULL),
(1,5,154,57,NULL),
(1,5,155,58,NULL),
(1,6,75,211,NULL),
(1,6,76,214,NULL),
(1,6,77,218,NULL),
(1,6,247,212,13),
(1,6,248,213,NULL),
(1,6,249,215,NULL),
(1,6,250,216,NULL),
(1,6,251,217,NULL),
(1,7,29,42,NULL),
(1,7,105,41,NULL),
(1,7,107,44,NULL),
(1,7,145,43,NULL),
(1,7,146,45,NULL),
(1,7,147,46,NULL),
(1,7,148,47,NULL),
(1,7,149,48,NULL),
(1,9,132,181,NULL),
(1,9,134,187,NULL),
(1,9,226,182,2),
(1,9,227,183,NULL),
(1,9,228,184,NULL),
(1,9,229,185,NULL),
(1,9,230,186,NULL),
(1,9,231,188,NULL),
(1,11,48,84,NULL),
(1,11,49,81,NULL),
(1,11,51,82,NULL),
(1,11,54,87,NULL),
(1,11,55,83,NULL),
(1,11,170,85,NULL),
(1,11,171,86,NULL),
(1,11,172,88,NULL),
(1,13,99,111,NULL),
(1,13,118,115,NULL),
(1,13,121,117,NULL),
(1,13,122,118,NULL),
(1,13,183,112,21),
(1,13,184,113,NULL),
(1,13,185,114,NULL),
(1,13,186,116,4),
(1,14,81,151,3),
(1,14,86,156,NULL),
(1,14,209,152,NULL),
(1,14,210,153,13),
(1,14,211,154,16),
(1,14,212,155,NULL),
(1,14,213,157,NULL),
(1,14,214,158,NULL),
(1,15,35,31,NULL),
(1,15,65,33,NULL),
(1,15,66,35,NULL),
(1,15,71,36,NULL),
(1,15,141,32,NULL),
(1,15,142,34,NULL),
(1,15,143,37,NULL),
(1,15,144,38,NULL),
(1,16,13,141,7),
(1,16,115,148,NULL),
(1,16,201,142,NULL),
(1,16,202,143,NULL),
(1,16,203,144,NULL),
(1,16,204,145,NULL),
(1,16,205,146,NULL),
(1,16,206,147,NULL),
(1,17,22,176,NULL),
(1,17,46,171,NULL),
(1,17,84,177,NULL),
(1,17,128,178,NULL),
(1,17,222,172,NULL),
(1,17,223,173,11),
(1,17,224,174,NULL),
(1,17,225,175,NULL),
(1,18,23,21,NULL),
(1,18,30,22,NULL),
(1,18,57,24,NULL),
(1,18,63,23,NULL),
(1,18,82,28,NULL),
(1,18,138,25,17),
(1,18,139,26,NULL),
(1,18,140,27,NULL),
(1,19,25,91,16),
(1,19,26,95,NULL),
(1,19,27,94,NULL),
(1,19,173,92,NULL),
(1,19,174,93,NULL),
(1,19,175,96,7),
(1,19,176,97,21),
(1,19,177,98,NULL),
(1,20,125,73,NULL),
(1,20,126,75,NULL),
(1,20,133,71,NULL),
(1,20,165,72,NULL),
(1,20,166,74,NULL),
(1,20,167,76,NULL),
(1,20,168,77,NULL),
(1,20,169,78,NULL),
(1,22,239,201,NULL),
(1,22,240,202,NULL),
(1,22,241,203,NULL),
(1,22,242,204,NULL),
(1,22,243,205,NULL),
(1,22,244,206,NULL),
(1,22,245,207,NULL),
(1,22,246,208,NULL),
(1,23,28,191,NULL),
(1,23,232,192,7),
(1,23,233,193,NULL),
(1,23,234,194,NULL),
(1,23,235,195,NULL),
(1,23,236,196,NULL),
(1,23,237,197,10),
(1,23,238,198,NULL),
(1,24,1,11,16),
(1,24,4,16,NULL),
(1,24,5,18,NULL),
(1,24,7,17,NULL),
(1,24,12,12,NULL),
(1,24,85,14,NULL),
(1,24,136,13,NULL),
(1,24,137,15,NULL),
(1,25,34,1,NULL),
(2,25,34,1,NULL),
(1,25,36,4,19),
(1,25,38,8,NULL),
(1,25,39,5,NULL),
(1,25,42,7,NULL),
(1,25,44,2,NULL),
(1,25,83,6,NULL),
(1,25,135,3,NULL),
(1,26,95,121,NULL),
(1,26,96,124,NULL),
(1,26,98,128,NULL),
(1,26,187,122,NULL),
(1,26,188,123,15),
(1,26,189,125,NULL),
(1,26,190,126,NULL),
(1,26,191,127,7),
(1,27,113,221,13),
(1,27,252,222,NULL),
(1,27,253,223,NULL),
(1,27,254,224,5),
(1,27,255,225,NULL),
(1,27,256,226,NULL),
(1,27,257,227,NULL),
(1,27,258,228,18),
(1,28,193,131,NULL),
(1,28,194,132,NULL),
(1,28,195,133,NULL),
(1,28,196,134,NULL),
(1,28,197,135,NULL),
(1,28,198,136,NULL),
(1,28,199,137,NULL),
(1,28,200,138,16);
/*!40000 ALTER TABLE `tblPloegRenners` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `tblPloegen`
--

DROP TABLE IF EXISTS `tblPloegen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblPloegen` (
  `ploegID` int(11) NOT NULL AUTO_INCREMENT,
  `naam` varchar(255) DEFAULT NULL,
  `landID` varchar(10) DEFAULT NULL,
  `ploegCode` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`ploegID`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblPloegen`
--

LOCK TABLES `tblPloegen` WRITE;
/*!40000 ALTER TABLE `tblPloegen` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `tblPloegen` VALUES
(1,'Alpecin-Deceuninck','BE','ADC'),
(2,'Arkéa-B&B Hotels','FR','ARK'),
(3,'Astana Qazaqstan Team','KZ','AST'),
(4,'Cofidis','FR','COF'),
(5,'Decathlon AG2R La Mondiale Team','FR','DAT'),
(6,'Team dsm-firmenich PostNL','NL','DFP'),
(7,'EF Education-EasyPost','US','EFE'),
(8,'Euskaltel-Euskadi','ES','EUS'),
(9,'Groupama-FDJ','FR','GFC'),
(10,'Intermarché-Wanty','BE','ICW'),
(11,'INEOS Grenadiers','GB','INE'),
(12,'Israel - Premier Tech','IL','IPT'),
(13,'Team Jayco AlUla','AU','JAY'),
(14,'Lotto Dstny','BE','LTD'),
(15,'Lidl-Trek','US','LTK'),
(16,'Movistar Team','ES','MOV'),
(17,'Q36.5 Pro Cycling Team','CH','Q36'),
(18,'Red Bull-BORA-hansgrohe','DE','RBH'),
(19,'Soudal Quick-Step','BE','SOQ'),
(20,'Bahrain Victorious','BH','TBV'),
(21,'TDT-Unibet Cycling Team','NL','TDT'),
(22,'TotalEnergies','FR','TEN'),
(23,'Tudor Pro Cycling Team','CH','TUD'),
(24,'Team Visma | Lease a Bike','NL','TVL'),
(25,'UAE Team Emirates','AE','UAD'),
(26,'Uno-X Mobility','NO','UXM'),
(27,'Caja Rural-Seguros RGA','ES','CJR'),
(28,'NSN Cycling Team','CH','NSN');
/*!40000 ALTER TABLE `tblPloegen` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `tblPools`
--

DROP TABLE IF EXISTS `tblPools`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblPools` (
  `poolID` int(11) NOT NULL AUTO_INCREMENT,
  `tourID` int(11) NOT NULL,
  `Naam` varchar(255) DEFAULT NULL,
  `Org` varchar(255) DEFAULT NULL,
  `StartInschr` datetime DEFAULT NULL,
  `EindInschr` datetime DEFAULT NULL,
  PRIMARY KEY (`poolID`),
  KEY `tourID` (`tourID`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblPools`
--

LOCK TABLES `tblPools` WRITE;
/*!40000 ALTER TABLE `tblPools` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `tblPools` VALUES
(1,1,'TDF Pool 2026','Cafe de Laurierboom','2026-07-01 00:00:00','2026-10-31 00:00:00');
/*!40000 ALTER TABLE `tblPools` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `tblPuntenToekenning`
--

DROP TABLE IF EXISTS `tblPuntenToekenning`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblPuntenToekenning` (
  `prestatieID` int(11) DEFAULT NULL,
  `poolID` int(11) DEFAULT NULL,
  `Omschrijving` varchar(100) DEFAULT NULL,
  `Punten` int(11) DEFAULT NULL,
  KEY `tblPuntenToekenning_prestatieID_IDX` (`prestatieID`,`poolID`) USING BTREE,
  KEY `tblPuntenToekenning_tblPools_FK` (`poolID`),
  CONSTRAINT `tblPuntenToekenning_tblPools_FK` FOREIGN KEY (`poolID`) REFERENCES `tblPools` (`poolID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblPuntenToekenning`
--

LOCK TABLES `tblPuntenToekenning` WRITE;
/*!40000 ALTER TABLE `tblPuntenToekenning` DISABLE KEYS */;
set autocommit=0;
/*!40000 ALTER TABLE `tblPuntenToekenning` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `tblRenners`
--

DROP TABLE IF EXISTS `tblRenners`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblRenners` (
  `rennerID` int(11) NOT NULL AUTO_INCREMENT,
  `anaam` varchar(255) DEFAULT NULL,
  `tnaam` varchar(255) DEFAULT NULL,
  `vnaam` varchar(255) DEFAULT NULL,
  `landID` varchar(10) DEFAULT NULL,
  `gebDatum` date DEFAULT NULL,
  PRIMARY KEY (`rennerID`)
) ENGINE=InnoDB AUTO_INCREMENT=259 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblRenners`
--

LOCK TABLES `tblRenners` WRITE;
/*!40000 ALTER TABLE `tblRenners` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `tblRenners` VALUES
(1,'Vingegaard',NULL,'Jonas','DK','1996-12-10'),
(2,'Aert','van','Wout','BE','1994-09-15'),
(3,'Kelderman',NULL,'Wilco','NL','1991-03-25'),
(4,'Jorgenson',NULL,'Matteo','US','1999-07-01'),
(5,'Piganzoli',NULL,'Davide','IT','2002-07-08'),
(6,'Laporte',NULL,'Christophe','FR','1992-12-11'),
(7,'Kuss',NULL,'Sepp','US','1994-09-13'),
(8,'Benoot',NULL,'Tiesj','BE','1994-03-11'),
(9,'Kooij',NULL,'Olav','NL','2001-10-17'),
(10,'Tulett',NULL,'Ben','GB','2001-08-26'),
(11,'Valter',NULL,'Attila','HU','1998-06-12'),
(12,'Affini',NULL,'Edoardo','IT','1996-06-24'),
(13,'Uijtdebroeks',NULL,'Cian','BE','2003-02-28'),
(14,'Poel','van der','Mathieu','NL','1995-01-19'),
(15,'Philipsen',NULL,'Jasper','BE','1998-03-02'),
(16,'Groves',NULL,'Kaden','AU','1998-12-23'),
(17,'Bayer',NULL,'Tobias','AT','1999-11-17'),
(18,'Dillier',NULL,'Silvan','CH','1990-08-03'),
(19,'Hermans',NULL,'Quinteten','BE','1995-06-08'),
(20,'Kragh Andersen',NULL,'Søren','DK','1994-08-10'),
(21,'Laurance',NULL,'Axel','FR','2001-04-13'),
(22,'Meurisse',NULL,'Xandro','BE','1992-01-31'),
(23,'Evenepoel',NULL,'Remco','BE','2000-01-25'),
(24,'Landa',NULL,'Mikel','ES','1989-12-13'),
(25,'Merlier',NULL,'Tim','BE','1992-10-30'),
(26,'Baarle','van','Dylan','NL','1992-05-21'),
(27,'Stuyven',NULL,'Jasper','BE','1992-04-17'),
(28,'Alaphilippe',NULL,'Julian','FR','1992-06-11'),
(29,'Asgreen',NULL,'Kasper','DK','1995-02-08'),
(30,'Cattaneo',NULL,'Mattia','IT','1990-10-25'),
(31,'Van Wilder',NULL,'Ilian','BE','2000-05-14'),
(32,'Vansevenant',NULL,'Mauri','BE','1999-06-01'),
(33,'Lamperti',NULL,'Luke','US','2002-12-31'),
(34,'Pogačar',NULL,'Tadej','SI','1998-09-21'),
(35,'Ayuso',NULL,'Juan','ES','2002-09-16'),
(36,'McNulty',NULL,'Brandon','US','1998-04-02'),
(37,'Almeida',NULL,'João','PT','1998-08-05'),
(38,'Yates',NULL,'Adam','GB','1992-08-07'),
(39,'Politt',NULL,'Nils','DE','1994-03-06'),
(40,'Sivakov',NULL,'Pavel','FR','1997-07-11'),
(41,'Soler',NULL,'Marc','ES','1993-11-22'),
(42,'Wellens',NULL,'Tim','BE','1991-05-10'),
(43,'Vine',NULL,'Jay','AU','1995-11-16'),
(44,'Del Toro',NULL,'Isaac','MX','2003-11-27'),
(45,'Majka',NULL,'Rafał','PL','1989-09-12'),
(46,'Pidcock',NULL,'Tom','GB','1999-07-30'),
(47,'Rodríguez',NULL,'Carlos','ES','2001-02-02'),
(48,'Ganna',NULL,'Filippo','IT','1996-07-25'),
(49,'Bernal',NULL,'Egan','CO','1997-01-13'),
(50,'Thomas',NULL,'Geraint','GB','1986-05-25'),
(51,'Arensman',NULL,'Thymen','NL','1999-12-04'),
(52,'Sheffield',NULL,'Magnus','US','2002-04-19'),
(53,'Narváez',NULL,'Jhonatan','EC','1997-03-04'),
(54,'Tarling',NULL,'Joshua','GB','2004-02-15'),
(55,'Foss',NULL,'Tobias','NO','1997-05-25'),
(56,'Roglič',NULL,'Primož','SI','1989-10-29'),
(57,'Hindley',NULL,'Jai','AU','1996-05-05'),
(58,'Vlasov',NULL,'Aleksandr','RU','1996-04-23'),
(59,'Martínez',NULL,'Daniel','CO','1996-04-25'),
(60,'Kämna',NULL,'Lennard','DE','1996-09-09'),
(61,'Jungels',NULL,'Bob','LU','1992-09-22'),
(62,'Poppel','van','Danny','NL','1993-07-26'),
(63,'Denz',NULL,'Nico','DE','1994-02-15'),
(64,'Schachmann',NULL,'Maximilian','DE','1994-01-09'),
(65,'Pedersen',NULL,'Mads','DK','1995-12-18'),
(66,'Skjelmose',NULL,'Mattias','DK','2000-09-26'),
(67,'Geoghegan Hart',NULL,'Tao','GB','1995-03-30'),
(68,'Milan',NULL,'Jonathan','IT','2000-10-01'),
(69,'Ciccone',NULL,'Giulio','IT','1994-12-20'),
(70,'Mollema',NULL,'Bauke','NL','1986-11-26'),
(71,'Skujiņš',NULL,'Toms','LV','1991-06-15'),
(72,'Oomen',NULL,'Sam','NL','1995-08-15'),
(73,'Jakobsen',NULL,'Fabio','NL','1996-08-31'),
(74,'Bardet',NULL,'Romain','FR','1990-11-09'),
(75,'Barguil',NULL,'Warren','FR','1991-10-28'),
(76,'Degenkolb',NULL,'John','DE','1989-01-07'),
(77,'Broek','van den','Frank','NL','2000-12-28'),
(78,'Uden','van','Casper','NL','2001-07-22'),
(79,'Leemreize',NULL,'Gijs','NL','1999-10-23'),
(80,'Vermaerke',NULL,'Kevin','US','2000-10-16'),
(81,'De Lie',NULL,'Arnaud','BE','2002-03-16'),
(82,'Van Gils',NULL,'Maxim','BE','1999-11-25'),
(83,'Vermeersch',NULL,'Florian','BE','1999-03-12'),
(84,'Van Moer',NULL,'Brent','BE','1998-01-12'),
(85,'Campenaerts',NULL,'Victor','BE','1991-10-28'),
(86,'Van Eetvelt',NULL,'Lennert','BE','2001-07-17'),
(87,'Vries','de','Hartthijs','NL','1996-07-11'),
(88,'Johannink',NULL,'Jelle','NL','1996-12-23'),
(89,'Pedersen',NULL,'Nicklas','DK','1993-08-03'),
(90,'Budding',NULL,'Martijn','NL','1995-08-31'),
(91,'Stockman',NULL,'Abram','BE','1996-07-31'),
(92,'Bloem',NULL,'Joren','NL','1999-12-21'),
(93,'Kopecky',NULL,'Tomas','CZ','2000-04-08'),
(94,'Kristoff',NULL,'Alexander','NO','1987-07-05'),
(95,'Halland Johannessen',NULL,'Tobias','NO','1999-08-23'),
(96,'Cort',NULL,'Magnus','DK','1993-01-16'),
(97,'Leknessund',NULL,'Andreas','NO','1999-05-21'),
(98,'Wærenskjold',NULL,'Søren','NO','2000-03-12'),
(99,'O\'Connor',NULL,'Ben','AU','1995-11-25'),
(100,'Gall',NULL,'Felix','AT','1998-02-27'),
(101,'Bennett',NULL,'Sam','IE','1990-10-16'),
(102,'Cosnefroy',NULL,'Benoît','FR','1995-10-17'),
(103,'Naesen',NULL,'Oliver','BE','1990-09-16'),
(104,'Lafay',NULL,'Victor','FR','1996-01-17'),
(105,'Carapaz',NULL,'Richard','EC','1993-05-29'),
(106,'Powless',NULL,'Neilson','US','1996-09-03'),
(107,'Healy',NULL,'Ben','IE','2000-09-11'),
(108,'Bettiol',NULL,'Alberto','IT','1993-10-29'),
(109,'Urán',NULL,'Rigoberto','CO','1987-01-26'),
(110,'Costa',NULL,'Rui','PT','1986-10-05'),
(111,'Mas',NULL,'Enric','ES','1995-01-07'),
(112,'Quintana',NULL,'Nairo','CO','1990-02-04'),
(113,'Gaviria',NULL,'Fernando','CO','1994-08-19'),
(114,'Aranburu',NULL,'Alex','ES','1995-09-19'),
(115,'Rubio',NULL,'Einer','CO','1998-02-22'),
(116,'Cavagna',NULL,'Rémi','FR','1995-08-10'),
(117,'Yates',NULL,'Simon','GB','1992-08-07'),
(118,'Matthews',NULL,'Michael','AU','1990-09-26'),
(119,'Groenewegen',NULL,'Dylan','NL','1993-06-21'),
(120,'Ewan',NULL,'Caleb','AU','1994-07-11'),
(121,'Plapp',NULL,'Luke','AU','2000-12-25'),
(122,'Schmid',NULL,'Mauro','CH','1999-11-07'),
(123,'Bilbao',NULL,'Pello','ES','1990-02-25'),
(124,'Buitrago',NULL,'Santiago','CO','1999-09-26'),
(125,'Caruso',NULL,'Damiano','IT','1987-10-12'),
(126,'Mohorič',NULL,'Matej','SI','1994-10-19'),
(127,'Haig',NULL,'Jack','AU','1993-09-06'),
(128,'Wright',NULL,'Fred','GB','1999-06-13'),
(129,'Gaudu',NULL,'David','FR','1996-10-10'),
(130,'Küng',NULL,'Stefan','CH','1993-11-16'),
(131,'Madouas',NULL,'Valentin','FR','1996-07-12'),
(132,'Grégoire',NULL,'Romain','FR','2003-01-21'),
(133,'Martinez',NULL,'Lenny','FR','2003-07-11'),
(134,'Pacher',NULL,'Quentin','FR','1992-01-06'),
(135,'Großschartner',NULL,'Felix','AT',NULL),
(136,'Armirail',NULL,'Bruno','FR',NULL),
(137,'Hagenes',NULL,'Per Strand','NO',NULL),
(138,'Lipowitz',NULL,'Florian','DE',NULL),
(139,'Tratnik',NULL,'Jan','SI',NULL),
(140,'van Dijke',NULL,'Tim','NL',NULL),
(141,'Gee-West',NULL,'Derek','CA',NULL),
(142,'Simmons',NULL,'Quinn','US',NULL),
(143,'Vacek',NULL,'Mathias','CZ',NULL),
(144,'Verona',NULL,'Carlos','ES',NULL),
(145,'Baudin',NULL,'Alex','FR',NULL),
(146,'Quinn',NULL,'Sean','US',NULL),
(147,'Steinhauser',NULL,'Georg','DE',NULL),
(148,'Valgren',NULL,'Michael','DK',NULL),
(149,'Walker',NULL,'Max','GB',NULL),
(150,'Seixas',NULL,'Paul','FR',NULL),
(151,'Bol',NULL,'Cees','NL',NULL),
(152,'Hoole',NULL,'Daan','NL',NULL),
(153,'Paret-Peintre',NULL,'Aurélien','FR',NULL),
(154,'Prodhomme',NULL,'Nicolas','FR',NULL),
(155,'Riccitello',NULL,'Matthew','US',NULL),
(156,'Higuita',NULL,'Sergio','CO',NULL),
(157,'Ballerini',NULL,'Davide','IT',NULL),
(158,'Gate',NULL,'Aaron','NZ',NULL),
(159,'Kanter',NULL,'Max','DE',NULL),
(160,'Tejada',NULL,'Harold','CO',NULL),
(161,'Teunissen',NULL,'Mike','NL',NULL),
(162,'Velasco',NULL,'Simone','IT',NULL),
(163,'Vinokurov',NULL,'Nicolas','KZ',NULL),
(164,'Fortunato',NULL,'Lorenzo','IT',NULL),
(165,'Bauhaus',NULL,'Phil','DE',NULL),
(166,'Gradek',NULL,'Kamil','PL',NULL),
(167,'Stannard',NULL,'Robert','AU',NULL),
(168,'Tiberi',NULL,'Antonio','IT',NULL),
(169,'Van Mechelen',NULL,'Vlad','BE',NULL),
(170,'Godon',NULL,'Dorian','FR',NULL),
(171,'Kwiatkowski',NULL,'Michal','PL',NULL),
(172,'Vauquelin',NULL,'Kévin','FR',NULL),
(173,'Eenkhoorn',NULL,'Pascal','NL',NULL),
(174,'Paret-Peintre',NULL,'Valentin','FR',NULL),
(175,'Van Lerberghe',NULL,'Bert','BE',NULL),
(176,'Van Wilder',NULL,'Ilan','BE',NULL),
(177,'Vervaeke',NULL,'Louis','BE',NULL),
(178,'Debruyne',NULL,'Ramses','BE',NULL),
(179,'Marsman',NULL,'Tim','NL',NULL),
(180,'Planckaert',NULL,'Edward','BE',NULL),
(181,'Rickaert',NULL,'Jonas','BE',NULL),
(182,'Verstrynge',NULL,'Emiel','BE',NULL),
(183,'Ackermann',NULL,'Pascal','DE',NULL),
(184,'Durbridge',NULL,'Luke','AU',NULL),
(185,'Engelhardt',NULL,'Felix','DE',NULL),
(186,'O\'Brien',NULL,'Kelland','AU',NULL),
(187,'Abrahamsen',NULL,'Jonas','NO',NULL),
(188,'Charmig',NULL,'Anthon','DK',NULL),
(189,'Johannessen',NULL,'Anders Halland','NO',NULL),
(190,'Skaarseth',NULL,'Anders','NO',NULL),
(191,'Træen',NULL,'Torstein','NO',NULL),
(192,'Kron',NULL,'Andreas','DK',NULL),
(193,'Girmay',NULL,'Biniam','ER',NULL),
(194,'Askey',NULL,'Lewis','GB',NULL),
(195,'Bennett',NULL,'George','NZ',NULL),
(196,'Frigo',NULL,'Marco','IT',NULL),
(197,'Louvel',NULL,'Matis','FR',NULL),
(198,'Neilands',NULL,'Krists','LV',NULL),
(199,'Stewart',NULL,'Jake','GB',NULL),
(200,'Van Asbroeck',NULL,'Tom','BE',NULL),
(201,'Castrillo',NULL,'Pablo','ES',NULL),
(202,'Cepeda',NULL,'Jefferson','EC',NULL),
(203,'García',NULL,'Raúl','ES',NULL),
(204,'Heßmann',NULL,'Michel','DE',NULL),
(205,'Oliveira',NULL,'Nelson','PT',NULL),
(206,'Romo',NULL,'Javier','ES',NULL),
(207,'Adrià',NULL,'Roger','ES',NULL),
(208,'Romeo',NULL,'Iván','ES',NULL),
(209,'Artz',NULL,'Huub','NL',NULL),
(210,'Berckmoes',NULL,'Jenno','BE',NULL),
(211,'Craps',NULL,'Lars','BE',NULL),
(212,'Slock',NULL,'Liam','BE',NULL),
(213,'Veistroffer',NULL,'Baptiste','FR',NULL),
(214,'Zimmermann',NULL,'Georg','DE',NULL),
(215,'Izagirre',NULL,'Ion','ES',NULL),
(216,'Allegaert',NULL,'Piet','BE',NULL),
(217,'Biermans',NULL,'Jenthe','BE',NULL),
(218,'Fretin',NULL,'Milan','BE',NULL),
(219,'Kirsch',NULL,'Alex','LU',NULL),
(220,'Page',NULL,'Hugo','FR',NULL),
(221,'Thomas',NULL,'Benjamin','FR',NULL),
(222,'Azparren',NULL,'Xabier','ES',NULL),
(223,'Harper',NULL,'Chris','AU',NULL),
(224,'Hermans',NULL,'Quinten','BE',NULL),
(225,'Howson',NULL,'Damien','AU',NULL),
(226,'Berthet',NULL,'Clément','FR',NULL),
(227,'Braz Afonso',NULL,'Clément','FR',NULL),
(228,'Costiou',NULL,'Ewen','FR',NULL),
(229,'Germani',NULL,'Lorenzo','IT',NULL),
(230,'Martin-Guyonnet',NULL,'Guillaume','FR',NULL),
(231,'Russo',NULL,'Clément','FR',NULL),
(232,'de Kleijn',NULL,'Arvid','NL',NULL),
(233,'Haller',NULL,'Marco','AT',NULL),
(234,'Hirschi',NULL,'Marc','CH',NULL),
(235,'Pluimers',NULL,'Rick','NL',NULL),
(236,'Storer',NULL,'Michael','AU',NULL),
(237,'Trentin',NULL,'Matteo','IT',NULL),
(238,'Voisard',NULL,'Yannis','CH',NULL),
(239,'Jegat',NULL,'Jordan','FR',NULL),
(240,'Breuillard',NULL,'Nicolas','FR',NULL),
(241,'Delbove',NULL,'Joris','FR',NULL),
(242,'Delettre',NULL,'Alexandre','FR',NULL),
(243,'Guernalec',NULL,'Thibault','FR',NULL),
(244,'Le Berre',NULL,'Mathis','FR',NULL),
(245,'Turgis',NULL,'Anthony','FR',NULL),
(246,'Vercher',NULL,'Mattéo','FR',NULL),
(247,'Biesterbos',NULL,'Frits','NL',NULL),
(248,'Bittner',NULL,'Pavel','CZ',NULL),
(249,'Dhondt',NULL,'Robbe','BE',NULL),
(250,'Märkl',NULL,'Niklas','DE',NULL),
(251,'van den Berg',NULL,'Julius','NL',NULL),
(252,'Balderstone',NULL,'Abel','ES',NULL),
(253,'Berwick',NULL,'Sebastian','AU',NULL),
(254,'Molenaar',NULL,'Alex','NL',NULL),
(255,'Nicolau',NULL,'Joel','ES',NULL),
(256,'Oldani',NULL,'Stefano','IT',NULL),
(257,'Otruba',NULL,'Jakub','CZ',NULL),
(258,'Parra',NULL,'José Félix','ES',NULL);
/*!40000 ALTER TABLE `tblRenners` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `tblStandaardPunten`
--

DROP TABLE IF EXISTS `tblStandaardPunten`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblStandaardPunten` (
  `prestatieID` int(11) NOT NULL AUTO_INCREMENT,
  `Omschrijving` varchar(100) DEFAULT NULL,
  `punten` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`prestatieID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblStandaardPunten`
--

LOCK TABLES `tblStandaardPunten` WRITE;
/*!40000 ALTER TABLE `tblStandaardPunten` DISABLE KEYS */;
set autocommit=0;
/*!40000 ALTER TABLE `tblStandaardPunten` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `tblTourPloegen`
--

DROP TABLE IF EXISTS `tblTourPloegen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblTourPloegen` (
  `tourID` int(11) NOT NULL,
  `ploegID` int(11) NOT NULL,
  `volgorde` int(11) DEFAULT NULL,
  PRIMARY KEY (`tourID`,`ploegID`),
  KEY `tblTourPloegen_tblPloegen_FK` (`ploegID`),
  CONSTRAINT `tblTourPloegen_tblPloegen_FK` FOREIGN KEY (`ploegID`) REFERENCES `tblPloegen` (`ploegID`) ON DELETE CASCADE,
  CONSTRAINT `tblTourPloegen_tblTours_FK` FOREIGN KEY (`tourID`) REFERENCES `tblTours` (`tourID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblTourPloegen`
--

LOCK TABLES `tblTourPloegen` WRITE;
/*!40000 ALTER TABLE `tblTourPloegen` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `tblTourPloegen` VALUES
(1,1,11),
(1,3,7),
(1,4,17),
(1,5,6),
(1,6,22),
(1,7,5),
(1,9,19),
(1,11,9),
(1,13,12),
(1,14,16),
(1,15,4),
(1,16,15),
(1,17,18),
(1,18,3),
(1,19,10),
(1,20,8),
(1,22,21),
(1,23,20),
(1,24,2),
(1,25,1),
(1,26,13),
(1,27,23),
(1,28,14),
(2,24,2),
(2,25,1);
/*!40000 ALTER TABLE `tblTourPloegen` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `tblTours`
--

DROP TABLE IF EXISTS `tblTours`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblTours` (
  `tourID` int(11) NOT NULL AUTO_INCREMENT,
  `naam` varchar(10) NOT NULL,
  `StartDatum` datetime DEFAULT NULL,
  `EindDatum` datetime DEFAULT NULL,
  PRIMARY KEY (`tourID`),
  KEY `tblTours_naam_IDX` (`naam`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblTours`
--

LOCK TABLES `tblTours` WRITE;
/*!40000 ALTER TABLE `tblTours` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `tblTours` VALUES
(1,'Tour 2026','2026-07-04 00:00:00','2026-07-26 00:00:00'),
(2,'Tour 2027','2027-07-04 00:00:00','2027-07-25 00:00:00');
/*!40000 ALTER TABLE `tblTours` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Temporary table structure for view `vwPloegRenners`
--

DROP TABLE IF EXISTS `vwPloegRenners`;
/*!50001 DROP VIEW IF EXISTS `vwPloegRenners`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `vwPloegRenners` AS SELECT
 1 AS `rennerID`,
  1 AS `Renner`,
  1 AS `uit`,
  1 AS `nr`,
  1 AS `ploeg`,
  1 AS `land`,
  1 AS `Opgave` */;
SET character_set_client = @saved_cs_client;

--
-- Dumping events for database 'tourpool'
--

--
-- Dumping routines for database 'tourpool'
--

--
-- Current Database: `tourpool`
--

USE `tourpool`;

--
-- Final view structure for view `vwPloegRenners`
--

/*!50001 DROP VIEW IF EXISTS `vwPloegRenners`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_uca1400_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`jeroen`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `vwPloegRenners` AS select `r`.`rennerID` AS `rennerID`,concat(`r`.`anaam`,', ',trim(concat(`r`.`vnaam`,' ',coalesce(`r`.`tnaam`,'')))) AS `Renner`,`r`.`landID` AS `uit`,`pr`.`Rugnummer` AS `nr`,`p`.`naam` AS `ploeg`,`p`.`landID` AS `land`,coalesce(`pr`.`nietGestartEtappe`,'') AS `Opgave` from ((`tblRenners` `r` left join `tblPloegRenners` `pr` on(`r`.`rennerID` = `pr`.`rennerID`)) left join `tblPloegen` `p` on(`pr`.`ploegID` = `p`.`ploegID`)) where `pr`.`tourID` = 1 order by `pr`.`Rugnummer` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-09-13 17:11:54
