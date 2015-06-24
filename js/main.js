var map, geojson, locationGroup, materials, point;

//Result - Small Blue Point - for Geolocated or Searched Location
function addLocationToMap(latlng) {
		var icon = L.icon({
			iconUrl: 'img/location.png',
			iconSize: [14,14]
		});
		locationGroup.clearLayers();
		locationGroup.addLayer(L.marker(latlng, {icon:icon}));
}
 
//Red Icon for Closest Facility
//Extend the Default marker class
        var RedIcon = L.Icon.Default.extend({
            options: {
            iconUrl: 'img/markerred.png' 
            }
         });
         var redIcon = new RedIcon();
		 
function getMaterials () {
  $.getJSON("materials.json", function (data) {
		materials = data;
    $(data).each(function (i, mat) {
			var option = $("<option>"+mat.Type+"</option>").appendTo("select");
    });
  });
}

function mapProperty (pin) {
	$.ajax({
		url: 'https://maps.raleighnc.gov/arcgis/rest/services/Parcels/MapServer/find',
		dataType: 'jsonp',
		data: {
			f: 'json',
			searchFields: "PIN_NUM",
			returnGeometry: true,
			searchText: pin,
			layers: "0,1",
			sr: 4326
		},
	})
	.done(function(data) {
		if (data.results.length > 0) {
			//parcelGraphic.clearLayers();
			var geom = data.results[0].geometry,
					poly = L.multiPolygon([]),
					latlngs = [];
			$(geom.rings).each(function (i, r) {
				var ring = [];
				$(r).each(function(j, p) {

					ring.push({lon:p[0], lat:p[1]})

				});
				latlngs.push(ring);
			});
			poly.setLatLngs(latlngs);
			findNearest(poly.getBounds().getCenter());
			addLocationToMap(poly.getBounds().getCenter());
		}
	});
}
function searchByAddress (address, type) {
	$.ajax({
		url: 'http://mapstest.raleighnc.gov/arcgis/rest/services/Parcels/MapServer/exts/PropertySOE/RealEstateSearch',
		dataType: 'jsonp',
		data: {
			f: 'json',
			type: type,
			values: '["'+address+'"]'
		},
	})
	.done(function(data) {
		account = data.Accounts[0];
		mapProperty(account.pin);
	});
}
function setAddressSearch () {
  $('.typeahead').typeahead({
			name: "address",
			remote:{
				url: "http://mapstest.raleighnc.gov/arcgis/rest/services/Parcels/MapServer/exts/PropertySOE/AutoComplete?f=json&type=address&input=%QUERY",
				filter: function (resp) {
					return resp.Results;
				}
			}
    }).on("typeahead:selected",function (obj, datum, dataset) {
		searchByAddress(datum.value, dataset);
	});;
}

function getPlaceTypes () {
	var material = $("select option:selected").val(),
		list = [];
	var matches = $(materials).filter(function () {
		return this.Type === material;
	});
	if (matches.length > 0) {
		if (matches[0].convenience) {
			list.push("convenience");
		}
		if (matches[0].multimaterial) {
			list.push("multimaterial");
		}
		if (matches[0].household) {
			list.push("household");
		}
		if (matches[0].municipal) {
			list.push("municipal");
		}
	}
	return list;
}

