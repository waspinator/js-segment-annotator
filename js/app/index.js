/** Index page renderer.
 */
define(["../helper/pagination",
  "../helper/segment-viewer",
  "../helper/util"],
  function (Pagination, Viewer, util) {
    // Create the container for the list of labels users can select from
    function createLabelOptions(params, labels) {
      var container = document.createElement("p"),
        select = document.createElement("select"),
        option;
      {
        option = document.createElement("option");
        option.appendChild(document.createTextNode("all"));
        select.appendChild(option);
      }
      for (var i = 0; i < labels.length; ++i) {
        option = document.createElement("option");
        option.appendChild(document.createTextNode(labels[i]));
        if (labels[i] === params.label) {
          option.selected = true;
        }
        select.appendChild(option);
      }
      select.onchange = function (event) {
        window.location = util.makeQueryParams(params, {
          label: (event.target.value === "all") ? null : event.target.value
        });
      };
      //container.appendChild(select);
      return container;
    }

    // Create the index page containing thumbnails of all images that can be annotated
    function render(data, params) {
      var pagination = new Pagination(data.imageURLs.length, params);
      // Create the top of the page containing "Prev and Next" navigation links
      document.body.appendChild(pagination.render());
      // Create the side panel containing the list of labels to select from
      document.body.appendChild(createLabelOptions(params, data.labels));

      var showIndexCount = true, showAnnotated = true;
      if ('indexInfo' in data) {
        if ('showIfAnnotatedFileFound' in data.indexInfo) {
          showAnnotated = data.indexInfo.showIfAnnotatedFileFound;
        }
        if ('showIndexCount' in data.indexInfo) {
          showIndexCount = data.indexInfo.showIndexCount;
        }
      }

      for (var i = pagination.begin(); i < pagination.end(); ++i) {
        // show a list of all images that are available to be annotated with an index for each (viewer is a function in segment-viewer.js)

        var viewer = new Viewer(data.imageURLs[i], data.annotationURLs[i], {
          width: (params.width || 240),
          height: (params.height || 320),
          colormap: data.colormap,
          labels: data.labels,
          excludedLegends: [0],
          showIndexCount: showIndexCount,
          showAnnotated: showAnnotated,
          overlay: i.toString()
        }),
          anchor = document.createElement("a");

        anchor.appendChild(viewer.container);
        // Link each image to the edit function with parameter id=i
        anchor.href = util.makeQueryParams({ view: "edit", id: i });
        document.body.appendChild(anchor);
      }
    }

    return render;
  });
