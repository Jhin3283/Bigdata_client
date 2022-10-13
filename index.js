import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import {
  defaults as defaultInteractions,
  DragRotateAndZoom,
  DragBox,
} from "ol/interaction";
import TileLayer from "ol/layer/Tile";
import { OSM, TileDebug, XYZ } from "ol/source";

import { MultiPoint, Point, LineString, Polygon, Geometry } from "ol/geom";
import {
  Circle as CircleStyle,
  Fill,
  Stroke,
  Style,
  Text,
  RegularShape,
  Icon,
} from "ol/style";
import { getVectorContext } from "ol/render";
import {
  defaults as defaultControls,
  ScaleLine,
  Scale,
  PanZoomBar,
  ZoomToExtent,
} from "ol/control";

import { LayerSwitcher } from "ol/control";

import MousePosition from "ol/control/MousePosition";
import { createStringXY, closestOnCircle } from "ol/coordinate";

import { transform } from "ol/proj.js";
import GeoJSON from "ol/format/GeoJSON";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import TileJSON from "ol/source/TileJSON";

import Graticule from "ol/layer/Graticule";
import { fromLonLat } from "ol/proj";

import Feature from "ol/Feature";
import Overlay from "ol/Overlay";

import { toStringXY } from "ol/coordinate";
import { toStringHDMS } from "ol/coordinate";
import ImageStyle from "ol/style/Image";

import Draw from "ol/interaction/Draw";
import { unByKey } from "ol/Observable";
import { getArea, getLength } from "ol/sphere";
import { approximatelyEquals } from "ol/extent";
import { asArray } from "ol/color";
import html from "./index.html"

var scaleType = "scalebar";
var scaleBarText = true;
var control;

var Tabulator = require("tabulator-tables");
var mouse_mode = 0;
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

var AISSource = new VectorSource();
var VesselSource = new VectorSource();


var AISLayer = new VectorLayer({
  title: "AISLayer",
  source: AISSource,
});

var VesselLayer = new VectorLayer({
  title: "ShipLayer",
  source: VesselSource,
});


var AISVectorSource = new VectorSource();

var AISVectorLayer = new VectorLayer({
  title: "AISVectorLayer",
  source: AISVectorSource,
});

var HV_TIME = 6;

var zoomLevelChangeFlag = 0;
var prevZoomLevel = 0;

function get100PX_Distance() {
  var pixel = [100, 0];
  var pixel1 = [100, 100];

  var point = map.getCoordinateFromPixel(pixel);
  var point1 = map.getCoordinateFromPixel(pixel1);

  var latLon = meters2degress(point[0], point[1]);
  var latLon1 = meters2degress(point1[0], point1[1]);

  var options = { units: "miles" };
  return turf.rhumbDistance(latLon, latLon1, options) * 1852;
}

var lastedAISInfo = new Array();

function InitAISLayer() {
  if (localStorage.getItem("AISData")) {
    lastedAISInfo = JSON.parse(localStorage.getItem("AISData"));
  }
}

function ProcessDynamicA(Tokens1) {
  var lastedName = "";
  for (var i = 0; i < lastedAISInfo.length; i++) {
    if (lastedAISInfo[i].MMSI == Tokens1[2]) {
      lastedName = lastedAISInfo[i].name;
      lastedAISInfo.splice(i, 3);
    }
  }

  // ais_table.updateOrAddData([{ mmsi: Tokens1[2], name: lastedName }]);

  var lon = Number(Tokens1[3]);
  var lat = Number(Tokens1[4]);

  if (lon > 180 || lon < -180) {
    return;
  }
  if (lat > 85 || lat < -85) {
    return;
  }
  var courseOverGround = Number(Tokens1[6]);
  var spdOverGround = Number(Tokens1[7]);

  var aisArray = AISLayer.getSource().getFeatures();
  // AIS body update
  var found = aisArray.find(function (element) {
    return element.get("MMSI") == Tokens1[2];
  });

  var iconScalFactor = 0.3;
  var lengthFactor = 0.5;
  var breadthFactor = 0.5;

  if (found) {
    var aisCoordi = fromLonLat([lon, lat]);

    found.getGeometry().setCoordinates(aisCoordi);
    var cog = courseOverGround * (Math.PI / 180);

    found.set("datetime", Tokens1[0]);

    var track = found.get("tracks");
    track.push(aisCoordi);

    var cogs = found.get("cogs");
    cogs.push(courseOverGround);

    //message_info.innerHTML = "found = " + found.get('MMSI');
  } else {
    var obj = new Feature({
      geometry: new Point(fromLonLat([lon, lat])),
      messageType: Number(Tokens1[1]),
      MMSI: Tokens1[2],
      name: lastedName,
      heading: Number(Tokens1[5]),
      COG: courseOverGround,
      SOG: spdOverGround,
      callsign: "",
      datetime: Tokens1[0],
      refA: 0,
      refB: 0,
      refC: 0,
      refD: 0,
      selected: 0,
      cogs: [],
      tracks: [],
    });
    var cog = Number(Tokens1[6]) * (Math.PI / 180);
    var aiStyle = new Style({
      image: new Icon({
        //color: [113, 140, 0],
        opacity: 1.0,
        crossOrigin: "anonymous",
        anchor: [breadthFactor, lengthFactor],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        src: "data/dotBig.png",
        rotation: cog,
        scale: iconScalFactor,
      }),
      text: new Text({
        font: "12px Calibri,sans-serif",
        text: obj.get("name"),
        offsetY: 16,
        fill: new Fill({
          color: "#000",
        }),
        stroke: new Stroke({
          color: "#fff",
          width: 1,
        }),
      }),
    });
    obj.setStyle(aiStyle);
    AISLayer.getSource().addFeature(obj);
  }
}

function getHeadingVector(aLon, aLat, aCOG, aSOG) {
  var pt = turf.point([aLon, aLat], { "marker-color": "F00" });
  var distance = aSOG * (HV_TIME / 60);

  var options = { units: "miles" };

  //aCOG = 270;
  var destination = turf.rhumbDestination(pt, distance, aCOG, options);

  var cd = degrees2meters(
    destination["geometry"]["coordinates"][0],
    destination["geometry"]["coordinates"][1]
  );

  return [
    aLon,
    aLat,
    destination["geometry"]["coordinates"][0],
    destination["geometry"]["coordinates"][1],
  ];

  // return [0,0,0,0];
}

