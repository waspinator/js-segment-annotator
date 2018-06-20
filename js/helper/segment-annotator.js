/**
 * Segment annotation widget.
 *
 * var annotator = new SegmentAnnotator("/path/to/image.jpg", {
 *   onload: function () {},
 *   onerror: function () {},
 *   onchange: function () {},
 *   onrightclick: function () {},
 *   onleftclick: function () {}
 * });
 * document.body.appendChild(annotator.container);
 *
 * Copyright 2015  Kota Yamaguchi
 */
define(['../image/layer',
  '../image/segmentation',
  '../helper/colormap',
  '../image/morph'],
  function (Layer, segmentation, colormap, morph) {
    // Segment annotator.
    function Annotator(imageURL, options) {
      options = options || {};
      if (typeof imageURL !== "string") {
        throw "Invalid imageURL";
      }
      this.nextObject = [];
      this.labels = options.labels || [];
      this.colormap = options.colormap || [[255, 255, 255], [255, 0, 0]]; // Given colormap or white and red
      this.boundaryColor = options.boundaryColor || [255, 255, 255]; //given boundary color or white
      this.boundaryAlpha = options.boundaryAlpha || 127;  //boundary opacity
      this.objectBoundaryColor = options.objectBoundaryColor || [255, 255, 255]; //given object boundary color or white
      this.objectBoundaryAlpha = options.objectBoundaryAlpha || 127;  //boundary opacity
      this.visualizationAlpha = options.visualizationAlpha || 100; // annotation layer opacity. The higher the less opaque. This is why the image being annotated is not bright
      this.highlightAlpha = options.highlightAlpha ||
        Math.min(0, this.visualizationAlpha + 150); // the opacity of a highlighted segment
      this.currentZoom = 1.0;
      this.annotateURL = options.annotateURL;
      this.defaultLabel = options.defaultLabel || 0;
      this.defaultObjectNumber = options.defaultObjectNumber || 0;
      this.eraseLabel = options.earseLabel || 0;
      this.objVisualizationbackground = 0;
      this.maxHistoryRecord = options.maxHistoryRecord || 15;  // The maximum amount of "undo's" we can do.
      this.currentHistoryRecord = {};
      this.onchange = options.onchange || null;
      this.onrightclick = options.onrightclick || null;
      this.onleftclick = options.onleftclick || null;
      this.onhighlight = options.onhighlight || null;
      this.onmousemove = options.onmousemove || null;
      // Create the canvas layers: image, visualization, annotation, objects,  superpixel, and boundary layers
      this._createLayers(options);
      // initialize change history. Used for "undo" and "redo" functions
      this._initializeHistory(options);
      this.mode = "superpixel";
      this.polygonPoints = [];
      this.objectVisualizationOn = false;
      this.polygonCanClose = false;
      this.prevAnnotationImg = null;
      var annotator = this;
      this.layers.image.load(imageURL, {
        width: options.width,
        height: options.height,
        onload: function () { annotator._initialize(options); },
        onerror: options.onerror
      });
      this.crcTable = _makeCRCTable();
    }

    // Run superpixel segmentation.
    Annotator.prototype.resetSuperpixels = function (options) {
      options = options || {};
      this.layers.superpixel.copy(this.layers.image);
      this.segmentation = segmentation.create(this.layers.image.imageData,
        options);
      this._updateSuperpixels(options);
      return this;
    };

    // Adjust the superpixel resolution.
    Annotator.prototype.finer = function (options) {
      this.segmentation.finer();
      this._updateSuperpixels(options);
      return this;
    };

    // Adjust the superpixel resolution.
    Annotator.prototype.coarser = function (options) {
      this.segmentation.coarser();
      this._updateSuperpixels(options);
      return this;
    };

    // Undo the edit.
    Annotator.prototype.undo = function () {

      if (this.currentHistoryRecord[this.currentLabel] < 0)
        return false;

      var currentHistory = this.currentHistoryRecord[this.currentLabel],
        record = this.history[this.currentLabel][currentHistory];

      this.currentHistoryRecord[this.currentLabel] = this.currentHistoryRecord[this.currentLabel] - 1;

      this._fillPixels(record.pixels, record.prev, record.prevObjNum);

      this.layers[this.currentLabel].visualization.render();
      this.layers[this.currentLabel].objectVisualization.render();
      this.layers[this.currentLabel].objects.forEach(function (layer) {
        layer.render();
      });

      if (typeof this.onchange === "function")
        this.onchange.call(this);

      return this.currentHistoryRecord[this.currentLabel] < 0;
    };

    // Redo the edit.
    Annotator.prototype.redo = function () {
      var returnResult;
      if (this.currentHistoryRecord[this.currentLabel] >= this.history[this.currentLabel].length - 1) {
        returnResult = false;
      } else {
        var record = this.history[this.currentLabel][++this.currentHistoryRecord[this.currentLabel]];
        this._fillPixels(record.pixels, record.next, record.nextObjNum);
        this.layers[this.currentLabel].visualization.render();
        this.layers[this.currentLabel].objectVisualization.render();
        this.layers[this.currentLabel].objects.forEach(function (layer) {
          layer.render();
        });
        if (typeof this.onchange === "function")
          this.onchange.call(this);
        returnResult = this.currentHistoryRecord[this.currentLabel] >= this.history[this.currentLabel].length;
      }
      return returnResult;
    };

    // Fill all the pixels assigned the target label or all.
    Annotator.prototype.fill = function (targetLabel) {
      var pixels = [],
        label = 0,
        annotationData = this.layers[this.currentLabel].annotatedObjects.imageData.data;
      for (var i = 0; i < annotationData.length; i += 4) {
        var objectNumber = this.layers[this.currentLabel].annotatedObjects._getEncodedLabel(data, i);
        label = 0;
        if (objectNumber > 0) {
          label = this.currentLabel;
        }
        if (label === targetLabel || targetLabel === undefined)
          pixels.push(i);
      }
      if (pixels.length > 0)
        this._updateAnnotation(pixels, this.currentLabel, this.currentObjectNumber[this.currentLabel]);
      return this;
    };

    Annotator.prototype.setAlpha = function (alpha) {
      this.visualizationAlpha = Math.max(Math.min(alpha, 255), 0);
      for (var labelIndex in this.labels) {
        this.layers[labelIndex].visualization.setAlpha(this.visualizationAlpha).render();
      }
      return this;
    };

    Annotator.prototype.lessAlpha = function (scale) {
      var alphaVal = this.visualizationAlpha - (scale || 1) * 20;
      return this.setAlpha(alphaVal);
    };

    Annotator.prototype.moreAlpha = function (scale) {
      var alphaVal = this.visualizationAlpha + (scale || 1) * 20;
      return this.setAlpha(alphaVal);
    };

    Annotator.prototype._clearImageData = function (index) {
      this.layers[index].objects = [];

      var i;
      var length = this.layers[index].objectVisualization.imageData.data.length;
      for (i = 0; i < length; i += 4) {
        this.layers[index].objectVisualization.imageData.data[i] = 255;
        this.layers[index].objectVisualization.imageData.data[i + 1] = 255;
        this.layers[index].objectVisualization.imageData.data[i + 2] = 255;

        this.layers[index].visualization.imageData.data[i] = 255;
        this.layers[index].visualization.imageData.data[i + 1] = 255;
        this.layers[index].visualization.imageData.data[i + 2] = 255;
      }
    };

    Annotator.prototype.update = function (data) {

      for (var label in data) {
        if (data.hasOwnProperty(label)) {
          var labelData = data[label];
          var index = this.labels.indexOf(label);

          if (index < 0) continue;

          var i, j;
          this._clearImageData(index);

          for (i = 1; i <= labelData.currentObjectNumber; i++) {

            this._createObjectLayer(i - 1, index);

            var pixels = [];
            var labels = [];
            var objectNumber = [];

            // Fill pixels with data
            for (j = 0; j < labelData.annotatedObjects.length; j++) {
              if (i === labelData.annotatedObjects[j]) {
                pixels.push(j * 4);
                labels.push(index);
                objectNumber.push(i);
              }
            }

            // Add pixels and render new objects
            if (pixels.length > 0) {
              this._fillPixels(pixels, labels, objectNumber);
              this.layers[index].objectVisualization.render();
              this.layers[index].visualization.render();
              this.layers[index].objects[i - 1].render();
            }

          }

          this.currentObjectNumber[index] = labelData.currentObjectNumber;
        }
      }
      this.updateObjectView();
    };

    // Updates object list
    Annotator.prototype.updateObjectView = function () {
      document.getElementById("objects-viewer").innerHTML = "";
      var label = this.labels[this.currentLabel];
      var numOfObjects = this.currentObjectNumber[this.currentLabel];

      for (var i = 1; i < numOfObjects; i++) {
        var value = document.getElementById("objects-viewer").innerHTML;

        var includes = false;
        if (typeof this.deleteObjectNumbers[this.currentLabel] !== 'undefined') {
          includes = this.deleteObjectNumbers[this.currentLabel].includes(i)
        }

        if (includes) continue;

        if (numOfObjects - 1 === i) {
          document.getElementById("objects-viewer").innerHTML = value + "<option value='" + i + "' selected>" + i + " " + label + "</option>";
        } else {
          document.getElementById("objects-viewer").innerHTML = value + "<option value='" + i + "'>" + i + " " + label + "</option>";
        }
      }
    };

    function isOdd(n) {
      return Math.abs(n % 2) == 1;
    }

    function nonBackgroundLabel(label) {
      return label != 0;
    }

    Annotator.prototype.createLabelLayer = function (labelIndex, objectLayer) {
      var labelLayer = new Layer(objectLayer.canvas,
        {
          width: objectLayer.canvas.width,
          height: objectLayer.canvas.height
        });
      labelLayer.canvas.width = objectLayer.canvas.width;
      labelLayer.canvas.height = objectLayer.canvas.height;
      var objectData = objectLayer.imageData.data;
      this.currentObjectNumber[labelIndex] = 0;
      for (var i = 0; i < objectData.length; i += 4) {
        var currentObject = objectLayer._getEncodedLabel(objectData, i);
        // keep track of the maximum object number in the current object layer
        this.currentObjectNumber[labelIndex] = Math.max(currentObject, this.currentObjectNumber[labelIndex]);
        if (currentObject > 0) {
          labelLayer._setEncodedLabel(labelLayer.imageData.data, i, labelIndex);
        }
      }
      this.currentObjectNumber[labelIndex] += 1;
      return labelLayer;
    };

    Annotator.prototype.importTiles = function (data, id, pngData, options) {
      options = options || {};
      var annotator = this;

      var filePath = data.annotationURLs[id];
      var imageSize = [
        this.layers[0].annotatedObjects.canvas.width,
        this.layers[0].annotatedObjects.canvas.height
      ];

      console.log("Loading: " + filePath);
      var combinedLayer = new Layer();
      combinedLayer.load(filePath, {
        onload: function () {
          for (var label in pngData) {
            var labelIndex = data.labels.indexOf(label);
            if (labelIndex === -1) continue;

            var newCanvas = document.createElement("canvas");
            newCanvas.width = imageSize[0];
            newCanvas.height = imageSize[1];
            var context = newCanvas.getContext("2d");
            var canvasData = context.createImageData(
              newCanvas.width, newCanvas.height);

            var offset = newCanvas.width *
              newCanvas.height *
              pngData[label][0][0] * 4;
            var layer = pngData[label][0][1];

            for (var i = 0; i < canvasData.data.length; i += 4) {
              canvasData.data[i] = combinedLayer.imageData.data[i + layer + offset];
              canvasData.data[i + 3] = 255; //Set Alpha
            }
            context.putImageData(canvasData, 0, 0);
            var newLayer = new Layer();
            newLayer.fromCanvas(newCanvas);
            annotator._addImportedLayer(labelIndex, newLayer);
          }
        },
        onerror: options.onerror
      });
    };

    Annotator.prototype.exportTiles = function () {
      var i, j;
      var annotator = this;
      var currentLayer = this.layers[0].annotatedObjects;
      var list = [];
      var layerCountToExport = 0;
      var layerCountExported = 0;
      for (i = 0; i < this.labels.length; i++) {
        if (this._getMaxObjectNumber(i) > 0) layerCountToExport++;
      }
      console.log("Will export", layerCountToExport, "layers.");
      if (layerCountToExport === 0) return null;

      var newCanvas = document.createElement("canvas");
      newCanvas.width = currentLayer.canvas.width;
      newCanvas.height = currentLayer.canvas.height * Math.ceil(layerCountToExport / 3);
      var context = newCanvas.getContext("2d");
      var canvasData = context.createImageData(
        newCanvas.width, newCanvas.height);

      // Metadata will describe where in the annotation each layer is encoded.
      var metaData = new Uint8Array(0);
      metaData = _arrayConcat(metaData, _stringToArray("{"));

      for (var labelIndex = 0; labelIndex < this.labels.length; labelIndex += 1) {

        if (this._getMaxObjectNumber(labelIndex) === 0) continue;

        currentLayer = this.layers[labelIndex].annotatedObjects;
        list = [];

        // Remove all deleted items from image data
        var length = currentLayer.imageData.data.length;
        var imageData = currentLayer.imageData.data;

        for (i = 1; i < this.currentObjectNumber[labelIndex]; i++) {
          if (imageData.indexOf(i) === -1) {
            list.push(i)
          }
        }

        function sortNum(a, b) {
          return b - a;
        }

        list.sort(sortNum);

        for (i = 0; i < list.length; i++) {
          var value = list[i];
          for (j = 0; j < length; j += 4) {
            if (imageData[j] > value) {
              imageData[j] -= 1;
            }
          }
        }

        this.currentObjectNumber[labelIndex] -= list.length;

        layerCountExported += 1;

        var tile = Math.floor((layerCountExported - 1) / 3);
        var offset = currentLayer.canvas.width *
          currentLayer.canvas.height *
          tile * 4;

        metaData = _arrayConcat(metaData, _stringToArray("\""));
        metaData = _arrayConcat(metaData, _stringToArray(this.labels[labelIndex]));
        metaData = _arrayConcat(metaData, _stringToArray("\":[["));
        metaData = _arrayConcat(metaData, _stringToArray(tile.toString()));
        metaData = _arrayConcat(metaData, _stringToArray(","));
        metaData = _arrayConcat(metaData, _stringToArray(((layerCountExported - 1) % 3).toString()));
        metaData = _arrayConcat(metaData, _stringToArray("]]"));
        if (layerCountExported < layerCountToExport)
          metaData = _arrayConcat(metaData, _stringToArray(","));

        for (i = 0; i < currentLayer.imageData.data.length; i += 4) {
          canvasData.data[i + (layerCountExported - 1) % 3 + offset] = imageData[i];
          canvasData.data[i + 3 + offset] = 255; //Set alpha channel
        }
      }
      metaData = _arrayConcat(metaData, _stringToArray("}"));
      context.putImageData(canvasData, 0, 0);

      var encodedPng = newCanvas.toDataURL();
      var unitArray = Base64Binary.decode(encodedPng.replace(/data:image\/png;base64,/, ''));

      var chunkType = _stringToArray("tEXT");

      // Add metadata
      unitArray = _arrayInsert(unitArray, 33, _int32ToArray(metaData.length));
      unitArray = _arrayInsert(unitArray, 37, chunkType);
      unitArray = _arrayInsert(unitArray, 41, metaData);
      unitArray = _arrayInsert(unitArray, 41 + metaData.length,
        _int32ToArray(annotator._crc32(_arrayConcat(chunkType, metaData))));

      encodedPng = "data:image\/png;base64,".concat(
        btoa(String.fromCharCode.apply(null, unitArray))
      );
      return encodedPng;
    };

    // Show a specified layer.
    Annotator.prototype.show = function (layer, labels) {
      labels = labels || null;
      if (!labels)
        this.layers[layer].canvas.style.display = "inline-block";
      else {
        for (var labelIndex in labels) {
          this.layers[labels[labelIndex]][layer].canvas.style.display = "inline-block";
        }
      }
      return this;
    };

    // Hide a specified layer.
    Annotator.prototype.hide = function (layer, labels) {
      labels = labels || null;
      if (!labels)
        this.layers[layer].canvas.style.display = "none";
      else {
        for (var labelIndex in labels) {
          this.layers[labelIndex][layer].canvas.style.display = "none";
        }
      }
      return this;
    };

    // Shows an object layer
    Annotator.prototype.showObjectLayer = function (objectNum) {

      if (objectNum < 0) return this;

      this.hide("objectVisualization", this.labels);

      this.layers[this.currentLabel].objects.forEach(function (layer) {
        layer.canvas.style.display = "none";
      });

      this.layers[this.currentLabel].objects[objectNum].canvas.style.display = "inline-block";

      return this;
    };

    // Determines the correct object visualisation layers to display
    Annotator.prototype.correctDisplay = function () {
      if (this.showOnlySelected()) {
        this.showObjectLayer(this.getCurrentSelectedObject() - 1);
      } else {
        if (this.objectVisualizationOn) {
          this.show("objectVisualization", [this.currentLabel]);
        } else {
          this.hide("objectVisualization", this.labels);
        }
        this.hideAllObjectLayers();
      }
    };

    // Hides all object layers
    Annotator.prototype.hideAllObjectLayers = function () {

      this.layers[this.currentLabel].objects.forEach(function (layer) {
        layer.canvas.style.display = "none";
      });

      return this;
    };

    // Zoom to specific resolution.
    Annotator.prototype.zoom = function (scale) {
      this.currentZoom = Math.max(Math.min(scale || 1.0, 10.0), 1.0);
      this.innerContainer.style.zoom = this.currentZoom;
      this.innerContainer.style.MozTransform = "scale(" + this.currentZoom + ")";
      return this;
    };

    // Zoom in.
    Annotator.prototype.zoomIn = function (scale) {
      return this.zoom(this.currentZoom + (scale || 0.25));
    };

    // Zoom out.
    Annotator.prototype.zoomOut = function (scale) {
      return this.zoom(this.currentZoom - (scale || 0.25));
    };

    // Creates new object
    Annotator.prototype.createNewObject = function () {
      if (this.nextObject[this.currentLabel]) {
        this._createObjectLayer(this.currentObjectNumber[this.currentLabel] - 1, this.currentLabel);
        this.currentObjectNumber[this.currentLabel] += 1;
        this.nextObject[this.currentLabel] = false; //cannot increase the object number until at least on new segment is selected (clicked)

        // expand the color map if needed
        if (this.colormap.length <= this.currentObjectNumber[this.currentLabel]) {

          var moreColors = colormap.create("hsv", {  // Creates a list of RGB colors (uses hsv2rgb)
            size: 1, offset: this.colormap.length + 1
          });

          while (this.colormap.includes(moreColors)) {
            moreColors = colormap.create("hsv", {  // Creates a list of RGB colors (uses hsv2rgb)
              size: 1, offset: this.colormap.length + 1
            });
          }

          Array.prototype.push.apply(this.colormap, moreColors);
        }
      }
      this.updateObjectView();
    };

    // Returns the selected object value from the object viewer
    Annotator.prototype.getCurrentSelectedObject = function () {
      var value = parseInt(document.getElementById("objects-viewer").value);
      if (isNaN(value)) return 0;
      return value;
    };

    Annotator.prototype.deleteObject = function () {
      var index = this.getCurrentSelectedObject();
      var list = document.getElementById("objects-viewer");

      if (index !== 0) {
        var label = this.currentLabel;

        var annotatedData = this.layers[label].annotatedObjects.imageData.data;
        var dataLength = annotatedData.length;

        var visualizationData = this.layers[label].visualization.imageData.data;
        var objectVisualData = this.layers[label].objectVisualization.imageData.data;

        var i, j;

        // Update Image data and remove object
        for (i = 0; i < dataLength; i += 4) {

          var found = false;

          for (j = 0; j < 3; ++j) {
            if (annotatedData[i + j] === index) {
              found = true;
              annotatedData[i + j] = 0;
            }
          }

          if (found) {
            for (j = 0; j < 3; ++j) {
              visualizationData[i + j] = 255;
              objectVisualData[i + j] = 255;
            }
          }
        }

        this.layers[label].visualization.render();
        this.layers[label].objectVisualization.render();

        // this.layers[label].objects.splice(index - 1, 1);
        if (typeof this.deleteObjectNumbers[label] === 'undefined') {
          this.deleteObjectNumbers[label] = []
        }

        this.deleteObjectNumbers[label].push(index);
        // Removes object from list
        for (i = 0; i < list.length; i++) {
          if (list.options[i].value == index) {
            list.remove(i)
          }
        }
      }
    };

    Annotator.prototype.showOnlySelected = function () {
      return document.getElementById("onlyShowSelected").checked;
    };

    Annotator.prototype.denoise = function () {
      var indexImage = morph.decodeIndexImage(this.layers[this.currentLabel].annotatedObjects.imageData),
        result = morph.maxFilter(indexImage);
      var pixels = new Int32Array(result.data.length);
      for (var i = 0; i < pixels.length; ++i)
        pixels[i] = 4 * i;
      this._updateAnnotation(pixels, result.data);
      return this;
    };

    // Private methods.
    // Layers created: image, superpixels, visualization, boundary, objects, object boundary,  and annotation
    // All these layers are overlayed in the canvas as a "segment-annotator-layer"
    // This is  where we can add more layers (e.g. a single layer per
    //  label) to allow a single pixel to be annotated with more than one label
    Annotator.prototype._createLayers = function (options) {

      this.options = options;
      var onload = options.onload;
      delete options.onload;
      this.container = document.createElement("div");
      this.container.classList.add("segment-annotator-outer-container");
      this.innerContainer = document.createElement("div");
      this.innerContainer.classList.add("segment-annotator-inner-container");
      var layerClassOrder = ["image", "superpixel", "boundary", "visualization", "objectVisualization", "annotatedObjects"];
      this.layers = {
        image: new Layer(options), // Contains the image being annotated
        superpixel: new Layer(options), // contains superpixels
        boundary: new Layer(options), // contains boundaries of superpixels
      };

      for (var labelIndex in this.labels) {
        this.layers[labelIndex] = {
          visualization: new Layer(options), // used to fill image areas with color that corresponds to the pixel's label
          objectVisualization: new Layer(options), // contains objects of superpixels
          annotatedObjects: new Layer(options), // a layer that combines the annotation information and object number for each pixel
          objects: [] // Creates layer array for objects
        }
      }

      options.onload = onload;
      for (var i in layerClassOrder) {
        var currentLayer = this.layers[layerClassOrder[i]];
        if (typeof (currentLayer) !== "undefined") {
          var canvas = currentLayer.canvas;
          canvas.classList.add("segment-annotator-layer");
          canvas.classList.add(layerClassOrder[i]);
          this.innerContainer.appendChild(canvas);
        } else { // Create the visualization, object visualization, and annotated objects layers for the current label
          for (var labelIndex in this.labels) {
            currentLayer = this.layers[labelIndex][layerClassOrder[i]];
            if (typeof (currentLayer) !== "undefined") {
              var canvas = currentLayer.canvas;
              canvas.classList.add("segment-annotator-layer");
              canvas.classList.add(layerClassOrder[i]);
              canvas.classList.add(labelIndex);
              this.innerContainer.appendChild(canvas);
            }
          }
        }
      }
      this.container.appendChild(this.innerContainer);
      this._resizeLayers(options);
    };

    // Creates a layer if the object does not currently have one
    Annotator.prototype._createObjectLayer = function (objectNum, label) {
      var objectLayer = this.layers[label].objects[objectNum];
      if (typeof objectLayer === 'undefined') {

        var onload = this.options.onload;
        delete this.options.onload;

        this.layers[label].objects[objectNum] = new Layer();

        var canvas = this.layers[label].objects[objectNum].canvas;

        canvas.classList.add("segment-annotator-layer");
        canvas.classList.add("object");
        canvas.classList.add(this.labels[label]);
        canvas.classList.add(objectNum);

        canvas.style.display = "none";
        canvas.width = this.width;
        canvas.height = this.height;

        var innerContainerTemp = this.innerContainer;
        innerContainerTemp.appendChild(canvas);

        this.container.replaceChild(this.innerContainer, innerContainerTemp);
        this.innerContainer = innerContainerTemp;

        this.options.onload = onload;
        this._initializeObjectLayer(objectNum, label);
      }
    };

    Annotator.prototype._resizeLayers = function (options) {
      this.width = options.width || this.layers.image.canvas.width;
      this.height = options.height || this.layers.image.canvas.height;
      for (var key in this.layers) {
        if (key !== "image") {
          var canvas = this.layers[key].canvas;
          if (typeof (canvas) !== "undefined") {
            canvas.width = this.width;
            canvas.height = this.height;
          } else {
            for (var layerName in this.layers[key]) {
              if (layerName !== "image") {
                var keyCanvas = this.layers[key][layerName].canvas;
                if (typeof (keyCanvas) !== "undefined") {
                  keyCanvas.width = this.width;
                  keyCanvas.height = this.height;
                }
              }
            }
          }
        }
      }
      this.innerContainer.style.width = this.width + "px";
      this.innerContainer.style.height = this.height + "px";
      this.container.style.width = this.width + "px";
      this.container.style.height = this.height + "px";
    };

    Annotator.prototype._initializeHistory = function (options) {
      this.history = {};
      for (var labelIndex in this.labels) {
        this.history[labelIndex] = [];
        this.currentHistoryRecord[labelIndex] = -1;
      }
    };

    Annotator.prototype._initialize = function (options) {
      options = options || {};
      if (!options.width)
        this._resizeLayers(options);
      this._initialize_AllAnnotationLayers();
      this._initialize_AllObjectsLayers();
      this._initialize_AllVisualizationLayers();
      this._initializeEvents();
      this.resetSuperpixels(options.superpixelOptions);
      if (typeof options.onload === "function")
        options.onload.call(this);
      if (typeof this.onchange === "function")
        this.onchange.call(this);
    };

    Annotator.prototype._initializeEvents = function () {
      var mousestate = { down: false, button: 0 },
        annotator = this,
        polygonJustFinished = false;

      for (labelIndex in this.labels) {
        this.layers[labelIndex].annotatedObjects.canvas.oncontextmenu = function () { return false; };
      }

      //canvas.oncontextmenu= function() { return false; };
      function updateIfActive(event) { //called when the mouse is moved or mouse button released (mouseup)
        var offset = annotator._getClickOffset(event),
          superpixelData = annotator.layers.superpixel.imageData.data,
          annotationData = annotator.layers[annotator.currentLabel].annotatedObjects.imageData.data,
          superpixelIndex = annotator.layers.superpixel._getEncodedLabel(superpixelData, offset),
          pixels = annotator.pixelIndex[superpixelIndex],
          objectNumber = annotator.layers[annotator.currentLabel].annotatedObjects._getEncodedLabel(
            annotationData, offset);
        var existingLabel = 0;
        if (objectNumber > 0) {
          existingLabel = annotator.currentLabel;
        }
        if (annotator.mode === "superpixel")
          annotator._updateHighlight(pixels);
        if (typeof annotator.onmousemove === "function")
          annotator.onmousemove.call(annotator, existingLabel);
        if (mousestate.down) {
          //if the "secondary button" (usualy right) was clicked
          if (mousestate.button == 2) {
            if (annotator.mode === "polygon") {
              // Do not start new polygon until mouse has been released
              if (polygonJustFinished) return;
              // annotator._emptyPolygonPoints(); //reset
              //if the "main button" (usually left) was clicked
              annotator._addPolygonPoint(event, annotator._getClickPos(event));
              if (annotator._checkPolygonComplete()) {
                annotator._addPolygonToAnnotation({ label: annotator.eraseLabel, objectNumber: annotator.defaultObjectNumber });
                annotator.polygonCanClose = false;
                polygonJustFinished = true;
              }
            } else {
              //annotator.onrightclick.call(annotator, existingLabel);
              // Erase annotation
              if (annotator.mode === "brush") {
                annotator.brush(annotator._getClickPos(event), annotator.eraseLabel);
              } else if (annotator.mode === "superpixel") {
                // add the current label to the pixel's labels (currently we can annotate a pixel with a single label)
                annotator._updateAnnotation(pixels, annotator.eraseLabel, annotator.defaultObjectNumber);//sets the object number to 0
              }
            }
          } else {
            if (event.button === 0) {
              annotator.nextObject[annotator.currentLabel] = true;
              if (annotator.mode === "brush") {
                annotator.brush(annotator._getClickPos(event), annotator.currentLabel);
              } else if (annotator.mode === "polygon") {
                // Do not start new polygon until mouse has been released
                if (polygonJustFinished) return;
                //if the "main button" (usualy left) was clicked
                annotator._addPolygonPoint(event, annotator._getClickPos(event));
                if (annotator._checkPolygonComplete()) {
                  annotator._addPolygonToAnnotation();
                  annotator.polygonCanClose = false;
                  polygonJustFinished = true;
                }
              } else if (annotator.mode === "superpixel") {
                // add the current label to the pixel's labels (currently we can annotate a pixel with a single label)
                // annotator._updateAnnotation(pixels, annotator.currentLabel, annotator.currentObjectNumber[annotator.currentLabel]);
                // Adds the currently selected label tot the pixel's label
                annotator._updateAnnotation(pixels, annotator.currentLabel, annotator.getCurrentSelectedObject());
              }
            }
          }
        } else {
          polygonJustFinished = false;
        }
      }

      for (var labelIndex in this.labels) {
        var labelCanvas = annotator.layers[labelIndex].annotatedObjects.canvas;
        labelCanvas.addEventListener('mousemove', updateIfActive);
        labelCanvas.addEventListener('mouseup', updateIfActive);
        labelCanvas.addEventListener('mouseleave', function () {
          annotator._updateHighlight(null);
          if (typeof annotator.onmousemove === "function") {
            annotator.onmousemove.call(annotator, null);
          }
        });
        // Increment object number for space bar press
        labelCanvas.addEventListener('mousedown', function (event) {
          mousestate.down = true;
          mousestate.button = event.button;
        });
      }

      window.addEventListener('mouseup', function () {
        mousestate.down = false;
      });

      //polygon on/off with ctrl-key
      window.onkeyup = function (e) {
        var key = e.keyCode ? e.keyCode : e.which;
        if (key == 17) {
          var polygonBtn = document.getElementsByClassName("polygon-tool").item(0);
          var superpixelBtn = document.getElementsByClassName("superpixel-tool").item(0);
          var brushBtn = document.getElementsByClassName("brush-tool").item(0);
          if (annotator.mode == "polygon") {
            polygonBtn.classList.remove("edit-sidebar-button-selected");
            brushBtn.classList.remove("edit-sidebar-button-selected");
            superpixelBtn.classList.add("edit-sidebar-button-selected");
            annotator.mode = "superpixel";
          } else {
            superpixelBtn.classList.remove("edit-sidebar-button-selected");
            brushBtn.classList.remove("edit-sidebar-button-selected");
            polygonBtn.classList.add("edit-sidebar-button-selected");
            annotator.mode = "polygon";
            annotator._updateHighlight(null);
          }
          annotator._emptyPolygonPoints();
        } else if (key == 32) {
          //e.preventDefault();
          annotator.createNewObject();
        } else if (key == 46) {
          annotator.deleteObject();
        }
        //window.off('keyup')
      };
    };

    Annotator.prototype._updateBoundaryLayer = function () {
      var boundaryLayer = this.layers.boundary;
      boundaryLayer.copy(this.layers.superpixel);
      boundaryLayer.computeEdgemap({
        foreground: this.boundaryColor.concat(this.boundaryAlpha),
        background: this.boundaryColor.concat(0)
      });
      boundaryLayer.render();
    };

    Annotator.prototype._initialize_AllAnnotationLayers = function () {
      this.currentLabel = this.defaultLabel;
      this.currentObjectNumber = [];
      this.deleteObjectNumbers = [];
      this.updateObjectView();
      for (var labelIndex in this.labels) {
        this._initializeAnnotationLayer(labelIndex);
      }
    };

    // initializes the annotation canvas layer with the defaultLabel value (0 if none given) and the default object number
    Annotator.prototype._initializeAnnotationLayer = function (label) {
      //var layer = this.layers.annotation;
      var layer = this.layers[label].annotatedObjects;
      if (layer === "undefined") {
        throw ("undefined canvas layer!");
      } else {
        layer.resize(this.width, this.height);
        layer.fill([this.defaultObjectNumber, 0, 0, 0]);
        this.currentObjectNumber[label] = this.defaultObjectNumber + 1; // the next object to be marked will belong to its own object
        layer.render();
      }
    };

    // initialize te object visualization layer for all labels
    Annotator.prototype._initialize_AllObjectsLayers = function () {
      for (var labelIndex in this.labels) {
        this._initializeObjectsLayer(labelIndex)
      }
    };

    // initializes the layer that visualized the objects embedded in the annotatedObjects layer.
    Annotator.prototype._initializeObjectsLayer = function (label) {
      var layer = this.layers[label].objectVisualization;

      layer.resize(this.width, this.height);
      this.nextObject[label] = true; // used to prevent the user from increasing the object number until there is at least one segments in the current object.

      var initialColor = this.colormap[this.objVisualizationbackground]
        .concat([this.visualizationAlpha]);

      layer.fill(initialColor);
      layer.render();
    };

    Annotator.prototype._initializeObjectLayer = function (objectNum, label) {
      var layer = this.layers[label].objects[objectNum];
      layer.resize(this.width, this.height);

      var initialColor = this.colormap[this.objVisualizationbackground].concat([this.visualizationAlpha]);
      layer.fill(initialColor);

      layer.render();
    };

    // initialize te object visualization layer for all labels
    Annotator.prototype._initialize_AllVisualizationLayers = function () {
      for (var labelIndex in this.labels) {
        this._initializeVisualizationLayer(labelIndex)
      }
    };

    // Initializes the visualization layer to the color of the default
    //   label (0 if none given) and the value of the visualization Alpha
    Annotator.prototype._initializeVisualizationLayer = function (label) {
      var layer = this.layers[label].visualization;
      layer.resize(this.width, this.height);
      var initialColor = this.colormap[this.defaultLabel]
        .concat([this.visualizationAlpha]);
      layer.fill(initialColor);
      layer.render();
    };

    Annotator.prototype._updateSuperpixels = function () {
      var annotator = this;
      this.layers.superpixel.process(function (imageData) {
        imageData.data.set(annotator.segmentation.result.data);
        annotator._createPixelIndex(annotator.segmentation.result.numSegments);
        annotator._updateBoundaryLayer();
        this.setAlpha(0).render();
      });
    };

    Annotator.prototype._createPixelIndex = function (numSegments) {
      var pixelIndex = new Array(numSegments),
        data = this.layers.superpixel.imageData.data,
        i;
      for (i = 0; i < numSegments; ++i)
        pixelIndex[i] = [];
      for (i = 0; i < data.length; i += 4) {
        var index = this.layers.superpixel._getEncodedLabel(data, i);
        pixelIndex[index].push(i);
      }
      this.currentPixels = null;
      this.pixelIndex = pixelIndex;
    };

    Annotator.prototype._getClickOffset = function (event) {
      var pos = this._getClickPos(event),
        x = pos[0],
        y = pos[1];
      return 4 * (y * this.layers[this.currentLabel].visualization.canvas.width + x);
    };

    Annotator.prototype._getClickPos = function (event) {
      var container = this.container,
        containerRect = container.getBoundingClientRect(), win = window, docElem = document.documentElement,
        offsetLeft = containerRect.left + (win.pageXOffset || docElem.scrollLeft) - (docElem.clientLeft || 0),
        offsetTop = containerRect.top + (win.pageYOffset || docElem.scrollTop) - (docElem.clientTop || 0),
        x = Math.round(
          (event.pageX - offsetLeft + container.scrollLeft) *
          (container.offsetWidth / container.scrollWidth)
        ),
        y = Math.round(
          (event.pageY - offsetTop + container.scrollTop) *
          (container.offsetHeight / container.scrollHeight)
        ),
        x = Math.max(Math.min(x, this.layers[this.currentLabel].visualization.canvas.width - 1), 0);
      y = Math.max(Math.min(y, this.layers[this.currentLabel].visualization.canvas.height - 1), 0);
      return [x, y];
    };

    // polygon tool.
    Annotator.prototype._addPolygonPoint = function (event, pos) {
      var annotator = this,
        x = pos[0],
        y = pos[1];
      //get canvas.
      var canvas = annotator.layers[this.currentLabel].annotatedObjects.canvas,
        ctx = canvas.getContext('2d');
      if (this.polygonPoints.length === 0) {
        ctx.save();  // remember previous state.
        annotator.prevAnnotationImg =
          ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
      // draw.
      ctx.fillStyle = '#FA6900';
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      if (this.polygonPoints.length === 0) {
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      this.polygonPoints.push(pos);
    };

    Annotator.prototype._emptyPolygonPoints = function () {
      var annotator = this,
        ctx = annotator.layers[this.currentLabel].annotatedObjects.canvas.getContext('2d');
      ctx.restore();
      if (annotator.prevAnnotationImg)
        ctx.putImageData(annotator.prevAnnotationImg, 0, 0);
      //reset polygon-points
      annotator.polygonPoints = [];
    };

    Annotator.prototype._addPolygonToAnnotation = function (options) {
      if (this.getCurrentSelectedObject() === 0)
        this.createNewObject();

      var annotator = this,
        canvas = document.createElement('canvas'),
        x, y,
        newLabel = this.currentLabel;
      if (typeof options !== "undefined") { // we use these values to erase the annotation within the polygon points
        newLabel = options.label;
      }
      // set canvas dimensions.
      canvas.width = annotator.layers[this.currentLabel].annotatedObjects.canvas.width;
      canvas.height = annotator.layers[this.currentLabel].annotatedObjects.canvas.height;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = "rgba(0, 0, 255, 255)";
      ctx.beginPath();
      ctx.moveTo(annotator.polygonPoints[0][0], annotator.polygonPoints[0][1]);
      for (var i = 1; i < annotator.polygonPoints.length; ++i) {
        x = annotator.polygonPoints[i][0];
        y = annotator.polygonPoints[i][1];
        ctx.lineTo(x, y);
      }
      ctx.lineTo(annotator.polygonPoints[0][0], annotator.polygonPoints[0][1]);
      ctx.closePath();
      ctx.fill();
      //get pixels within polygon.
      var colorToCheck = [0, 0, 255, 255],
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height),
        data = imageData.data,
        pixelsPolygon = [];
      for (x = 0; x < canvas.width; ++x) {
        for (y = 0; y < canvas.height; ++y) {
          var index = (x + y * imageData.width) * 4;
          if (data[index + 0] == colorToCheck[0] &&
            data[index + 1] == colorToCheck[1] &&
            data[index + 2] == colorToCheck[2] &&
            data[index + 3] == colorToCheck[3]) {
            pixelsPolygon.push(index);
          }
        }
      }
      // update annotation.
      annotator._updateAnnotation(pixelsPolygon, newLabel, this.getCurrentSelectedObject());
      annotator._emptyPolygonPoints();
    };

    Annotator.prototype._checkPolygonComplete = function () {
      if (this.polygonPoints.length < 4) return false;
      var newLineEndX = this.polygonPoints[this.polygonPoints.length - 1][0];
      var newLineEndY = this.polygonPoints[this.polygonPoints.length - 1][1];
      var polygonStartX = this.polygonPoints[0][0];
      var polygonStartY = this.polygonPoints[0][1];

      var distance = Math.sqrt(
        Math.pow(newLineEndX - polygonStartX, 2) +
        Math.pow(newLineEndY - polygonStartY, 2)
      );

      // Set flag to ensure that polygon is only closed once it has started.
      if (distance > 4) this.polygonCanClose = true;

      return distance < 4 && this.polygonCanClose;
    };

    Annotator.prototype._checkLineIntersection = function () {
      if (this.polygonPoints.length < 4)
        return false;
      var newLineStartX = this.polygonPoints[this.polygonPoints.length - 2][0],
        newLineStartY = this.polygonPoints[this.polygonPoints.length - 2][1],
        newLineEndX = this.polygonPoints[this.polygonPoints.length - 1][0],
        newLineEndY = this.polygonPoints[this.polygonPoints.length - 1][1];

      for (var i = 1; i < this.polygonPoints.length - 2; ++i) {
        var line1StartX = this.polygonPoints[i - 1][0],
          line1StartY = this.polygonPoints[i - 1][1],
          line1EndX = this.polygonPoints[i][0],
          line1EndY = this.polygonPoints[i][1],
          denominator =
            ((newLineEndY - newLineStartY) * (line1EndX - line1StartX)) -
            ((newLineEndX - newLineStartX) * (line1EndY - line1StartY)),
          a = line1StartY - newLineStartY,
          b = line1StartX - newLineStartX,
          numerator1 = ((newLineEndX - newLineStartX) * a) -
            ((newLineEndY - newLineStartY) * b),
          numerator2 = ((line1EndX - line1StartX) * a) -
            ((line1EndY - line1StartY) * b);
        a = numerator1 / denominator;
        b = numerator2 / denominator;
        if (a > 0 && a < 1 && b > 0 && b < 1)
          return true;
      }
      return false;
    };

    Annotator.prototype._setMode = function (mode) {
      this.mode = mode;
    };

    Annotator.prototype._updateHighlight = function (pixels) {
      var visualizationData = this.layers[this.currentLabel].visualization.imageData.data,
        boundaryData = this.layers.boundary.imageData.data,
        annotationData = this.layers[this.currentLabel].annotatedObjects.imageData.data,
        i,
        labelColor, objectNumber, currLabel,
        offset;
      if (this.currentPixels !== null) {
        for (i = 0; i < this.currentPixels.length; ++i) {
          offset = this.currentPixels[i];
          objectNumber = this.layers[this.currentLabel].annotatedObjects._getEncodedLabel(annotationData, offset);
          if (objectNumber > 0) {
            currLabel = this.currentLabel;
          } else {
            currLabel = 0
          }
          labelColor = this.colormap[currLabel];
          visualizationData[offset + 0] = labelColor[0];
          visualizationData[offset + 1] = labelColor[1];
          visualizationData[offset + 2] = labelColor[2];
          visualizationData[offset + 3] = this.visualizationAlpha;
        }
      }
      this.currentPixels = pixels;
      if (this.currentPixels !== null) {
        for (i = 0; i < pixels.length; ++i) {
          offset = pixels[i];
          if (boundaryData[offset + 3]) {
            visualizationData[offset + 0] = this.boundaryColor[0];
            visualizationData[offset + 1] = this.boundaryColor[1];
            visualizationData[offset + 2] = this.boundaryColor[2];
            visualizationData[offset + 3] = this.highlightAlpha;
          } else {
            visualizationData[offset + 3] = this.highlightAlpha;
          }
        }
      }
      this.layers[this.currentLabel].visualization.render();
      this.layers.boundary.render();
      if (typeof this.onhighlight === "function")
        this.onhighlight.call(this);
    };

    // Change the given pixel's label to the corresponding label in labels labels
    // and to its new object number
    Annotator.prototype._fillPixels = function (pixels, labels, objectNumbers) {

      if (pixels.length !== labels.length)
        throw "Invalid fill: " + pixels.length + " !== " + labels.length;

      if (pixels.length !== objectNumbers.length)
        throw "Invalid fill: " + pixels.length + " !== " + objectNumbers.length;

      var label = labels[0] === 0 ? this.currentLabel : labels[0];
      var annotationLayer = this.layers[label].annotatedObjects,
        annotationData = annotationLayer.imageData.data,
        labelVisualizationData = this.layers[label].visualization.imageData.data,
        objectVisualizationData = this.layers[label].objectVisualization.imageData.data;

      for (var i = 0; i < pixels.length; ++i) {
        var offset = pixels[i],
          label = labels[i],
          objectNumber = objectNumbers[i],
          labelColor = this.colormap[label],
          objectColor = this.colormap[objectNumber];
        // change the current pixel's label in this.layers.annotation.imageData.data
        annotationLayer._setEncodedLabel(annotationData, offset, objectNumber);

        if (typeof labelColor !== 'undefined') {
          // change the current pixel's label in visualizationData
          labelVisualizationData[offset + 0] = labelColor[0];
          labelVisualizationData[offset + 1] = labelColor[1];
          labelVisualizationData[offset + 2] = labelColor[2];
          labelVisualizationData[offset + 3] = this.visualizationAlpha;
        } else {
          alert("Undefined label color!")
        }

        if (typeof objectColor === 'undefined') {
          // if more colors are needed to represent data, expand color map
          var moreColors, numItems = objectNumber - this.colormap.length + 1;
          for (var j = 0; j < numItems; j++) {
            moreColors = colormap.addNewColor(this.colormap, "hsv");
            Array.prototype.push.apply(this.colormap, moreColors);
          }

          objectColor = this.colormap[objectNumber];
        }

        // You cannot pass 'this' to a forEach loop so we fine it as a variable
        var visualizationAlpha = this.visualizationAlpha;

        // change the current pixel's object number in the object visualization layer
        objectVisualizationData[offset + 0] = objectColor[0];
        objectVisualizationData[offset + 1] = objectColor[1];
        objectVisualizationData[offset + 2] = objectColor[2];
        objectVisualizationData[offset + 3] = visualizationAlpha;

        if (objectNumber === 0) {
          this.layers[this.currentLabel].objects.forEach(function (layer) {
            var data = layer.imageData.data;
            data[offset + 0] = objectColor[0];
            data[offset + 1] = objectColor[1];
            data[offset + 2] = objectColor[2];
            data[offset + 3] = visualizationAlpha;
          });
        } else if (objectNumber > 0) {
          var objectLayerData = this.layers[label].objects[objectNumber - 1].imageData.data;
          objectLayerData[offset + 0] = objectColor[0];
          objectLayerData[offset + 1] = objectColor[1];
          objectLayerData[offset + 2] = objectColor[2];
          objectLayerData[offset + 3] = visualizationAlpha;
        }
      }
    };

    // Update label.
    Annotator.prototype._updateAnnotation = function (pixels, labels, objectNumbers) {

      if (objectNumbers < 0) return this;

      var updates;
      objectNumbers = objectNumbers || this.defaultObjectNumber;
      labels = (typeof labels === "object") ?
        labels : _fillArray(new Int32Array(pixels.length), labels);
      objectNumbers = (typeof objectNumbers === "object") ?
        objectNumbers : _fillArray(new Int32Array(pixels.length), objectNumbers);
      // Find out which pixels changed labels
      updates = this._getDifferentialUpdates(pixels, labels, objectNumbers);
      // if nothing has changed then return
      if (updates.pixels.length === 0)
        return this;
      // Add the new updates to the update history. Used for "undo" function
      this._updateHistory(updates);
      // update annotationData and visualizationData with new labels for changed pixels
      this._fillPixels(updates.pixels, updates.next, updates.nextObjNum);
      // Update canvas image
      this.layers[this.currentLabel].visualization.render();
      this.layers[this.currentLabel].objectVisualization.render();
      // Update object canvas
      this.layers[this.currentLabel].objects.forEach(function (layer) {
        layer.render();
      });

      if (typeof this.onchange === "function")
        this.onchange.call(this);
      return this;
    };

    // Get the differential update of labels (i.e. find out which pixels had their label or objet number changed)
    // NOTE: This works because all calls to updateAnnotation look at the annotatedObjects layers of the curretn layer only.
    // If we started looking at the annotated objects of other labels, this fnuction needs to be modified to account for that.
    Annotator.prototype._getDifferentialUpdates = function (pixels, labels, objectNumbers) {
      if (pixels.length !== labels.length)
        throw "Invalid labels";
      var annotationData = this.layers[this.currentLabel].annotatedObjects.imageData.data,
        label,
        updates = { pixels: [], prev: [], next: [], prevObjNum: [], nextObjNum: [] };
      for (var i = 0; i < pixels.length; ++i) {
        // Get the label of pixel i in the image from our annotation data (imageData.data)
        var objectNumber = this.layers[this.currentLabel].annotatedObjects._getEncodedLabel(annotationData, pixels[i]);
        label = 0;
        if (objectNumber > 0) {
          label = this.currentLabel;
        }
        //var objectNumber = _getEncodedLabel(objectsData, pixels[i]);
        // If there has been a change in pixel i's label then add it to our updates dictionary
        if ((label !== labels[i]) || (objectNumber !== objectNumbers[i])) {
          updates.pixels.push(pixels[i]);
          updates.prev.push(label);
          updates.prevObjNum.push(objectNumber);
          updates.next.push(labels[i]);
          updates.nextObjNum.push(objectNumbers[i]);
        }
      }
      return updates;
    };

    // Keep track of annotation changes. This is used later for "undo".
    // Change maxHistoryRecord to increase the maximum number of changes that can be "un-done".
    // This can be implemented more efficiently now that each layer has its own label. Future To Do
    Annotator.prototype._updateHistory = function (updates) {
      this.history[this.currentLabel] = this.history[this.currentLabel].slice(0, this.currentHistoryRecord[this.currentLabel] + 1);
      this.history[this.currentLabel].push(updates);
      if (this.history[this.currentLabel].length > this.maxHistoryRecord) {
        this.history[this.currentLabel] = this.history[this.currentLabel].slice(1, this.history[this.currentLabel].length);
      } else {
        ++this.currentHistoryRecord[this.currentLabel];
      }
    };

    Annotator.prototype._addImportedLayer = function (layerLabel, layer) {
      var annotator = this;

      // create the three layers associated with the layerLabels label:
      // 1. annotation layer with object numbers.
      // 2. visualization layer with annotated pixels colored with the  appropriate color value for the current label
      // 3. objectVisualization layer consisting of pixels colored by object numbers
      if (typeof layerLabel !== "undefined") {
        annotator.layers[layerLabel].annotatedObjects.copy(layer);
        annotator.layers[layerLabel].visualization.copy(annotator.createLabelLayer(layerLabel, layer));
        annotator.layers[layerLabel].objectVisualization.copy(layer);
        annotator.layers[layerLabel]
          .visualization
          .applyColormap({ greyscale: false, givenColormap: annotator.colormap })
          .setAlpha(annotator.visualizationAlpha)
          .render();
        annotator.layers[layerLabel]
          .objectVisualization
          .applyColormap({ greyscale: false, givenColormap: annotator.colormap })
          .setAlpha(annotator.visualizationAlpha)
          .render();
        annotator.layers[layerLabel].annotatedObjects.setAlpha(0).render();

        // Create layers for objects
        var i, objects = this.currentObjectNumber[layerLabel] - 1;
        for (i = 0; i < objects; ++i) {

          this.layers[layerLabel].objects[i] = new Layer().copy(layer);
          var canvas = this.layers[layerLabel].objects[i].canvas;

          canvas.classList.add("segment-annotator-layer");
          canvas.classList.add("object");
          canvas.classList.add(this.labels[layerLabel].replace(/ /g, '_'));
          canvas.classList.add(i.toString());

          canvas.style.display = "none";
          canvas.width = this.width;
          canvas.height = this.height;

          var innerContainerTemp = this.innerContainer;
          innerContainerTemp.appendChild(canvas);

          this.container.replaceChild(this.innerContainer, innerContainerTemp);
          this.innerContainer = innerContainerTemp;

          this.layers[layerLabel].objects[i].applyColormap({ greyscale: false, givenColormap: annotator.colormap, objectLayer: i })
            .setAlpha(annotator.visualizationAlpha)
            .render();

        }
      }
    };

    Annotator.prototype._crc32 = function (array) {
      var ds = new DataStream(array);
      var crc = 0 ^ (-1);
      var dsArr = ds.readUint8Array();

      for (var i = 0; i < array.byteLength; i++) {
        crc = (crc >>> 8) ^ this.crcTable[(crc ^ dsArr[i]) & 0xFF];
      }

      return (crc ^ (-1)) >>> 0;
    };

    Annotator.prototype._getMaxObjectNumber = function (label) {
      return this.currentObjectNumber[label] + (this.nextObject[label] ? 0 : -1);
    };

    function _fillArray(array, value) {
      for (var i = 0; i < array.length; ++i)
        array[i] = value;
      return array;
    }

    function _arrayInsert(array, index, toInsert) {
      var newArray = new (array.constructor)(array.length + toInsert.length);
      newArray.set(array.slice(0, index), 0);
      newArray.set(toInsert, index);
      newArray.set(array.slice(index), index + toInsert.length);
      return newArray;
    }

    function _arrayConcat(array, toInsert) {
      return _arrayInsert(array, array.length, toInsert);
    }

    // Adapted from:
    // https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
    function _stringToArray(str) {
      var buf = new ArrayBuffer(str.length);
      var bufView = new Uint8Array(buf);
      for (var i = 0; i < str.length; i++) {
        bufView[i] = str.charCodeAt(i);
      }
      return bufView;
    }

    function _int8ToArray(num) {
      return new Uint8Array([
        (num & 0xff)
      ]);
    }

    function _int32ToArray(num) {
      return new Uint8Array([
        (num & 0xff000000) >> 24,
        (num & 0x00ff0000) >> 16,
        (num & 0x0000ff00) >> 8,
        (num & 0x000000ff)
      ]);
    }

    function _makeCRCTable() {
      var c;
      var crcTable = [];
      for (var n = 0; n < 256; n++) {
        c = n;
        for (var k = 0; k < 8; k++) {
          c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
      }
      return crcTable;
    }

    return Annotator;
  });
