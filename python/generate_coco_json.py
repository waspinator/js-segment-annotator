#!/usr/bin/env python3

__version__ = "0.1.0"
__license__ = "GPLv3"
__status__ = "Prototype"

import datetime
import json
import os
import re
import fnmatch
from skimage import morphology, filters
from PIL import Image
import numpy as np
from annotation_data import AnnotationData
from annotation_data import get_metadata
from pycococreatortools import pycococreatortools

DATA_DIR = '../data'
IMAGE_DIR = '../data/images'
ANNOTATION_DIR = '../data/annotations'

INFO = {
    "description": "Example Dataset",
    "url": "https://github.com/waspinator/js-segment-annotator",
    "version": "0.1.0",
    "year": 2018,
    "contributor": "waspinator",
    "date_created": datetime.datetime.utcnow().isoformat(' ')
}

LICENSES = [
    {
        "id": 1,
        "name": "Attribution-NonCommercial-ShareAlike License",
        "url": "http://creativecommons.org/licenses/by-nc-sa/2.0/"
    }
]

CATEGORIES = [
    {
        'id': 1,
        'name': 'skin',
        'supercategory': 'human'
    },
    {
        'id': 2,
        'name': 'hair',
        'supercategory': 'human'
    },
    {
        'id': 3,
        'name': 'dress',
        'supercategory': 'clothes'
    }
]

ANNOTATOR_CATEGORIES = {
    'skin': {'id': 1, 'is_crowd': False},
    'hair': {'id': 2, 'is_crowd': False},
    'dress': {'id': 3, 'is_crowd': False},
}


def main():
    """ Main entry point of the app """

    coco_output = {
        "info": INFO,
        "licenses": LICENSES,
        "categories": CATEGORIES,
        "images": [],
        "annotations": []
    }

    segmentation_id = 1
    image_id = 1

    for root, directories, files in os.walk(IMAGE_DIR):
        file_types = ['*.jpeg', '*.jpg']
        file_types = r'|'.join([fnmatch.translate(x) for x in file_types])
        files = [os.path.join(root, f) for f in files]
        files = [f for f in files if re.match(file_types, f)]

        # go through each image
        for i, filename in enumerate(files):
            print(filename)
            parent_directory = root.split(os.path.sep)[-1]
            basename_no_extension = os.path.splitext(
                os.path.basename(filename))[0]
            image = Image.open(filename)
            image_info = pycococreatortools.create_image_info(
                image_id, os.path.basename(filename), image.size)
            coco_output["images"].append(image_info)

            # go through each associated annotation
            for root, directories, files in os.walk(ANNOTATION_DIR):
                file_types = ['*.png']
                file_types = r'|'.join([fnmatch.translate(x)
                                        for x in file_types])
                file_name_prefix = basename_no_extension + '.*'
                files = [os.path.join(root, f) for f in files]
                files = [f for f in files if re.match(file_types, f)]
                files = [f for f in files if re.match(
                    file_name_prefix, os.path.splitext(os.path.basename(f))[0])]

                for filename in files:
                    parent_directory = root.split(os.path.sep)[-1]
                    basename_no_extension = os.path.splitext(
                        os.path.basename(filename))[0]
                    annotation_array = np.array(Image.open(filename))
                    # load annotation information
                    annotation_metadata = get_metadata(filename)
                    annotation_data = AnnotationData(
                        annotation_array, annotation_metadata)
                    object_classes = annotation_data.get_classes()

                    # go through each class
                    for j, object_class in enumerate(object_classes):
                        if ANNOTATOR_CATEGORIES.get(object_class) == None:
                            print("missing: {}".format(object_class))
                            continue

                        # go through each object
                        for object_instance in range(object_classes[object_class]):
                            object_mask = annotation_data.get_mask(
                                object_class, object_instance)
                            if object_mask is not None:
                                object_mask = object_mask.astype(np.uint8)

                                annotation_info = pycococreatortools.create_annotation_info(segmentation_id, image_id,
                                                                                            ANNOTATOR_CATEGORIES.get(object_class), object_mask, image.size, tolerance=2)

                                if annotation_info is not None:
                                    coco_output["annotations"].append(
                                        annotation_info)
                                    segmentation_id = segmentation_id + 1

            image_id = image_id + 1

    with open('{}/coco.json'.format(DATA_DIR), 'w') as output_json_file:
        json.dump(coco_output, output_json_file)


if __name__ == "__main__":
    main()
