#!/bin/sh

# civey deploy script

# source nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# change to script dir
cd $( dirname $0 );

# update
git pull;

# npm install
npm install;

# restart or start daemon with https://www.npmjs.com/package/forever
forever restart omat-feedback;
if [ $? -ne 0 ]; then
  forever --uid omat-feedback -a start ./feedback.js;
fi;

# alert the internets
curl -X POST --data-urlencode 'payload={"channel": "#data-notify", "username": "deploybot", "text": "omat-feedback deployed", "icon_emoji": ":white_check_mark:"}' https://hooks.slack.com/services/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;

