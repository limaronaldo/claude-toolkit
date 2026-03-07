FROM python:3.12-slim
RUN apt-get update && \
    apt-get install -y --no-install-recommends git ca-certificates && \
    rm -rf /var/lib/apt/lists/*
COPY python/claude_primer.py /usr/local/lib/claude_primer.py
RUN printf '#!/bin/sh\nexec python3 /usr/local/lib/claude_primer.py "$@"\n' > /usr/local/bin/claude-primer && \
    chmod +x /usr/local/bin/claude-primer
WORKDIR /project
ENTRYPOINT ["claude-primer"]
CMD ["--help"]
