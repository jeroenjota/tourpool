const poolSetting = {
    inleg: 10,
    rennerAant: 8,
    reserveAant: 4,
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
                groen: [4],
                bol: [4],
                wit: [4],
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
        nr: 1,
        datum: '2022-07-02',
        van: 'Kopenhagen',
        naar: 'Kopenhagen',
        km: 13,
        type: 'tijdrit'
    }, {
        nr: 2,
        datum: '2022-07-02',
        van: 'Roskilde',
        naar: 'Nyborg',
        km: 199,
        type: 'heuvels'
    }, {
        nr: 3,
        datum: '2022-07-03',
        van: 'Vejle',
        naar: 'Soderborg',
        km: 182,
        type: 'vlak'
    }, {
        datum: '2022-07-04',
        van: 'rustdag'
    }, {
        nr: 4,
        datum: '2022-07-05',
        van: 'Duinkerken',
        naar: 'Calais',
        km: 172,
        type: 'heuvels'
    }, {
        nr: 5,
        datum: '2022-07-06',
        van: 'Lille',
        naar: 'Arenberg',
        km: 155,
        type: 'kasseien'
    }, {
        nr: 6,
        datum: '2022-07-07',
        van: 'Binche',
        naar: 'Longwy',
        km: 220,
        type: 'heuvels'
    }, {
        nr: 7,
        datum: '2022-07-08',
        van: 'Tomblaine',
        naar: 'La Planche des Belles-Filles',
        km: 176,
        type: 'bergen'
    }, {
        nr: 8,
        datum: '2022-07-09',
        van: 'Dole',
        naar: 'Lausanne',
        km: 182,
        type: 'vlak'
    }, {
        nr: 9,
        datum: '2022-07-10',
        van: 'Aigle',
        naar: 'Châtel',
        km: 183,
        type: 'bergen'
    }, {
        datum: '2022-07-11',
        van: 'rustdag'
    }, {
        nr: 10,
        datum: '2022-07-12',
        van: 'Morzine',
        naar: 'Megève',
        km: 148,
        type: 'heuvels'
    }]
}

module.exports = poolSetting