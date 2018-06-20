/** Segmentation viewer.
 *
 * var viewer = new Viewer("/path/to/image.jpg", "/path/to/annotation.png", {
 *   colormap: [[255, 255, 255], [0, 255, 255]],
 *   labels: ["background", "foreground"],
 *   onload: function () { }
 * });
 * document.body.appendChild(viewer.container);
 *
 * Copyright 2015  Kota Yamaguchi
 */
define(['../image/layer'], function (Layer) {
  // Segment viewer.
  // the options parameter contains: width, height, colormap, labels, excludedLegends, and the index number of the image (overlay)
  function Viewer(imageURL, annotationURL, options) {
    if (typeof options === "undefined") options = {};
    this.colormap = options.colormap || [[255, 255, 255], [255, 0, 0]];
    this.labels = options.labels;
    // loads the list of images  on the main index.html page
    // First create the layer for the image and its annotation and put that in the Viewer's container
    this._createLayers(imageURL, annotationURL, options);
    var viewer = this;
    // then load the image given its file name
    this.layers.image.load(imageURL, {
      width: options.width,
      height: options.height,
      onload: function () { viewer._initializeIfReady(options); }
    });

    if (options.showIndexCount && options.overlay) // adds the index to the top left corner of an image if an index is given through options.overlay
      viewer.addOverlay(options.overlay);

    var pngURI = window.location.pathname + annotationURL;
    var xhr = new XMLHttpRequest();
    xhr.open("GET", pngURI, true);
    xhr.onload = function () {
      if (options.showAnnotated && xhr.status !== 404) {
        viewer.addAnnotatedText();
      }
    };
    xhr.send();

  }

  // Creates canvas layers for the image and a top visualization layer for hte main index page displaying an indexed list of images
  Viewer.prototype._createLayers = function (imageURL,
    annotationURL,
    options) {
    var onload = options.onload;
    delete options.onload;
    this.container = document.createElement("div");
    this.container.classList.add("segment-viewer-container");
    // Create the canvas for the image and visualization layers
    // These are used to display an indexed list of the images given in the JSON input file
    this.layers = {
      image: new Layer(options),
      visualization: new Layer(options)
    };
    options.onload = onload;
    for (var key in this.layers) {
      var canvas = this.layers[key].canvas;
      canvas.classList.add("segment-viewer-layer");
      this.container.appendChild(canvas);
    }
    this._unloadedLayers = Object.keys(this.layers).length;
    this._resizeLayers(options);
  };

  Viewer.prototype._resizeLayers = function (options) {
    this.width = options.width || this.layers.image.canvas.width;
    this.height = options.height || this.layers.image.canvas.height;
    for (var key in this.layers) {
      if (key !== "image") {
        var canvas = this.layers[key].canvas;
        canvas.width = this.width;
        canvas.height = this.height;
      }
    }
    this.container.style.width = this.width + "px";
    this.container.style.height = this.height + "px";
  };

  Viewer.prototype._initializeIfReady = function (options) {
    if (--this._unloadedLayers > 0)
      return;
    this._resizeLayers(options);
  };

  // adds an extra layer to an image
  Viewer.prototype.addOverlay = function (text) {

    var overlayText = document.createElement("div");
    overlayText.classList.add("segment-viewer-overlay-container");

    if (text) // adds the index number of the image
      overlayText.appendChild(document.createTextNode(text));

    this.container.appendChild(overlayText);
  };

  Viewer.prototype.addAnnotatedText = function () {
    var overlayAnnotated = document.createElement("div");

    overlayAnnotated.classList.add("segment-viewer-overlay-container-annotated");

    overlayAnnotated.appendChild(document.createTextNode("Annotated file found"));

    this.container.appendChild(overlayAnnotated);
  };

  Viewer.prototype.addLegend = function (index) {
    var legendContainer = document.createElement("div"),
      i;
    if (typeof index === "undefined") {
      index = [];
      for (i = 0; i < this.labels.length; ++i)
        index.push(i);
    }
    legendContainer.classList.add("segment-viewer-legend-container");
    for (i = 0; i < index.length; ++i) {
      var label = this.labels[index[i]],
        color = this.colormap[index[i]],
        legendItem = document.createElement("div"),
        colorbox = document.createElement("span"),
        legendLabel = document.createElement("span");
      colorbox.classList.add("segment-viewer-legend-colorbox");
      colorbox.style.backgroundColor = "rgb(" + color.join(",") + ")";
      legendItem.classList.add("segment-viewer-legend-item");
      legendLabel.appendChild(document.createTextNode(" " + label));
      legendLabel.classList.add("segment-viewer-legend-label");
      legendItem.appendChild(colorbox);
      legendItem.appendChild(legendLabel);
      legendContainer.appendChild(legendItem);
    }
    this.container.appendChild(legendContainer);
  };

  var getUniqueIndex = function (data, layer) {
    var pairedData, label,
      uniqueIndex = [];
    for (var i = 0; i < data.length; i += 4) {
      pairedData = layer.inverseCantorPair(data[i]);
      label = pairedData[0];
      if (uniqueIndex.indexOf(label) < 0) {
        uniqueIndex.push(label);
      }
    }
    return uniqueIndex.sort(function (a, b) { return a - b; });
  };

  return Viewer;
});
