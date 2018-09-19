#!/usr/bin/env python3

__version__ = "0.1.0"
__license__ = "GPLv3"
__status__ = "Prototype"

import datetime
import json
import os
import re
import fnmatch

DATA_DIR = '../data'
IMAGE_DIR = os.path.join(DATA_DIR, 'images')
ANNOTATION_DIR = os.path.join(DATA_DIR, 'annotations')

ANNOTATOR_CATEGORIES = [
    'skin',
    'hair',
    'dress'
]

def main():
    """ Main entry point of the app """

    data_output = {
        "labels": ANNOTATOR_CATEGORIES,
        "imageURLs": [],
        "annotationURLs": []
    }

    for root, directories, files in os.walk(IMAGE_DIR):
        file_types = ['*.jpeg', '*.jpg']
        file_types = r'|'.join([fnmatch.translate(x) for x in file_types])
        files = [os.path.join(root, f) for f in files]
        files = [f for f in files if re.match(file_types, f)]

        # go through each image
        for i, filename in enumerate(files):
            basename_no_extension = os.path.splitext(
                os.path.basename(filename))[0]

            data_output["imageURLs"].append('data/images/' + os.path.basename(filename))
            data_output["annotationURLs"].append('data/annotations/' + basename_no_extension + '.png')

    with open('{}/data.json'.format(DATA_DIR), 'w') as output_json_file:
        json.dump(data_output, output_json_file)

if __name__ == "__main__":
    main()
