FROM python:3.12-alpine

RUN apk add --no-cache g++ make

RUN adduser -D -u 1000 judge

WORKDIR /judge

COPY judge/judge.py ./judge.py
COPY judge/server.py ./server.py

RUN chown -R judge:judge /judge

USER judge

EXPOSE 8080

CMD ["python3", "server.py"]
