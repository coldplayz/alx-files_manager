#!/usr/bin/env bash
# copy specified files to directory provided on the CLI

echo Enter director to copy to:
read -r dir

src="controllers/ image_upload.py interactive.js routes/ utils/ server.js"
dest="../.backups/files_manager/$dir"

# echo $link

cp -r $src $dest
