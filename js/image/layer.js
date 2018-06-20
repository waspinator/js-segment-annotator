/** Image canvas wrapper.
 *
 * Example:
 *
 *  var layer = new Layer("/path/to/image.jpg", {
 *    onload: function () {
 *      this.resize(200, 300);
 *      document.body.appendChild(this.canvas);
 *    }
 *  });
 *
 * Copyright 2015  Kota Yamaguchi
 */
define(['../helper/colormap'],
  function (colormap) {
    // Canvas wrapper object. Creates a canvas
    function Layer(source, options) {
      options = options || {};
      this.canvas = document.createElement("canvas");
      this.canvas.width = options.width || this.canvas.width;
      this.canvas.height = options.height || this.canvas.height;
      if (source) {
        if (typeof source === "string" ||
          typeof source === "object" && source.nodeName === "IMG")
          this.load(source, options);
        else if (typeof source === "object" &&
          (source.nodeName === "CANVAS" || source instanceof ImageData))
          this.fromCanvas(source, options);
      }
    }

    // Load an image from source
    Layer.prototype.load = function (source, options) {
      options = options || {};
      if (typeof options === "function") options = { onload: options };
      var image, layer = this;
      this.canvas.width = options.width || this.canvas.width;
      this.canvas.height = options.height || this.canvas.height;
      if (typeof source === "string") {
        image = new Image();
        image.src = source;
      }
      else
        image = source;
      image.onload = function () { layer._onImageLoad(image, options); };
      if (typeof options.onerror === "function")
        image.onerror = options.onerror.call(this);
      return this;
    };


    // loads the given image and gets its pixel data
    Layer.prototype._onImageLoad = function (image, options) {
      this.canvas.width = options.width || image.width;
      this.canvas.height = options.height || image.height;
      var context = this.canvas.getContext("2d");
      this._setImageSmoothing(context, options);
      context.drawImage(image, 0, 0, image.width, image.height,
        0, 0, this.canvas.width, this.canvas.height);
      this.imageData = context.getImageData(0, 0,
        this.canvas.width,
        this.canvas.height);
      if (typeof options.onload === "function")
        options.onload.call(this);
    };

    Layer.prototype.fromCanvas = function (source, options) {
      options = options || {};
      if (typeof options === "function") options = { onload: options };
      this.canvas.width = source.width;
      this.canvas.height = source.height;
      var context = this.canvas.getContext("2d");
      this._setImageSmoothing(context, options);
      if (source instanceof ImageData)
        context.putImageData(source, 0, 0);
      else
        context.drawImage(source, 0, 0, this.canvas.width, this.canvas.height);
      this.imageData = context.getImageData(0, 0,
        this.canvas.width,
        this.canvas.height);
      if (typeof options.onload === "function")
        options.onload.call(this);
      return this;
    };

    Layer.prototype.fromImageData = function (imageData, options) {
      options = options || {};
      if (typeof options === "function") options = { onload: options };
      this.canvas.width = imageData.width;
      this.canvas.height = imageData.height;
      var context = this.canvas.getContext("2d");
      this._setImageSmoothing(context, options);
      context.drawImage(imageData, 0, 0, this.canvas.width, this.canvas.height);
      this.imageData = context.getImageData(0, 0,
        this.canvas.width,
        this.canvas.height);
      if (typeof options.onload === "function")
        options.onload.call(this);
      return this;
    };

    Layer.prototype._setImageSmoothing = function (context, options) {
      if (typeof options.imageSmoothingEnabled === "undefined")
        options.imageSmoothingEnabled = true;
      //context.mozImageSmoothingEnabled = options.imageSmoothingEnabled;
      context.webkitImageSmoothingEnabled = options.imageSmoothingEnabled;
      context.msImageSmoothingEnabled = options.imageSmoothingEnabled;
      context.imageSmoothingEnabled = options.imageSmoothingEnabled;
    };

    Layer.prototype.copy = function (source) {
      source.render();
      this.fromCanvas(source.canvas);
      return this;
    };

    Layer.prototype.process = function (callback) {
      if (typeof callback !== "function")
        throw "Invalid callback";
      callback.call(this, this.imageData);
      return this.render();
    };

    // update the canvas image with new imageData
    Layer.prototype.render = function () {
      if (this.imageData)
        this.canvas.getContext("2d").putImageData(this.imageData, 0, 0);
      else { alert("no image data!") }
      return this;
    };

    Layer.prototype.setAlpha = function (alpha) {
      var data = this.imageData.data, i;
      for (i = 3; i < data.length; i += 4)
        data[i] = alpha;
      return this;
    };

    Layer.prototype.fill = function (rgba) {
      var data = this.imageData.data,
        i, j;

      for (i = 0; i < data.length; i += 4)
        for (j = 0; j < rgba.length; ++j)
          data[i + j] = rgba[j];

      return this;
    };

    Layer.prototype.resize = function (width, height, options) {
      options = options || {};
      var temporaryCanvas = document.createElement("canvas"),
        tempoaryContext = temporaryCanvas.getContext("2d");
      temporaryCanvas.width = width;
      temporaryCanvas.height = height;
      tempoaryContext.drawImage(this.canvas, 0, 0, width, height);
      this.canvas.width = width;
      this.canvas.height = height;
      var context = this.canvas.getContext("2d");
      this._setImageSmoothing(context, options);
      context.drawImage(temporaryCanvas, 0, 0);
      this.imageData = context.getImageData(0, 0, width, height);
      return this;
    };

    // use the colormap to change the RGB values of the corresponding pixels in imageData.data
    Layer.prototype.applyColormap = function (args) {
      var moreColors,
        greyscale = args.greyscale || false,
        givenColormap = args.givenColormap,
        data = this.imageData.data,
        i;

      if (typeof greyscale === "undefined") greyscale = true;

      for (i = 0; i < data.length; i += 4) {

        var index = data[i];

        if (!greyscale)
          index |= (data[i + 1] << 8) | (data[i + 2] << 16);

        // if more colors are needed to represent data, expand color map
        var j, numItems = index - givenColormap.length + 1;

        for (j = 0; j < numItems; j++) {
          moreColors = colormap.addNewColor(givenColormap, "hsv");
          Array.prototype.push.apply(givenColormap, moreColors);
        }

        if ('objectLayer' in args) {
          if (index !== (args.objectLayer + 1)) {
            index = 0;
          }
        }

        data[i] = givenColormap[index][0];
        data[i + 1] = givenColormap[index][1];
        data[i + 2] = givenColormap[index][2];
      }

      return this;
    };

    Layer.prototype.computeEdgemap = function (options) {
      if (typeof options === "undefined") options = {};
      var data = this.imageData.data,
        width = this.imageData.width, // width and height is in number pixels
        height = this.imageData.height,
        edgeMap = new Uint8Array(this.imageData.data),
        foreground = options.foreground || [255, 255, 255],
        background = options.background || [0, 0, 0],
        i, j, k;
      for (i = 0; i < height; ++i) {
        for (j = 0; j < width; ++j) {
          var offset = 4 * (i * width + j),
            index = data[4 * (i * width + j)],
            // a pixel is on a boundary iff: it is on the edge of the image OR
            //                               the current alpha?? value is different from an adjecent pixel
            isBoundary = (i === 0 ||
              j === 0 ||
              i === (height - 1) ||
              j === (width - 1) ||
              index !== data[4 * (i * width + j - 1)] ||
              index !== data[4 * (i * width + j + 1)] ||
              index !== data[4 * ((i - 1) * width + j)] ||
              index !== data[4 * ((i + 1) * width + j)]);
          if (isBoundary) {
            for (k = 0; k < foreground.length; ++k)
              edgeMap[offset + k] = foreground[k];
          }
          else {
            for (k = 0; k < background.length; ++k)
              edgeMap[offset + k] = background[k];
          }
        }
      }
      data.set(edgeMap);
      return this;
    };

    Layer.prototype.inverseCantorPair = function (ar) {
      var result = [],
        i, x, y, row;
      for (i = 0; i < ar.length; i++) {
        row = [];
        for (x = 0, y = i; y >= 0; x++ , y--) {
          row.push(ar[y][x]);
        }
        result.push(row);
      }
      for (i = 1; i < ar[0].length; i++) {
        row = [];
        for (x = i, y = ar[0].length - 1; x < ar[0].length; x++ , y--) {
          row.push(ar[y][x]);
        }
        result.push(row);
      }
    };

    Layer.prototype.gray2index = function () {
      var data = this.imageData.data,
        i;
      for (i = 0; i < data.length; i += 4) {
        data[i + 1] = 0;
        data[i + 2] = 0;
      }
      return this;
    };

    Layer.prototype._getEncodedLabel = function (array, offset) {
      return array[offset] |
        (array[offset + 1] << 8) |
        (array[offset + 2] << 16);
    };

    // Label encoding: label is int32, canvas data consists of pixels each
    // containing four array items: red value of the color, green value of the color,
    // blue value of the color, and the Alpha (transparency) of the pixel.
    // The values for each item range from 0-255
    // label encoding saves each 8 bits in a single pixel array item.
    Layer.prototype._setEncodedLabel = function (array, offset, val) {
      array[offset + 0] = val & 255;
      array[offset + 1] = (val >>> 8) & 255;
      array[offset + 2] = (val >>> 16) & 255;
      array[offset + 3] = 255;
    };

    Layer.prototype.copyImageData = function (originalLayer) {
      var context = originalLayer.canvas.getContext("2d");
      this.imageData = context.getImageData(0, 0,
        originalLayer.canvas.width,
        originalLayer.canvas.height);
      this.imageData.data.set(originalLayer.imageData.data);
      return this;
    };


    return Layer;
  });
