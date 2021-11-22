const poolSetting = {
    inleg: 10,
    rennerAant: 8,
    reserveAant: 4,
    rennerstotaal: 12,
    dagScoreHoogPrijs: 2.5,
    dagTotaalHoogPrijs: 1,
    dagTotaalLaagPrijs: 0.1,
    eindScorePerc: [50, 30, 15, 5],
    eindScoreLaatstPrijs: 10,
    punten: {
        etappe: {
            uitslag: [15, 10, 7, 5, 3, 1],
            truien: {
                geel: [5, 3, 1],
                groen: [3, 1],
                bol: [3, 1],
                wit: [3],
            }
        },
        eindstand: {
            geel: [50, 35, 25, 20, 15, 5],
            groen: [10, 6, 3],
            bol: [10, 6, 3],
            wit: [10, 6, 3],
        }
    },
    tourjaar: 2022,
    tourdatum: {
        start: '2022-07-02',
        eind: '2022-07-24'
    },

    tourEtappes: [{
            "nr": 1,
            "datum": "2022-7-2",
            "van": "Kopenhagen ",
            "naar": " Kopenhagen",
            "kms": 13,
            "type": "tijdrit"
        },
        {
            "nr": 2,
            "datum": "2022-7-2",
            "van": "Roskilde ",
            "naar": " Nyborg",
            "kms": 199,
            "type": "heuvels"
        },
        {
            "nr": 3,
            "datum": "2022-7-3",
            "van": "Vejle ",
            "naar": " Sønderborg",
            "kms": 182,
            "type": "vlak"
        },
        {
            "nr": null,
            "datum": "2022-7-4",
            "van": "",
            "naar": "",
            "kms": null,
            "type": "rustdag"
        },
        {
            "nr": 4,
            "datum": "2022-7-5",
            "van": "Duinkerke ",
            "naar": " Calais",
            "kms": 172,
            "type": "heuvels"
        },
        {
            "nr": 5,
            "datum": "2022-7-6",
            "van": "Lille ",
            "naar": " Arenberg",
            "kms": 155,
            "type": "kasseien"
        },
        {
            "nr": 6,
            "datum": "2022-7-7",
            "van": "Binche ",
            "naar": " Longwy",
            "kms": 220,
            "type": "heuvels"
        },
        {
            "nr": 7,
            "datum": "2022-7-8",
            "van": "Tomblaine ",
            "naar": " La Planche des Belles Filles",
            "kms": 176,
            "type": "bergen"
        },
        {
            "nr": 8,
            "datum": "2022-7-9",
            "van": "Dole ",
            "naar": " Lausanne",
            "kms": 184,
            "type": "heuvels"
        },
        {
            "nr": 9,
            "datum": "2022-7-10",
            "van": "Aigle ",
            "naar": " Châtel",
            "kms": 183,
            "type": "bergen"
        },
        {
            "nr": null,
            "datum": "2022-7-11",
            "van": "",
            "naar": "",
            "kms": null,
            "type": "rustdag"
        },
        {
            "nr": 10,
            "datum": "2022-7-12",
            "van": "Morzine ",
            "naar": " Megève",
            "kms": 148,
            "type": "heuvels"
        },
        {
            "nr": 11,
            "datum": "2022-7-13",
            "van": "Albertville ",
            "naar": " Col du Granon",
            "kms": 149,
            "type": "bergen"
        },
        {
            "nr": 12,
            "datum": "2022-7-14",
            "van": "Briançon ",
            "naar": " Alpe d’Huez",
            "kms": 166,
            "type": "bergen"
        },
        {
            "nr": 13,
            "datum": "2022-7-15",
            "van": "Bourg d’Oisans ",
            "naar": " Saint-Etienne",
            "kms": 193,
            "type": "heuvels"
        },
        {
            "nr": 14,
            "datum": "2022-7-16",
            "van": "Saint-Etienne ",
            "naar": " Mende",
            "kms": 195,
            "type": "heuvels"
        },
        {
            "nr": 15,
            "datum": "2022-7-17",
            "van": "Rodez ",
            "naar": " Carcassonne",
            "kms": 200,
            "type": "vlak"
        },
        {
            "nr": null,
            "datum": "2022-7-18",
            "van": "",
            "naar": "",
            "kms": null,
            "type": "rustdag"
        },
        {
            "nr": 16,
            "datum": "2022-7-19",
            "van": "Carcassonne ",
            "naar": " Foix",
            "kms": 179,
            "type": "heuvels"
        },
        {
            "nr": 17,
            "datum": "2022-7-20",
            "van": "Saint-Gaudens ",
            "naar": " Peyragudes",
            "kms": 130,
            "type": "bergen"
        },
        {
            "nr": 18,
            "datum": "2022-7-21",
            "van": "Lourdes ",
            "naar": " Hautacam",
            "kms": 143,
            "type": "bergen"
        },
        {
            "nr": 19,
            "datum": "2022-7-22",
            "van": "Castelnau-Magnoac ",
            "naar": " Cahors",
            "kms": 189,
            "type": "vlak"
        },
        {
            "nr": 20,
            "datum": "2022-7-23",
            "van": "Lacapelle-Marival ",
            "naar": " Rocamadour",
            "kms": 40,
            "type": "tijdrit"
        },
        {
            "nr": 21,
            "datum": "2022-7-24",
            "van": "Thoiry ",
            "naar": " Parijs",
            "kms": 112,
            "type": "vlak"
        }
    ]
}

module.exports = poolSetting