function ProcessBaseStation(Tokens1) {
  //var zoomLevel = map.getView().getZoom();

  var lon = Number(Tokens1[3]);
  var lat = Number(Tokens1[4]);

  if (lon > 180 || lon < -180) {
    return;
  }
  if (lat > 85 || lat < -85) {
    return;
  }

  var aisArray = AISLayer.getSource().getFeatures();
  // AIS body update
  var found = aisArray.find(function (element) {
    return element.get("MMSI") == Tokens1[2];
  });

  if (found) {
    found.set("datetime", Tokens1[0]);
  } else {
    var obj = new Feature({
      geometry: new Point(fromLonLat([lon, lat])),
      messageType: 4,
      MMSI: Tokens1[2],
      name: "",
      heading: 0,
      COG: 0,
      SOG: 0,
      callsign: "",
      datetime: Tokens1[0],
      refA: 0,
      refB: 0,
      refC: 0,
      refD: 0,
      selected: 0,
      cogs: [],
      tracks: [],
    });
    var cog = Number(Tokens1[6]) * (Math.PI / 180);
    var aiStyle = new Style({
      image: new Icon({
        color: [255, 0, 0],
        opacity: 0.8,
        crossOrigin: "anonymous",
        anchor: [0.5, 0.5],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        src: "data/dot.png",
        scale: 0.7,
      }),
      text: new Text({
        font: "14px Calibri,sans-serif",
        text: "BS",
        offsetY: 16,
        fill: new Fill({
          color: "#000",
        }),
        stroke: new Stroke({
          color: "#fff",
          width: 1,
        }),
      }),
    });
    obj.setStyle(aiStyle);
    AISLayer.getSource().addFeature(obj);
  }
}

function ProcessStaticA(Tokens1) {
  //ais_table.updateOrAddData([{ mmsi: Tokens1[2], name: Tokens1[5], callsign: Tokens1[4]}]);

  var aisArray = AISLayer.getSource().getFeatures();
  var found = aisArray.find(function (element) {
    return element.get("MMSI") == Tokens1[2];
  });

  if (found) {
    found.set("datetime", Tokens1[0]);
    found.set("callsign", Tokens1[4]);
    found.set("name", Tokens1[5]);

    if (Tokens1[7] != "") {
      found.set("refA", Number(Tokens1[7]));
    }

    if (Tokens1[8] != "") {
      found.set("refB", Number(Tokens1[8]));
    }
    if (Tokens1[9] != "") {
      found.set("refC", Number(Tokens1[9]));
    }
    if (Tokens1[10] != "") {
      found.set("refD", Number(Tokens1[10]));
    }

    var aiStyle = new Style({
      image: new Icon({
        //color: [113, 140, 0],
        opacity: 1.0,
        crossOrigin: "anonymous",
        anchor: [0.5, 0.5],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        src: "data/dotBig.png",
        rotation: found.get("cogs"),
        scale: 0.2,
      }),
      text: new Text({
        font: "12px Calibri,sans-serif",
        text: Tokens1[5],
        offsetY: 16,
        fill: new Fill({
          color: "#000",
        }),
        stroke: new Stroke({
          color: "#fff",
          width: 1,
        }),
      }),
    });
    found.setStyle(aiStyle);

    // var length = found.get('refA') + found.get('refB');
    // var breadth = found.get('refC') + found.get('refD');

    // var zoomLevel = map.getView().getZoom();

    // message_info.innerHTML = "Z:" + zoomLevel + " Static found = " + found.get('name') + "L : " + found.get('refA').toString() + ' ' + found.get('refB').toString() + ' B : '
    //     + found.get('refC').toString() + ' ' + found.get('refD').toString();
  } else {
  }
}

function ProcessDynamicB(Tokens1) {
  //ais_table.updateOrAddData([{ mmsi: Tokens1[2] }]);

  var lon = Number(Tokens1[3]);
  var lat = Number(Tokens1[4]);

  if (lon > 180 || lon < -180) {
    return;
  }
  if (lat > 85 || lat < -85) {
    return;
  }

  var courseOverGround = Number(Tokens1[6]);
  var spdOverGround = Number(Tokens1[7]);

  var aisArray = AISLayer.getSource().getFeatures();
  // AIS body update
  var found = aisArray.find(function (element) {
    return element.get("MMSI") == Tokens1[2];
  });

  var iconScalFactor = 0.3;
  var lengthFactor = 0.5;
  var breadthFactor = 0.5;

  if (found) {
    var aisCoordi = fromLonLat([lon, lat]);

    found.getGeometry().setCoordinates(aisCoordi);
    //var cog = courseOverGround * (Math.PI / 180);

    found.set("datetime", Tokens1[0]);
    found.set("heading", Number(Tokens1[5]));
    found.set("COG", courseOverGround);
    found.set("SOG", spdOverGround);

    var aiStyleTransparent = new Style({
      image: new Icon({
        //color: [113, 140, 0],
        opacity: 1.0,
        crossOrigin: "anonymous",
        anchor: [breadthFactor, lengthFactor],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        src: "data/dotBig.png",
        //rotation: cog,
        scale: iconScalFactor,
      }),

      text: new Text({
        font: "12px Calibri,sans-serif",
        text: found.get("name"),
        offsetY: 12,
        fill: new Fill({
          color: "#000",
        }),
        stroke: new Stroke({
          color: "#fff",
          width: 1,
        }),
      }),
    });

    found.setStyle(aiStyleTransparent);

    var track = found.get("tracks");
    track.push(aisCoordi);

    var cogs = found.get("cogs");
    cogs.push(courseOverGround);
  } else {
    var obj = new Feature({
      geometry: new Point(fromLonLat([lon, lat])),
      messageType: 18,
      MMSI: Tokens1[2],
      name: "",
      heading: Number(Tokens1[5]),
      COG: courseOverGround,
      SOG: spdOverGround,
      callsign: "",
      datetime: Tokens1[0],
      refA: 0,
      refB: 0,
      refC: 0,
      refD: 0,
      selected: 0,
      cogs: [],
      tracks: [],
    });
    var cog = Number(Tokens1[6]) * (Math.PI / 180);
    var aiStyle = new Style({
      image: new Icon({
        //color: [113, 140, 0],
        opacity: 1.0,
        crossOrigin: "anonymous",
        anchor: [breadthFactor, lengthFactor],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        src: "data/dotBig.png",
        rotation: cog,
        scale: iconScalFactor,
      }),
      text: new Text({
        font: "12px Calibri,sans-serif",
        text: obj.get("name"),
        offsetY: 16,
        fill: new Fill({
          color: "#000",
        }),
        stroke: new Stroke({
          color: "#fff",
          width: 1,
        }),
      }),
    });
    obj.setStyle(aiStyle);
    AISLayer.getSource().addFeature(obj);
  }
}

