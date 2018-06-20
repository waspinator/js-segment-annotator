/** Editor page renderer.
 * This is where the user annotates a selected image. It renders the Prev, Next
 * buttons, the label list, and the image with its superpixels
 */

define(['../image/layer',
  '../helper/segment-annotator',
  '../helper/util'],
  function (Layer, Annotator, util) {

    // Create the navigation menu allowing the user to move to the next or previous image to be annotated.
    function createNavigationMenu(params, data, annotator) {
      var navigationMenu = document.createElement("p"),
        navigation = createNavigation(params, data),
        idBlock = document.createElement("div");
      idBlock.className = "edit-top-menu-block";
      idBlock.appendChild(
        document.createTextNode(" ID = " + params.id));
      navigationMenu.appendChild(navigation);
      navigationMenu.appendChild(idBlock);
      return navigationMenu;
    }

    // Create the  navigation between images ("Prev index Next" at the top of each edit page)
    function createNavigation(params, data) {
      var id = parseInt(params.id, 10),
        container = document.createElement("div"),
        indexAnchor = document.createElement("a"),
        indexAnchorText = document.createTextNode("Index"),
        prevAnchorText = document.createTextNode("Prev"),
        nextAnchorText = document.createTextNode("Next"),
        prevAnchor, nextAnchor;
      indexAnchor.href = util.makeQueryParams({ view: "index" }); // link the index text to the main page containing the indexed list of images
      indexAnchor.appendChild(indexAnchorText);
      if (id > 0) {
        prevAnchor = document.createElement("a");
        prevAnchor.appendChild(prevAnchorText);
        prevAnchor.href = util.makeQueryParams(params, {
          id: id - 1
        });
      }
      else
        prevAnchor = prevAnchorText;
      if (id < data.imageURLs.length - 1) {
        nextAnchor = document.createElement("a");
        nextAnchor.appendChild(nextAnchorText);
        nextAnchor.href = util.makeQueryParams(params, {
          id: id + 1
        });
      }
      else
        nextAnchor = nextAnchorText;
      container.appendChild(prevAnchor);
      container.appendChild(document.createTextNode(" "));
      container.appendChild(indexAnchor);
      container.appendChild(document.createTextNode(" "));
      container.appendChild(nextAnchor);
      container.classList.add("edit-top-menu-block");
      return container;
    }

    // Create the main content block. This is where the contents of the annotation page
    //  are created (segmetned image, label list etc.) and the annotation takes place
    function createMainDisplay(params, data, annotator, imageLayer) {
      var container = document.createElement("div"),
        imageContainerSpacer = document.createElement("div"),
        imageContainer = document.createElement("div"),
        annotatorTopMenu = createImageTopMenu(params, data, annotator),
        annotatorContainer = document.createElement("div"),
        sidebarSpacer = document.createElement("div"),
        sidebarContainer = document.createElement("div"),
        sidebar = createSidebar(params, data, annotator),
        objectsContainer = document.createElement("div"),
        objects = createObjectsViewer(annotator);

      //imageContainer contains the image without segmentation or annotationURLs
      // imageContainerSpacer.className = "edit-image-top-menu";
      // imageContainer.className = "edit-image-display";
      // imageContainer.appendChild(imageContainerSpacer);
      // imageContainer.appendChild(imageLayer.canvas);

      // annotatorContainer contains the image with its annotations. This is where we add superpixel segments
      annotatorContainer.className = "edit-image-display";
      annotatorContainer.appendChild(annotatorTopMenu);
      annotatorContainer.appendChild(annotator.container);

      // meant to add a spacer on top of the sidebar menu
      sidebarSpacer.className = "edit-image-top-menu";

      // This contains the labels and other functions
      sidebarContainer.className = "edit-image-display";
      sidebarContainer.appendChild(sidebarSpacer);
      sidebarContainer.appendChild(sidebar);

      objectsContainer.className = "edit-image-display object-container";
      sidebarContainer.appendChild(sidebarSpacer);
      objectsContainer.appendChild(objects);

      //Show the image with its annotation functions
      container.className = "edit-main-container";
      //container.appendChild(imageContainer);
      container.appendChild(annotatorContainer);
      // Side bar containing the label list and other tools on the side of the edit page
      container.appendChild(sidebarContainer);
      container.appendChild(objectsContainer);
      return container;
    }

    // Create the menu above the editor containing: zoom buttons, segment buttons, and image buttons
    function createImageTopMenu(params, data, annotator) {
      var container = document.createElement("div"),
        zoomOutButton = document.createElement("div"),
        zoomInButton = document.createElement("div"),
        spacer1 = document.createElement("span"),
        finerButton = document.createElement("div"),
        boundaryButton = document.createElement("div"),
        coarserButton = document.createElement("div"),
        spacer2 = document.createElement("span"),
        alphaMinusButton = document.createElement("div"),
        imageButton = document.createElement("div"),
        alphaPlusButton = document.createElement("div"),
        spacer3 = document.createElement("span"),
        objectVisualizationButton = document.createElement("div");


      // Button to zoom in and out ofthe image being annotated
      zoomOutButton.appendChild(document.createTextNode("-"));
      zoomOutButton.classList.add("edit-image-top-button");
      zoomOutButton.addEventListener("click", function () {
        annotator.zoomOut();
      });
      zoomInButton.appendChild(document.createTextNode("zoom +"));
      zoomInButton.classList.add("edit-image-top-button");
      zoomInButton.addEventListener("click", function () {
        annotator.zoomIn();
      });

      spacer1.className = "edit-image-top-spacer";

      // Button to show the superpixel segments
      boundaryButton.id = "boundary-button";
      boundaryButton.className = "edit-image-top-button";
      boundaryButton.appendChild(document.createTextNode("boundary"));
      boundaryButton.addEventListener("click", function () {
        if (boundaryFlashTimeoutID)
          window.clearTimeout(boundaryFlashTimeoutID);
        if (boundaryButton.classList.contains("edit-image-top-button-enabled"))
          annotator.hide("boundary");
        else
          annotator.show("boundary");
        boundaryButton.classList.toggle("edit-image-top-button-enabled");
      });

      // Button to increase and decrease the number of superpixels
      finerButton.appendChild(document.createTextNode("-"));
      finerButton.className = "edit-image-top-button";
      finerButton.addEventListener("click", function () {
        annotator.finer();
        boundaryFlash();
      });
      coarserButton.appendChild(document.createTextNode("+"));
      coarserButton.className = "edit-image-top-button";
      coarserButton.addEventListener("click", function () {
        annotator.coarser();
        boundaryFlash();
      });

      spacer2.className = "edit-image-top-spacer";

      // Button to increase or decrease the image's opacity
      alphaMinusButton.className = "edit-image-top-button";
      alphaMinusButton.appendChild(document.createTextNode("-"));
      alphaMinusButton.addEventListener("click", function () {
        annotator.moreAlpha();
      });
      imageButton.className = "edit-image-top-button " +
        "edit-image-top-button-enabled";
      imageButton.appendChild(document.createTextNode("image"));
      imageButton.addEventListener("click", function () {
        if (imageButton.classList.contains("edit-image-top-button-enabled"))
          annotator.hide("image");
        else
          annotator.show("image");
        imageButton.classList.toggle("edit-image-top-button-enabled");
      });
      alphaPlusButton.className = "edit-image-top-button";
      alphaPlusButton.appendChild(document.createTextNode("+"));
      alphaPlusButton.addEventListener("click", function () {
        annotator.lessAlpha();
      });

      spacer3.className = "edit-image-top-spacer spacer3";

      // Button to show the superpixel segments
      objectVisualizationButton.id = "objectVisualization-button";
      objectVisualizationButton.className = "edit-image-top-button objectVisualization";
      objectVisualizationButton.appendChild(document.createTextNode("Objects"));
      objectVisualizationButton.addEventListener("click", function () {
        objectVisualizationButton.classList.toggle("edit-image-top-button-enabled");
        if (objectVisualizationButton.classList.contains("edit-image-top-button-enabled")) {
          annotator.objectVisualizationOn = true;
          annotator.hide("objectVisualization", annotator.labels);
          annotator.hide("visualization", annotator.labels);
          annotator.hide("annotatedObjects", annotator.labels);
          annotator.show("visualization", [annotator.currentLabel]);
          annotator.correctDisplay();
        } else {
          annotator.objectVisualizationOn = false;
          annotator.correctDisplay();
          annotator.hide("visualization", annotator.labels);
          annotator.hide("annotatedObjects", annotator.labels);
          annotator.show("visualization", [annotator.currentLabel]);
          annotator.show("annotatedObjects", [annotator.currentLabel]);
        }
      });

      // Container contains the "zoom", "boundary", and "image"-related buttons
      container.className = "edit-image-top-menu";
      container.appendChild(zoomOutButton);
      container.appendChild(zoomInButton);
      container.appendChild(spacer1);
      container.appendChild(finerButton);
      container.appendChild(boundaryButton);
      container.appendChild(coarserButton);
      container.appendChild(spacer2);
      container.appendChild(alphaMinusButton);
      container.appendChild(imageButton);
      container.appendChild(alphaPlusButton);
      container.appendChild(spacer3);
      container.appendChild(objectVisualizationButton);

      return container;
    }

    // Set up the automatic flash of boundary.
    // Shows the superpixel segment boundaries for a preset amount of time then hides the boundaries.
    var boundaryFlashTimeoutID = null,
      boundarFlashTime = 1000;

    function boundaryFlash() {
      var boundaryButton = document.getElementById("boundary-button");
      if (boundaryFlashTimeoutID) {
        window.clearTimeout(boundaryFlashTimeoutID);
        boundaryFlashTimeoutID = window.setTimeout(function () {
          boundaryButton.click();
          boundaryFlashTimeoutID = null;
        }, boundarFlashTime);
      } else if (!boundaryButton.classList.contains(
        "edit-image-top-button-enabled")) {
        boundaryButton.click();
        boundaryFlashTimeoutID = window.setTimeout(function () {
          boundaryButton.click();
          boundaryFlashTimeoutID = null;
        }, boundarFlashTime);
      }
    }

    // Create the sidebar containing labels and other functions
    function createSidebar(params, data, annotator) {
      var container = document.createElement("div"),
        labelPicker = createLabelPicker(params, data, annotator),
        spacer1 = document.createElement("div"),
        undoButton = document.createElement("div"),
        redoButton = document.createElement("div"),
        spacer2 = document.createElement("div"),
        denoiseButton = document.createElement("div"),
        newObjectButton = document.createElement("div"),
        deleteObjectButton = document.createElement("div"),
        spacer3 = document.createElement("div"),
        superpixelToolButton = document.createElement("div"),
        spacer4 = document.createElement("div"),
        spacer5 = document.createElement("div"),
        spacer6 = document.createElement("div"),
        polygonToolButton = document.createElement("div"),
        brushToolButton = document.createElement("div"),
        manualParagraph = document.createElement("p"),
        exportButton = document.createElement("input"),
        annotateButton = document.createElement("input");

      // Create the export button
      exportButton.type = "submit";
      exportButton.value = "export";
      exportButton.className = "edit-sidebar-submit";
      exportButton.addEventListener("click", function () {
        //Save image
        var filePath = data.annotationURLs[params.id].split(/[\\/]/).pop();
        var image = annotator.exportTiles();
        if (image !== null) downloadURI(image, filePath);
      });

      annotateButton.type = "submit";
      annotateButton.value = "call api";
      annotateButton.className = "edit-sidebar-annotate";
      annotateButton.addEventListener("click", function () {
        //Save image
        var i;
        for (i = 0; i < annotator.deleteObjectNumbers.length; i++) {
          if (annotator.deleteObjectNumbers[i] != null) {
            if (annotator.deleteObjectNumbers[i].length > 0) {
              confirm('Please save before annotating');
              return;
            }
          }
        }

        var annotate = annotator.exportTiles();
        var canvas = document.getElementsByClassName('image');

        canvas[0].toBlob(function (blob) {
          var formData = new FormData();
          formData.append('image', blob, 'image.jpg');

          if (annotate != null) {
            formData.append('annotate64', annotate);
          }

          axios.post(annotator.annotateURL, formData).then(function (response) {
            annotator.update(response.data);
          }).catch(function () {
            console.log("An error has occurred well trying to annotate the file.")
          })

        }, 'image/jpeg');
      });

      spacer1.className = "edit-sidebar-spacer";

      // Define the undoo button
      undoButton.className = "edit-sidebar-button";
      undoButton.appendChild(document.createTextNode("undo"));
      undoButton.addEventListener("click", function () { annotator.undo(); });

      //Define the redo button
      redoButton.className = "edit-sidebar-button";
      redoButton.appendChild(document.createTextNode("redo"));
      redoButton.addEventListener("click", function () { annotator.redo(); });

      spacer2.className = "edit-sidebar-spacer";

      // Define the denoise button
      denoiseButton.className = "edit-sidebar-button";
      denoiseButton.appendChild(document.createTextNode("denoise"));
      denoiseButton.addEventListener("click", function () { annotator.denoise(); });

      // Define the new object button
      newObjectButton.className = "edit-sidebar-button";
      newObjectButton.appendChild(document.createTextNode("new object"));
      newObjectButton.addEventListener("click", function () { annotator.createNewObject(); });

      // Define the new object button
      deleteObjectButton.className = "edit-sidebar-button";
      deleteObjectButton.appendChild(document.createTextNode("delete object"));
      deleteObjectButton.addEventListener("click", function () { annotator.deleteObject(); });

      // Define the superpixel button
      superpixelToolButton.className = "edit-sidebar-button";
      superpixelToolButton.classList.add("superpixel-tool");
      superpixelToolButton.appendChild(
        document.createTextNode("Superpixel tool"));
      superpixelToolButton.addEventListener("click", function () {
        polygonToolButton.classList.remove("edit-sidebar-button-selected");
        brushToolButton.classList.remove("edit-sidebar-button-selected");
        superpixelToolButton.classList.add("edit-sidebar-button-selected");
        annotator._setMode("superpixel");
      });
      // ??? why do we need this here again???
      superpixelToolButton.classList.add("edit-sidebar-button-selected");

      // Polygon button
      polygonToolButton.className = "edit-sidebar-button";
      polygonToolButton.classList.add("polygon-tool");
      polygonToolButton.appendChild(document.createTextNode("Polygon tool"));
      polygonToolButton.addEventListener("click", function () {
        superpixelToolButton.classList.remove("edit-sidebar-button-selected");
        brushToolButton.classList.remove("edit-sidebar-button-selected");
        polygonToolButton.classList.add("edit-sidebar-button-selected");
        annotator._setMode("polygon");
      });

      // Brush tool button
      brushToolButton.classList.add("edit-sidebar-button-selected");
      brushToolButton.className = "edit-sidebar-button";
      brushToolButton.classList.add("brush-tool");
      brushToolButton.appendChild(document.createTextNode("Brush tool"));
      brushToolButton.addEventListener("click", function () {
        superpixelToolButton.classList.remove("edit-sidebar-button-selected");
        polygonToolButton.classList.remove("edit-sidebar-button-selected");
        brushToolButton.classList.add("edit-sidebar-button-selected");
        annotator._setMode("brush");
      });

      spacer3.className = "edit-sidebar-spacer";

      // A paragraph that explains how to use each tool
      manualParagraph.appendChild(document.createTextNode("ctrl: toggle mode"));
      manualParagraph.appendChild(document.createElement("br"));
      manualParagraph.appendChild(document.createElement("br"));
      manualParagraph.appendChild(document.createTextNode("+Superpixel tool:"));
      manualParagraph.appendChild(document.createElement("br"));
      manualParagraph.appendChild(document.createTextNode("left: mark"));
      manualParagraph.appendChild(document.createElement("br"));
      manualParagraph.appendChild(document.createTextNode("right: erase"));
      manualParagraph.appendChild(document.createElement("br"));
      manualParagraph.appendChild(document.createElement("br"));
      manualParagraph.appendChild(document.createTextNode("+Polygon tool:"));
      manualParagraph.appendChild(document.createElement("br"));
      manualParagraph.appendChild(document.createTextNode("left: mark area"));
      manualParagraph.appendChild(document.createElement("br"));
      manualParagraph.appendChild(document.createTextNode("right: erase area"));
      manualParagraph.appendChild(document.createElement("br"));
      manualParagraph.appendChild(document.createElement("br"));
      manualParagraph.appendChild(document.createTextNode("Objects"));
      manualParagraph.appendChild(document.createElement("br"));
      manualParagraph.appendChild(document.createTextNode("space: new object"));
      manualParagraph.appendChild(document.createElement("br"));
      manualParagraph.appendChild(document.createTextNode("delete: deletes"));
      manualParagraph.appendChild(document.createElement("br"));
      manualParagraph.appendChild(document.createTextNode("object"));


      spacer4.className = "edit-sidebar-spacer";
      spacer5.className = "edit-sidebar-spacer";
      spacer6.className = "edit-sidebar-spacer";

      // Place all buttons
      container.className = "edit-sidebar";
      container.appendChild(labelPicker);
      container.appendChild(spacer1);
      container.appendChild(undoButton);
      container.appendChild(redoButton);
      // container.appendChild(spacer2);
      // container.appendChild(denoiseButton);
      container.appendChild(spacer3);
      container.appendChild(newObjectButton);
      container.appendChild(deleteObjectButton);
      container.appendChild(spacer4);
      container.appendChild(polygonToolButton);
      container.appendChild(superpixelToolButton);
      //container.appendChild(brushToolButton);
      container.appendChild(manualParagraph);
      //container.appendChild(spacer4);
      container.appendChild(spacer5);
      container.appendChild(exportButton);

      return container;
    }

    // Defines the list of labels and their corresponding colors
    function createLabelButton(data, value, index, annotator) {
      var colorBox = document.createElement("span"),
        labelText = document.createElement("span"),
        pickButton = document.createElement("div"),
        popupButton = document.createElement("div"),
        popupContainer = document.createElement("div");


      colorBox.className = "edit-sidebar-legend-colorbox";
      colorBox.style.backgroundColor =
        "rgb(" + data.colormap[index].join(",") + ")";

      labelText.appendChild(document.createTextNode(value));
      labelText.className = "edit-sidebar-legend-label";

      popupButton.appendChild(document.createTextNode("+"));
      popupButton.className = "edit-sidebar-popup-trigger";
      popupButton.addEventListener("click", function () {
        popupContainer.classList.toggle("edit-sidebar-popup-active");
      });

      popupContainer.className = "edit-sidebar-popup";
      popupContainer.appendChild(
        createRelabelSelector(data, index, annotator, popupContainer)
      );
      popupContainer.addEventListener("click", function (event) {
        event.preventDefault();
      });

      pickButton.appendChild(colorBox);
      pickButton.appendChild(labelText);
      pickButton.appendChild(popupButton);
      pickButton.appendChild(popupContainer);
      pickButton.id = "label-" + index + "-button";
      pickButton.className = "edit-sidebar-button";
      pickButton.addEventListener("click", function () {
        var className = "edit-sidebar-button-selected";
        annotator.currentLabel = index;
        annotator.updateObjectView();
        annotator.hide("visualization", annotator.labels);
        annotator.hide("objectVisualization", annotator.labels);
        annotator.hide("annotatedObjects", annotator.labels);
        annotator.show("visualization", [index]);
        annotator.show("annotatedObjects", [index]);

        // If the Object Visualization button is on, show the objectVisualizationLayer as well
        var objVisButtonID = document.getElementById("objectVisualization-button");
        if (objVisButtonID.classList.contains("edit-image-top-button-enabled")) {
          annotator.show("objectVisualization", [index]);
        }

        var selectedElements = document.getElementsByClassName(className);
        for (var i = 0; i < selectedElements.length; ++i)
          selectedElements[i].classList.remove(className);
        pickButton.classList.add(className);
      });
      pickButton.addEventListener('mouseenter', function () {
        if (!document.getElementsByClassName("edit-sidebar-popup-active").length)
          // Show only layers for the currently highlighted label
          annotator.hide("visualization", annotator.labels);
        annotator.hide("objectVisualization", annotator.labels);
        annotator.hide("annotatedObjects", annotator.labels);
        annotator.hideAllObjectLayers();
        annotator.show("visualization", [index]);
        annotator.show("annotatedObjects", [index]);

        // If the Object Visualization button is on, show the objectVisualizationLayer as well
        var objVisButtonID = document.getElementById("objectVisualization-button");
        if (objVisButtonID.classList.contains("edit-image-top-button-enabled")) {
          annotator.show("objectVisualization", [index]);
        }
      });
      pickButton.addEventListener('mouseleave', function () {
        if (!document.getElementsByClassName("edit-sidebar-popup-active").length)
          // Show only layers for the current label
          annotator.hide("visualization", annotator.labels);
        annotator.hide("objectVisualization", annotator.labels);
        annotator.hide("annotatedObjects", annotator.labels);
        annotator.show("visualization", [annotator.currentLabel]);
        annotator.show("annotatedObjects", [annotator.currentLabel]);

        annotator.correctDisplay();
      });
      return pickButton;
    }

    // Creates object viewing section
    function createObjectsViewer(annotator) {
      var container = document.createElement("div"),
        list = document.createElement("select"),
        spacer1 = document.createElement("div"),
        onlySelect = document.createElement("input"),
        label = document.createTextNode("Show only selected");

      // Create object viewing list
      list.id = "objects-viewer";
      list.addEventListener('mousemove', function (ev) {
        var value = parseInt(ev.target.value);
        if (isNaN(value)) return;
        annotator.showObjectLayer(value - 1);
      });

      list.addEventListener('mouseleave', function () {
        annotator.correctDisplay();
      });

      list.addEventListener('click', function () {
        annotator.correctDisplay();
      });

      list.setAttribute("size", annotator.labels.length + 9);
      list.setAttribute("style", "width: 150px;");

      // Create Show only selected option
      spacer1.className = "edit-sidebar-spacer";
      onlySelect.type = "checkbox";
      onlySelect.id = "onlyShowSelected";
      onlySelect.addEventListener('click', function () {
        if (isNaN(annotator.getCurrentSelectedObject())) return;
        annotator.correctDisplay();
      });

      container.className = "edit-sidebar";

      container.appendChild(list);
      container.appendChild(spacer1);
      container.appendChild(onlySelect);
      container.appendChild(label);

      return container;
    }

    // Write the brush tool
    Annotator.prototype.brush = function (pos, label) {
      var offsets = [], labels = [], objectNumbers = [];
      for (var y = -2; y <= 2; y++) {
        for (var x = -2; x <= 2; x++) {
          // Circle
          if ((x * x + y * y) > 7) continue;
          var offset = 4 * ((pos[1] + y) * this.layers[this.currentLabel].visualization.canvas.width + (pos[0] + x));
          offsets.push(offset);
          labels.push(label); // we do not need to use a labels list with the multi label layers. To do: remove this list and use a single label in updateannotation.
          objectNumbers.push(this.currentObjectNumber[label]);
        }
      }
      this._updateAnnotation(offsets, labels, objectNumbers);
      this.layers[this.currentLabel].visualization.render();
      if (typeof this.onchange === "function")
        this.onchange.call(this);
    };

    // Create the label picker button.
    function createLabelPicker(params, data, annotator) {
      var container = document.createElement("div");
      container.className = "edit-sidebar-label-picker";
      for (var i = 0; i < data.labels.length; ++i) {
        var labelButton = createLabelButton(data, data.labels[i], i, annotator);
        if (i === 0) {
          annotator.currentLabel = 0;
          labelButton.classList.add("edit-sidebar-button-selected");
        }
        container.appendChild(labelButton);
      }
      window.addEventListener("click", cancelPopup, true);
      return container;
    }

    // Cancel popup.
    function cancelPopup(event) {
      var isOutsidePopup = true,
        target = event.target;
      while (target.parentNode) {
        isOutsidePopup = isOutsidePopup &&
          !target.classList.contains("edit-sidebar-popup");
        target = target.parentNode;
      }
      if (isOutsidePopup) {
        var popups = document.getElementsByClassName("edit-sidebar-popup-active"),
          i;
        if (popups.length)
          for (i = 0; i < popups.length; ++i)
            popups[i].classList.remove("edit-sidebar-popup-active");
      }
    }

    // Create the relabel selector (by clicking the + beside a label's text)
    // The "Relabel selector" is the dropdown menu attached to each label on the sidebar
    // that allows the user to rename the label.
    function createRelabelSelector(data, index, annotator, popupContainer) {
      var select = document.createElement("select"),
        firstOption = document.createElement("option"),
        i;
      firstOption.appendChild(document.createTextNode("Change to"));
      select.appendChild(firstOption);
      for (i = 0; i < data.labels.length; ++i) {
        if (i !== index) {
          var option = document.createElement("option");
          option.value = i.toString();
          option.appendChild(document.createTextNode(data.labels[i]));
          select.appendChild(option);
        }
      }
      select.addEventListener("change", function (event) {
        var sourceLabel = index;
        var targetLabel = parseInt(event.target.value, 10);
        if (sourceLabel !== targetLabel) {
          var currentLabel = annotator.currentLabel;
          annotator.currentLabel = targetLabel;
          annotator.fill(sourceLabel);
          annotator.currentLabel = currentLabel;
        }
        popupContainer.classList.remove("edit-sidebar-popup-active");
        firstOption.selected = true;
        event.preventDefault();
      });
      return select;
    }

    // Download trick.
    function downloadURI(uri, filename) {
      var anchor = document.createElement("a");
      anchor.style.display = "none";
      anchor.target = "_blank"; // Safari doesn't work.
      anchor.download = filename;
      anchor.href = uri;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }

    // Entry point. When we click on an image from the index.html page, this is where the edit page starts
    // Given the data and params we render the image, the annotator, the annotation layer,
    function render(data, params) {

      var id = parseInt(params.id, 10);

      for (var i = 0; i < data.labels.length; i++) {
        data.labels[i] = data.labels[i].replace(/ /g, '_');
      }

      if (isNaN(id))
        throw ("Invalid id");

      // This is where the annotation events are defined: mouse move, change, right click, and on load
      // Annotator also creates the canvas layers: image, annotation, visualization, boundary, and superpixel (in segment-annotator.js)
      var annotator = new Annotator(data.imageURLs[id], {
        annotateURL: data.annotateURL,
        width: params.width,
        height: params.height,
        labels: data.labels,
        colormap: data.colormap, // the list of colors for each label
        superpixelOptions: { method: "slic", regionSize: 25 },
        onload: function () {
          // Check if there are previous annotations ??
          if ('annotationURLs' in data) {
            // Read metadata from the annotation file
            // this describes where in the file each layer is encoded.
            //var pngURI = "file://" + window.location.pathname.slice(0, -10) + data.annotationURLs[id];
            var pngURI = window.location.pathname.slice(0, -10) + data.annotationURLs[id];
            var xhr = new XMLHttpRequest();
            xhr.open("GET", pngURI);
            xhr.responseType = "arraybuffer";
            xhr.onload = function () {

              if (xhr.status == 404) return;

              var view = new DataView(xhr.response);
              var dataLength = view.getUint32(33);
              var pngData = "";
              for (var i = 0; i < dataLength; i++) {
                pngData += String.fromCharCode(view.getUint8(i + 41));
              }
              pngData = JSON.parse(pngData);
              annotator.importTiles(data, id, convert(pngData));
            };
            xhr.send();

            annotator.hide("boundary");
            annotator.hide("objectVisualization", this.labels);
            annotator.hide("visualization", this.labels);
            annotator.hide("annotatedObjects", this.labels);
            annotator.hideAllObjectLayers();

            annotator.show("visualization", [this.defaultLabel]);
            annotator.show("annotatedObjects", [this.defaultLabel]);
          }
          boundaryFlash();
        },
        onchange: function () {
          var activeLabel = this.currentLabel,
            legendClass = "edit-sidebar-legend-label", // This class is for the label names of all labels
            legendActiveClass = "edit-sidebar-legend-label-active", // This is the class of the label names of active labels
            elements = document.getElementsByClassName(legendClass),  // Gets label names of all labels
            i;

          for (i = 0; i < elements.length; ++i)
            elements[i].classList.remove(legendActiveClass);
          elements[activeLabel].classList.add(legendActiveClass);  // Make only labels in activeLabels active ??@@
        },
      });

      //var imageLayer = new Layer(data.imageURLs[id], {
      //      width: params.width,
      //      height: params.height
      //    });

      document.body.appendChild(createNavigationMenu(params, data, annotator));
      document.body.appendChild(createMainDisplay(params,
        data,
        annotator, annotator.layers.image));
      //imageLayer)); //? Why is a new object created in the original code?
    }

    function convert(obj) {
      const result = {};
      Object.keys(obj).forEach(function (key) {
        result[key.replace(/ /g, '_')] = obj[key];
      });

      return result;
    }

    return render;
  });
