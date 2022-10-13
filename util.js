///////////////////////////////////////////////////
// util Function
///////////////////////////////////////////

var degrees2metersY = function (lat) {
  var y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * 20037508.34) / 180;
  return y;
};

var degrees2metersX = function (lon) {
  var xxx = (lon * 20037508.34) / 180;
  return xxx;
};

var degrees2meters = function (lon, lat) {
  var x = (lon * 20037508.34) / 180;
  var y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * 20037508.34) / 180;
  return [x, y];
};

var meters2degress = function (x, y) {
  var lon = (x * 180) / 20037508.34;
  //thanks magichim @ github for the correction
  var lat =
    (Math.atan(Math.exp((y * Math.PI) / 20037508.34)) * 360) / Math.PI - 90;
  return [lon, lat];
};

function getPointFromLongLat(long, lat) {
  return ol.proj.transform([long, lat], "EPSG:4326", "EPSG:3857");
}

var y1 = degrees2metersY(35.0);
var y2 = degrees2metersY(36.0);
var x1 = degrees2metersX(129.0);
var x2 = degrees2metersX(130.0);

///////////////////////////////////////////////////////////////////////////////////////////////

var rome = new Feature({
  geometry: new Point(fromLonLat([129.41, 35.42])),
  messageType: 1,
  MMSI: "120548694",
  name: "rome",
});

//rome.addAISObject([1,2]);

var london = new Feature({
  geometry: new Point(fromLonLat([129.44, 35.42])),
  messageType: 1,
  MMSI: "234456677",
  name: "london",
});
//london.addAISObject([3,3]);

var madrid = new Feature({
  geometry: new Point(fromLonLat([129.46, 35.42])),
  messageType: 1,
  MMSI: "123456789",
  name: "madrid",
});

//madrid.addAISObject([4, 5]);

var iconFeature = new Feature({
  geometry: new Point(fromLonLat([129.45, 35.47])),
  messageType: 1,
  MMSI: "ggggggggg",
  name: "iconFeature",
});
//iconFeature.addAISObject([6, 7]);

rome.setStyle(
  new Style({
    image: new Icon({
      color: "#8959A8",
      crossOrigin: "anonymous",
      anchor: [0.5, 46],
      anchorXUnits: "fraction",
      anchorYUnits: "pixels",
      imgSize: [20, 20],
      src: "data/square.svg",
    }),
  })
);

london.setStyle(
  new Style({
    image: new Icon({
      color: "#4271AE",
      crossOrigin: "anonymous",
      anchor: [0.5, 46],
      anchorXUnits: "fraction",
      anchorYUnits: "pixels",
      src: "data/dot.png",
    }),
  })
);

madrid.setStyle(
  new Style({
    image: new Icon({
      color: [113, 140, 0],
      crossOrigin: "anonymous",
      anchor: [0.5, 46],
      anchorXUnits: "fraction",
      anchorYUnits: "pixels",
      src: "data/dot.png",
      angle: Math.PI / 4,
    }),
  })
);

var iconStyle = new Style({
  image: new Icon({
    anchor: [0.5, 46],
    anchorXUnits: "fraction",
    anchorYUnits: "pixels",
    src: "data/dot.png",
  }),
});

iconFeature.setStyle(iconStyle);

function createEarthquakeStyle(feature) {
  // 2012_Earthquakes_Mag5.kml stores the magnitude of each earthquake in a
  // standards-violating <magnitude> tag in each Placemark.  We extract it
  // from the Placemark's name instead.
  var name = feature.get("name");
  var magnitude = parseFloat(name.substr(2));
  var radius = 5 + 20 * (magnitude - 5);

  return new Style({
    geometry: feature.getGeometry(),
    image: new RegularShape({
      radius1: radius,
      radius2: 3,
      points: 5,
      angle: Math.PI,
      fill: earthquakeFill,
      stroke: earthquakeStroke,
    }),
  });
}

///////////////////////////////////////////////////
// util Function
///////////////////////////////////////////
var degrees2metersY = function (lat) {
  var y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * 20037508.34) / 180;
  return y;
};

var degrees2metersX = function (lon) {
  var xxx = (lon * 20037508.34) / 180;
  return xxx;
};

var degrees2meters = function (lon, lat) {
  var x = (lon * 20037508.34) / 180;
  var y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * 20037508.34) / 180;
  return [x, y];
};

var meters2degress = function (x, y) {
  var lon = (x * 180) / 20037508.34;
  //thanks magichim @ github for the correction
  var lat =
    (Math.atan(Math.exp((y * Math.PI) / 20037508.34)) * 360) / Math.PI - 90;
  return [lon, lat];
};

function getPointFromLongLat(long, lat) {
  return ol.proj.transform([long, lat], "EPSG:4326", "EPSG:3857");
}

var y1 = degrees2metersY(35.0);
var y2 = degrees2metersY(36.0);
var x1 = degrees2metersX(129.0);
var x2 = degrees2metersX(130.0);