function ProcessStaticB(Tokens1) {
  //ais_table.updateOrAddData([{ mmsi: Tokens1[2], name: Tokens1[5] }]);

  var lon = Number(Tokens1[3]);
  var lat = Number(Tokens1[4]);

  if (lon > 180 || lon < -180) {
    return;
  }
  if (lat > 85 || lat < -85) {
    return;
  }

  var heading = Number(Tokens1[5]);
  var courseOverGround = Number(Tokens1[6]);
  var spdOverGround = Number(Tokens1[7]);

  var aisArray = AISLayer.getSource().getFeatures();

  var found = aisArray.find(function (element) {
    return element.get("MMSI") == Tokens1[2];
  });

  var iconScalFactor = 0.3;
  var lengthFactor = 0.5;
  var breadthFactor = 0.5;

  var refA = 0;
  var refB = 0;
  var refC = 0;
  var refD = 0;

  if (Tokens1[10] != "") {
    refA = Number(Tokens1[10]);
  }

  if (Tokens1[11] != "") {
    refB = Number(Tokens1[11]);
  }
  if (Tokens1[12] != "") {
    refC = Number(Tokens1[12]);
  }
  if (Tokens1[13] != "") {
    refD = Number(Tokens1[13]);
  }

  if (found) {
    var aisCoordi = fromLonLat([lon, lat]);

    found.getGeometry().setCoordinates(aisCoordi);
    //var cog = courseOverGround * (Math.PI / 180);

    found.set("datetime", Tokens1[0]);
    found.set("COG", courseOverGround);
    found.set("SOG", spdOverGround);
    found.set("heading", heading);
    found.set("callsign", Tokens1[8]);
    found.set("name", Tokens1[8]);

    found.set("refA", refA);
    found.set("refB", refB);
    found.set("refC", refC);
    found.set("refD", refD);

    //
    var aiStyleTransparent = new Style({
      image: new Icon({
        //color: [113, 140, 0],
        opacity: 1.0,
        crossOrigin: "anonymous",
        anchor: [breadthFactor, lengthFactor],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        src: "data/dotBig.png",
        //rotation: cog,
        scale: iconScalFactor,
      }),

      text: new Text({
        font: "12px Calibri,sans-serif",
        text: Tokens1[8],
        offsetY: 12,
        fill: new Fill({
          color: "#000",
        }),
        stroke: new Stroke({
          color: "#fff",
          width: 1,
        }),
      }),
    });

    //
    found.setStyle(aiStyleTransparent);
    var track = found.get("tracks");
    track.push(aisCoordi);

    var cogs = found.get("cogs");
    cogs.push(courseOverGround);

    //message_info.innerHTML = "found = " + found.get('MMSI');
  } else {
    var obj = new Feature({
      geometry: new Point(fromLonLat([lon, lat])),
      messageType: 18,
      MMSI: Tokens1[2],
      name: Tokens1[8],
      heading: heading,
      COG: courseOverGround,
      SOG: spdOverGround,
      callsign: "",
      datetime: Tokens1[0],
      refA: refA,
      refB: refB,
      refC: refC,
      refD: refD,
      selected: 0,
      cogs: [],
      tracks: [],
    });
    var cog = Number(Tokens1[6]) * (Math.PI / 180);
    var aiStyle = new Style({
      image: new Icon({
        //color: [113, 140, 0],
        opacity: 1.0,
        crossOrigin: "anonymous",
        anchor: [breadthFactor, lengthFactor],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        src: "data/dotBig.png",
        rotation: cog,
        scale: iconScalFactor,
      }),
      text: new Text({
        font: "12px Calibri,sans-serif",
        text: obj.get("name"),
        offsetY: 16,
        fill: new Fill({
          color: "#000",
        }),
        stroke: new Stroke({
          color: "#fff",
          width: 1,
        }),
      }),
    });
    obj.setStyle(aiStyle);
    AISLayer.getSource().addFeature(obj);
  }
}

function ProcessAtoNAIS(Tokens1) {
  var lon = Number(Tokens1[4]);
  var lat = Number(Tokens1[5]);

  if (lon > 180 || lon < -180) {
    return;
  }
  if (lat > 85 || lat < -85) {
    return;
  }

  var aisArray = AISLayer.getSource().getFeatures();
  // AIS body update
  var found = aisArray.find(function (element) {
    return element.get("MMSI") == Tokens1[2];
  });

  if (found) {
    found.set("name", Tokens1[3]);
    found.set("datetime", Tokens1[0]);
  } else {
    var obj = new Feature({
      geometry: new Point(fromLonLat([lon, lat])),
      messageType: 21,
      MMSI: Tokens1[2],
      name: Tokens1[3],
      heading: 0,
      COG: 0,
      SOG: 0,
      callsign: "",
      datetime: Tokens1[0],
      refA: 0,
      refB: 0,
      refC: 0,
      refD: 0,
      selected: 0,
      cogs: [],
      tracks: [],
    });
    var cog = Number(Tokens1[6]) * (Math.PI / 180);
    var aiStyle = new Style({
      image: new Icon({
        //color: [200, 40, 40],
        opacity: 0.8,
        crossOrigin: "anonymous",
        anchor: [0.5, 0.5],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        src: "data/dot.png",
        scale: 0.6,
      }),
      text: new Text({
        font: "14px Calibri,sans-serif",
        text: Tokens1[3],
        offsetY: 16,
        fill: new Fill({
          color: "#000",
        }),
        stroke: new Stroke({
          color: "#fff",
          width: 1,
        }),
      }),
    });
    obj.setStyle(aiStyle);
    AISLayer.getSource().addFeature(obj);
  }
}

function AddUpdateAISInfo(xTokens) {
  if (xTokens.length < 5) return;

  switch (xTokens[1]) {
    case "1":
    case "2":
    case "3":
      ProcessDynamicA(xTokens);
      break;
    case "4":
      ProcessBaseStation(xTokens);
      break;
    case "5":
      ProcessStaticA(xTokens);
      break;
    case "18":
      ProcessDynamicB(xTokens);
      break;
    case "19":
      ProcessStaticB(xTokens);
      break;
    case "21":
      ProcessAtoNAIS(xTokens);
      break;
  }
}

function scaleControl() {
  if (scaleType === "scaleline") {
    control = new ScaleLine({
      units: "nautical",
    });
    return control;
  }
  control = new ScaleLine({
    units: "nautical",
    bar: true,
    steps: 4,
    text: scaleBarText,
    minWidth: 140,
  });
  return control;
}

var simpleTileOSM = new XYZ({
  url: "tiles/tiles_simple/{z}/{x}/{y}.png",
});

var standardTileOSM = new XYZ({
  url: "tiles/tiles_standard/{z}/{x}/{y}.png",
});

var detailTileOSM = new XYZ({
  url: "tiles/tiles_detail/{z}/{x}/{y}.png",
});

var tileLayer = new TileLayer({
  title: "tileLayer",
  source: detailTileOSM,
});

var measureSource = new VectorSource();
var measureLayer = new VectorLayer({
  source: measureSource,
  style: new Style({
    fill: new Fill({
      color: "rgba(255, 255, 255, 0.2)",
    }),
    stroke: new Stroke({
      color: "#ffcc33",
      width: 2,
    }),
    image: new CircleStyle({
      radius: 7,
      fill: new Fill({
        color: "#ffcc33",
      }),
    }),
  }),
});

var map = new Map({
  controls: defaultControls().extend([
    scaleControl(),
    //, mousePositionControl
    //, mousePositionControl1
  ]),
  layers: [
    new TileLayer({
      source: new OSM()
  }),
    tileLayer,
    new Graticule({
      // the style to use for the lines, optional.
      strokeStyle: new Stroke({
        color: "rgba(80,80,80,0.5)",
        width: 1,
        lineDash: [0.6, 6],
      }),
      showLabels: true,
      wrapX: false,
    }),
    AISLayer,
    VesselLayer,
    // new TileLayer({
    //     source: new TileDebug()
    // }),

    measureLayer,
  ],
  target: "map",
  view: new View({
    center: transform([129.5, 35.4], "EPSG:4326", "EPSG:3857"),
    zoom: 11,
  }),
});

