FROM phusion/baseimage:bionic-1.0.0

RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt -y install nodejs gzip tmux unzip ffmpeg nginx
# RUN curl https://rclone.org/install.sh | bash -

WORKDIR /tmp/
RUN apt -y install build-essential wget && \
    wget https://github.com/eradman/entr/archive/refs/tags/5.1.tar.gz && \
    tar xf 5.1.tar.gz && \
    cd entr* && \
    ./configure && make && make install && \
    apt -y purge build-essential wget
ENV ENTR_INOTIFY_WORKAROUND 1

WORKDIR /server/
COPY bundled bundled

COPY container/etc/service/server/run /etc/service/server/run
RUN chmod +x /etc/service/server/run
COPY container/etc/service/nginx/run /etc/service/nginx/run
RUN chmod +x /etc/service/nginx/run
COPY container/etc/nginx/nginx.conf /etc/nginx/nginx.conf
# COPY container/etc/nginx/sites-available/default /etc/nginx/sites-available/default
# COPY container/rclone_command /root/
# RUN chmod +x /root/rclone_command
# COPY container/rclone_command_quiet /root/
# RUN chmod +x /root/rclone_command_quiet
# COPY container/rclone_cron /etc/cron.d/

RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

CMD ["/sbin/my_init", "--quiet"]

# vim: tw=0
