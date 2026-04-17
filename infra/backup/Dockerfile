# Imagem leve com pg_dump + mc (MinIO client) + cron.
FROM alpine:3.19

RUN apk add --no-cache \
      postgresql16-client \
      curl \
      tzdata \
      dcron \
  && curl -sSLo /usr/local/bin/mc https://dl.min.io/client/mc/release/linux-amd64/mc \
  && chmod +x /usr/local/bin/mc

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Schedule: todo dia às 03:00 UTC
RUN echo "0 3 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root

# Entrypoint: inicia cron em foreground e tail do log
CMD ["sh", "-c", "touch /var/log/backup.log && crond -f -d 8 & tail -F /var/log/backup.log"]