var element = document.getElementById("popup");
var popup = new Overlay({
  element: element,
  positioning: "bottom-center",
  stopEvent: false,
  offset: [0, -10],
});
map.addOverlay(popup);

var displayFeatureInfo = function (pixel) {
  AISLayer.getFeatures(pixel).then(function (AISs) {
    var ais = AISs.length ? AISs[0] : undefined;
    if (AISs.length) {
      var coordinates = ais.getGeometry().getCoordinates();
      popup.setPosition(coordinates);

      var str;
      if (ais.get("heading") == "511") {
        str = ais.get("COG") + "°, " + ais.get("SOG") + "kts";
      } else
        str =
          ais.get("heading") +
          "°T, " +
          ais.get("COG") +
          "°, " +
          ais.get("SOG") +
          "kts";

      var popContent;

      // var length = ais.get('refA') + ais.get('refB');
      // var breadth = ais.get('refC') + ais.get('refD');

      // if (ais.get('name') == '') {
      //     popContent = ais.get('MMSI') + ': ' + str + " L:" + ais.get('refA') + "," + ais.get('refB') + " B:" + ais.get('refC') + "," + ais.get('refD');
      // }
      // else {
      //     popContent = ais.get('name') + ': ' + ais.get('MMSI') + ': ' + str + " L:" + ais.get('refA') + "," + ais.get('refB') + " B:" + ais.get('refC') + "," + ais.get('refD');
      // }

      // var tr = ais.get('tracks');
      // popContent += ' track len : ' + tr.length + ' Selected = ' + ais.get('selected');

      popContent =
        ais.get("datetime") +
        " : " +
        ais.get("MMSI") +
        " : " +
        ais.get("callsign") +
        " : " +
        ais.get("name");
      $(element).popover({
        placement: "top",
        html: true,
        content: popContent,
      });
      $(element).popover("show");

      ais_info.innerHTML =
        ais.get("name") +
        ": " +
        ais.get("MMSI") +
        " : " +
        coordinates.join(",") +
        " num obj : " +
        AISs.length;
    } else {
      ais_info.innerHTML = "&nbsp;";
      $(element).popover("destroy");
    }
  });
};

class AISObject {
  constructor(cTokens) {
    this.messageType = cTokens[1];
    this.MMSI = cTokens[2];
    this.name = "AISObject";
    this.lon = Number(cTokens[3]);
    this.lat = Number(cTokens[4]);
    this.heading = Number(cTokens[5]);
    this.COG = Number(cTokens[6]);
    this.SOG = Number(cTokens[7]);
    this.headingVectorTime = 6;
  }

  // Method HV : headingVector
  getHVLineString() {
    var pt = turf.point([this.lon, this.lat], { "marker-color": "F00" });
    var distance = this.SOG * (HV_TIME / 60);
    //var bearing = 90;
    var options = { units: "miles" };
    var destination = turf.rhumbDestination(pt, distance, this.COG, options);

    return [
      this.lon,
      this.lat,
      destination["geometry"]["coordinates"][0],
      destination["geometry"]["coordinates"][1],
    ];
  }
}

function TORADIAN(ang) {
  return (Math.PI / 180.0) * ang;
}

function GetRotatedPoint(pos, angle) {
  var theta = TORADIAN(-angle);
  //Clockwise Rotation
  var temp = [];
  temp[0] = pos[0] * Math.cos(theta) + pos[1] * Math.sin(theta);
  temp[1] = -pos[0] * Math.sin(theta) + pos[1] * Math.cos(theta);
  return temp;
}

// display popup on click
map.on("click", function (evt) {
  if (mouse_mode == 0) {
    var pixel = map.getEventPixel(evt.originalEvent);
    AISLayer.getFeatures(pixel).then(function (AISs) {
      var ais = AISs.length ? AISs[0] : undefined;
      if (AISs.length) {
        if (ais.get("selected") == 1) {
          ais.set("selected", 0);
        } else ais.set("selected", 1);
      }
    });

    // if (onOff == 1)
    //     onOff = 0;
    // else
    //     onOff = 1;

    // var coordi = fromLonLat([129.5, 35.4]);
    // var pixelXY = map.getPixelFromCoordinate(coordi);
    // var pos1 = getRLPosition(129.5, 35.4, 90, 12);

    // var coordi1 = fromLonLat(pos1["geometry"]["coordinates"]);
    // var pixelXY1 = map.getPixelFromCoordinate(coordi1);
  }

  if (mouse_mode == 1) {
    if (point_count == 3) {
      mouse_mode = 0;
      point_count = 0;

      if (measureTooltipElement) {
        measureTooltipElement.parentNode.removeChild(measureTooltipElement);
      }

      measureTooltipElement = null;
      map.removeInteraction(draw);
    }
  }
});

function DisplayMousePosition(e) {
  //var coordi = map.getEventCoordinate(e);
  //var coord = [7.85, 47.983333];

  var coord = meters2degress(e.coordinate[0], e.coordinate[1]);
  var out = toStringHDMS(coord, 2);
  document.getElementById("mouse-position").innerHTML = out; //coord.join(',');
}

// change mouse cursor when over marker
map.on("pointermove", function (e) {
  DisplayMousePosition(e);

  if (mouse_mode == 0) {
    var pixel = map.getEventPixel(e.originalEvent);
    //displayFeatureInfo(pixel);

    //var aisArray = AISLayer.getSource().getFeatures();
    // var fts = measureLayer.getSource().getFeatures();

    // document.getElementById('find_info').innerHTML = "fts length: " + fts.length;
  }
  // else {
  //     if (e.dragging) {
  //         return;
  //     }
  //     /** @type {string} */
  //     var helpMsg = 'Click to start drawing';

  //     if (sketch) {
  //         var geom = sketch.getGeometry();
  //         if (geom instanceof LineString) {
  //             helpMsg = continueLineMsg;
  //         }
  //     }

  //     helpTooltipElement.innerHTML = helpMsg;
  //     helpTooltip.setPosition(e.coordinate);

  //     helpTooltipElement.classList.remove('hidden');
  // }
});

var vectorStrokeStyle = new Stroke({
  color: "rgba(10,100,10,1.0)",
  width: 1,
});

var selectedStrokeStyle = new Stroke({
  color: "rgba(230,230,10,1.0)",
  width: 2,
});

var vectorDashStyle = new Stroke({
  color: "rgba(10,100,10,1.0)",
  lineDash: [6, 4],
  width: 1,
});

var vectorFillStyle = new Fill({ color: "rgba(52,120,58,0.25)" });
var vectorFillStyleB = new Fill({ color: "rgba(52,58,150,0.25)" });

var myStroke = new Stroke({ color: "rgba(52,120,58,0.6)", width: 2 });
var myFill = new Fill({ color: "rgba(52,120,58,0.6)" });