function findNearest(latlng) {

  var placeTypes = getPlaceTypes(),
		distance = 0,
    closest = null,
		cnt = 0,
		tbody = $("table tbody").empty(),
		distances = [];
	point = latlng
  $(geojson.getLayers()).each(function(i, l) {
		if ($.inArray(l.feature.properties.category, placeTypes) > -1) {
			var coords = L.latLng(l.feature.geometry.coordinates[1], l.feature.geometry.coordinates[0]),
				dist = latlng.distanceTo(coords);
			distances.push(dist);
			distances.sort(function(a,b) { return a - b;});
			var idx = distances.indexOf(dist);
			if ($("tr", tbody).length === 0 || idx >= $("tr", tbody).length ) {
				tbody.append("<tr><td>"+l.feature.properties.operator+"</td><td>"+l.feature.properties.type+"</td><td>"+l.feature.properties.address+"</td><td>"+l.feature.properties.Hours+"</td><td>"+Math.round(latlng.distanceTo(coords)/1609.34*10)/10+" miles</td></tr>");
			}
			else {
				$("tr:eq("+idx+")", tbody).before("<tr><td>"+l.feature.properties.operator+"</td><td>"+l.feature.properties.type+"</td><td>"+l.feature.properties.address+"</td><td>"+l.feature.properties.Hours+"</td><td>"+Math.round(latlng.distanceTo(coords)/1609.34*10)/10+" miles</td></tr>");
			}
			if (cnt === 0) {
				distance = dist;
				closest = l;
			}
			if (dist < distance) {
				distance = dist;
				closest = l;
			}

			cnt += 1;
		}
  });
  var toLocation = L.latLng(closest.feature.geometry.coordinates[1], closest.feature.geometry.coordinates[0]);
  //var toLocation = closest.feature.geometry.coordinates.reverse();
  //map.setView(closest.feature.geometry.coordinates.reverse(), 16);
  map.fitBounds([latlng, toLocation], {padding: [100,100]});
  var dirLink = "https://www.google.com/maps/dir/"+latlng.lat+","+latlng.lng+"/"+toLocation.lat+","+toLocation.lng;
  //closest.getPopup().setContent(closest.getPopup().getContent()+"<br/><a class='directions' href='"+dirLink+"' target='_blank'>Get Directions</a>");
  closest.openPopup();
	//alert($(".leaflet-popup").length);
	$(".leaflet-popup-content .directions").remove();
	$(".leaflet-popup-content").append("<div class='directions'><br/><a href='"+dirLink+"' target='_blank'>Get Directions</a></div>");
}
		 
function createMap() {

  map = L.map('map').setView([35.81889, -78.64447], 10);
  L.esri.basemapLayer('Gray').addTo(map);
  var facilities = L.esri.featureLayer('http://maps.wakegov.com/arcgis/rest/services/Environmental/SWFacilities/MapServer/0', {
  	onEachFeature: function (feature) {
	$("table tbody").append("<tr><td>"+feature.properties.OPERATOR+"</td><td>"+feature.properties.TYPE+"</td><td>"+feature.properties.ADDRESS+"</td><td>"+feature.properties.HOURS+"</td></tr>");
  }
  }).addTo(map);
  facilities.bindPopup(function (feature) {
  	return L.Util.template('<strong>{OPERATOR}</strong><br/>{TYPE}<br/>{ADDRESS}<br/>{HOURS}<strong><br/>{OPENTO}', feature.properties);
  });

  //L.tileLayer('http://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}').addTo(map);
  // $.getJSON("facilities.geojson", function (data) {
  //   geojson = L.geoJson(data, {
  //     onEachFeature: function (feature, layer) {
  //       layer.bindPopup('<strong>'+feature.properties.operator+'</strong><br/>'+feature.properties.type+'<br/>'+feature.properties.address+'<br/>'+feature.properties.Hours+'<strong><br/>'+feature.properties.OpenTo);

		// 		$("table tbody").append("<tr><td>"+feature.properties.operator+"</td><td>"+feature.properties.type+"</td><td>"+feature.properties.address+"</td><td>"+feature.properties.Hours+"</td></tr>");
  //     }
  //   }).addTo(map);
  // });
  locationGroup = L.featureGroup().addTo(map);
   var locate = L.control.locate().addTo(map);
   map.on("locationfound", function (loc) {
     locate.stopLocate();
     map.setView(loc.latlng, 17);
     findNearest(loc.latlng);
     addLocationToMap(loc.latlng);
   });
}
$(document).ready(function () {
  createMap();
  setAddressSearch();
  getMaterials();
	$("select").change(function () {
		if (point) {
			findNearest(point);
		}
	});
});
