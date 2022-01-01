FROM phusion/baseimage:bionic-1.0.0

RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get -y install nodejs gzip tmux unzip ffmpeg nginx
# RUN curl https://rclone.org/install.sh | bash -

WORKDIR /server
ADD package.json .
RUN npm i --silent
ADD . .
RUN npm run build

COPY container/etc/service/server/run /etc/service/server/run
RUN chmod +x /etc/service/server/run
COPY container/etc/service/nginx/run /etc/service/nginx/run
RUN chmod +x /etc/service/nginx/run
COPY container/etc/nginx/nginx.conf /etc/nginx/nginx.conf

COPY test.json /downloads/test.json

# COPY container/etc/nginx/sites-available/default /etc/nginx/sites-available/default
# COPY container/rclone_command /root/
# RUN chmod +x /root/rclone_command
# COPY container/rclone_command_quiet /root/
# RUN chmod +x /root/rclone_command_quiet
# COPY container/rclone_cron /etc/cron.d/

RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# ARG VERSION
# ENV VERSION=$VERSION
# ARG GIT_COMMIT
# ENV GIT_COMMIT=$GIT_COMMIT
# ARG BUILD_DATE
# ENV BUILD_DATE=$BUILD_DATE

CMD ["/sbin/my_init", "--quiet"]