function getTriangle(xCoordi, bCog) {
  var centerPX = map.getPixelFromCoordinate(xCoordi);

  var pts = [];

  pts[0] = [0, -15];
  pts[1] = [7.5, 7.5];
  pts[2] = [-7.5, +7.5];

  var ptsR = [];
  ptsR[0] = GetRotatedPoint(pts[0], bCog);
  ptsR[1] = GetRotatedPoint(pts[1], bCog);
  ptsR[2] = GetRotatedPoint(pts[2], bCog);

  ptsR[0][0] += centerPX[0];
  ptsR[0][1] += centerPX[1];
  ptsR[1][0] += centerPX[0];
  ptsR[1][1] += centerPX[1];
  ptsR[2][0] += centerPX[0];
  ptsR[2][1] += centerPX[1];

  var points = [];

  points[0] = map.getCoordinateFromPixel(ptsR[0]);
  points[1] = map.getCoordinateFromPixel(ptsR[1]);
  points[2] = map.getCoordinateFromPixel(ptsR[2]);
  points[3] = map.getCoordinateFromPixel(ptsR[0]);

  return points;
}

//var onOff = 1;
function getDimension(aCoordi, bCog, refA, refB, refC, refD) {
  var centerPX = map.getPixelFromCoordinate(aCoordi);
  var px_refA = map.getPixelFromCoordinate(refA);
  var px_refB = map.getPixelFromCoordinate(refB);
  var px_refC = map.getPixelFromCoordinate(refC);
  var px_refD = map.getPixelFromCoordinate(refD);

  var Width6 = (px_refD[0] - px_refC[0]) / 6; //+ 부호
  var Width3 = (px_refD[0] - px_refC[0]) / 3; //+ 부호

  px_refA[0] -= centerPX[0];
  px_refB[0] -= centerPX[0];
  px_refC[0] -= centerPX[0];
  px_refD[0] -= centerPX[0];
  px_refA[1] -= centerPX[1];
  px_refB[1] -= centerPX[1];
  px_refC[1] -= centerPX[1];
  px_refD[1] -= centerPX[1];

  var cx = px_refD[0] - (px_refD[0] - px_refC[0]) / 2;

  var pts = [];

  pts[0] = [cx, px_refA[1]];
  pts[1] = [cx + Width6, px_refA[1] * 0.95];
  pts[2] = [cx + Width3, px_refA[1] * 0.82];
  pts[3] = [px_refD[0], px_refA[1] * 0.55];

  pts[4] = [px_refD[0], px_refD[1]];

  pts[5] = [px_refD[0], px_refB[1] * 0.95];
  pts[6] = [cx + Width6, px_refB[1]];
  pts[7] = [cx - Width6, px_refB[1]];

  pts[8] = [px_refC[0], px_refB[1] * 0.95];
  pts[9] = [px_refC[0], px_refC[1]];

  pts[10] = [px_refC[0], px_refA[1] * 0.55];
  pts[11] = [cx - Width3, px_refA[1] * 0.82];
  pts[12] = [cx - Width6, px_refA[1] * 0.95];

  var ptsR = [];
  for (var j = 0; j < 13; j++) {
    ptsR[j] = GetRotatedPoint(pts[j], bCog);
  }

  for (var i = 0; i < 13; i++) {
    ptsR[i][0] += centerPX[0];
    ptsR[i][1] += centerPX[1];
  }

  var points = [];
  for (var k = 0; k < 13; k++) {
    points[k] = map.getCoordinateFromPixel(ptsR[k]);
  }

  points[13] = map.getCoordinateFromPixel(ptsR[0]);
  return points;
}

function getRLPosition(aLon, aLat, aCOG, aDist) {
  var pt = turf.point([aLon, aLat], { "marker-color": "F00" });
  var options = { units: "miles" };
  return turf.rhumbDestination(pt, aDist, aCOG, options);
}

var imageStyle = new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "green" }),
    stroke: new Stroke({ color: "blue", width: 1 }),
  }),
});

function DisplayAIS(vc) {
  var aisArray = AISLayer.getSource().getFeatures();

  document.getElementById("ttl-ais-count").innerHTML =
    "총 AIS 척수 : " + aisArray.length + " 척                       ";

  for (var i = 0; i < aisArray.length; ++i) {
    var ais = aisArray[i];

    if (ais.get("messageType") == 4 || ais.get("messageType") == 21) continue;

    var coordi = ais.getGeometry().getCoordinates();
    var latLon = meters2degress(coordi[0], coordi[1]);

    var refA = ais.get("refA") / 1852; // dist in miles
    var refB = ais.get("refB") / 1852;
    var refC = ais.get("refC") / 1852;
    var refD = ais.get("refD") / 1852;

    var zoomLevel = map.getView().getZoom();

    var heading = ais.get("heading");
    var headingVector = 0;
    var aCog = ais.get("COG");

    if (heading == 511) {
      headingVector = aCog;
      var ls = getHeadingVector(latLon[0], latLon[1], aCog, ais.get("SOG"));
      vc.drawGeometry(
        new LineString([fromLonLat([ls[0], ls[1]]), fromLonLat([ls[2], ls[3]])])
      );
    } else {
      headingVector = heading;

      var ls1 = getHeadingVector(latLon[0], latLon[1], aCog, ais.get("SOG"));
      vc.setFillStrokeStyle(null, vectorStrokeStyle);
      vc.drawGeometry(
        new LineString([
          fromLonLat([ls1[0], ls1[1]]),
          fromLonLat([ls1[2], ls1[3]]),
        ])
      );

      var ls2 = getHeadingVector(latLon[0], latLon[1], heading, ais.get("SOG"));
      vc.setFillStrokeStyle(null, vectorDashStyle);
      vc.drawGeometry(
        new LineString([
          fromLonLat([ls2[0], ls2[1]]),
          fromLonLat([ls2[2], ls2[3]]),
        ])
      );
    }

    var temp;

    if (zoomLevel > 16) {
      if (refA != 0 || refB != 0 || refC != 0 || refD != 0) {
        // draw shape
        var posRefA = getRLPosition(latLon[0], latLon[1], 0, refA);
        var posRefB = getRLPosition(latLon[0], latLon[1], 180, refB);
        var posRefC = getRLPosition(latLon[0], latLon[1], 270, refC);
        var posRefD = getRLPosition(latLon[0], latLon[1], 90, refD);

        var coordiA = fromLonLat(posRefA["geometry"]["coordinates"]);
        var coordiB = fromLonLat(posRefB["geometry"]["coordinates"]);
        var coordiC = fromLonLat(posRefC["geometry"]["coordinates"]);
        var coordiD = fromLonLat(posRefD["geometry"]["coordinates"]);

        temp = getDimension(
          coordi,
          headingVector,
          coordiA,
          coordiB,
          coordiC,
          coordiD
        );

        if (ais.get("selected") == 1) {
          // show track
          vc.setFillStrokeStyle(vectorFillStyle, selectedStrokeStyle);
          vc.drawGeometry(new Polygon([temp]));
          ShowLineTrack(ais, vc);
          ShowShapeTrack(ais, vc, refA, refB, refC, refD);
        } else {
          vc.setFillStrokeStyle(vectorFillStyle, vectorStrokeStyle);
          vc.drawGeometry(new Polygon([temp]));
        }

        vc.setStyle(imageStyle);
        vc.drawGeometry(new Point(coordi));
      } else {
        // Draw Triangle
        temp = getTriangle(coordi, headingVector);

        if (ais.get("selected") == 1) {
          vc.setFillStrokeStyle(vectorFillStyle, selectedStrokeStyle);
        } else vc.setFillStrokeStyle(vectorFillStyle, vectorStrokeStyle);

        vc.drawGeometry(new Polygon([temp]));

        if (ais.get("selected") == 1) {
          ShowLineTrack(ais, vc);
        }
      }
    } else {
      // Draw Triangle
      temp = getTriangle(coordi, headingVector);

      if (ais.get("selected") == 1) {
        vc.setFillStrokeStyle(vectorFillStyle, selectedStrokeStyle);
      } else {
        if (ais.get("messageType") == 18)
          vc.setFillStrokeStyle(vectorFillStyleB, vectorStrokeStyle);
        else vc.setFillStrokeStyle(vectorFillStyle, vectorStrokeStyle);
      }
      vc.drawGeometry(new Polygon([temp]));

      if (ais.get("selected") == 1) {
        // show track
        ShowLineTrack(ais, vc);
      }
    }
  }
}

