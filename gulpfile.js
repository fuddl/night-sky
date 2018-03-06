const gulp = require('gulp');
const pug = require('gulp-pug');
const yaml = require('js-yaml');
const fs = require('fs');
const d3geo = require("d3-geo");
const d3GeoProjection = require("d3-geo-projection");
const svg_to_png = require('svg-to-png');
const simplify = require('simplify-geojson');
const d3 = require("d3");
const rename = require("gulp-rename");
const jf = require('jsonfile');
const svgmin = require('gulp-svgmin');
const inlineCss = require('gulp-inline-css');
const replace = require('gulp-replace');
const d3gcp = require('d3-geo-polygon');
const centroid = require('polygon-centroid');
const wdk = require('wikidata-sdk');
const breq = require('bluereq');
const Crawler = require("crawler");


function RAhToLon(val) {
  return (((360 / 24) * val))*-1;
}

let milkyWay = simplify(require('./data/milkyway.json'), .2);
let constellationsBounds = require('./data/constellations.bounds.json');
let constellationsLines = require('./data/constellations.lines.json');
 
const ecliptic = { 
  "type": "FeatureCollection",
  "features": [
  { "type": "Feature",
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [RAhToLon(24), 0], [RAhToLon(6), 20], [RAhToLon(12), 0], [RAhToLon(18), -20], [RAhToLon(24), 0]
        ]
      },
    },
  ]
}

let constellations = yaml.safeLoad(fs.readFileSync('data/constellations.yml', 'utf8'));
let constellationsWd = yaml.safeLoad(fs.readFileSync('data/constellations.wd.yml', 'utf8'));

for (key in constellations.constellations) {
  if (constellations.constellations[key].wd) {
    constellations.constellations[key].wikidata = constellationsWd[constellations.constellations[key].wd];
  }
}



const styles = [
//  'textbook', 
//  'toner', 
  'futura'
];


const northPole = { "type": "Point", 
  "coordinates": [0, -90]
}

const motifs = {
  /*
  'rect': {
    'preclip': false,
    'ratio': 2,
    'projection': d3geo.geoEquirectangular(),
    'background': { 
      "type": "Polygon", 
      "coordinates": [
        [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]
      ]
    }
  },
  'natural': {
    'preclip': false,
    'ratio': 2,
    'projection': d3geo.geoNaturalEarth1(),
    'background': { 
      "type": "Polygon", 
      "coordinates": [
        [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]
      ]
    }
  },
  */
  'ary-north': {
    'subject': 'Q10294637',
    'preclip': true,
    'ratio': 1,
    'projection': d3GeoProjection.geoAiry().rotate([0, -90]),
    'background': {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [[-180, 0], [90, 0], [0, 0], [-90, 0], [ -180, 0]]
            ]
          },
          "properties": {}
        }
      ]
    }
  },
  'ary-south': {
    'preclip': true,
    'subject': 'Q10294638',
    'ratio': 1,
    'projection': d3GeoProjection.geoAiry().rotate([0, 90]),
    'background': {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [[-180, 0], [-90, 0], [0, 0], [90, 0], [-180, 0]]
            ]
          },
          "properties": {}
        }
      ]
    }
  },/*
  'ary-summer': {
    'preclip': true,
    'ratio': 1,
    'projection': d3GeoProjection.geoAiry().rotate([0, 90]),
    'background': {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [[0, 90], [0, -90], [180, -180], [180, 180], [0, 90]]
            ]
          },
          "properties": {}
        }
      ]
    }
  }*/
};

const langs = [
/*  'en', 
  'de', 
  'ru', 
  'nl', 
  'fr',  */
  'eo',
  //'pl', 
  'zxx'
];

let pugTasks = [];

let stars = [];

const height = 2000;

let graticule = {
  v: [],
  h: [],
};

for (var i = -180; i < 180; i = i + 10) {
  graticule.v.push({ 
    "type": "FeatureCollection",
    "features": [
      { "type": "Feature",
        "geometry": {
          "type": "LineString",
          "coordinates": [
            [i, -80], [i, 0], [i, 80]
            ]
          },
        },
      ]
    })
}
for (var i = -90; i <= 90; i = i + 10) {
  let points = [];
  let j = -180;
  while (j <= 180) {
    points.push([j, i]);
    j = j + 4;
  }
  graticule.h.push({ 
    "type": "FeatureCollection",
    "features": [
      { "type": "Feature",
        "geometry": {
          "type": "LineString",
          "coordinates": points
          },
        },
      ]
    })
}

for (style of styles) {
  for (m in motifs) {
    let stars = jf.readFileSync('./data/catalog.json').stars;

    //console.log(motifs[m].background);
    motifs[m]
      .projection
      .fitHeight(height, motifs[m].background);
    if(motifs[m].preclip) {
      motifs[m]
        .projection
        .preclip(d3gcp.geoClipPolygon(motifs[m].background));
    }

    for(s in stars) {
      let c = motifs[m].projection([RAhToLon(stars[s].RAh), stars[s].DEd])
      stars[s].c = {x: c[0], y: c[1]};
    }

    let background = d3geo.geoPath(motifs[m].projection)(motifs[m].background);

    let eclipticPath = d3geo.geoPath(motifs[m].projection)(ecliptic);
    let graticulePaths = {
      h: [],
      v: []
    }

    for (direction in graticule) {
      for(line in graticule[direction]) {
        graticulePaths[direction][line] = d3geo.geoPath(motifs[m].projection)(graticule[direction][line]);
      }
    }

    let mwLayers = [];

    for(geometry of milkyWay.features) {
      let path = d3geo.geoPath(motifs[m].projection)(geometry);
      mwLayers.push(path);
    }


    for (let lang of langs) {
      let taskname = m + '-' + style + '-' + lang;
      let thisStyle = '' + style;
      pugTasks.push(taskname);

      let width = height*motifs[m].ratio;

      gulp.task(taskname, function () {
        return gulp.src('templates/map.pug')
          .pipe(pug({data: {
            stars: stars,
            style: thisStyle,
            sky: background,
            graticule: graticulePaths,
            ecliptic: eclipticPath,
            constellations: constellations.constellations,
            milkyWay: mwLayers,
            stage: {
              h: height,
              w: width,
            },
            lang: lang,
            getCenter: centroid,
          }}))
          .pipe(rename(function (path) {
            path.basename = taskname;
            path.extname = ".svg"
          }))
          .pipe(inlineCss({lowerCaseTags: false}))
          /*.pipe(svgmin())*/
          .pipe(gulp.dest('./dist/'));
        });
    }
  }
}

gulp.task('gather-data', function () {
  let ids = [];
  for (key in constellations.constellations) {
    ids.push(constellations.constellations[key].wd);
  }
  const urls = wdk.getManyEntities({
    ids: ids,
    languages: langs,
  });
  let output = {};
  let c = new Crawler({
    maxConnections : 1,
    rateLimit: 1000,
    jQuery: false,
    callback : function (error, res, done) {
      if (error) {
        console.log(error);
      } else {
        let json = JSON.parse(res.body).entities;
        output = Object.assign(output, json)
      }
      done();
    }
  });
  c.queue(urls);
  c.on('drain',function(){
    fs.writeFileSync('./data/constellations.wd.yml', yaml.safeDump(output));
  });
});

gulp.task('default', pugTasks, function () {
  return gulp.watch(['templates/*.pug', 'data/*.yml'], pugTasks);
});
