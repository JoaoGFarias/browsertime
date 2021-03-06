FROM sitespeedio/webbrowsers:firefox-53.0-chrome-58.0-2

ENV BROWSERTIME_XVFB true
ENV BROWSERTIME_CONNECTIVITY__ENGINE tc
ENV BROWSERTIME_CHROME__ARGS no-sandbox

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

VOLUME /browsertime-results

COPY package.json /usr/src/app/
RUN npm install --production
COPY . /usr/src/app

## This is to avoid click the OK button
RUN mkdir -m 0750 /root/.android
ADD docker/adb/insecure_shared_adbkey /root/.android/adbkey
ADD docker/adb/insecure_shared_adbkey.pub /root/.android/adbkey.pub

WORKDIR /

COPY docker/scripts/start.sh /start.sh

ENTRYPOINT ["/start.sh"]