function ShowShapeTrack(aAis, aVC, ra, rb, rc, rd) {
  // 배열의 갯수만큼
  var trs = aAis.get("tracks");

  var cogs = aAis.get("cogs");

  for (var i = trs.length - 2; i >= 0; i--) {
    var aPos = trs[i];
    var _latLon = meters2degress(aPos[0], aPos[1]);

    var _posRefA = getRLPosition(_latLon[0], _latLon[1], 0, ra);
    var _posRefB = getRLPosition(_latLon[0], _latLon[1], 180, rb);
    var _posRefC = getRLPosition(_latLon[0], _latLon[1], 270, rc);
    var _posRefD = getRLPosition(_latLon[0], _latLon[1], 90, rd);

    var _coordiA = fromLonLat(_posRefA["geometry"]["coordinates"]);
    var _coordiB = fromLonLat(_posRefB["geometry"]["coordinates"]);
    var _coordiC = fromLonLat(_posRefC["geometry"]["coordinates"]);
    var _coordiD = fromLonLat(_posRefD["geometry"]["coordinates"]);

    var temp = getDimension(
      aPos,
      cogs[i],
      _coordiA,
      _coordiB,
      _coordiC,
      _coordiD
    );

    aVC.setFillStrokeStyle(null, trackStrokeStyle);
    aVC.drawGeometry(new Polygon([temp]));
  }
}

var trackStrokeStyle = new Stroke({
  color: "rgba(100,100,100, 1.0)",
  width: 1,
});

function ShowLineTrack(ais, vc) {
  var trs = ais.get("tracks");
  vc.setFillStrokeStyle(null, trackStrokeStyle);
  vc.drawGeometry(new LineString(trs));
}

AISLayer.on("postrender", function (event) {
  //var coordinates = [];

  var vectorContext = getVectorContext(event);
  DisplayAIS(vectorContext);

  map.render();
});

map.render();

var continueLineMsg = "Click to continue drawing the line";

/**
 * The help tooltip element.
 * @type {HTMLElement}
 */
var helpTooltipElement;

/**
 * Overlay to show the help messages.
 * @type {Overlay}
 */
var helpTooltip;

/**
 * The measure tooltip element.
 * @type {HTMLElement}
 */
var measureTooltipElement;

/**
 * Overlay to show the measurement.
 * @type {Overlay}
 */
var measureTooltip;

/**
 * Creates a new help tooltip
 */
function createHelpTooltip() {
  if (helpTooltipElement) {
    helpTooltipElement.parentNode.removeChild(helpTooltipElement);
  }
  helpTooltipElement = document.createElement("div");
  helpTooltipElement.className = "ol-tooltip hidden";
  helpTooltip = new Overlay({
    element: helpTooltipElement,
    offset: [15, 0],
    positioning: "center-left",
  });
  map.addOverlay(helpTooltip);
}

/**
 * Creates a new measure tooltip
 */
function createMeasureTooltip() {
  if (measureTooltipElement) {
    measureTooltipElement.parentNode.removeChild(measureTooltipElement);
  }
  measureTooltipElement = document.createElement("div");
  measureTooltipElement.className = "ol-tooltip ol-tooltip-measure";
  measureTooltip = new Overlay({
    element: measureTooltipElement,
    offset: [0, -15],
    positioning: "bottom-center",
  });
  map.addOverlay(measureTooltip);
}

var draw; // global so we can remove it later

/**
 * Currently drawn feature.
 * @type {import("../src/ol/Feature.js").default}
 */
var sketch;
/**
 * Format length output.
 * @param {LineString} line The line.
 * @return {string} The formatted length.
 */
var formatLength = function (line) {
  var coordis = line.getCoordinates();

  var latLon1 = meters2degress(coordis[0][0], coordis[0][1]);
  var latLon2 = meters2degress(coordis[1][0], coordis[1][1]);

  var point1 = turf.point([latLon1[0], latLon1[1]], { "marker-color": "#F00" });
  var point2 = turf.point([latLon2[0], latLon2[1]], { "marker-color": "#00F" });

  var bearing = turf.rhumbBearing(point1, point2);

  var length = getLength(line);
  var output;
  if (length >= 1000) {
    output = Math.round((length / 1852) * 100) / 100 + " " + "'";
  } else {
    output = Math.round(length * 100) / 100 + " " + "m";
  }

  if (bearing < 0) bearing += 360;

  //bearing.toFixed(1);
  output = output + " : " + bearing.toFixed(1) + "°";
  return output;
};

function addInteraction() {
  //var type = 'LineString';//(typeSelect.value == 'area' ? 'Polygon' : 'LineString');
  draw = new Draw({
    source: measureSource,
    type: "LineString",
    style: new Style({
      fill: new Fill({
        color: "rgba(255, 255, 255, 0.2)",
      }),
      stroke: new Stroke({
        color: "rgba(0, 0, 0, 0.5)",
        lineDash: [10, 10],
        width: 2,
      }),
      image: new CircleStyle({
        radius: 5,
        stroke: new Stroke({
          color: "rgba(0, 0, 0, 0.7)",
        }),
        fill: new Fill({
          color: "rgba(255, 255, 255, 0.2)",
        }),
      }),
    }),
  });
  map.addInteraction(draw);

  createMeasureTooltip();
  createHelpTooltip();

  var listener;

  draw.on("drawstart", function (evt) {
    // set sketch
    sketch = evt.feature;

    /** @type {import("../src/ol/coordinate.js").Coordinate|undefined} */
    var tooltipCoord = evt.coordinate;

    listener = sketch.getGeometry().on("change", function (evt) {
      var geom = evt.target;

      point_count = geom.getCoordinates().length;

      var output;
      if (geom instanceof LineString) {
        output = formatLength(geom);
        tooltipCoord = geom.getLastCoordinate();
      }
      measureTooltipElement.innerHTML = output;
      measureTooltip.setPosition(tooltipCoord);
    });
  });

  draw.on("drawend", function () {
    measureTooltipElement.className = "ol-tooltip ol-tooltip-static";
    measureTooltip.setOffset([0, -7]);
    // unset sketch
    sketch = null;
    // unset tooltip so that a new one can be created
    measureTooltipElement = null;
    createMeasureTooltip();
    unByKey(listener);
  });
}

//Reference to simpleHub proxy
var simpleHubProxy;

//Connect to the SignalR server and get the proxy for simpleHub
function connect() {
  var ipaddress1 = "14.42.209.254";
  var ipaddress2 = "192.168.219.177";
  var ipaddress3 = "172.30.1.30";
  var ipaddress4 = "112.218.175.109";

  var ipaddress = ipaddress4;
  //Load auto generated hub script dynamically and perform connection operation when loading completed
  //SignalR server location is specified by 'Url' input element, hub script must be loaded from the same location
  //For production, remove this call and uncomment the script block in the header part
  $.getScript("http://" + ipaddress + ":8888/signalr/hubs", function () {
    $.connection.hub.url = "http://" + ipaddress + ":8888/signalr";
    // Declare a proxy to reference the hub.
    simpleHubProxy = $.connection.simpleHub;

    //Reigster to the "AddMessage" callback method of the hub
    //This method is invoked by the hub
    simpleHubProxy.client.addMessage = function (name, message) {
      //$("label[for = 'info'").text(log);
      var xxTokens = message.split(",");
      AddUpdateAISInfo(xxTokens);
    };
    //Connect to hub
    $.connection.hub.start().done(function () {
      simpleHubProxy.server.setUserName("user");
      //AddOneFeature();
    });
  });
  ProcessDBAIS();
  ReadTable();
  InitAISLayer();
}

//Disconnect from the server
function disconnect() {
  if (simpleHubProxy != null) {
    $.connection.hub.stop().done(function () {
      simpleHubProxy = null;
    });
  }
}

window.onload = connect;
window.onunload = disconnect;
//addInteraction();

var point_count = 0;
document.getElementById("ebl_vrm").onclick = function () {
  measureSource.clear();
  measureTooltipElement = null;

  switch (mouse_mode) {
    case 0:
      mouse_mode = 1;
      addInteraction();
      // map.getViewport().addEventListener('mouseout', function () {
      //     helpTooltipElement.classList.add('hidden');
      // });

      //document.getElementById('find_info').innerHTML = "interaction added. : " + mouse_mode ;
      break;
    case 1:
      mouse_mode = 0;
      map.removeInteraction(draw);
      //document.getElementById('find_info').innerHTML = "interaction removed. : " + mouse_mode;
      break;
  }
};

document.body.style.overflow = "hidden";

var option = function () {
  var simpleTiles = document.getElementById("simple_tiles");
  var standardTiles = document.getElementById("standard_tiles");
  var detailTiles = document.getElementById("detail_tiles");

  var clickHandlerSimple = function () {
    tileLayer.setSource(simpleTileOSM);
    setCookie("tile_type", "simple", 7);
  };

  var clickHandlerStandrad = function () {
    tileLayer.setSource(standardTileOSM);
    setCookie("tile_type", "standard", 7);
  };

  var clickHandlerDetail = function () {
    tileLayer.setSource(detailTileOSM);
    setCookie("tile_type", "detail", 7);
  };

  simpleTiles.addEventListener("click", clickHandlerSimple);
  standardTiles.addEventListener("click", clickHandlerStandrad);
  detailTiles.addEventListener("click", clickHandlerDetail);
};

option();

// 5분마다
var myVar = setInterval(CollectGarbage, 300000);

function CollectGarbage() {
  var d = new Date();
  var t = d.toLocaleTimeString();
  var aisArray = AISLayer.getSource().getFeatures();

  const overtimedAISs = aisArray.filter(function (ais) {
    var str = ais.get("datetime");
    var hourStr = str.substring(str.length - 6, str.length - 4);

    var hour = Number(hourStr) * 60;
    var min = hour + Number(str.substring(str.length - 4, str.length - 2));
    var res = str.substring(str.length - 4, str.length - 2);

    var n = d.getMinutes() + d.getHours() * 60;

    if (n - min > 10) return true;
    else return false;
  });

  for (var i = 0; i < overtimedAISs.length; i++) {
    AISSource.removeFeature(overtimedAISs[i]);
  }
}

var schedule_table;
var pilot_table;
var ais_table;

function ReadTable() {
  $.getJSON("schedule.json", function (data1) {
    var today = new Date();
    var currentTime = Number(today.getHours() + "" + today.getMinutes());

    for (var key in data1) {
      if (data1[key].TM_SHIP < currentTime) {
        delete data1[key];
      }
    }

    schedule_table = new Tabulator("#schedule-table", {
      //height: 205, // set height of table (in CSS or here), this enables the Virtual DOM and improves render speed dramatically (can be any valid css height value)
      data: data1, //assign data to table
      layout: "fitColumns", //fit columns to width of table (optional)
      addRowPos: "top",
      pagination: "local", //paginate the data
      paginationSize: 24,
      columns: [
        //Define Table Columns
        { title: "시간", field: "TM_SHIP", width: 80, headerFilter: "input" },
        {
          title: "선명",
          field: "NM_CALLSIGN",
          width: 180,
          headerFilter: "input",
        },
        {
          title: "CallSign",
          field: "CD_CALLSIGN",
          width: 100,
          headerFilter: "input",
        },
        {
          title: "도선사",
          field: "CD_PILOT",
          width: 80,
          headerFilter: "input",
        },
      ],
      rowClick: function (e, row) {
        //trigger an alert message when the row is clicked
        //alert("Row " + row.getData().CD_CALLSIGN + " Clicked!!!!");
        SetCenterbyName(row.getData().NM_CALLSIGN);
      },
    });
  });

  ais_table = new Tabulator("#ais-table", {
    //height: 205, // set height of table (in CSS or here), this enables the Virtual DOM and improves render speed dramatically (can be any valid css height value)
    //data: tabledata, //assign data to table
    layout: "fitColumns", //fit columns to width of table (optional)
    index: "mmsi",
    // addRowPos: "bottom",
    pagination: "local", //paginate the data
    paginationSize: 24,
    columns: [
      //Define Table Columns
      { title: "MMSI", field: "mmsi", width: 100, headerFilter: "input" },
      { title: "선명", field: "name", width: 180, headerFilter: "input" },
      {
        title: "CallSign",
        field: "callsign",
        width: 120,
        headerFilter: "input",
      },
      // { title: "Age", field: "age", hozAlign: "left", formatter: "progress" },

      // { title: "Date Of Birth", field: "dob", sorter: "date", hozAlign: "center" },
    ],
    rowClick: function (e, row) {
      //trigger an alert message when the row is clicked

      //alert("Row " + row.getData().mmsi + " Clicked!!!!");
      SetCenterbyMMSi(row.getData().mmsi);
    },
  });
}

function SetCenterbyName(aName) {
  var ais_array1 = AISLayer.getSource().getFeatures();

  var found = ais_array1.find(function (element) {
    return element.get("name").trim() == aName.trim();
  });

  if (found) {
    var point = found.getGeometry();
    var size = map.getSize();

    var table_size = document.getElementById("pnl_schedule_table").clientWidth;
    map
      .getView()
      .centerOn(point.getCoordinates(), size, [
        size[0] / 2 - table_size,
        size[1] / 2,
      ]);
  } else {
  }
}
function SetCenterbyMMSi(mmsi) {
  //alert("Row " + mmsi + " Clicked!!!!");

  var ais_array = AISLayer.getSource().getFeatures();

  var found = ais_array.find(function (element) {
    return element.get("MMSI") == mmsi;
  });

  if (found) {
    var point = found.getGeometry();
    var size = map.getSize();
    var left_cookie = getCookie("left_open");
    if (left_cookie == "true") {
      var table_size =
        document.getElementById("pnl_schedule_table").clientWidth;
      map
        .getView()
        .centerOn(point.getCoordinates(), size, [
          size[0] / 2 - table_size,
          size[1] / 2,
        ]);
    } else {
      map
        .getView()
        .centerOn(point.getCoordinates(), size, [size[0] / 2, size[1] / 2]);
    }
  }
}

window.onbeforeunload = function LastedAISInfo() {
  localStorage.removeItem("AISData");

  var lastedAISInfo = AISLayer.getSource().getFeatures();

  var jsonArray = new Array();
  for (var row in lastedAISInfo) {
    var item = lastedAISInfo[row].values_;
    var jsonObject = new Object({
      MMSI: item.MMSI,
      name: item.name,
      callsign: item.callsign,
    });

    jsonArray.push(jsonObject);
  }

  var jsonData = JSON.stringify(jsonArray);
  localStorage.setItem("AISData", jsonData);
};

const panleSlide = () => {
  const map_el = document.querySelector(".map");

  const panel_left = document.querySelector(".pnl_schedule_table");
  const panel_right = document.querySelector(".pnl_ais_table");

  const burger_left = document.querySelector(".burger.left");
  const arrow_left = document.querySelector(".arrow.left");

  const burger_right = document.querySelector(".burger.right");
  const arrow_right = document.querySelector(".arrow.right");

  burger_left.addEventListener("click", () => {
    map_el.classList.toggle("map-active");
    panel_left.classList.toggle("pnl_schedule_table-active");
    burger_left.classList.toggle("toggle");

    var left_cookie = getCookie("left_open");
    if (left_cookie == "true") {
      setCookie("left_open", "false", 7);
    } else {
      setCookie("left_open", "true", 7);
    }
  });

  arrow_left.addEventListener("click", () => {
    map_el.classList.toggle("map-active");
    panel_left.classList.toggle("pnl_schedule_table-active");
    burger_left.classList.toggle("toggle");

    setCookie("left_open", "false", 7);
  });

  burger_right.addEventListener("click", () => {
    map_el.classList.toggle("map-active");
    panel_right.classList.toggle("pnl_ais_table-active");
    burger_right.classList.toggle("toggle");

    var right_cookie = getCookie("right_open");
    if (right_cookie == "true") {
      setCookie("right_open", "false", 7);
    } else {
      setCookie("right_open", "true", 7);
    }
  });

  arrow_right.addEventListener("click", () => {
    map_el.classList.toggle("map-active");
    panel_right.classList.toggle("pnl_ais_table-active");
    burger_right.classList.toggle("toggle");

    setCookie("right_open", "false", 7);
  });
};

panleSlide();

//아래로 쿠키 전용

var setCookie = function (name, value, day) {
  var date = new Date();
  date.setTime(date.getTime() + day * 60 * 60 * 24 * 1000);
  document.cookie =
    name + "=" + value + ";expires=" + date.toUTCString() + ";path=/";
};

var getCookie = function (name) {
  var value = document.cookie.match("(^|;) ?" + name + "=([^;]*)(;|$)");
  return value ? value[2] : null;
};

var deleteCookie = function (name) {
  var date = new Date();
  document.cookie =
    name + "= " + "; expires=" + date.toUTCString() + "; path=/";
};

var left_open = getCookie("left_open");
var right_open = getCookie("right_open");
var tiles_type = getCookie("tile_type");

if (left_open == "true") {
  document
    .querySelector(".pnl_schedule_table")
    .classList.toggle("pnl_schedule_table-active");
  document.querySelector(".burger.left").classList.toggle("toggle");
}

if (right_open == "true") {
  document
    .querySelector(".pnl_ais_table")
    .classList.toggle("pnl_ais_table-active");
  document.querySelector(".burger.right").classList.toggle("toggle");
}

if (tiles_type == "simple") {
  tileLayer.setSource(simpleTileOSM);
} else if (tiles_type == "standard") {
  tileLayer.setSource(standardTileOSM);
} else if (tiles_type == "detail") {
  tileLayer.setSource(detailTileOSM);
} else {
  tileLayer.setSource(standardTileOSM);
}

// 항적 그리기
// var drawSoucre = new ol.source.Vector();
// //      ，     
// var drawLayer = new ol.layer.Vector({
//     source: drawSoucre,
//     style: style
// });
function ProcessDBAIS(Tokens1) {
  var lon = 129.24
  var lat = 35.26

  if (lon > 180 || lon < -180) {
    return;
  }
  if (lat > 85 || lat < -85) {
    return;
  }

  var DBArray = VesselLayer.getSource().getFeatures();
  // AIS body update
  var found = DBArray.find(function (element) {
    return 441273000
  });

  if (found) {
    found.set("name", "HANNARA");
    found.set("datetime", "2021-11-04 01:13:20");
  } else {
    var obj = new Feature({
      geometry: new Point(fromLonLat([lon, lat])),
      messageType: 21,
      MMSI: "441273000",
      name: "HANNARA",
      heading: 0,
      COG: 0,
      SOG: 0,
      callsign: "",
      datetime: "2021-11-04 01:13:20",
      refA: 0,
      refB: 0,
      refC: 0,
      refD: 0,
      selected: 0,
      cogs: [],
      tracks: [],
    });
    //var cog = Number(Tokens1[6]) * (Math.PI / 180);
    var aiStyle = new Style({
      image: new Icon({
        //color: [200, 40, 40],
        opacity: 0.8,
        crossOrigin: "anonymous",
        anchor: [0.5, 0.5],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        src: "data/dot.png",
        scale: 0.6,
      }),
      text: new Text({
        font: "14px Calibri,sans-serif",
        text: "",
        offsetY: 16,
        fill: new Fill({
          color: "#000",
        }),
        stroke: new Stroke({
          color: "#fff",
          width: 1,
        }),
      }),
    });
    obj.setStyle(aiStyle);
    VesselLayer.getSource().addFeature(obj);
  }
}